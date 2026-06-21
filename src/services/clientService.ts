import { supabase } from '../lib/supabase'
import { logger } from '../lib/logger'
import type { Database } from '../types/database'
import { createInternalNotification } from './notificationsService'

export type Barbershop = Database['public']['Tables']['barbershops']['Row']
export type ClientProfile = Database['public']['Tables']['profiles']['Row']
export type ClientFavoriteBarbershop =
  Database['public']['Tables']['client_favorite_barbershops']['Row']
export type ClientAppointment = Database['public']['Tables']['appointments']['Row'] & {
  barbershop?: { nome: string; endereco: string | null } | null
  barbeiro?: { nome: string } | null
  items?: Array<{
    nome: string
    duration_minutes: number
    servico_id: string | null
    valor_final: number
  }>
}
export type BookingService = Database['public']['Tables']['servicos']['Row']
export type BookingBarber = Database['public']['Tables']['barbeiros']['Row']
export type BookingUnavailability =
  Database['public']['Tables']['barber_unavailability']['Row']
export type AppointmentWaitlist =
  Database['public']['Tables']['appointment_waitlist']['Row'] & {
    barber?: { nome: string } | null
    service?: { nome: string } | null
  }

function appointmentTimeLabel(value: string) {
  return new Date(value).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function appointmentDateLabel(value: string) {
  return new Date(value).toLocaleDateString('pt-BR')
}

async function tryCreateInternalNotification(
  input: Parameters<typeof createInternalNotification>[0],
) {
  try {
    await createInternalNotification(input)
  } catch (error) {
    logger.warn({
      action: 'notification_internal_create_failed',
      area: 'notifications',
      error,
      message: 'Erro ao criar notificacao interna.',
      metadata: {
        notificationType: input.type,
      },
      empresaId: input.empresaId,
    })
  }
}

export async function listBarbershops(search: string) {
  let query = supabase
    .from('barbershops')
    .select('*')
    .eq('status', 'ativa')
    .order('rating', { ascending: false })

  const normalizedSearch = search.trim()

  if (normalizedSearch) {
    query = query.or(
      `nome.ilike.%${normalizedSearch}%,endereco.ilike.%${normalizedSearch}%`,
    )
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as Barbershop[]
}

export function formatBarbershopAddress(barbershop: Partial<Barbershop> | null) {
  if (!barbershop) {
    return 'Endereco nao informado'
  }

  const streetLine = [barbershop.rua, barbershop.numero]
    .filter(Boolean)
    .join(', ')
  const cityLine = [barbershop.bairro, barbershop.cidade, barbershop.estado]
    .filter(Boolean)
    .join(' - ')
  const structuredAddress = [streetLine, cityLine].filter(Boolean).join(' — ')

  return structuredAddress || barbershop.endereco || 'Endereco nao informado'
}

export function getBarbershopRouteUrl(barbershop: Partial<Barbershop>) {
  const latitude =
    barbershop.latitude !== null && barbershop.latitude !== undefined
      ? Number(barbershop.latitude)
      : null
  const longitude =
    barbershop.longitude !== null && barbershop.longitude !== undefined
      ? Number(barbershop.longitude)
      : null
  const query =
    latitude !== null && longitude !== null
      ? `${latitude},${longitude}`
      : formatBarbershopAddress(barbershop)

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

export async function listFavoriteBarbershopIds(clientProfileId: string) {
  const { data, error } = await supabase
    .from('client_favorite_barbershops')
    .select('barbershop_id')
    .eq('client_id', clientProfileId)

  if (error) {
    throw new Error(error.message)
  }

  const rows = Array.isArray(data) ? data : []

  return new Set(rows.map((favorite) => favorite.barbershop_id))
}

export async function listFavoriteBarbershops(clientProfileId: string) {
  const { data, error } = await supabase
    .from('client_favorite_barbershops')
    .select('*,barbershop:barbershops(*)')
    .eq('client_id', clientProfileId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  const rows = Array.isArray(data) ? data : []

  return (rows as unknown as Array<
    ClientFavoriteBarbershop & { barbershop: Barbershop | null }
  >)
    .map((favorite) => favorite.barbershop)
    .filter((barbershop): barbershop is Barbershop => Boolean(barbershop))
}

export async function favoriteBarbershop(
  profile: ClientProfile,
  barbershop: Barbershop,
) {
  const { error } = await supabase.from('client_favorite_barbershops').upsert(
    {
      barbershop_id: barbershop.id,
      client_id: profile.id,
      empresa_id: barbershop.empresa_id,
    },
    { onConflict: 'client_id,barbershop_id' },
  )

  if (error) {
    throw new Error(error.message)
  }
}

export async function unfavoriteBarbershop(
  profile: ClientProfile,
  barbershopId: string,
) {
  const { error } = await supabase
    .from('client_favorite_barbershops')
    .delete()
    .eq('client_id', profile.id)
    .eq('barbershop_id', barbershopId)

  if (error) {
    throw new Error(error.message)
  }
}

export async function setPrimaryBarbershop(
  profile: ClientProfile,
  barbershopId: string,
) {
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ primary_barbershop_id: barbershopId })
    .eq('id', profile.id)
    .eq('auth_user_id', profile.auth_user_id)

  if (profileError) {
    throw new Error(profileError.message)
  }

  await supabase
    .from('client_barbershop')
    .update({ is_primary: false })
    .eq('client_profile_id', profile.id)

  const { error: linkError } = await supabase.from('client_barbershop').upsert(
    {
      barbershop_id: barbershopId,
      client_profile_id: profile.id,
      is_primary: true,
    },
    { onConflict: 'client_profile_id,barbershop_id' },
  )

  if (linkError) {
    throw new Error(linkError.message)
  }
}

export async function updateClientProfile(
  profile: ClientProfile,
  data: {
    avatar_url?: string | null
    nome: string
    telefone?: string | null
  },
) {
  const { error } = await supabase
    .from('profiles')
    .update({
      avatar_url: data.avatar_url || null,
      nome: data.nome.trim(),
      telefone: data.telefone?.replace(/\D/g, '') || null,
    })
    .eq('id', profile.id)
    .eq('auth_user_id', profile.auth_user_id)

  if (error) {
    throw new Error(error.message)
  }
}

export async function getPrimaryBarbershop(profile: ClientProfile) {
  if (!profile.primary_barbershop_id) {
    return null
  }

  const { data, error } = await supabase
    .from('barbershops')
    .select('*')
    .eq('id', profile.primary_barbershop_id)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data as Barbershop | null
}

export async function listClientAppointments(profileId: string) {
  const { data, error } = await supabase
    .from('appointments')
    .select(
      '*,barbershop:barbershops(nome,endereco),barbeiro:barbeiros(nome),items:appointment_items(nome,duration_minutes,servico_id,valor_final)',
    )
    .eq('client_profile_id', profileId)
    .order('starts_at', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as unknown as ClientAppointment[]
}

export async function listBookingServices(empresaId: string, barberId: string) {
  if (!barberId) {
    return []
  }

  const { data, error } = await supabase
    .from('barber_services')
    .select(
      'service:servicos(id,empresa_id,nome,preco,duracao_minutos,duration_minutes,ativo,status)',
    )
    .eq('empresa_id', empresaId)
    .eq('barbeiro_id', barberId)
    .eq('active', true)

  if (error) {
    throw new Error(error.message)
  }

  return ((data ?? []) as unknown as Array<{ service: BookingService | null }>)
    .map((item) => item.service)
    .filter(
      (service): service is BookingService =>
        Boolean(service?.ativo) && service?.status !== 'inativo',
    )
    .sort((first, second) => first.nome.localeCompare(second.nome))
}

export async function listBookingBarbers(empresaId: string) {
  const { data, error } = await supabase
    .from('barbeiros')
    .select('id,empresa_id,nome,status,percentual_comissao')
    .eq('empresa_id', empresaId)
    .eq('status', 'ativo')
    .order('nome', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as BookingBarber[]
}

export async function listBarberAppointments(
  barbershopId: string,
  barbeiroId: string,
  date: string,
  excludeAppointmentId?: string,
) {
  if (!barbershopId || !barbeiroId || !date) {
    return []
  }

  const { data, error } = await supabase.rpc('get_booking_busy_slots', {
    p_barbeiro_id: barbeiroId,
    p_barbershop_id: barbershopId,
    p_date: date,
    p_exclude_appointment_id: excludeAppointmentId ?? null,
  })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as Array<{ starts_at: string; ends_at: string }>
}

async function logAppointmentStatus(input: {
  appointmentId: string
  empresaId: string | null
  oldStatus?: string | null
  newStatus: string
  reason?: string | null
  metadata?: Record<string, unknown>
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase.from('appointment_status_logs').insert({
    appointment_id: input.appointmentId,
    changed_by: user?.id ?? null,
    changed_by_role: 'cliente',
    empresa_id: input.empresaId,
    metadata: (input.metadata ?? {}) as never,
    new_status: input.newStatus,
    old_status: input.oldStatus ?? null,
    reason: input.reason ?? null,
    source: 'appointments',
  })

  if (error) {
    throw new Error(error.message)
  }
}

function periodMatches(date: Date, preferredPeriod: string | null) {
  if (!preferredPeriod || preferredPeriod === 'qualquer') {
    return true
  }

  const hour = date.getHours()

  if (preferredPeriod === 'manha') {
    return hour < 12
  }

  if (preferredPeriod === 'tarde') {
    return hour >= 12 && hour < 18
  }

  return hour >= 18
}

export async function notifyWaitlistForVacancy(input: {
  empresaId: string
  barbershopId?: string | null
  barbershopName?: string | null
  barberId?: string | null
  serviceId?: string | null
  startsAt: string
}) {
  const desiredDate = input.startsAt.slice(0, 10)
  let query = supabase
    .from('appointment_waitlist')
    .select('*')
    .eq('empresa_id', input.empresaId)
    .eq('desired_date', desiredDate)
    .eq('status', 'aguardando')
    .order('created_at', { ascending: true })
    .limit(10)

  if (input.serviceId) {
    query = query.eq('service_id', input.serviceId)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  const vacancyDate = new Date(input.startsAt)
  const candidate = ((data ?? []) as Array<
    Database['public']['Tables']['appointment_waitlist']['Row']
  >).find(
    (item) =>
      (!item.barber_id || !input.barberId || item.barber_id === input.barberId) &&
      periodMatches(vacancyDate, item.preferred_period),
  )

  if (!candidate) {
    return
  }

  const { data: clientData } = await supabase
    .from('profiles')
    .select('nome')
    .eq('id', candidate.client_id)
    .maybeSingle()

  const message = `Olá, ${clientData?.nome ?? 'cliente'}! Surgiu um horário disponivel na ${input.barbershopName ?? 'barbearia'} para ${vacancyDate.toLocaleDateString('pt-BR')} as ${vacancyDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}. Acesse o app BW Barber para confirmar seu agendamento.`

  const { error: notificationError } = await supabase
    .from('notification_logs')
    .insert({
      channel: 'whatsapp',
      client_id: candidate.client_id,
      empresa_id: input.empresaId,
      message,
      status: 'pendente',
      type: 'waitlist_vacancy',
    })

  if (notificationError) {
    throw new Error(notificationError.message)
  }

  const { error: updateError } = await supabase
    .from('appointment_waitlist')
    .update({ notified_at: new Date().toISOString(), status: 'notificado' })
    .eq('id', candidate.id)
    .eq('status', 'aguardando')

  if (updateError) {
    throw new Error(updateError.message)
  }

  await tryCreateInternalNotification({
    barberName: undefined,
    empresaId: input.empresaId,
    message: `Uma vaga foi liberada para ${appointmentDateLabel(input.startsAt)} as ${appointmentTimeLabel(input.startsAt)} e um cliente da lista de espera foi notificado.`,
    metadata: {
      client_id: candidate.client_id,
      desired_date: desiredDate,
      waitlist_id: candidate.id,
    },
    title: 'Horário liberado',
    type: 'waitlist_vacancy',
  })
}

export async function listBarberUnavailabilityForDate(
  empresaId: string,
  barbeiroId: string,
  date: string,
) {
  const { data, error } = await supabase
    .from('barber_unavailability')
    .select('*')
    .eq('empresa_id', empresaId)
    .eq('barber_id', barbeiroId)
    .eq('date', date)

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as BookingUnavailability[]
}

export async function createClientAppointment(input: {
  barbershop: Barbershop
  clientProfile: ClientProfile
  service: BookingService
  barber: BookingBarber
  startsAt: string
  endsAt: string
}) {
  if (!input.barbershop.empresa_id) {
    throw new Error('Barbearia sem empresa vinculada.')
  }

  const { data: appointment, error: appointmentError } = await supabase.rpc(
    'create_client_appointment',
    {
      p_barbeiro_id: input.barber.id,
      p_barbershop_id: input.barbershop.id,
      p_client_profile_id: input.clientProfile.id,
      p_ends_at: input.endsAt,
      p_servico_id: input.service.id,
      p_starts_at: input.startsAt,
    },
  )

  if (appointmentError) {
    throw new Error(appointmentError.message)
  }

  if (!appointment) {
    throw new Error('Não foi possível confirmar o agendamento.')
  }

  await tryCreateInternalNotification({
    barberName: input.barber.nome,
    empresaId: input.barbershop.empresa_id,
    message: `${input.clientProfile.nome} marcou ${input.service.nome} com ${input.barber.nome} em ${appointmentDateLabel(input.startsAt)} as ${appointmentTimeLabel(input.startsAt)}.`,
    metadata: {
      appointment_id: appointment.id,
      barber_id: input.barber.id,
      client_profile_id: input.clientProfile.id,
      starts_at: input.startsAt,
    },
    title: 'Novo agendamento',
    type: 'appointment_created',
  })
}

export async function cancelClientAppointment(input: {
  appointment: ClientAppointment
  reason?: string
}) {
  if (!input.appointment.client_profile_id) {
    throw new Error('Agendamento sem cliente vinculado.')
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const now = new Date().toISOString()

  const { error } = await supabase
    .from('appointments')
    .update({
      cancellation_reason: input.reason?.trim() || null,
      cancelled_at: now,
      cancelled_by: user?.id ?? null,
      status: 'cancelado',
    })
    .eq('id', input.appointment.id)
    .eq('client_profile_id', input.appointment.client_profile_id)

  if (error) {
    throw new Error(error.message)
  }

  await logAppointmentStatus({
    appointmentId: input.appointment.id,
    empresaId: input.appointment.empresa_id,
    newStatus: 'cancelado',
    oldStatus: input.appointment.status,
    reason: input.reason,
  })

  await supabase
    .from('movimentacoes_financeiras')
    .update({ cancelled_at: now, status: 'cancelada' })
    .eq('appointment_id', input.appointment.id)

  if (input.appointment.empresa_id) {
    await tryCreateInternalNotification({
      barberName: input.appointment.barbeiro?.nome,
      empresaId: input.appointment.empresa_id,
      message: `${input.appointment.barbershop?.nome ? 'Um cliente' : 'Cliente'} cancelou o agendamento de ${appointmentDateLabel(input.appointment.starts_at)} as ${appointmentTimeLabel(input.appointment.starts_at)}.`,
      metadata: {
        appointment_id: input.appointment.id,
        reason: input.reason ?? null,
      },
      title: 'Agendamento cancelado',
      type: 'appointment_cancelled',
    })

    await notifyWaitlistForVacancy({
      barberId: input.appointment.barbeiro_id,
      barbershopName: input.appointment.barbershop?.nome,
      empresaId: input.appointment.empresa_id,
      serviceId: input.appointment.items?.[0]?.servico_id ?? null,
      startsAt: input.appointment.starts_at,
    })
  }
}

export async function rescheduleClientAppointment(input: {
  appointment: ClientAppointment
  startsAt: string
  endsAt: string
}) {
  if (!input.appointment.client_profile_id) {
    throw new Error('Agendamento sem cliente vinculado.')
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const now = new Date().toISOString()

  const { error } = await supabase
    .from('appointments')
    .update({
      ends_at: input.endsAt,
      rescheduled_at: now,
      rescheduled_by: user?.id ?? null,
      rescheduled_from_ends_at: input.appointment.ends_at,
      rescheduled_from_starts_at: input.appointment.starts_at,
      starts_at: input.startsAt,
      status:
        input.appointment.status === 'confirmado' ? 'confirmado' : 'agendado',
    })
    .eq('id', input.appointment.id)
    .eq('client_profile_id', input.appointment.client_profile_id)

  if (error) {
    throw new Error(error.message)
  }

  await logAppointmentStatus({
    appointmentId: input.appointment.id,
    empresaId: input.appointment.empresa_id,
    metadata: {
      from_ends_at: input.appointment.ends_at,
      from_starts_at: input.appointment.starts_at,
      to_ends_at: input.endsAt,
      to_starts_at: input.startsAt,
    },
    newStatus: 'remarcado',
    oldStatus: input.appointment.status,
    reason: 'Remarcacao solicitada pelo cliente',
  })

  await supabase
    .from('movimentacoes_financeiras')
    .update({ data_movimentacao: input.startsAt.slice(0, 10) })
    .eq('appointment_id', input.appointment.id)
    .neq('status', 'cancelada')

  if (input.appointment.empresa_id) {
    await tryCreateInternalNotification({
      barberName: input.appointment.barbeiro?.nome,
      empresaId: input.appointment.empresa_id,
      message: `Agendamento remarcado de ${appointmentDateLabel(input.appointment.starts_at)} as ${appointmentTimeLabel(input.appointment.starts_at)} para ${appointmentDateLabel(input.startsAt)} as ${appointmentTimeLabel(input.startsAt)}.`,
      metadata: {
        appointment_id: input.appointment.id,
        from_starts_at: input.appointment.starts_at,
        to_starts_at: input.startsAt,
      },
      title: 'Agendamento remarcado',
      type: 'appointment_rescheduled',
    })
  }
}

export async function listClientWaitlist(profileId: string) {
  const { data, error } = await supabase
    .from('appointment_waitlist')
    .select('*')
    .eq('client_id', profileId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data ?? []) as Database['public']['Tables']['appointment_waitlist']['Row'][]
  const [servicesResponse, barbersResponse] = await Promise.all([
    rows.length
      ? supabase
          .from('servicos')
          .select('id,nome')
          .in('id', rows.map((row) => row.service_id))
      : Promise.resolve({ data: [], error: null }),
    rows.some((row) => row.barber_id)
      ? supabase
          .from('barbeiros')
          .select('id,nome')
          .in(
            'id',
            rows
              .map((row) => row.barber_id)
              .filter((id): id is string => Boolean(id)),
          )
      : Promise.resolve({ data: [], error: null }),
  ])

  if (servicesResponse.error) {
    throw new Error(servicesResponse.error.message)
  }

  if (barbersResponse.error) {
    throw new Error(barbersResponse.error.message)
  }

  const services = new Map(
    (servicesResponse.data ?? []).map((service) => [service.id, service]),
  )
  const barbers = new Map(
    (barbersResponse.data ?? []).map((barber) => [barber.id, barber]),
  )

  return rows.map((row) => ({
    ...row,
    barber: row.barber_id ? (barbers.get(row.barber_id) ?? null) : null,
    service: services.get(row.service_id) ?? null,
  }))
}

export async function createWaitlistEntry(input: {
  barbershop: Barbershop
  clientProfile: ClientProfile
  serviceId: string
  barberId?: string | null
  desiredDate: string
  preferredPeriod?: 'manha' | 'tarde' | 'noite' | 'qualquer'
}) {
  if (!input.barbershop.empresa_id) {
    throw new Error('Barbearia sem empresa vinculada.')
  }

  const { error } = await supabase.from('appointment_waitlist').insert({
    barber_id: input.barberId || null,
    client_id: input.clientProfile.id,
    desired_date: input.desiredDate,
    empresa_id: input.barbershop.empresa_id,
    expires_at: `${input.desiredDate}T23:59:59`,
    preferred_period: input.preferredPeriod ?? 'qualquer',
    service_id: input.serviceId,
    status: 'aguardando',
  })

  if (error) {
    throw new Error(error.message)
  }

  await tryCreateInternalNotification({
    empresaId: input.barbershop.empresa_id,
    message: `${input.clientProfile.nome} entrou na lista de espera para ${input.desiredDate.split('-').reverse().join('/')} (${input.preferredPeriod ?? 'qualquer horário'}).`,
    metadata: {
      barber_id: input.barberId ?? null,
      client_profile_id: input.clientProfile.id,
      desired_date: input.desiredDate,
      service_id: input.serviceId,
    },
    title: 'Cliente na lista de espera',
    type: 'waitlist_joined',
  })
}

export async function cancelWaitlistEntry(input: {
  id: string
  clientProfileId: string
}) {
  const { error } = await supabase
    .from('appointment_waitlist')
    .update({ status: 'cancelado' })
    .eq('id', input.id)
    .eq('client_id', input.clientProfileId)

  if (error) {
    throw new Error(error.message)
  }
}
