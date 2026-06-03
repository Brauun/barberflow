import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'
import type { ClienteFormData } from '../types/clientes'

export type Cliente = Database['public']['Tables']['clientes']['Row']

export type ClienteAtendimento = {
  id: string
  data_hora_inicio: string
  valor: number
  status: string
  observacoes: string | null
  barbeiros: { nome: string } | null
  servicos: { nome: string } | null
}

function normalizeClienteInput(data: ClienteFormData, empresaId: string) {
  return {
    empresa_id: empresaId,
    nome: data.nome.trim(),
    telefone: data.telefone?.trim() || null,
    data_nascimento: data.data_nascimento || null,
    observacoes: data.observacoes?.trim() || null,
  }
}

export async function listClientes(
  empresaId: string,
  search: string,
): Promise<Cliente[]> {
  let query = supabase
    .from('clientes')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('nome', { ascending: true })

  const normalizedSearch = search.trim()

  if (normalizedSearch) {
    query = query.or(
      `nome.ilike.%${normalizedSearch}%,telefone.ilike.%${normalizedSearch}%`,
    )
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as Cliente[]
}

export async function createCliente(empresaId: string, data: ClienteFormData) {
  const { error } = await supabase
    .from('clientes')
    .insert(normalizeClienteInput(data, empresaId))

  if (error) {
    throw new Error(error.message)
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
    throw new Error(error.message)
  }
}

export async function deleteCliente(empresaId: string, clienteId: string) {
  const { error } = await supabase
    .from('clientes')
    .delete()
    .eq('empresa_id', empresaId)
    .eq('id', clienteId)

  if (error) {
    throw new Error(error.message)
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
    throw new Error(error.message)
  }

  return (data ?? []) as unknown as ClienteAtendimento[]
}
