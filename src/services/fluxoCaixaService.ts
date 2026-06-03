import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'
import type { FluxoCaixaFormData } from '../types/fluxoCaixa'

export type MovimentacaoFinanceira =
  Database['public']['Tables']['movimentacoes_financeiras']['Row']

function normalizeMovimentacaoInput(
  data: FluxoCaixaFormData,
  empresaId: string,
) {
  return {
    categoria: data.categoria,
    data_movimentacao: data.data_movimentacao,
    descricao: data.descricao.trim(),
    empresa_id: empresaId,
    status: 'confirmada' as const,
    tipo: data.tipo,
    valor: Number(data.valor),
  }
}

export async function listMovimentacoesFinanceiras(
  empresaId: string,
  dataInicio: string,
  dataFim: string,
): Promise<MovimentacaoFinanceira[]> {
  let query = supabase
    .from('movimentacoes_financeiras')
    .select('*')
    .eq('empresa_id', empresaId)
    .neq('status', 'cancelada')
    .order('data_movimentacao', { ascending: false })

  if (dataInicio) {
    query = query.gte('data_movimentacao', dataInicio)
  }

  if (dataFim) {
    query = query.lte('data_movimentacao', dataFim)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as MovimentacaoFinanceira[]
}

export async function createMovimentacaoFinanceira(
  empresaId: string,
  data: FluxoCaixaFormData,
) {
  const { error } = await supabase
    .from('movimentacoes_financeiras')
    .insert(normalizeMovimentacaoInput(data, empresaId))

  if (error) {
    throw new Error(error.message)
  }
}
