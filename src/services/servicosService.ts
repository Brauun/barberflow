import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'
import type { ServicoFormData } from '../types/servicos'
import { toAppError } from '../utils/handleAppError'
import { createAuditLog } from './observabilityService'

export type Servico = Database['public']['Tables']['servicos']['Row']
export type BarberService = Database['public']['Tables']['barber_services']['Row']
export type ServiceBarberOption = Pick<
  Database['public']['Tables']['barbeiros']['Row'],
  'id' | 'nome' | 'status'
>

function normalizeServicoInput(data: ServicoFormData, empresaId: string) {
  const status = data.ativo ? ('ativo' as const) : ('inativo' as const)

  return {
    ativo: data.ativo,
    allow_barber_create: false,
    categoria: data.categoria?.trim() || null,
    descricao: data.descricao?.trim() || null,
    duracao_minutos: Number(data.duracao_minutos),
    duration_minutes: Number(data.duracao_minutos),
    empresa_id: empresaId,
    nome: data.nome.trim(),
    percentual_comissao: Number(data.percentual_comissao ?? 60),
    preco: Number(data.preco),
    status,
  }
}

export async function listServicos(
  empresaId: string,
  search: string,
): Promise<Servico[]> {
  let query = supabase
    .from('servicos')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('nome', { ascending: true })

  const normalizedSearch = search.trim()

  if (normalizedSearch) {
    query = query.ilike('nome', `%${normalizedSearch}%`)
  }

  const { data, error } = await query

  if (error) {
    throw toAppError(error, 'Não foi possível listar servicos.')
  }

  return (data ?? []) as Servico[]
}

export async function createServico(empresaId: string, data: ServicoFormData) {
  const { data: created, error } = await supabase
    .from('servicos')
    .insert(normalizeServicoInput(data, empresaId))
    .select('*')
    .single()

  if (error) {
    throw toAppError(error, 'Não foi possível criar o servico.')
  }

  await linkServicoToActiveBarbers({
    empresaId,
    servicoId: (created as Servico).id,
  })

  await createAuditLog({
    action: 'servico_criado',
    empresaId,
    entityId: (created as Servico).id,
    entityType: 'servicos',
    metadata: {
      nome: data.nome,
      preco: Number(data.preco),
    },
    userRole: 'administrador',
  })

  return created as Servico
}

export async function linkServicoToActiveBarbers(input: {
  empresaId: string
  servicoId: string
}) {
  const { data: barbers, error: barbersError } = await supabase
    .from('barbeiros')
    .select('id')
    .eq('empresa_id', input.empresaId)
    .eq('status', 'ativo')

  if (barbersError) {
    throw toAppError(
      barbersError,
      'Não foi possível listar barbeiros para vincular o servico.',
    )
  }

  const rows = (barbers ?? []).map((barber) => ({
    active: true,
    barbeiro_id: barber.id,
    empresa_id: input.empresaId,
    service_id: input.servicoId,
  }))

  if (!rows.length) {
    return
  }

  const { error } = await supabase.from('barber_services').upsert(rows, {
    onConflict: 'empresa_id,barbeiro_id,service_id',
  })

  if (error) {
    throw toAppError(error, 'Não foi possível vincular barbeiros ao servico.')
  }
}

export async function updateServico(
  empresaId: string,
  servicoId: string,
  data: ServicoFormData,
) {
  const { error } = await supabase
    .from('servicos')
    .update(normalizeServicoInput(data, empresaId))
    .eq('empresa_id', empresaId)
    .eq('id', servicoId)

  if (error) {
    throw toAppError(error, 'Não foi possível atualizar o servico.')
  }

  await createAuditLog({
    action: 'servico_editado',
    empresaId,
    entityId: servicoId,
    entityType: 'servicos',
    metadata: {
      nome: data.nome,
      preco: Number(data.preco),
    },
    userRole: 'administrador',
  })
}

export async function deleteServico(empresaId: string, servicoId: string) {
  const { error } = await supabase
    .from('servicos')
    .update({ ativo: false, status: 'inativo' })
    .eq('empresa_id', empresaId)
    .eq('id', servicoId)

  if (error) {
    throw toAppError(error, 'Não foi possível inativar o servico.')
  }

  await createAuditLog({
    action: 'servico_inativado',
    empresaId,
    entityId: servicoId,
    entityType: 'servicos',
    userRole: 'administrador',
  })
}

export async function listServiceBarbers(
  empresaId: string,
): Promise<ServiceBarberOption[]> {
  const { data, error } = await supabase
    .from('barbeiros')
    .select('id,nome,status')
    .eq('empresa_id', empresaId)
    .order('nome', { ascending: true })

  if (error) {
    throw toAppError(error, 'Não foi possível listar barbeiros para o servico.')
  }

  return (data ?? []) as ServiceBarberOption[]
}

export async function listServicoBarberIds(
  empresaId: string,
  servicoId: string,
) {
  const { data, error } = await supabase
    .from('barber_services')
    .select('barbeiro_id')
    .eq('empresa_id', empresaId)
    .eq('service_id', servicoId)
    .eq('active', true)

  if (error) {
    throw toAppError(error, 'Não foi possível carregar vinculos do servico.')
  }

  return new Set((data ?? []).map((item) => item.barbeiro_id))
}

export async function saveServicoBarberLinks(input: {
  empresaId: string
  servicoId: string
  barbeiroIds: string[]
}) {
  const { data: existing, error: existingError } = await supabase
    .from('barber_services')
    .select('id,barbeiro_id')
    .eq('empresa_id', input.empresaId)
    .eq('service_id', input.servicoId)

  if (existingError) {
    throw toAppError(existingError, 'Não foi possível carregar vinculos do servico.')
  }

  const selectedIds = new Set(input.barbeiroIds)
  const rows = existing ?? []
  const existingIds = new Set(rows.map((row) => row.barbeiro_id))

  const updates = rows.map((row) =>
    supabase
      .from('barber_services')
      .update({ active: selectedIds.has(row.barbeiro_id) })
      .eq('id', row.id)
      .eq('empresa_id', input.empresaId),
  )
  const inserts = input.barbeiroIds
    .filter((barbeiroId) => !existingIds.has(barbeiroId))
    .map((barbeiroId) =>
      supabase.from('barber_services').insert({
        active: true,
        barbeiro_id: barbeiroId,
        empresa_id: input.empresaId,
        service_id: input.servicoId,
      }),
    )

  const responses = await Promise.all([...updates, ...inserts])
  const failed = responses.find((response) => response.error)

  if (failed?.error) {
    throw toAppError(failed.error, 'Não foi possível salvar barbeiros do servico.')
  }
}
