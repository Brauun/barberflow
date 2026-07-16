import { createClient } from 'jsr:@supabase/supabase-js@2'
import { BillingService, type BillingEventType } from '../_shared/billingService.ts'
import {
  MercadoPagoProvider,
  type MercadoPagoPayment,
} from '../_shared/mercadoPagoProvider.ts'

type MercadoPagoNotification = {
  id?: number | string
  action?: string
  api_version?: string
  data?: { id?: number | string }
  date_created?: string
  live_mode?: boolean
  type?: string
}

type ExternalReference = {
  empresaId: string
  subscriptionId: string
  planId: string
}

type PaymentMapping = {
  eventType: BillingEventType
  paymentStatus: string
}

type SignatureValidationResult = {
  signatureVersion: string | null
  valid: boolean
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status,
  })
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )
}

function parseExternalReference(value: string | null | undefined): ExternalReference | null {
  if (!value) return null

  const [empresaId, subscriptionId, planId, timestamp, ...extra] = value.split('_')

  if (
    extra.length ||
    !isUuid(empresaId) ||
    !isUuid(subscriptionId) ||
    !isUuid(planId) ||
    !/^\d{10,}$/.test(timestamp ?? '')
  ) {
    return null
  }

  return { empresaId, planId, subscriptionId }
}

function mapPaymentStatus(status: string): PaymentMapping {
  switch (status.toLowerCase()) {
    case 'approved':
      return { eventType: 'PAYMENT_APPROVED', paymentStatus: 'APPROVED' }
    case 'rejected':
      return { eventType: 'PAYMENT_REJECTED', paymentStatus: 'REJECTED' }
    case 'cancelled':
    case 'canceled':
      return { eventType: 'PAYMENT_CANCELLED', paymentStatus: 'CANCELED' }
    case 'refunded':
      return { eventType: 'PAYMENT_REFUNDED', paymentStatus: 'REFUNDED' }
    case 'charged_back':
      return { eventType: 'PAYMENT_CHARGEBACK', paymentStatus: 'CHARGEBACK' }
    case 'in_process':
    case 'authorized':
    case 'in_mediation':
      return { eventType: 'PAYMENT_PENDING', paymentStatus: 'PROCESSING' }
    default:
      return { eventType: 'PAYMENT_PENDING', paymentStatus: 'PENDING' }
  }
}

function addDays(value: string, days: number) {
  const date = new Date(value)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString()
}

function parseSignature(value: string) {
  return value.split(',').reduce<Record<string, string>>((parts, item) => {
    const separatorIndex = item.indexOf('=')
    if (separatorIndex < 1) return parts

    const key = item.slice(0, separatorIndex).trim().toLowerCase()
    const partValue = item.slice(separatorIndex + 1).trim()
    if (key && partValue) parts[key] = partValue
    return parts
  }, {})
}

function constantTimeEqual(first: string, second: string) {
  if (first.length !== second.length) return false
  let difference = 0
  for (let index = 0; index < first.length; index += 1) {
    difference |= first.charCodeAt(index) ^ second.charCodeAt(index)
  }
  return difference === 0
}

async function hmacSha256Hex(secret: string, value: string) {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { hash: 'SHA-256', name: 'HMAC' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value))
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function validateWebhookSignature(input: {
  dataId: string | null
  requestId: string | null
  secret: string
  signature: string | null
}): Promise<SignatureValidationResult> {
  const parts = input.signature ? parseSignature(input.signature) : {}
  const secret = input.secret.trim()
  const signatureVersion = parts.v1 ? 'v1' : null

  if (!input.signature || !parts.ts || !parts.v1) {
    return {
      signatureVersion,
      valid: false,
    }
  }

  // Mercado Pago signs URL/header values, not the JSON body. Missing optional
  // values must be omitted from the manifest, as prescribed by its webhook spec.
  const manifest = [
    input.dataId ? `id:${input.dataId.toLowerCase()};` : '',
    input.requestId ? `request-id:${input.requestId};` : '',
    `ts:${parts.ts};`,
  ].join('')
  const calculatedSignature = await hmacSha256Hex(secret, manifest)

  return {
    signatureVersion,
    valid: constantTimeEqual(calculatedSignature, parts.v1.toLowerCase()),
  }
}

function safeEventPayload(
  notification: MercadoPagoNotification,
  payment: MercadoPagoPayment,
) {
  return {
    action: notification.action ?? null,
    api_version: notification.api_version ?? null,
    date_created: notification.date_created ?? null,
    live_mode: notification.live_mode ?? null,
    payment: {
      currency_id: payment.currency_id ?? null,
      date_approved: payment.date_approved ?? null,
      external_reference: payment.external_reference ?? null,
      id: String(payment.id),
      payment_method_id: payment.payment_method_id ?? null,
      status: payment.status,
      status_detail: payment.status_detail ?? null,
      transaction_amount: Number(payment.transaction_amount),
    },
    type: notification.type ?? null,
  }
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Método não permitido.' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const accessToken = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN')
  const webhookSecret = Deno.env.get('MERCADO_PAGO_WEBHOOK_SECRET')?.trim()

  if (!supabaseUrl || !serviceRoleKey || !accessToken || !webhookSecret) {
    console.error(JSON.stringify({
      action: 'MERCADOPAGO_WEBHOOK_CONFIG_MISSING',
      area: 'billing',
    }))
    return jsonResponse({ error: 'Webhook não configurado.' }, 503)
  }

  let notification: MercadoPagoNotification

  try {
    notification = await request.json()
  } catch {
    return jsonResponse({ error: 'Payload inválido.' }, 400)
  }

  if (notification.type !== 'payment') {
    return jsonResponse({ ignored: true, reason: 'unsupported_event_type' })
  }

  const requestUrl = new URL(request.url)
  // Signature validation must use the value received in the URL. `data_id`
  // is accepted for compatibility with integrations/frameworks that normalize
  // dotted query keys, while the payment lookup may still use the body fallback.
  const signedDataId = requestUrl.searchParams.get('data.id')
    ?? requestUrl.searchParams.get('data_id')
  const paymentId = signedDataId ?? String(notification.data?.id ?? '')
  const requestId = request.headers.get('x-request-id')
  const signature = request.headers.get('x-signature')
  const signatureValidation = await validateWebhookSignature({
    dataId: signedDataId,
    requestId,
    secret: webhookSecret,
    signature,
  })

  if (!signatureValidation.valid) {
    console.warn(JSON.stringify({
      action: 'MERCADOPAGO_WEBHOOK_SIGNATURE_REJECTED',
      area: 'billing',
      hasDataId: Boolean(signedDataId),
      hasRequestId: Boolean(requestId),
      hasSignature: Boolean(signature),
      requestId,
      signatureVersion: signatureValidation.signatureVersion,
    }))
    return jsonResponse({ error: 'Assinatura inválida.' }, 401)
  }

  const provider = new MercadoPagoProvider(accessToken)
  let payment: MercadoPagoPayment

  try {
    payment = await provider.getPayment(paymentId) as MercadoPagoPayment
  } catch {
    console.error(JSON.stringify({
      action: 'MERCADOPAGO_PAYMENT_LOOKUP_FAILED',
      area: 'billing',
      providerPaymentId: paymentId,
    }))
    return jsonResponse({ error: 'Não foi possível consultar o pagamento.' }, 502)
  }

  const reference = parseExternalReference(payment.external_reference)

  if (!reference) {
    console.warn(JSON.stringify({
      action: 'MERCADOPAGO_EXTERNAL_REFERENCE_REJECTED',
      area: 'billing',
      providerPaymentId: String(payment.id),
    }))
    return jsonResponse({ error: 'Referência externa inválida.' }, 422)
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey)
  const { data: plan, error: planError } = await adminClient
    .from('plans')
    .select('id,monthly_price')
    .eq('id', reference.planId)
    .maybeSingle()

  if (planError || !plan) {
    return jsonResponse({ error: 'Plano do pagamento não encontrado.' }, 422)
  }

  const amount = Number(payment.transaction_amount)
  const expectedAmount = Number(plan.monthly_price)

  if (
    !Number.isFinite(amount) ||
    !Number.isFinite(expectedAmount) ||
    Math.abs(amount - expectedAmount) > 0.009 ||
    String(payment.currency_id ?? 'BRL').toUpperCase() !== 'BRL'
  ) {
    console.warn(JSON.stringify({
      action: 'MERCADOPAGO_PAYMENT_AMOUNT_REJECTED',
      area: 'billing',
      planId: reference.planId,
      providerPaymentId: String(payment.id),
    }))
    return jsonResponse({ error: 'Valor ou moeda do pagamento inválidos.' }, 422)
  }

  const status = mapPaymentStatus(payment.status)
  const approvedAt = payment.date_approved || payment.date_created || new Date().toISOString()
  const periodStart = status.eventType === 'PAYMENT_APPROVED' ? approvedAt : null
  const periodEnd = periodStart ? addDays(periodStart, 30) : null
  const providerEventId = [
    String(notification.id ?? paymentId),
    notification.action ?? 'payment',
    payment.status,
  ].join(':')

  try {
    const billingService = new BillingService(adminClient)
    const result = await billingService.processWebhook({
      empresaId: reference.empresaId,
      eventType: status.eventType,
      payload: {
        amount,
        currency: String(payment.currency_id ?? 'BRL').toUpperCase(),
        current_period_end: periodEnd,
        current_period_start: periodStart,
        due_at: payment.date_of_expiration ?? null,
        event_payload: safeEventPayload(notification, payment),
        external_reference: payment.external_reference ?? null,
        next_payment_at: periodEnd,
        paid_at: payment.date_approved ?? null,
        payment_method: payment.payment_method_id ?? null,
        payment_status: status.paymentStatus,
        plan_id: reference.planId,
        provider_invoice_id: payment.order?.id ? String(payment.order.id) : null,
        provider_payment_id: String(payment.id),
        subscription_id: reference.subscriptionId,
      },
      provider: provider.name,
      providerEventId,
    })

    return jsonResponse({ ok: true, result })
  } catch {
    console.error(JSON.stringify({
      action: 'MERCADOPAGO_WEBHOOK_PROCESSING_FAILED',
      area: 'billing',
      empresaId: reference.empresaId,
      eventType: status.eventType,
      providerEventId,
      providerPaymentId: String(payment.id),
    }))
    return jsonResponse({ error: 'Falha ao processar evento financeiro.' }, 500)
  }
})
