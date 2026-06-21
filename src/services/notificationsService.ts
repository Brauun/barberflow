import { supabase } from '../lib/supabase'
import type { Database, UserRole } from '../types/database'

export type InternalNotification =
  Database['public']['Tables']['notifications']['Row']

type NotificationEventInput = {
  empresaId: string
  type:
    | 'appointment_created'
    | 'appointment_cancelled'
    | 'appointment_rescheduled'
    | 'waitlist_joined'
    | 'waitlist_vacancy'
    | 'appointment_upcoming'
  title: string
  message: string
  metadata?: Record<string, unknown>
  barberName?: string | null
}

export async function listNotifications(input: {
  empresaId: string
  usuarioId: string
  papel: UserRole
}) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('empresa_id', input.empresaId)
    .or(`recipient_user_id.is.null,recipient_user_id.eq.${input.usuarioId}`)
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as InternalNotification[]
}

export async function markNotificationAsRead(input: {
  empresaId: string
  notificationId: string
}) {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('empresa_id', input.empresaId)
    .eq('id', input.notificationId)

  if (error) {
    throw new Error(error.message)
  }
}

export async function markAllNotificationsAsRead(input: {
  empresaId: string
  usuarioId: string
  papel: UserRole
}) {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('empresa_id', input.empresaId)
    .is('read_at', null)
    .or(`recipient_user_id.is.null,recipient_user_id.eq.${input.usuarioId}`)

  if (error) {
    throw new Error(error.message)
  }
}

export async function createInternalNotification(input: NotificationEventInput) {
  const { error } = await supabase.rpc('create_internal_notification', {
    p_barber_name: input.barberName ?? null,
    p_empresa_id: input.empresaId,
    p_message: input.message,
    p_metadata: (input.metadata ?? {}) as never,
    p_title: input.title,
    p_type: input.type,
  })

  if (error) {
    throw new Error(error.message)
  }
}
