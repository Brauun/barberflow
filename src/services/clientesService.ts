import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'
import type { ClienteFormData } from '../types/clientes'
import { duplicateAwareError } from '../utils/duplicateErrors'
import { toAppError } from '../utils/handleAppError'
import { onlyDigits } from '../utils/masks'

export type Cliente = Database['public']['Tables']['clientes']['Row']

export type ClienteSearchResult = Pick<
  Cliente,
  'email' | 'id' | 'nome' | 'telefone'
>

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
  cliente_id?: string | null
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

async function ensureClienteNotDuplicated(
  empresaId: string,
  data: ClienteFormData,
  clienteId?: string,
) {
  const telefone = onlyDigits(data.telefone)

  if (!telefone) {
    return
  }

  let query = supabase
    .from('clientes')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('telefone', telefone)
    .limit(1)

  if (clienteId) {
    query = query.neq('id', clienteId)
  }

  const { data: duplicated, error } = await query.maybeSingle()

  if (error) {
    throw toAppError(error, 'Não foi possível validar duplicidade do cliente.')
  }

  if (duplicated) {
    throw new Error('Já existe um cliente cadastrado com este telefone.')
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

async function listClientesCompact(
  empresaId: string,
  search: string,
): Promise<ClienteWithIndicators[]> {
  const term = search.trim()
  const clientesQuery = supabase
    .from('clientes')
    .select('*')
    .eq('empresa_id', empresaId)
    .eq('status', 'ativo')
    .limit(20)

  if (term.length >= 2) {
    const escapedTerm = escapeLikeSearch(term)
    const termDigits = onlyDigits(term)
    const filters = [
      `nome.ilike.%${escapedTerm}%`,
      `email.ilike.%${escapedTerm}%`,
      `telefone.ilike.%${escapedTerm}%`,
    ]

    if (termDigits.length >= 2) {
      filters.push(`telefone.ilike.%${termDigits}%`)
    }

    clientesQuery.or(filters.join(',')).order('nome', { ascending: true })
  } else {
    clientesQuery.order('created_at', { ascending: false })
  }

  const clientesResponse = await clientesQuery

  if (clientesResponse.error) {
    throw toAppError(clientesResponse.error, 'NÃ£o foi possÃ­vel listar clientes.')
  }

  const clientes = (clientesResponse.data ?? []) as Cliente[]

  if (!clientes.length) {
    return []
  }

  const clienteIds = clientes.map((cliente) => cliente.id)
  const clientProfileIds = clientes
    .map((cliente) => cliente.client_profile_id)
    .filter((clientProfileId): clientProfileId is string =>
      Boolean(clientProfileId),
    )

  const [
    atendimentosResponse,
    appointmentsByClienteResponse,
    appointmentsByProfileResponse,
  ] = await Promise.all([
    supabase
      .from('atendimentos')
      .select('cliente_id,data_hora_inicio,valor')
      .eq('empresa_id', empresaId)
      .in('cliente_id', clienteIds)
      .in('status', [
        'concluido',
        'concluido_automatico',
      ]),
    supabase
      .from('appointments')
      .select('cliente_id,client_profile_id,starts_at,status,valor_final')
      .eq('empresa_id', empresaId)
      .in('cliente_id', clienteIds)
      .not('status', 'in', '(cancelado,remarcado,nao_compareceu,faltou)'),
    clientProfileIds.length
      ? supabase
          .from('appointments')
          .select('cliente_id,client_profile_id,starts_at,status,valor_final')
          .eq('empresa_id', empresaId)
          .in('client_profile_id', clientProfileIds)
          .not('status', 'in', '(cancelado,remarcado,nao_compareceu,faltou)')
      : Promise.resolve({ data: [], error: null }),
  ])

  const failedResponse = [
    atendimentosResponse,
    appointmentsByClienteResponse,
    appointmentsByProfileResponse,
  ].find((response) => response.error)

  const listError = failedResponse?.error

  if (listError) {
    throw toAppError(listError, 'NÃ£o foi possÃ­vel listar clientes.')
  }

  const atendimentos = (atendimentosResponse.data ?? []) as ClienteIndicator[]
  const appointments = [
    ...(appointmentsByClienteResponse.data ?? []),
    ...(appointmentsByProfileResponse.data ?? []),
  ] as unknown as AppointmentClientIndicator[]
  const uniqueAppointments = Array.from(
    new Map(
      appointments.map((appointment) => [
        `${appointment.cliente_id ?? ''}:${appointment.client_profile_id ?? ''}:${appointment.starts_at}`,
        appointment,
      ]),
    ).values(),
  )

  return clientes.map((cliente) => {
    const atendimentosDoCliente = atendimentos.filter(
      (atendimento) => atendimento.cliente_id === cliente.id,
    )
    const agendamentosDoCliente = uniqueAppointments.filter(
      (appointment) =>
        appointment.cliente_id === cliente.id ||
        (Boolean(cliente.client_profile_id) &&
          appointment.client_profile_id === cliente.client_profile_id),
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
      is_online_only: false,
      total_gasto: atendimentosDoCliente.reduce(
        (total, atendimento) => total + Number(atendimento.valor),
        0,
      ),
      ultima_visita: ultimaVisita ?? null,
      visitas_count:
        atendimentosDoCliente.length + agendamentosDoCliente.length,
    }
  })
}

export async function listClientes(
  empresaId: string,
  search: string,
): Promise<ClienteWithIndicators[]> {
  return listClientesCompact(empresaId, search)
}

export async function listClientesLegacy(
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

  const legacyListError = failedResponse?.error

  if (legacyListError) {
    throw toAppError(legacyListError, 'Não foi possível listar clientes.')
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

function escapeLikeSearch(value: string) {
  return value.replaceAll('%', '\\%').replaceAll('_', '\\_')
}

export async function searchClientes(
  empresaId: string,
  search: string,
  limit = 10,
): Promise<ClienteSearchResult[]> {
  const term = search.trim()

  if (term.length < 2) {
    return []
  }

  const escapedTerm = escapeLikeSearch(term)
  const termDigits = onlyDigits(term)
  const filters = [
    `nome.ilike.%${escapedTerm}%`,
    `email.ilike.%${escapedTerm}%`,
    `telefone.ilike.%${escapedTerm}%`,
  ]

  if (termDigits.length >= 2) {
    filters.push(`telefone.ilike.%${termDigits}%`)
  }

  const { data, error } = await supabase
    .from('clientes')
    .select('id,nome,telefone,email')
    .eq('empresa_id', empresaId)
    .eq('status', 'ativo')
    .or(filters.join(','))
    .order('nome', { ascending: true })
    .limit(limit)

  if (error) {
    throw toAppError(error, 'Não foi possível buscar clientes.')
  }

  return data ?? []
}

export async function createCliente(empresaId: string, data: ClienteFormData) {
  await ensureClienteNotDuplicated(empresaId, data)

  const { error } = await supabase
    .from('clientes')
    .insert(normalizeClienteInput(data, empresaId))

  if (error) {
    throw duplicateAwareError(
      error,
      {
        clientes_empresa_email_normalizado_unique_idx:
          'Já existe um cliente cadastrado com este e-mail.',
        clientes_empresa_telefone_normalizado_unique_idx:
          'Já existe um cliente cadastrado com este telefone.',
      },
      'Não foi possível criar o cliente.',
    )
  }
}

export async function updateCliente(
  empresaId: string,
  clienteId: string,
  data: ClienteFormData,
) {
  await ensureClienteNotDuplicated(empresaId, data, clienteId)

  const { error } = await supabase
    .from('clientes')
    .update(normalizeClienteInput(data, empresaId))
    .eq('empresa_id', empresaId)
    .eq('id', clienteId)

  if (error) {
    throw duplicateAwareError(
      error,
      {
        clientes_empresa_email_normalizado_unique_idx:
          'Já existe um cliente cadastrado com este e-mail.',
        clientes_empresa_telefone_normalizado_unique_idx:
          'Já existe um cliente cadastrado com este telefone.',
      },
      'Não foi possível atualizar o cliente.',
    )
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
    throw toAppError(error, 'Não foi possível carregar o historico do cliente.')
  }

  return (data ?? []) as unknown as ClienteAtendimento[]
}
