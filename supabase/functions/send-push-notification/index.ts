import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

type PushRequest = {
  body: string
  metadata?: Record<string, unknown>
  title: string
  url?: string
  user_id: string
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
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:suporte@bwbarber.app'

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey) {
    return jsonResponse({ error: 'Push não configurado no ambiente.' }, 503)
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

  let payload: PushRequest

  try {
    payload = await request.json()
  } catch {
    return jsonResponse({ error: 'Corpo da requisição inválido.' }, 400)
  }

  if (!payload.user_id || payload.user_id !== user.id || !payload.title || !payload.body) {
    return jsonResponse({ error: 'Solicitação de push inválida.' }, 403)
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

  const adminClient = createClient(supabaseUrl, serviceRoleKey)
  const { data: subscriptions, error: subscriptionsError } = await adminClient
    .from('push_subscriptions')
    .select('id,endpoint,p256dh,auth')
    .eq('user_id', payload.user_id)
    .eq('is_active', true)

  if (subscriptionsError) {
    return jsonResponse({ error: 'Não foi possível localizar dispositivos.' }, 500)
  }

  const notificationPayload = JSON.stringify({
    body: payload.body,
    metadata: payload.metadata ?? {},
    title: payload.title,
    url: payload.url ?? '/app/dashboard',
  })

  let sent = 0
  let disabled = 0

  await Promise.all(
    (subscriptions ?? []).map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { auth: subscription.auth, p256dh: subscription.p256dh },
          },
          notificationPayload,
        )
        sent += 1
      } catch (error) {
        const statusCode =
          typeof error === 'object' && error !== null && 'statusCode' in error
            ? Number(error.statusCode)
            : 0

        if (statusCode === 404 || statusCode === 410) {
          disabled += 1
          await adminClient
            .from('push_subscriptions')
            .update({ is_active: false })
            .eq('id', subscription.id)
        }
      }
    }),
  )

  return jsonResponse({ disabled, sent })
})
