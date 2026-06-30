import { createClient } from 'jsr:@supabase/supabase-js@2'

type SelectPlanRequest = {
  empresa_id?: unknown
  plan_id?: unknown
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

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse({ error: 'Serviço de assinatura não configurado.' }, 503)
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

  let payload: SelectPlanRequest

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
    console.error('select-subscription-plan admin lookup failed', {
      code: adminError.code,
      userId: user.id,
    })
    return jsonResponse({ error: 'Não foi possível validar a permissão.' }, 500)
  }

  if (!adminProfile) {
    return jsonResponse({ error: 'Apenas administradores da empresa podem trocar o plano.' }, 403)
  }

  const { data: plan, error: planError } = await adminClient
    .from('plans')
    .select('id')
    .eq('id', payload.plan_id)
    .eq('is_active', true)
    .maybeSingle()

  if (planError) {
    console.error('select-subscription-plan plan lookup failed', {
      code: planError.code,
      userId: user.id,
    })
    return jsonResponse({ error: 'Não foi possível validar o plano.' }, 500)
  }

  if (!plan) {
    return jsonResponse({ error: 'Plano não encontrado ou inativo.' }, 404)
  }

  const { data, error } = await adminClient.rpc('apply_subscription_plan_change', {
    p_changed_by: user.id,
    p_empresa_id: payload.empresa_id,
    p_plan_id: payload.plan_id,
  })

  if (error) {
    console.error('select-subscription-plan update failed', {
      code: error.code,
      empresaId: payload.empresa_id,
      userId: user.id,
    })
    const status = error.code === 'P0002' ? 404 : 500
    return jsonResponse({ error: 'Não foi possível alterar o plano.' }, status)
  }

  return jsonResponse({ data })
})
