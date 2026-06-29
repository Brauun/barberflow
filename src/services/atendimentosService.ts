import { supabase } from '../lib/supabase'
import { logger } from '../lib/logger'
import {
  listBarberAppointments,
  notifyWaitlistForVacancy,
  type BookingUnavailability,
} from './clientService'
import {
  applyLoyaltyProgressForAppointment,
  redeemClientBenefit,
} from './benefitsService'
import type { AtendimentoFormData } from '../types/atendimentos'
import type { Database } from '../types/database'
import { createAuditLog } from './observabilityService'
import {
  hasConfiguredBusinessHours,
  type BusinessHour,
  type SpecialBusinessHour,
} from './businessHoursService'
import { sendAppointmentCancelledPushNotification } from './pushNotificationsService'

export type Atendimento = Database['public']['Tables']['atendimentos']['Row']

export type AtendimentoListItem = Atendimento & {
  barbeiros: { nome: string } | null
  clientes: { nome: string } | null
  servicos: { nome: string } | null
}

export type AtendimentoRecordFilters = {
  barbeiroId?: string
  clienteId?: string
  dataFim: string
  dataInicio: string
  page: number
  pageSize: number
  servicoId?: string
  status?: string
}

export type AtendimentoRecord = {
  id: string
  source: 'appointment' | 'atendimento'
  starts_at: string
  cliente: string
  cliente_tipo: 'cadastrado' | 'avulso'
  barbeiro: string
  servico: string
  status: DailyAppointmentStatus
  valor: number
  valor_desconto: number
  valor_final: number
}

export type AtendimentoRecordSummary = {
  total: number
  concluidos: number
  cancelados: number
  naoCompareceu: number
  receita: number
  comissao: number
}

export type AtendimentoRecordsResult = {
  items: AtendimentoRecord[]
  page: number
  pageSize: number
  hasMore: boolean
  summary: AtendimentoRecordSummary
  total: number
}

export type AtendimentoOption = {
  id: string
  nome: string
}

export type DailyAppointmentStatus =
  | 'agendado'
  | 'confirmado'
  | 'em_atendimento'
  | 'aguardando_finalizacao'
  | 'concluido'
  | 'concluido_automatico'
  | 'cancelado'
  | 'remarcado'
  | 'nao_compareceu'
  | 'faltou'

export type DailyAppointment = {
  id: string
  source: 'appointment' | 'atendimento'
  starts_at: string
  ends_at: string
  cliente: string
  cliente_telefone?: string | null
  is_walk_in?: boolean
  barbeiro: string
  barbeiro_id: string | null
  barbershop_id: string | null
  service_id: string | null
  servico: string
  duration_minutes: number
  valor: number
  status: DailyAppointmentStatus
  auto_completed?: boolean
  auto_completed_at?: string | null
}

export type AdminWaitlistEntry =
  Database['public']['Tables']['appointment_waitlist']['Row'] & {
    client?: { nome: string; telefone: string | null } | null
    service?: { nome: string } | null
    barber?: { nome: string } | null
  }

export type ServicoOption = {
  id: string
  nome: string
  preco: number
  duration_minutes: number | null
  duracao_minutos?: number | null
}

export type InternalAppointmentSlotData = {
  appointments: Array<{ starts_at: string; ends_at: string }>
  businessHours: BusinessHour[]
  specialHour: SpecialBusinessHour | null
  unavailability: BookingUnavailability[]
}

function displayCustomerName(...values: Array<null | string | undefined>) {
  const value = values.find((item) => item?.trim())

  return value?.trim() || 'Cliente não identificado'
}

type AppointmentProfileFallback = {
  auth_user_id: string | null
  id: string
  nome: string
  telefone: string | null
}

type AppointmentCustomerFallback = {
  client_profile_id: string | null
  id: string
  nome: string
  telefone: string | null
}

async function getAppointmentCustomerFallbacks(
  empresaId: string,
  appointments: Array<{
    cliente_id?: string | null
    client_profile_id?: string | null
    created_by_user_id?: string | null
  }>,
) {
  const clienteIds = [
    ...new Set(
      appointments
        .map((appointment) => appointment.cliente_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ]
  const profileIds = [
    ...new Set(
      appointments
        .map((appointment) => appointment.client_profile_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ]
  const authUserIds = [
    ...new Set(
      appointments
        .map((appointment) => appointment.created_by_user_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ]

  if (!clienteIds.length && !profileIds.length && !authUserIds.length) {
    return {
      byAuthUserId: new Map<string, AppointmentCustomerFallback>(),
      byClientId: new Map<string, AppointmentCustomerFallback>(),
      byProfileId: new Map<string, AppointmentCustomerFallback>(),
      profilesByAuthUserId: new Map<string, AppointmentProfileFallback>(),
      profilesByProfileId: new Map<string, AppointmentProfileFallback>(),
    }
  }

  let profiles: AppointmentProfileFallback[] = []

  if (profileIds.length || authUserIds.length) {
    const filters = [
      profileIds.length ? `id.in.(${profileIds.join(',')})` : '',
      authUserIds.length ? `auth_user_id.in.(${authUserIds.join(',')})` : '',
    ].filter(Boolean)
    const { data } = await supabase
      .from('profiles')
      .select('id,auth_user_id,nome,telefone')
      .or(filters.join(','))

    profiles = (data ?? []) as AppointmentProfileFallback[]
  }

  const profileIdsFromAuth = profiles.map((profile) => profile.id)
  const allProfileIds = [...new Set([...profileIds, ...profileIdsFromAuth])]
  const clienteFilters = [
    clienteIds.length ? `id.in.(${clienteIds.join(',')})` : '',
    allProfileIds.length ? `client_profile_id.in.(${allProfileIds.join(',')})` : '',
  ].filter(Boolean)

  let clientes: AppointmentCustomerFallback[] = []

  if (clienteFilters.length) {
    const { data } = await supabase
      .from('clientes')
      .select('id,client_profile_id,nome,telefone')
      .eq('empresa_id', empresaId)
      .or(clienteFilters.join(','))

    clientes = (data ?? []) as AppointmentCustomerFallback[]
  }

  const clientsByProfileId = new Map(
    clientes
      .filter((cliente) => cliente.client_profile_id)
      .map((cliente) => [cliente.client_profile_id as string, cliente]),
  )
  const profilesByAuthUserId = new Map(
    profiles
      .filter((profile) => profile.auth_user_id)
      .map((profile) => [profile.auth_user_id as string, profile]),
  )

  return {
    byAuthUserId: new Map(
      Array.from(profilesByAuthUserId.entries())
        .map(([authUserId, profile]) => {
          const cliente = clientsByProfileId.get(profile.id)

          return cliente ? ([authUserId, cliente] as const) : null
        })
        .filter((entry): entry is readonly [string, AppointmentCustomerFallback] =>
          Boolean(entry),
        ),
    ),
    byClientId: new Map(clientes.map((cliente) => [cliente.id, cliente])),
    byProfileId: clientsByProfileId,
    profilesByAuthUserId,
    profilesByProfileId: new Map(profiles.map((profile) => [profile.id, profile])),
  }
}

export async function listAtendimentos(
  empresaId: string,
): Promise<AtendimentoListItem[]> {
  const { data, error } = await supabase
    .from('atendimentos')
    .select(
      '*,clientes(nome),barbeiros(nome),servicos(nome)',
    )
    .eq('empresa_id', empresaId)
    .order('data_hora_inicio', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as unknown as AtendimentoListItem[]
}

export async function listDailyAppointments(input: {
  empresaId: string
  date: string
  barbeiroId?: string
  status?: string
}): Promise<DailyAppointment[]> {
  const dayStart = new Date(`${input.date}T00:00:00`)
  const dayEnd = new Date(dayStart)
  dayEnd.setDate(dayStart.getDate() + 1)

  let appointmentsQuery = supabase
    .from('appointments')
    .select(
      'id,atendimento_id,cliente_id,client_profile_id,created_by_user_id,starts_at,ends_at,status,valor_final,barbeiro_id,barbershop_id,auto_completed,auto_completed_at,is_walk_in,walk_in_customer_name,walk_in_customer_phone,client:profiles(nome,telefone),cliente:clientes(nome,telefone),barbeiro:barbeiros(nome),items:appointment_items(nome,duration_minutes,servico_id,valor_final)',
    )
    .eq('empresa_id', input.empresaId)
    .gte('starts_at', dayStart.toISOString())
    .lt('starts_at', dayEnd.toISOString())
    .order('starts_at', { ascending: true })

  let atendimentosQuery = supabase
    .from('atendimentos')
    .select('*,clientes(nome),barbeiros(nome),servicos(nome,duracao_minutos)')
    .eq('empresa_id', input.empresaId)
    .gte('data_hora_inicio', dayStart.toISOString())
    .lt('data_hora_inicio', dayEnd.toISOString())
    .order('data_hora_inicio', { ascending: true })

  if (input.barbeiroId) {
    appointmentsQuery = appointmentsQuery.eq('barbeiro_id', input.barbeiroId)
    atendimentosQuery = atendimentosQuery.eq('barbeiro_id', input.barbeiroId)
  }

  if (input.status) {
    appointmentsQuery = appointmentsQuery.eq(
      'status',
      input.status as DailyAppointmentStatus,
    )
    atendimentosQuery = atendimentosQuery.eq(
      'status',
      input.status as DailyAppointmentStatus,
    )
  }

  const [appointmentsResponse, atendimentosResponse] = await Promise.all([
    appointmentsQuery,
    atendimentosQuery,
  ])

  if (appointmentsResponse.error) {
    throw new Error(appointmentsResponse.error.message)
  }

  if (atendimentosResponse.error) {
    throw new Error(atendimentosResponse.error.message)
  }

  const appointments = (appointmentsResponse.data ?? []) as unknown as Array<{
    id: string
    atendimento_id: string | null
    cliente_id: string | null
    client_profile_id: string | null
    created_by_user_id: string | null
    starts_at: string
    ends_at: string
    status: DailyAppointmentStatus
    valor_final: number
    barbeiro_id: string | null
    barbershop_id: string | null
    auto_completed?: boolean
    auto_completed_at?: string | null
    client: { nome: string; telefone: string | null } | null
    cliente: { nome: string; telefone: string | null } | null
    is_walk_in?: boolean
    walk_in_customer_name?: string | null
    walk_in_customer_phone?: string | null
    barbeiro: { nome: string } | null
    items: Array<{
      nome: string
      duration_minutes: number
      servico_id: string | null
      valor_final: number
    }>
  }>
  const atendimentos =
    (atendimentosResponse.data ?? []) as unknown as Array<
      Atendimento & {
        clientes: { nome: string } | null
        barbeiros: { nome: string } | null
        servicos: { nome: string; duracao_minutos: number } | null
      }
    >
  const linkedAtendimentoIds = new Set(
    appointments
      .map((appointment) => appointment.atendimento_id)
      .filter(Boolean),
  )
  const unlinkedAtendimentos = atendimentos.filter(
    (atendimento) => !linkedAtendimentoIds.has(atendimento.id),
  )
  const fallbackCustomers = await getAppointmentCustomerFallbacks(input.empresaId, [
    ...appointments,
    ...unlinkedAtendimentos.map((atendimento) => ({
      cliente_id: atendimento.cliente_id,
    })),
  ])

  return [
    ...appointments.map((appointment) => {
      const firstItem = appointment.items[0]
      const fallbackCustomer =
        (appointment.cliente_id
          ? fallbackCustomers.byClientId.get(appointment.cliente_id)
          : null) ??
        (appointment.client_profile_id
          ? fallbackCustomers.byProfileId.get(appointment.client_profile_id)
          : null) ??
        (appointment.created_by_user_id
          ? fallbackCustomers.byAuthUserId.get(appointment.created_by_user_id)
          : null)
      const fallbackProfile =
        (appointment.client_profile_id
          ? fallbackCustomers.profilesByProfileId.get(appointment.client_profile_id)
          : null) ??
        (appointment.created_by_user_id
          ? fallbackCustomers.profilesByAuthUserId.get(appointment.created_by_user_id)
          : null)
      const cliente = appointment.is_walk_in
        ? displayCustomerName(
            appointment.walk_in_customer_name,
            appointment.cliente?.nome,
            fallbackCustomer?.nome,
            appointment.client?.nome,
            fallbackProfile?.nome,
          )
        : displayCustomerName(
            appointment.cliente?.nome,
            fallbackCustomer?.nome,
            appointment.client?.nome,
            fallbackProfile?.nome,
            appointment.walk_in_customer_name,
          )

      return {
        barbeiro: appointment.barbeiro?.nome ?? 'Barbeiro',
        barbeiro_id: appointment.barbeiro_id,
        barbershop_id: appointment.barbershop_id,
        cliente,
        cliente_telefone:
          appointment.walk_in_customer_phone ??
          appointment.cliente?.telefone ??
          fallbackCustomer?.telefone ??
          appointment.client?.telefone ??
          fallbackProfile?.telefone ??
          null,
        is_walk_in: Boolean(appointment.is_walk_in),
        duration_minutes:
          firstItem?.duration_minutes ??
          Math.round(
            (new Date(appointment.ends_at).getTime() -
              new Date(appointment.starts_at).getTime()) /
              60000,
          ),
        id: appointment.id,
        servico: appointment.items.map((item) => item.nome).join(' + ') || 'Serviço',
        source: 'appointment' as const,
        ends_at: appointment.ends_at,
        starts_at: appointment.starts_at,
        status: appointment.status,
        auto_completed: appointment.auto_completed,
        auto_completed_at: appointment.auto_completed_at,
        service_id: firstItem?.servico_id ?? null,
        valor:
          firstItem?.valor_final !== undefined
            ? appointment.items.reduce(
                (total, item) => total + Number(item.valor_final),
                0,
              )
            : Number(appointment.valor_final),
      }
    }),
    ...unlinkedAtendimentos.map((atendimento) => {
      const fallbackCustomer = fallbackCustomers.byClientId.get(atendimento.cliente_id)

      return {
        barbeiro: atendimento.barbeiros?.nome ?? 'Barbeiro',
        barbeiro_id: atendimento.barbeiro_id,
        barbershop_id: null,
        cliente: displayCustomerName(atendimento.clientes?.nome, fallbackCustomer?.nome),
        cliente_telefone: fallbackCustomer?.telefone ?? null,
        duration_minutes: atendimento.servicos?.duracao_minutos ?? 30,
        id: atendimento.id,
        ends_at:
          atendimento.data_hora_fim ??
          new Date(
            new Date(atendimento.data_hora_inicio).getTime() +
              (atendimento.servicos?.duracao_minutos ?? 30) * 60 * 1000,
          ).toISOString(),
        servico: atendimento.servicos?.nome ?? 'Serviço',
        service_id: atendimento.servico_id,
        source: 'atendimento' as const,
        starts_at: atendimento.data_hora_inicio,
        status: atendimento.status as DailyAppointmentStatus,
        auto_completed: atendimento.auto_completed,
        auto_completed_at: atendimento.auto_completed_at,
        valor: Number(atendimento.valor_final ?? atendimento.valor),
      }
    }),
  ].sort(
    (first, second) =>
      new Date(first.starts_at).getTime() - new Date(second.starts_at).getTime(),
  )
}

export async function processPendingAppointmentCompletions(empresaId: string) {
  const { error } = await supabase.rpc('process_pending_appointment_completions', {
    p_empresa_id: empresaId,
  })

  if (error) {
    throw new Error(error.message)
  }
}

export async function reverseAutoCompletedAppointment(input: {
  empresaId: string
  appointmentId: string
  nextStatus: 'concluido' | 'nao_compareceu'
}) {
  const { error } = await supabase.rpc('reverse_auto_completed_appointment', {
    p_appointment_id: input.appointmentId,
    p_empresa_id: input.empresaId,
    p_next_status: input.nextStatus,
  })

  if (error) {
    throw new Error(error.message)
  }
}

export async function updateDailyAppointmentStatus(input: {
  empresaId: string
  id: string
  source: 'appointment' | 'atendimento'
  status: DailyAppointmentStatus
  reason?: string | null
}) {
  const table = input.source === 'appointment' ? 'appointments' : 'atendimentos'
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const currentResponse =
    input.source === 'appointment'
      ? await supabase
          .from('appointments')
          .select('id,atendimento_id,status,starts_at,barbeiro_id,barbershop:barbershops(nome),items:appointment_items(servico_id)')
          .eq('empresa_id', input.empresaId)
          .eq('id', input.id)
          .maybeSingle()
      : await supabase
          .from('atendimentos')
          .select('id,status,data_hora_inicio,barbeiro_id,servico_id')
          .eq('empresa_id', input.empresaId)
          .eq('id', input.id)
          .maybeSingle()

  if (currentResponse.error) {
    throw new Error(currentResponse.error.message)
  }

  const current = currentResponse.data as
    | {
        status: DailyAppointmentStatus
        starts_at?: string
        data_hora_inicio?: string
        atendimento_id?: string | null
        barbeiro_id: string | null
        servico_id?: string | null
        barbershop?: { nome: string } | null
        items?: Array<{ servico_id: string | null }>
      }
    | null
  const now = new Date().toISOString()
  const patch =
    input.status === 'cancelado'
      ? {
          cancellation_reason: input.reason ?? null,
          cancelled_at: now,
          cancelled_by: user?.id ?? null,
          status: input.status,
        }
      : { status: input.status }

  const updateResponse =
    input.source === 'appointment' &&
    (input.status === 'concluido' || input.status === 'concluido_automatico')
      ? await supabase.rpc(
          input.status === 'concluido_automatico'
            ? 'complete_appointment_financial_flow_with_status'
            : 'complete_appointment_financial_flow',
          {
          p_appointment_id: input.id,
          p_empresa_id: input.empresaId,
          p_forma_pagamento: 'Agendamento',
          ...(input.status === 'concluido_automatico'
            ? { p_status: 'concluido_automatico' }
            : {}),
          },
        )
      : await supabase
          .from(table)
          .update(patch)
          .eq('empresa_id', input.empresaId)
          .eq('id', input.id)

  const { error } = updateResponse

  if (error) {
    throw new Error(error.message)
  }

  if (
    input.source === 'appointment' &&
    (input.status === 'concluido' || input.status === 'concluido_automatico')
  ) {
    try {
      await applyLoyaltyProgressForAppointment(input.empresaId, input.id)
    } catch (loyaltyError) {
      console.warn('[benefits] Não foi possível aplicar progresso de fidelidade.', {
        appointmentId: input.id,
        empresaId: input.empresaId,
        error: loyaltyError instanceof Error ? loyaltyError.message : loyaltyError,
      })
    }
  }

  const { error: logError } = await supabase
    .from('appointment_status_logs')
    .insert({
      appointment_id: input.id,
      changed_by: user?.id ?? null,
      changed_by_role: 'barbearia',
      empresa_id: input.empresaId,
      metadata: {},
      new_status: input.status,
      old_status: current?.status ?? null,
      reason: input.reason ?? null,
      source: input.source === 'appointment' ? 'appointments' : 'atendimentos',
    })

  if (logError) {
    throw new Error(logError.message)
  }

  const actionByStatus: Partial<Record<DailyAppointmentStatus, string>> = {
    cancelado: 'atendimento_cancelado',
    concluido: 'atendimento_concluido',
    faltou: 'atendimento_nao_compareceu',
    nao_compareceu: 'atendimento_nao_compareceu',
  }
  const auditAction = actionByStatus[input.status]

  if (auditAction) {
    await createAuditLog({
      action: auditAction,
      empresaId: input.empresaId,
      entityId: input.id,
      entityType: input.source,
      metadata: {
        motivo: input.reason ?? null,
        novo_status: input.status,
        status_anterior: current?.status ?? null,
      },
      userRole: 'administrador',
    })
  }

  if (['cancelado', 'nao_compareceu', 'faltou'].includes(input.status)) {
    await supabase
      .from('movimentacoes_financeiras')
      .update({ cancelled_at: now, status: 'cancelada' })
      .eq(
        input.source === 'appointment' ? 'appointment_id' : 'atendimento_id',
        input.id,
      )
    await supabase
      .from('comissoes')
      .update({ status: 'cancelada' })
      .eq('empresa_id', input.empresaId)
      .eq(
        'atendimento_id',
        input.source === 'appointment' ? current?.atendimento_id ?? input.id : input.id,
      )

    if (input.status === 'cancelado' && current) {
      if (input.source === 'appointment') {
        void sendAppointmentCancelledPushNotification({ appointmentId: input.id }).catch(
          (pushError) => {
            logger.warn({
              action: 'appointment_cancelled_push_failed',
              area: 'notifications',
              empresaId: input.empresaId,
              error: pushError,
              message: 'O agendamento foi cancelado, mas o push não pôde ser enviado.',
              metadata: { appointmentId: input.id },
            })
          },
        )
      }

      await notifyWaitlistForVacancy({
        barberId: current.barbeiro_id,
        barbershopName: current.barbershop?.nome,
        empresaId: input.empresaId,
        serviceId: current.servico_id ?? current.items?.[0]?.servico_id ?? null,
        startsAt: current.starts_at ?? current.data_hora_inicio ?? now,
      })
    }
  }
}

export async function rescheduleDailyAppointment(input: {
  appointment: DailyAppointment
  empresaId: string
  startsAt: string
  endsAt: string
}) {
  if (!input.appointment.barbeiro_id) {
    throw new Error('Atendimento sem barbeiro vinculado.')
  }

  const date = input.startsAt.slice(0, 10)
  const start = new Date(input.startsAt).getTime()
  const end = new Date(input.endsAt).getTime()
  let hasConflict = false

  // Atendimentos legados (tabela `atendimentos`) nao possuem barbershop_id,
  // pois nao passam pelo fluxo de agendamento online. Nesse caso nao ha como
  // consultar a RPC get_booking_busy_slots (ela exige um barbershop_id valido),
  // entao a checagem de conflito e pulada — mesmo comportamento que ja existia
  // antes desta correcao, so que sem lancar um erro de UUID invalido no meio do caminho.
  if (input.appointment.barbershop_id) {
    const busy = await listBarberAppointments(
      input.appointment.barbershop_id,
      input.appointment.barbeiro_id,
      date,
      input.appointment.source === 'appointment' ? input.appointment.id : undefined,
    )

    hasConflict = busy.some((item) => {
      if (
        input.appointment.source === 'atendimento' &&
        item.starts_at === input.appointment.starts_at
      ) {
        return false
      }

      return start < new Date(item.ends_at).getTime() && end > new Date(item.starts_at).getTime()
    })
  }

  if (hasConflict) {
    throw new Error('Este horário não está disponível para remarcação.')
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const now = new Date().toISOString()

  const nextStatus =
    input.appointment.status === 'confirmado'
      ? ('confirmado' as const)
      : ('agendado' as const)
  const updateResponse =
    input.appointment.source === 'appointment'
      ? await supabase
          .from('appointments')
          .update({
            ends_at: input.endsAt,
            rescheduled_at: now,
            rescheduled_by: user?.id ?? null,
            rescheduled_from_ends_at: input.appointment.ends_at,
            rescheduled_from_starts_at: input.appointment.starts_at,
            starts_at: input.startsAt,
            status: nextStatus,
          })
          .eq('empresa_id', input.empresaId)
          .eq('id', input.appointment.id)
      : await supabase
          .from('atendimentos')
          .update({
            data_hora_fim: input.endsAt,
            data_hora_inicio: input.startsAt,
            rescheduled_at: now,
            rescheduled_by: user?.id ?? null,
            rescheduled_from_ends_at: input.appointment.ends_at,
            rescheduled_from_starts_at: input.appointment.starts_at,
            status: nextStatus,
          })
          .eq('empresa_id', input.empresaId)
          .eq('id', input.appointment.id)

  const { error } = updateResponse

  if (error) {
    throw new Error(error.message)
  }

  const { error: logError } = await supabase
    .from('appointment_status_logs')
    .insert({
      appointment_id: input.appointment.id,
      changed_by: user?.id ?? null,
      changed_by_role: 'barbearia',
      empresa_id: input.empresaId,
      metadata: {
        from_ends_at: input.appointment.ends_at,
        from_starts_at: input.appointment.starts_at,
        to_ends_at: input.endsAt,
        to_starts_at: input.startsAt,
      },
      new_status: 'remarcado',
      old_status: input.appointment.status,
      reason: 'Remarcação pela barbearia',
      source:
        input.appointment.source === 'appointment' ? 'appointments' : 'atendimentos',
    })

  if (logError) {
    throw new Error(logError.message)
  }

  await createAuditLog({
    action: 'atendimento_remarcado',
    empresaId: input.empresaId,
    entityId: input.appointment.id,
    entityType: input.appointment.source,
    metadata: {
      de: input.appointment.starts_at,
      para: input.startsAt,
    },
    userRole: 'administrador',
  })
}

export async function listAdminWaitlist(empresaId: string) {
  const { data, error } = await supabase
    .from('appointment_waitlist')
    .select('*,client:profiles(nome,telefone),service:servicos(nome),barber:barbeiros(nome)')
    .eq('empresa_id', empresaId)
    .in('status', ['aguardando', 'notificado'])
    .order('desired_date', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as unknown as AdminWaitlistEntry[]
}

export async function notifyWaitlistEntry(input: {
  entry: AdminWaitlistEntry
  barbershopName?: string | null
}) {
  const message = `Olá, ${input.entry.client?.nome ?? 'cliente'}! Surgiu uma possibilidade de horário na ${input.barbershopName ?? 'barbearia'} para ${new Date(`${input.entry.desired_date}T00:00:00`).toLocaleDateString('pt-BR')}. Acesse o app BW Barber para confirmar seu agendamento.`

  const { error: notificationError } = await supabase
    .from('notification_logs')
    .insert({
      channel: 'whatsapp',
      client_id: input.entry.client_id,
      empresa_id: input.entry.empresa_id,
      message,
      status: 'pendente',
      type: 'waitlist_manual',
    })

  if (notificationError) {
    throw new Error(notificationError.message)
  }

  const { error } = await supabase
    .from('appointment_waitlist')
    .update({ notified_at: new Date().toISOString(), status: 'notificado' })
    .eq('id', input.entry.id)

  if (error) {
    throw new Error(error.message)
  }
}

export async function removeAdminWaitlistEntry(input: {
  empresaId: string
  id: string
}) {
  const { error } = await supabase
    .from('appointment_waitlist')
    .update({ status: 'cancelado' })
    .eq('empresa_id', input.empresaId)
    .eq('id', input.id)

  if (error) {
    throw new Error(error.message)
  }
}

export async function listAtendimentoClientes(
  empresaId: string,
): Promise<AtendimentoOption[]> {
  const { data, error } = await supabase
    .from('clientes')
    .select('id,nome')
    .eq('empresa_id', empresaId)
    .eq('status', 'ativo')
    .order('nome', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

export async function listAtendimentoBarbeiros(
  empresaId: string,
): Promise<AtendimentoOption[]> {
  const { data, error } = await supabase
    .from('barbeiros')
    .select('id,nome')
    .eq('empresa_id', empresaId)
    .eq('status', 'ativo')
    .order('nome', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

export async function getAtendimentoBarbeiroByUsuario(
  empresaId: string,
  usuarioId: string,
): Promise<AtendimentoOption | null> {
  const { data, error } = await supabase
    .from('barbeiros')
    .select('id,nome')
    .eq('empresa_id', empresaId)
    .eq('usuario_id', usuarioId)
    .eq('status', 'ativo')
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data ?? null
}

export async function listAtendimentoServicos(
  empresaId: string,
): Promise<ServicoOption[]> {
  const { data, error } = await supabase
    .from('servicos')
    .select('id,nome,preco,duration_minutes,duracao_minutos')
    .eq('empresa_id', empresaId)
    .eq('ativo', true)
    .order('nome', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

export async function listInternalAppointmentSlotData(
  empresaId: string,
  barbeiroId: string,
  date: string,
): Promise<InternalAppointmentSlotData> {
  if (!empresaId || !barbeiroId || !date) {
    return {
      appointments: [],
      businessHours: [],
      specialHour: null,
      unavailability: [],
    }
  }

  const { endIso, startIso } = dateRangeBounds(date, date)

  const businessHoursResponse = await supabase
    .from('barbershop_business_hours')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('day_of_week', { ascending: true })

  if (businessHoursResponse.error) {
    throw new Error(businessHoursResponse.error.message)
  }

  const businessHours = (businessHoursResponse.data ?? []) as BusinessHour[]

  if (!hasConfiguredBusinessHours(businessHours)) {
    return {
      appointments: [],
      businessHours,
      specialHour: null,
      unavailability: [],
    }
  }

  const [
    specialHourResponse,
    unavailabilityResponse,
    appointmentsResponse,
    legacyAppointmentsResponse,
    legacyServicesResponse,
  ] = await Promise.all([
    supabase
      .from('barbershop_special_hours')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('date', date)
      .maybeSingle(),
    supabase
      .from('barber_unavailability')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('barber_id', barbeiroId)
      .eq('date', date),
    supabase
      .from('appointments')
      .select('starts_at,ends_at')
      .eq('empresa_id', empresaId)
      .eq('barbeiro_id', barbeiroId)
      .not('status', 'in', '(cancelado,remarcado,nao_compareceu,faltou)')
      .lt('starts_at', endIso)
      .gt('ends_at', startIso),
    supabase
      .from('atendimentos')
      .select('data_hora_inicio,data_hora_fim,servico_id')
      .eq('empresa_id', empresaId)
      .eq('barbeiro_id', barbeiroId)
      .not('status', 'in', '(cancelado,remarcado,nao_compareceu,faltou)')
      .gte('data_hora_inicio', startIso)
      .lt('data_hora_inicio', endIso),
    supabase
      .from('servicos')
      .select('id,duration_minutes,duracao_minutos')
      .eq('empresa_id', empresaId),
  ])

  if (specialHourResponse.error) {
    throw new Error(specialHourResponse.error.message)
  }

  if (unavailabilityResponse.error) {
    throw new Error(unavailabilityResponse.error.message)
  }

  if (appointmentsResponse.error) {
    throw new Error(appointmentsResponse.error.message)
  }

  if (legacyAppointmentsResponse.error) {
    throw new Error(legacyAppointmentsResponse.error.message)
  }

  if (legacyServicesResponse.error) {
    throw new Error(legacyServicesResponse.error.message)
  }

  const serviceDurations = new Map(
    (legacyServicesResponse.data ?? []).map((service) => [
      service.id,
      Number(service.duration_minutes ?? service.duracao_minutos ?? 30),
    ]),
  )

  const legacyAppointments = (legacyAppointmentsResponse.data ?? []).map((item) => {
    const startsAt = item.data_hora_inicio
    const durationMinutes = serviceDurations.get(item.servico_id ?? '') ?? 30
    const endsAt =
      item.data_hora_fim ??
      new Date(new Date(startsAt).getTime() + durationMinutes * 60 * 1000).toISOString()

    return {
      ends_at: endsAt,
      starts_at: startsAt,
    }
  })

  return {
    appointments: [
      ...((appointmentsResponse.data ?? []) as Array<{
        starts_at: string
        ends_at: string
      }>),
      ...legacyAppointments,
    ],
    businessHours,
    specialHour: specialHourResponse.data as SpecialBusinessHour | null,
    unavailability: (unavailabilityResponse.data ?? []) as BookingUnavailability[],
  }
}

export async function registrarAtendimento(
  empresaId: string,
  data: AtendimentoFormData,
) {
  const dataHoraInicio = new Date(`${data.data}T${data.hora}:00`)
  const { data: service, error: serviceError } = await supabase
    .from('servicos')
    .select('id,nome,preco,duration_minutes,duracao_minutos')
    .eq('empresa_id', empresaId)
    .eq('id', data.servico_id)
    .single()

  if (serviceError) {
    throw new Error(serviceError.message)
  }

  const durationMinutes = Number(
    service?.duration_minutes ?? service?.duracao_minutos ?? 30,
  )
  const dataHoraFim = new Date(dataHoraInicio.getTime() + durationMinutes * 60 * 1000)

  const valorOriginal = Number(data.valor)
  const valorDesconto =
    data.desconto_tipo === 'percentual'
      ? valorOriginal * (Number(data.valor_desconto) / 100)
      : Number(data.valor_desconto)
  const valorFinal = Math.max(0, valorOriginal - valorDesconto)

  const { data: appointment, error } = await supabase.rpc('create_internal_appointment', {
    p_barbeiro_id: data.barbeiro_id,
    p_cliente_id: data.atendimento_tipo === 'cadastrado' ? data.cliente_id ?? null : null,
    p_ends_at: dataHoraFim.toISOString(),
    p_empresa_id: empresaId,
    p_is_walk_in: data.atendimento_tipo === 'avulso',
    p_motivo_desconto: data.motivo_desconto || null,
    p_servico_id: data.servico_id,
    p_starts_at: dataHoraInicio.toISOString(),
    p_valor_desconto: valorDesconto,
    p_valor_final: valorFinal,
    p_valor_original: valorOriginal,
    p_walk_in_customer_name: data.cliente_avulso_nome ?? null,
    p_walk_in_customer_phone: data.cliente_avulso_telefone ?? null,
    p_walk_in_notes: data.cliente_avulso_observacao ?? null,
  })

  if (error) {
    throw new Error(error.message)
  }

  if (!appointment) {
    return
  }

  if (data.benefit_id) {
    await redeemClientBenefit(data.benefit_id, appointment.id)
  }

  if (valorDesconto > 0) {
    const { error: discountError } = await supabase.from('discount_logs').insert({
      appointment_id: appointment.id,
      empresa_id: empresaId,
      motivo: data.motivo_desconto ?? 'Outro',
      tipo: data.desconto_tipo,
      valor_desconto: valorDesconto,
      valor_final: valorFinal,
      valor_original: valorOriginal,
    })

    if (discountError) {
      throw new Error(discountError.message)
    }

    void createAuditLog({
      action: 'desconto_aplicado',
      empresaId,
      entityId: appointment.id,
      entityType: 'appointments',
      metadata: {
        motivo: data.motivo_desconto ?? 'Outro',
        tipo: data.desconto_tipo,
        valor_desconto: valorDesconto,
        valor_final: valorFinal,
        valor_original: valorOriginal,
      },
      userRole: 'administrador',
    })
  }

  return appointment
}

function dateRangeBounds(dataInicio: string, dataFim: string) {
  const start = new Date(`${dataInicio}T00:00:00`)
  const end = new Date(`${dataFim}T00:00:00`)
  end.setDate(end.getDate() + 1)

  return {
    endIso: end.toISOString(),
    startIso: start.toISOString(),
  }
}

function isCompletedStatus(status: string) {
  return status === 'concluido' || status === 'concluido_automatico'
}

function isNoShowStatus(status: string) {
  return status === 'nao_compareceu' || status === 'faltou'
}

function commissionValue(record: { valor: number; valor_final: number }) {
  return Number(record.valor_final || record.valor) * 0.6
}

export async function listAtendimentoRecords(
  empresaId: string,
  filters: AtendimentoRecordFilters,
): Promise<AtendimentoRecordsResult> {
  const { endIso, startIso } = dateRangeBounds(filters.dataInicio, filters.dataFim)
  const rowsToFetch = (filters.page + 1) * filters.pageSize

  let appointmentIdsByService: string[] | null = null

  if (filters.servicoId) {
    const { data: itemRows, error: itemError } = await supabase
      .from('appointment_items')
      .select('appointment_id')
      .eq('servico_id', filters.servicoId)

    if (itemError) {
      throw new Error(itemError.message)
    }

    appointmentIdsByService = [
      ...new Set((itemRows ?? []).map((item) => item.appointment_id)),
    ]
  }

  let appointmentsQuery = supabase
    .from('appointments')
    .select(
      'id,atendimento_id,cliente_id,client_profile_id,created_by_user_id,starts_at,status,valor_original,valor_desconto,valor_final,is_walk_in,walk_in_customer_name,cliente:clientes(nome),client:profiles(nome),barbeiro:barbeiros(nome),items:appointment_items(nome,servico_id,valor_original,valor_desconto,valor_final)',
      { count: 'exact' },
    )
    .eq('empresa_id', empresaId)
    .gte('starts_at', startIso)
    .lt('starts_at', endIso)
    .order('starts_at', { ascending: false })
    .range(0, Math.max(0, rowsToFetch - 1))

  let atendimentosQuery = supabase
    .from('atendimentos')
    .select('*,clientes(nome),barbeiros(nome),servicos(nome)', { count: 'exact' })
    .eq('empresa_id', empresaId)
    .gte('data_hora_inicio', startIso)
    .lt('data_hora_inicio', endIso)
    .order('data_hora_inicio', { ascending: false })
    .range(0, Math.max(0, rowsToFetch - 1))

  if (filters.barbeiroId) {
    appointmentsQuery = appointmentsQuery.eq('barbeiro_id', filters.barbeiroId)
    atendimentosQuery = atendimentosQuery.eq('barbeiro_id', filters.barbeiroId)
  }

  if (filters.clienteId) {
    appointmentsQuery = appointmentsQuery.eq('cliente_id', filters.clienteId)
    atendimentosQuery = atendimentosQuery.eq('cliente_id', filters.clienteId)
  }

  if (filters.status) {
    appointmentsQuery = appointmentsQuery.eq(
      'status',
      filters.status as DailyAppointmentStatus,
    )
    atendimentosQuery = atendimentosQuery.eq(
      'status',
      filters.status as DailyAppointmentStatus,
    )
  }

  if (filters.servicoId) {
    atendimentosQuery = atendimentosQuery.eq('servico_id', filters.servicoId)

    if (appointmentIdsByService?.length) {
      appointmentsQuery = appointmentsQuery.in('id', appointmentIdsByService)
    } else {
      appointmentsQuery = appointmentsQuery.in('id', ['00000000-0000-0000-0000-000000000000'])
    }
  }

  const [appointmentsResponse, atendimentosResponse] = await Promise.all([
    appointmentsQuery,
    atendimentosQuery,
  ])

  if (appointmentsResponse.error) {
    throw new Error(appointmentsResponse.error.message)
  }

  if (atendimentosResponse.error) {
    throw new Error(atendimentosResponse.error.message)
  }

  const appointments = (appointmentsResponse.data ?? []) as unknown as Array<{
    id: string
    atendimento_id: string | null
    cliente_id: string | null
    client_profile_id: string | null
    created_by_user_id: string | null
    starts_at: string
    status: DailyAppointmentStatus
    valor_original: number | null
    valor_desconto: number | null
    valor_final: number | null
    is_walk_in: boolean | null
    walk_in_customer_name: string | null
    cliente: { nome: string } | null
    client: { nome: string } | null
    barbeiro: { nome: string } | null
    items: Array<{
      nome: string
      valor_original: number | null
      valor_desconto: number | null
      valor_final: number | null
    }>
  }>

  const atendimentos =
    (atendimentosResponse.data ?? []) as unknown as Array<
      Atendimento & {
        clientes: { nome: string } | null
        barbeiros: { nome: string } | null
        servicos: { nome: string } | null
      }
    >

  const linkedAtendimentoIds = new Set(
    appointments
      .map((appointment) => appointment.atendimento_id)
      .filter(Boolean),
  )
  const unlinkedAtendimentos = atendimentos.filter(
    (atendimento) => !linkedAtendimentoIds.has(atendimento.id),
  )
  const fallbackCustomers = await getAppointmentCustomerFallbacks(empresaId, [
    ...appointments,
    ...unlinkedAtendimentos.map((atendimento) => ({
      cliente_id: atendimento.cliente_id,
    })),
  ])

  const records: AtendimentoRecord[] = [
    ...appointments.map((appointment) => {
      const totalOriginal =
        appointment.items.reduce(
          (total, item) => total + Number(item.valor_original ?? item.valor_final ?? 0),
          0,
        ) || Number(appointment.valor_original ?? appointment.valor_final ?? 0)
      const totalDiscount =
        appointment.items.reduce(
          (total, item) => total + Number(item.valor_desconto ?? 0),
          0,
        ) || Number(appointment.valor_desconto ?? 0)
      const totalFinal =
        appointment.items.reduce(
          (total, item) => total + Number(item.valor_final ?? 0),
          0,
        ) || Number(appointment.valor_final ?? totalOriginal - totalDiscount)
      const fallbackCustomer =
        (appointment.cliente_id
          ? fallbackCustomers.byClientId.get(appointment.cliente_id)
          : null) ??
        (appointment.client_profile_id
          ? fallbackCustomers.byProfileId.get(appointment.client_profile_id)
          : null) ??
        (appointment.created_by_user_id
          ? fallbackCustomers.byAuthUserId.get(appointment.created_by_user_id)
          : null)
      const fallbackProfile =
        (appointment.client_profile_id
          ? fallbackCustomers.profilesByProfileId.get(appointment.client_profile_id)
          : null) ??
        (appointment.created_by_user_id
          ? fallbackCustomers.profilesByAuthUserId.get(appointment.created_by_user_id)
          : null)
      const cliente = appointment.is_walk_in
        ? displayCustomerName(
            appointment.walk_in_customer_name,
            appointment.cliente?.nome,
            fallbackCustomer?.nome,
            appointment.client?.nome,
            fallbackProfile?.nome,
          )
        : displayCustomerName(
            appointment.cliente?.nome,
            fallbackCustomer?.nome,
            appointment.client?.nome,
            fallbackProfile?.nome,
            appointment.walk_in_customer_name,
          )

      return {
        barbeiro: appointment.barbeiro?.nome ?? 'Barbeiro',
        cliente,
        cliente_tipo: appointment.is_walk_in
          ? ('avulso' as const)
          : ('cadastrado' as const),
        id: appointment.id,
        servico: appointment.items.map((item) => item.nome).join(' + ') || 'Serviço',
        source: 'appointment' as const,
        starts_at: appointment.starts_at,
        status: appointment.status,
        valor: totalOriginal,
        valor_desconto: totalDiscount,
        valor_final: totalFinal,
      }
    }),
    ...unlinkedAtendimentos.map((atendimento) => {
      const fallbackCustomer = fallbackCustomers.byClientId.get(atendimento.cliente_id)

      return {
        barbeiro: atendimento.barbeiros?.nome ?? 'Barbeiro',
        cliente: displayCustomerName(atendimento.clientes?.nome, fallbackCustomer?.nome),
        cliente_tipo: 'cadastrado' as const,
        id: atendimento.id,
        servico: atendimento.servicos?.nome ?? 'Serviço',
        source: 'atendimento' as const,
        starts_at: atendimento.data_hora_inicio,
        status: atendimento.status as DailyAppointmentStatus,
        valor: Number(atendimento.valor_original ?? atendimento.valor),
        valor_desconto: Number(atendimento.valor_desconto ?? atendimento.desconto ?? 0),
        valor_final: Number(atendimento.valor_final ?? atendimento.valor),
      }
    }),
  ].sort(
    (first, second) =>
      new Date(second.starts_at).getTime() - new Date(first.starts_at).getTime(),
  )

  const total = Number(appointmentsResponse.count ?? 0) + Number(atendimentosResponse.count ?? 0)
  const pageStart = filters.page * filters.pageSize
  const items = records.slice(pageStart, pageStart + filters.pageSize)

  const summary = records.reduce<AtendimentoRecordSummary>(
    (acc, record) => {
      acc.total += 1

      if (isCompletedStatus(record.status)) {
        acc.concluidos += 1
        acc.receita += Number(record.valor_final)
        acc.comissao += commissionValue(record)
      }

      if (record.status === 'cancelado') {
        acc.cancelados += 1
      }

      if (isNoShowStatus(record.status)) {
        acc.naoCompareceu += 1
      }

      return acc
    },
    {
      cancelados: 0,
      comissao: 0,
      concluidos: 0,
      naoCompareceu: 0,
      receita: 0,
      total: 0,
    },
  )

  return {
    hasMore: records.length > pageStart + filters.pageSize || total > pageStart + filters.pageSize,
    items,
    page: filters.page,
    pageSize: filters.pageSize,
    summary,
    total,
  }
}
