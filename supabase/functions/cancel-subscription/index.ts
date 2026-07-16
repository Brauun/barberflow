import { createClient } from 'jsr:@supabase/supabase-js@2'
import { BillingService } from '../_shared/billingService.ts'

type CancelSubscriptionRequest = {
  action?: unknown
  empresa_id?: unknown
  reason?: unknown
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

function isSupportedAction(value: unknown): value is 'cancel' | 'reactivate' {
  return value === 'cancel' || value === 'reactivate'
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Metodo nao permitido.' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse({ error: 'Servico de assinatura nao configurado.' }, 503)
  }

  const authorization = request.headers.get('Authorization')

  if (!authorization) {
    return jsonResponse({ error: 'Nao autorizado.' }, 401)
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  })
  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser()

  if (userError || !user) {
    return jsonResponse({ error: 'Sessao invalida.' }, 401)
  }

  let payload: CancelSubscriptionRequest

  try {
    payload = await request.json()
  } catch {
    return jsonResponse({ error: 'Corpo da requisicao invalido.' }, 400)
  }

  if (!isUuid(payload.empresa_id) || !isSupportedAction(payload.action)) {
    return jsonResponse({ error: 'Empresa ou acao invalida.' }, 400)
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
    console.error('cancel-subscription admin lookup failed', {
      code: adminError.code,
      userId: user.id,
    })
    return jsonResponse({ error: 'Nao foi possivel validar sua permissao.' }, 500)
  }

  if (!adminProfile) {
    return jsonResponse({ error: 'Apenas o administrador da empresa pode gerenciar a assinatura.' }, 403)
  }

  const { data: subscription, error: subscriptionError } = await adminClient
    .from('subscriptions')
    .select('id,status,current_period_end,expires_at,cancel_at_period_end,provider,provider_subscription_id')
    .eq('empresa_id', payload.empresa_id)
    .maybeSingle()

  if (subscriptionError) {
    console.error('cancel-subscription subscription lookup failed', {
      code: subscriptionError.code,
      empresaId: payload.empresa_id,
      userId: user.id,
    })
    return jsonResponse({ error: 'Nao foi possivel carregar a assinatura.' }, 500)
  }

  if (!subscription) {
    return jsonResponse({ error: 'Assinatura nao encontrada.' }, 404)
  }

  if (subscription.provider_subscription_id) {
    return jsonResponse(
      {
        error:
          'Esta assinatura possui recorrencia no provedor e ainda precisa de cancelamento integrado ao gateway.',
      },
      409,
    )
  }

  const periodEnd = subscription.current_period_end ?? subscription.expires_at
  const periodEndsAt = periodEnd ? new Date(periodEnd).getTime() : Number.NaN

  if (subscription.status !== 'ACTIVE' || !Number.isFinite(periodEndsAt) || periodEndsAt <= Date.now()) {
    return jsonResponse({ error: 'Esta assinatura nao esta em um periodo ativo cancelavel.' }, 422)
  }

  try {
    const billingService = new BillingService(adminClient)
    const reason =
      typeof payload.reason === 'string' && payload.reason.trim()
        ? payload.reason.trim()
        : payload.action === 'cancel'
        ? 'Cancelamento solicitado pelo administrador'
        : 'Reativacao solicitada pelo administrador'
    const idempotencyAction =
      payload.action === 'cancel' ? 'cancel-subscription' : 'reactivate-subscription'
    const idempotencyKey = `${idempotencyAction}:${subscription.id}:${periodEnd}`
    const data =
      payload.action === 'cancel'
        ? await billingService.cancelSubscription(
            {
              actorUserId: user.id,
              empresaId: payload.empresa_id,
              origin: 'ADMIN',
              reason,
            },
            {
              at_period_end: true,
              idempotency_key: idempotencyKey,
            },
          )
        : await billingService.reactivateSubscription(
            {
              actorUserId: user.id,
              empresaId: payload.empresa_id,
              origin: 'REATIVACAO',
              reason,
            },
            {
              idempotency_key: idempotencyKey,
            },
          )

    return jsonResponse({ data })
  } catch (error) {
    console.error('cancel-subscription billing command failed', {
      action: payload.action,
      empresaId: payload.empresa_id,
      message: error instanceof Error ? error.message : 'unknown',
      userId: user.id,
    })
    return jsonResponse({ error: 'Nao foi possivel atualizar a assinatura.' }, 500)
  }
})
