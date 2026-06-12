import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'
import type { ClienteFormData } from '../types/clientes'
import { toAppError } from '../utils/handleAppError'
import { onlyDigits } from '../utils/masks'

export type Cliente = Database['public']['Tables']['clientes']['Row']

export type ClienteWithIndicators = Cliente & {
  agendamentos_count: number
  is_online_only?: boolean
  ultima_visita: string | null
  total_gasto: number
  visitas_count: number
}

export type ClienteAtendimento = {
  id: string
  data_hora_inicio: string
  valor: number
  status: string
  observacoes: string | null
  barbeiros: { nome: string } | null
  servicos: { nome: string } | null
}

type ClienteIndicator = {
  cliente_id: string
  data_hora_inicio: string
  valor: number
}

type AppointmentClientProfile = {
  created_at: string
  email: string | null
  id: string
  nome: string
  telefone: string | null
}

type AppointmentClientIndicator = {
  client: AppointmentClientProfile | AppointmentClientProfile[] | null
  client_profile_id: string | null
  starts_at: string
  status: string
  valor_final: number | null
}

function normalizeClienteInput(data: ClienteFormData, empresaId: string) {
  return {
    data_nascimento: data.data_nascimento || null,
    empresa_id: empresaId,
    nome: data.nome.trim(),
    observacoes: data.observacoes?.trim() || null,
    telefone: onlyDigits(data.telefone) || null,
  }
}

function getAppointmentProfile(appointment: AppointmentClientIndicator) {
  if (Array.isArray(appointment.client)) {
    return appointment.client[0] ?? null
  }

  return appointment.client
}

function matchesClienteSearch(cliente: Cliente, search: string) {
  const normalizedSearch = search.trim()

  if (!normalizedSearch) {
    return true
  }

  const normalizedSearchDigits = onlyDigits(normalizedSearch)
  const normalizedSearchLower = normalizedSearch.toLowerCase()
  const clientePhone = onlyDigits(cliente.telefone)
  const searchableText = [cliente.nome, cliente.email, cliente.telefone]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return (
    searchableText.includes(normalizedSearchLower) ||
    (Boolean(normalizedSearchDigits) &&
      clientePhone.includes(normalizedSearchDigits))
  )
}

export async function listClientes(
  empresaId: string,
  search: string,
): Promise<ClienteWithIndicators[]> {
  const [clientesResponse, atendimentosResponse, appointmentsResponse] =
    await Promise.all([
      supabase
        .from('clientes')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('nome', { ascending: true }),
      supabase
        .from('atendimentos')
        .select('cliente_id,data_hora_inicio,valor')
        .eq('empresa_id', empresaId)
        .in('status', ['concluido', 'concluido_automatico']),
      supabase
        .from('appointments')
        .select(
          'client_profile_id,starts_at,status,valor_final,client:profiles(id,nome,telefone,email,created_at)',
        )
        .eq('empresa_id', empresaId)
        .not('client_profile_id', 'is', null)
        .not('status', 'in', '(cancelado,remarcado,nao_compareceu,faltou)'),
    ])

  const failedResponse = [
    clientesResponse,
    atendimentosResponse,
    appointmentsResponse,
  ].find((response) => response.error)

  if (failedResponse?.error) {
    throw toAppError(failedResponse.error, 'Não foi possível listar clientes.')
  }

  const atendimentos = (atendimentosResponse.data ?? []) as ClienteIndicator[]
  const appointments = (appointmentsResponse.data ??
    []) as unknown as AppointmentClientIndicator[]
  const mergedClientes = new Map<string, Cliente>()

  ;((clientesResponse.data ?? []) as Cliente[]).forEach((cliente) => {
    mergedClientes.set(cliente.id, cliente)
  })

  appointments.forEach((appointment) => {
    const profile = getAppointmentProfile(appointment)

    if (!profile) {
      return
    }

    const profilePhone = onlyDigits(profile.telefone)
    const profileEmail = profile.email?.trim().toLowerCase()
    const alreadyExists = Array.from(mergedClientes.values()).some((cliente) => {
      const sameProfile = cliente.client_profile_id === profile.id
      const samePhone =
        profilePhone && onlyDigits(cliente.telefone) === profilePhone
      const sameEmail =
        profileEmail && cliente.email?.trim().toLowerCase() === profileEmail

      return Boolean(sameProfile || samePhone || sameEmail)
    })

    if (alreadyExists) {
      return
    }

    mergedClientes.set(`profile:${profile.id}`, {
      client_profile_id: profile.id,
      created_at: profile.created_at,
      data_nascimento: null,
      email: profile.email,
      empresa_id: empresaId,
      id: `profile:${profile.id}`,
      nome: profile.nome,
      observacoes: 'Cliente criado pelo agendamento online.',
      status: 'ativo',
      telefone: profile.telefone,
      updated_at: profile.created_at,
    })
  })

  return Array.from(mergedClientes.values())
    .filter((cliente) => matchesClienteSearch(cliente, search))
    .map((cliente) => {
      const atendimentosDoCliente = atendimentos.filter(
        (atendimento) => atendimento.cliente_id === cliente.id,
      )
      const agendamentosDoCliente = appointments.filter(
        (appointment) =>
          appointment.client_profile_id === cliente.client_profile_id,
      )
      const ultimaVisita = [
        ...atendimentosDoCliente.map(
          (atendimento) => atendimento.data_hora_inicio,
        ),
        ...agendamentosDoCliente.map((appointment) => appointment.starts_at),
      ]
        .sort()
        .at(-1)

      return {
        ...cliente,
        agendamentos_count: agendamentosDoCliente.length,
        is_online_only: cliente.id.startsWith('profile:'),
        total_gasto: atendimentosDoCliente.reduce(
          (total, atendimento) => total + Number(atendimento.valor),
          0,
        ),
        ultima_visita: ultimaVisita ?? null,
        visitas_count:
          atendimentosDoCliente.length + agendamentosDoCliente.length,
      }
    })
    .sort((first, second) => first.nome.localeCompare(second.nome, 'pt-BR'))
}

export async function createCliente(empresaId: string, data: ClienteFormData) {
  const { error } = await supabase
    .from('clientes')
    .insert(normalizeClienteInput(data, empresaId))

  if (error) {
    throw toAppError(error, 'Não foi possível criar o cliente.')
  }
}

export async function updateCliente(
  empresaId: string,
  clienteId: string,
  data: ClienteFormData,
) {
  const { error } = await supabase
    .from('clientes')
    .update(normalizeClienteInput(data, empresaId))
    .eq('empresa_id', empresaId)
    .eq('id', clienteId)

  if (error) {
    throw toAppError(error, 'Não foi possível atualizar o cliente.')
  }
}

export async function deleteCliente(empresaId: string, clienteId: string) {
  const { error } = await supabase
    .from('clientes')
    .delete()
    .eq('empresa_id', empresaId)
    .eq('id', clienteId)

  if (error) {
    throw toAppError(error, 'Não foi possível excluir o cliente.')
  }
}

export async function getClienteHistorico(
  empresaId: string,
  clienteId: string,
) {
  const { data, error } = await supabase
    .from('atendimentos')
    .select('id,data_hora_inicio,valor,status,observacoes,barbeiros(nome),servicos(nome)')
    .eq('empresa_id', empresaId)
    .eq('cliente_id', clienteId)
    .order('data_hora_inicio', { ascending: false })

  if (error) {
    throw toAppError(error, 'Não foi possível carregar o histórico do cliente.')
  }

  return (data ?? []) as unknown as ClienteAtendimento[]
}
