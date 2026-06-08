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

type UsuarioRecipient = {
  id: string
  nome: string
  papel: UserRole
}

const adminRoles: UserRole[] = ['administrador', 'gerente']

function canSeeAllNotifications(role: UserRole | null | undefined) {
  return role === 'administrador' || role === 'gerente'
}

export async function listNotifications(input: {
  empresaId: string
  usuarioId: string
  papel: UserRole
}) {
  let query = supabase
    .from('notifications')
    .select('*')
    .eq('empresa_id', input.empresaId)
    .order('created_at', { ascending: false })
    .limit(30)

  if (!canSeeAllNotifications(input.papel)) {
    query = query.eq('recipient_user_id', input.usuarioId)
  }

  const { data, error } = await query

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
  let query = supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('empresa_id', input.empresaId)
    .is('read_at', null)

  if (!canSeeAllNotifications(input.papel)) {
    query = query.eq('recipient_user_id', input.usuarioId)
  }

  const { error } = await query

  if (error) {
    throw new Error(error.message)
  }
}

async function listRecipients(input: {
  empresaId: string
  barberName?: string | null
}) {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id,nome,papel')
    .eq('empresa_id', input.empresaId)
    .eq('status', 'ativo')
    .in('papel', ['administrador', 'gerente', 'barbeiro'])

  if (error) {
    throw new Error(error.message)
  }

  const users = (data ?? []) as UsuarioRecipient[]
  const admins = users.filter((user) => adminRoles.includes(user.papel))
  const normalizedBarberName = input.barberName?.trim().toLowerCase()
  const barbers = normalizedBarberName
    ? users.filter(
        (user) =>
          user.papel === 'barbeiro' &&
          user.nome.trim().toLowerCase() === normalizedBarberName,
      )
    : []
  const recipients = new Map<string, UsuarioRecipient>()

  admins.forEach((user) => recipients.set(user.id, user))
  barbers.forEach((user) => recipients.set(user.id, user))

  return Array.from(recipients.values())
}

export async function createInternalNotification(input: NotificationEventInput) {
  const recipients = await listRecipients({
    barberName: input.barberName,
    empresaId: input.empresaId,
  })

  if (recipients.length === 0) {
    return
  }

  const { error } = await supabase.from('notifications').insert(
    recipients.map((recipient) => ({
      empresa_id: input.empresaId,
      message: input.message,
      metadata: (input.metadata ?? {}) as never,
      recipient_user_id: recipient.id,
      title: input.title,
      type: input.type,
    })),
  )

  if (error) {
    throw new Error(error.message)
  }
}
