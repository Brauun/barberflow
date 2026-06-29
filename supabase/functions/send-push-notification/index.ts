import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

type SelfPushRequest = {
  body: string
  metadata?: Record<string, unknown>
  title: string
  url?: string
  user_id: string
}

type AppointmentCreatedPushRequest = {
  appointment_id: string
  event: 'appointment_created'
}

type PushRequest = SelfPushRequest | AppointmentCreatedPushRequest

type PushSubscriptionRow = {
  auth: string
  endpoint: string
  id: string
  p256dh: string
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

function isAppointmentCreatedRequest(
  payload: PushRequest,
): payload is AppointmentCreatedPushRequest {
  return 'event' in payload && payload.event === 'appointment_created'
}

function errorStatusCode(error: unknown) {
  return typeof error === 'object' && error !== null && 'statusCode' in error
    ? Number(error.statusCode)
    : 0
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 500) : 'Falha desconhecida no provedor push.'
}

function localAppointmentLabels(startsAt: string) {
  const date = new Date(startsAt)
  const dateLabel = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(date)
  const timeLabel = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(date)
  const dateParts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
  }).formatToParts(date)
  const valueByPart = Object.fromEntries(dateParts.map((part) => [part.type, part.value]))

  return {
    dateInput: `${valueByPart.year}-${valueByPart.month}-${valueByPart.day}`,
    dateLabel,
    timeLabel,
  }
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

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  if (!isAppointmentCreatedRequest(payload)) {
    if (!payload.user_id || payload.user_id !== user.id || !payload.title || !payload.body) {
      return jsonResponse({ error: 'Solicitação de push inválida.' }, 403)
    }

    const { data: subscriptions, error: subscriptionsError } = await adminClient
      .from('push_subscriptions')
      .select('id,user_id,endpoint,p256dh,auth')
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
      ((subscriptions ?? []) as PushSubscriptionRow[]).map(async (subscription) => {
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
          const statusCode = errorStatusCode(error)

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
  }

  if (!payload.appointment_id) {
    return jsonResponse({ error: 'Agendamento não informado.' }, 400)
  }

  const { data: appointment, error: appointmentError } = await adminClient
    .from('appointments')
    .select('id,empresa_id,barbeiro_id,client_profile_id,starts_at')
    .eq('id', payload.appointment_id)
    .maybeSingle()

  if (appointmentError || !appointment) {
    return jsonResponse({ error: 'Agendamento não encontrado.' }, 404)
  }

  const { data: ownerProfile } = await adminClient
    .from('profiles')
    .select('id,nome')
    .eq('id', appointment.client_profile_id)
    .eq('auth_user_id', user.id)
    .eq('role', 'cliente')
    .maybeSingle()

  if (!ownerProfile) {
    return jsonResponse({ error: 'Sem permissão para notificar este agendamento.' }, 403)
  }

  const { data: appointmentItem } = await adminClient
    .from('appointment_items')
    .select('nome')
    .eq('appointment_id', appointment.id)
    .limit(1)
    .maybeSingle()

  const { data: barber } = await adminClient
    .from('barbeiros')
    .select('usuario_id')
    .eq('id', appointment.barbeiro_id)
    .eq('empresa_id', appointment.empresa_id)
    .eq('status', 'ativo')
    .maybeSingle()
  const { data: companyUsers, error: companyUsersError } = await adminClient
    .from('usuarios')
    .select('id,auth_user_id,papel')
    .eq('empresa_id', appointment.empresa_id)
    .eq('status', 'ativo')

  if (companyUsersError) {
    return jsonResponse({ error: 'Não foi possível localizar os destinatários.' }, 500)
  }

  const recipientAuthUserIds = [
    ...new Set(
      (companyUsers ?? [])
        .filter(
          (companyUser) =>
            companyUser.papel === 'administrador' || companyUser.id === barber?.usuario_id,
        )
        .map((companyUser) => companyUser.auth_user_id)
        .filter((authUserId): authUserId is string => Boolean(authUserId && authUserId !== user.id)),
    ),
  ]

  if (!recipientAuthUserIds.length) {
    return jsonResponse({ disabled: 0, recipients: 0, sent: 0 })
  }

  const { data: subscriptions, error: subscriptionsError } = await adminClient
    .from('push_subscriptions')
    .select('id,user_id,endpoint,p256dh,auth')
    .in('user_id', recipientAuthUserIds)
    .eq('is_active', true)

  if (subscriptionsError) {
    return jsonResponse({ error: 'Não foi possível localizar dispositivos ativos.' }, 500)
  }

  const subscriptionsByUser = new Map<string, PushSubscriptionRow[]>()

  for (const subscription of (subscriptions ?? []) as PushSubscriptionRow[]) {
    const current = subscriptionsByUser.get(subscription.user_id) ?? []
    current.push(subscription)
    subscriptionsByUser.set(subscription.user_id, current)
  }

  const labels = localAppointmentLabels(appointment.starts_at)
  const clientName = ownerProfile.nome?.trim() || 'Novo cliente'
  const serviceName = appointmentItem?.nome?.trim()
  const pushBody = serviceName
    ? `${clientName} agendou ${serviceName} para ${labels.dateLabel} às ${labels.timeLabel}.`
    : `${clientName} criou um novo agendamento para ${labels.dateLabel} às ${labels.timeLabel}.`
  const notificationPayload = JSON.stringify({
    body: pushBody,
    metadata: {
      appointment_id: appointment.id,
      barber_id: appointment.barbeiro_id,
      event: 'appointment_created',
      starts_at: appointment.starts_at,
    },
    title: 'Novo agendamento confirmado',
    url: `/app/atendimentos?appointmentId=${appointment.id}&barberId=${appointment.barbeiro_id}&date=${labels.dateInput}`,
  })
  let sent = 0
  let disabled = 0
  let recipients = 0

  await Promise.all(
    recipientAuthUserIds.map(async (recipientAuthUserId) => {
      const recipientSubscriptions = subscriptionsByUser.get(recipientAuthUserId) ?? []

      if (!recipientSubscriptions.length) {
        return
      }

      const { data: deliveryLog, error: deliveryLogError } = await adminClient
        .from('push_delivery_logs')
        .insert({
          appointment_id: appointment.id,
          empresa_id: appointment.empresa_id,
          event_type: 'appointment_created',
          recipient_auth_user_id: recipientAuthUserId,
          status: 'processando',
        })
        .select('id')
        .single()

      if (deliveryLogError?.code === '23505') {
        return
      }

      if (deliveryLogError || !deliveryLog) {
        console.error(JSON.stringify({
          action: 'appointment_push_claim_failed',
          appointmentId: appointment.id,
          area: 'push',
          level: 'error',
        }))
        return
      }

      recipients += 1
      let recipientSent = 0
      const recipientErrors: string[] = []

      await Promise.all(
        recipientSubscriptions.map(async (subscription) => {
          try {
            await webpush.sendNotification(
              {
                endpoint: subscription.endpoint,
                keys: { auth: subscription.auth, p256dh: subscription.p256dh },
              },
              notificationPayload,
            )
            recipientSent += 1
            sent += 1
          } catch (error) {
            const statusCode = errorStatusCode(error)
            recipientErrors.push(`${statusCode || 'provider'}: ${errorMessage(error)}`)

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

      const deliveryStatus = recipientSent > 0 ? 'enviado' : 'falhou'
      const deliveryError = recipientErrors.length ? recipientErrors.join(' | ').slice(0, 1000) : null

      await adminClient
        .from('push_delivery_logs')
        .update({
          error_message: deliveryError,
          sent_devices: recipientSent,
          status: deliveryStatus,
        })
        .eq('id', deliveryLog.id)

      if (deliveryStatus === 'falhou') {
        console.error(JSON.stringify({
          action: 'appointment_push_send_failed',
          appointmentId: appointment.id,
          area: 'push',
          level: 'error',
        }))
      }
    }),
  )

  return jsonResponse({ disabled, recipients, sent })
})
