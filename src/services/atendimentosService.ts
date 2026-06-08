import { supabase } from '../lib/supabase'
import {
  listBarberAppointments,
  notifyWaitlistForVacancy,
} from './clientService'
import type { AtendimentoFormData } from '../types/atendimentos'
import type { Database } from '../types/database'

export type Atendimento = Database['public']['Tables']['atendimentos']['Row']

export type AtendimentoListItem = Atendimento & {
  barbeiros: { nome: string } | null
  clientes: { nome: string } | null
  servicos: { nome: string } | null
}

export type AtendimentoOption = {
  id: string
  nome: string
}

export type DailyAppointmentStatus =
  | 'agendado'
  | 'confirmado'
  | 'em_atendimento'
  | 'concluido'
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
  barbeiro: string
  barbeiro_id: string | null
  service_id: string | null
  servico: string
  duration_minutes: number
  valor: number
  status: DailyAppointmentStatus
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
      'id,starts_at,ends_at,status,valor_final,barbeiro_id,client:profiles(nome),barbeiro:barbeiros(nome),items:appointment_items(nome,duration_minutes,valor_final)',
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
    starts_at: string
    ends_at: string
    status: DailyAppointmentStatus
    valor_final: number
    barbeiro_id: string | null
    client: { nome: string } | null
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

  return [
    ...appointments.map((appointment) => {
      const firstItem = appointment.items[0]

      return {
        barbeiro: appointment.barbeiro?.nome ?? 'Barbeiro',
        barbeiro_id: appointment.barbeiro_id,
        cliente: appointment.client?.nome ?? 'Cliente',
        duration_minutes:
          firstItem?.duration_minutes ??
          Math.round(
            (new Date(appointment.ends_at).getTime() -
              new Date(appointment.starts_at).getTime()) /
              60000,
          ),
        id: appointment.id,
        servico: appointment.items.map((item) => item.nome).join(' + ') || 'Servico',
        source: 'appointment' as const,
        ends_at: appointment.ends_at,
        starts_at: appointment.starts_at,
        status: appointment.status,
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
    ...atendimentos.map((atendimento) => ({
      barbeiro: atendimento.barbeiros?.nome ?? 'Barbeiro',
      barbeiro_id: atendimento.barbeiro_id,
      cliente: atendimento.clientes?.nome ?? 'Cliente',
      duration_minutes: atendimento.servicos?.duracao_minutos ?? 30,
      id: atendimento.id,
      ends_at:
        atendimento.data_hora_fim ??
        new Date(
          new Date(atendimento.data_hora_inicio).getTime() +
            (atendimento.servicos?.duracao_minutos ?? 30) * 60 * 1000,
        ).toISOString(),
      servico: atendimento.servicos?.nome ?? 'Servico',
      service_id: atendimento.servico_id,
      source: 'atendimento' as const,
      starts_at: atendimento.data_hora_inicio,
      status: atendimento.status as DailyAppointmentStatus,
      valor: Number(atendimento.valor_final ?? atendimento.valor),
    })),
  ].sort(
    (first, second) =>
      new Date(first.starts_at).getTime() - new Date(second.starts_at).getTime(),
  )
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
          .select('id,status,starts_at,barbeiro_id,barbershop:barbershops(nome),items:appointment_items(servico_id)')
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

  const { error } = await supabase
    .from(table)
    .update(patch)
    .eq('empresa_id', input.empresaId)
    .eq('id', input.id)

  if (error) {
    throw new Error(error.message)
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

  if (input.status === 'cancelado') {
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
      .eq('atendimento_id', input.id)

    if (current) {
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
  const busy = await listBarberAppointments(
    '',
    input.appointment.barbeiro_id,
    date,
    input.appointment.source === 'appointment' ? input.appointment.id : undefined,
    input.empresaId,
  )
  const start = new Date(input.startsAt).getTime()
  const end = new Date(input.endsAt).getTime()
  const hasConflict = busy.some((item) => {
    if (
      input.appointment.source === 'atendimento' &&
      item.starts_at === input.appointment.starts_at
    ) {
      return false
    }

    return start < new Date(item.ends_at).getTime() && end > new Date(item.starts_at).getTime()
  })

  if (hasConflict) {
    throw new Error('Este horario nao esta disponivel para remarcacao.')
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
      reason: 'Remarcacao pela barbearia',
      source:
        input.appointment.source === 'appointment' ? 'appointments' : 'atendimentos',
    })

  if (logError) {
    throw new Error(logError.message)
  }
}

export async function listAdminWaitlist(empresaId: string) {
  const { data, error } = await supabase
    .from('appointment_waitlist')
    .select('*,client:profiles(nome,telefone),service:servicos(nome),barber:barbeiros(nome)')
    .eq('empresa_id', empresaId)
    .neq('status', 'cancelado')
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
  const message = `Ola, ${input.entry.client?.nome ?? 'cliente'}! Surgiu uma possibilidade de horario na ${input.barbershopName ?? 'barbearia'} para ${new Date(`${input.entry.desired_date}T00:00:00`).toLocaleDateString('pt-BR')}. Acesse o app BW Barber para confirmar seu agendamento.`

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

export async function listAtendimentoServicos(
  empresaId: string,
): Promise<ServicoOption[]> {
  const { data, error } = await supabase
    .from('servicos')
    .select('id,nome,preco')
    .eq('empresa_id', empresaId)
    .eq('ativo', true)
    .order('nome', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

export async function registrarAtendimento(
  empresaId: string,
  data: AtendimentoFormData,
) {
  const dataHoraInicio = new Date(`${data.data}T${data.hora}:00`)

  const valorOriginal = Number(data.valor)
  const valorDesconto =
    data.desconto_tipo === 'percentual'
      ? valorOriginal * (Number(data.valor_desconto) / 100)
      : Number(data.valor_desconto)
  const valorFinal = Math.max(0, valorOriginal - valorDesconto)

  const { data: atendimento, error } = await supabase.rpc('registrar_atendimento', {
    p_barbeiro_id: data.barbeiro_id,
    p_cliente_id: data.cliente_id,
    p_data_hora_inicio: dataHoraInicio.toISOString(),
    p_empresa_id: empresaId,
    p_forma_pagamento: data.forma_pagamento,
    p_servico_id: data.servico_id,
    p_valor: valorFinal,
  })

  if (error) {
    throw new Error(error.message)
  }

  if (!atendimento) {
    return
  }

  const atendimentoId = (atendimento as Atendimento).id

  const { error: updateError } = await supabase
    .from('atendimentos')
    .update({
      comissao_base: data.comissao_base,
      motivo_desconto: data.motivo_desconto || null,
      valor_desconto: valorDesconto,
      valor_final: valorFinal,
      valor_original: valorOriginal,
    })
    .eq('empresa_id', empresaId)
    .eq('id', atendimentoId)

  if (updateError) {
    throw new Error(updateError.message)
  }

  if (valorDesconto > 0) {
    const { error: discountError } = await supabase.from('discount_logs').insert({
      atendimento_id: atendimentoId,
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
  }
}
