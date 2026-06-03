import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'
import type { ServicoFormData } from '../types/servicos'

export type Servico = Database['public']['Tables']['servicos']['Row']

function normalizeServicoInput(data: ServicoFormData, empresaId: string) {
  return {
    ativo: data.ativo,
    duracao_minutos: Number(data.duracao_minutos),
    empresa_id: empresaId,
    nome: data.nome.trim(),
    preco: Number(data.preco),
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
    throw new Error(error.message)
  }

  return (data ?? []) as Servico[]
}

export async function createServico(empresaId: string, data: ServicoFormData) {
  const { error } = await supabase
    .from('servicos')
    .insert(normalizeServicoInput(data, empresaId))

  if (error) {
    throw new Error(error.message)
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
    throw new Error(error.message)
  }
}

export async function deleteServico(empresaId: string, servicoId: string) {
  const { error } = await supabase
    .from('servicos')
    .delete()
    .eq('empresa_id', empresaId)
    .eq('id', servicoId)

  if (error) {
    throw new Error(error.message)
  }
}
