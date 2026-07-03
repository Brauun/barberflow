import { createClient } from 'jsr:@supabase/supabase-js@2'

type CheckoutRequest = {
  empresa_id?: unknown
  plan_id?: unknown
}

type MercadoPagoPreferenceResponse = {
  id?: string
  init_point?: string
  message?: string
}

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  )
}

function getAppBaseUrl(rawUrl: string) {
  const url = new URL(rawUrl)

  if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    throw new Error('APP_BASE_URL precisa usar HTTPS.')
  }

  return url.origin
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Método não permitido.' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const mercadoPagoAccessToken = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN')
  const appBaseUrlValue = Deno.env.get('APP_BASE_URL')

  if (
    !supabaseUrl ||
    !anonKey ||
    !serviceRoleKey ||
    !mercadoPagoAccessToken ||
    !appBaseUrlValue
  ) {
    return jsonResponse({ error: 'Checkout ainda não configurado neste ambiente.' }, 503)
  }

  let appBaseUrl: string

  try {
    appBaseUrl = getAppBaseUrl(appBaseUrlValue)
  } catch {
    return jsonResponse({ error: 'URL pública do aplicativo inválida.' }, 503)
  }

  const authorization = request.headers.get('Authorization')

  if (!authorization) {
    return jsonResponse({ error: 'Não autorizado.' }, 401)
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  })
  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser()

  if (userError || !user) {
    return jsonResponse({ error: 'Sessão inválida.' }, 401)
  }

  let payload: CheckoutRequest

  try {
    payload = await request.json()
  } catch {
    return jsonResponse({ error: 'Corpo da requisição inválido.' }, 400)
  }

  if (!isUuid(payload.empresa_id) || !isUuid(payload.plan_id)) {
    return jsonResponse({ error: 'Empresa ou plano inválido.' }, 400)
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey)
  const { data: adminProfile, error: adminError } = await adminClient
    .from('usuarios')
    .select('id')
    .eq('auth_user_id', user.id)
    .eq('empresa_id', payload.empresa_id)
    .eq('papel', 'administrador')
    .eq('status', 'ativo')
    .maybeSingle()

  if (adminError) {
    console.error('mercadopago checkout admin validation failed', {
      code: adminError.code,
      userId: user.id,
    })
    return jsonResponse({ error: 'Não foi possível validar sua permissão.' }, 500)
  }

  if (!adminProfile) {
    return jsonResponse({ error: 'Apenas o administrador da empresa pode assinar um plano.' }, 403)
  }

  const [{ data: subscription, error: subscriptionError }, { data: plan, error: planError }] =
    await Promise.all([
      adminClient
        .from('subscriptions')
        .select('id,empresa_id,plan_id,status')
        .eq('empresa_id', payload.empresa_id)
        .maybeSingle(),
      adminClient
        .from('plans')
        .select('id,name,description,monthly_price,is_active')
        .eq('id', payload.plan_id)
        .eq('is_active', true)
        .maybeSingle(),
    ])

  if (subscriptionError || planError) {
    console.error('mercadopago checkout data lookup failed', {
      empresaId: payload.empresa_id,
      planCode: planError?.code,
      subscriptionCode: subscriptionError?.code,
    })
    return jsonResponse({ error: 'Não foi possível carregar os dados da assinatura.' }, 500)
  }

  if (!subscription) {
    return jsonResponse({ error: 'Assinatura da empresa não encontrada.' }, 404)
  }

  if (!plan) {
    return jsonResponse({ error: 'Plano não encontrado ou inativo.' }, 404)
  }

  const amount = Number(plan.monthly_price)

  if (!Number.isFinite(amount) || amount <= 0) {
    return jsonResponse({ error: 'Este plano não possui um valor válido para checkout.' }, 422)
  }

  const timestamp = Date.now()
  const externalReference = `${payload.empresa_id}_${subscription.id}_${plan.id}_${timestamp}`
  const returnUrl = `${appBaseUrl}/app/assinatura/retorno`
  const notificationUrl = `${supabaseUrl}/functions/v1/mercadopago-webhook?source_news=webhooks`

  const mercadoPagoResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
    body: JSON.stringify({
      auto_return: 'approved',
      back_urls: {
        failure: `${returnUrl}?resultado=failure`,
        pending: `${returnUrl}?resultado=pending`,
        success: `${returnUrl}?resultado=success`,
      },
      external_reference: externalReference,
      items: [
        {
          currency_id: 'BRL',
          description: plan.description || `Assinatura mensal do plano ${plan.name}.`,
          id: plan.id,
          quantity: 1,
          title: `BW Barber - ${plan.name}`,
          unit_price: amount,
        },
      ],
      metadata: {
        empresa_id: payload.empresa_id,
        plan_id: plan.id,
        subscription_id: subscription.id,
      },
      notification_url: notificationUrl,
      payer: user.email ? { email: user.email } : undefined,
      statement_descriptor: 'BW BARBER',
    }),
    headers: {
      Authorization: `Bearer ${mercadoPagoAccessToken}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': crypto.randomUUID(),
    },
    method: 'POST',
  })
  const preference = (await mercadoPagoResponse.json()) as MercadoPagoPreferenceResponse

  if (!mercadoPagoResponse.ok || !preference.id || !preference.init_point) {
    console.error('mercadopago preference creation failed', {
      empresaId: payload.empresa_id,
      mercadoPagoStatus: mercadoPagoResponse.status,
      message: preference.message ?? null,
      planId: plan.id,
      userId: user.id,
    })
    return jsonResponse({ error: 'Não foi possível iniciar o checkout. Tente novamente.' }, 502)
  }

  return jsonResponse({
    checkout_url: preference.init_point,
    preference_id: preference.id,
  })
})
