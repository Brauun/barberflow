import type { PostgrestError } from '@supabase/supabase-js'

import { supabase } from '../lib/supabase'
import type { ContaPagarFormData, ContaPagarStatus } from '../types/contasPagar'
import type { Database } from '../types/database'

export type ContaPagar = Database['public']['Tables']['contas_pagar']['Row']

type MarcarContaPagaArgs =
  Database['public']['Functions']['marcar_conta_paga']['Args']

const marcarContaPagaRpc = supabase.rpc as unknown as (
  functionName: 'marcar_conta_paga',
  args: MarcarContaPagaArgs,
) => Promise<{ data: ContaPagar | null; error: PostgrestError | null }>

function normalizeContaInput(data: ContaPagarFormData, empresaId: string) {
  return {
    categoria: data.categoria.trim(),
    data_vencimento: data.data_vencimento,
    descricao: data.descricao.trim(),
    empresa_id: empresaId,
    status: data.status,
    valor: Number(data.valor),
  }
}

export async function listContasPagar(
  empresaId: string,
  status: ContaPagarStatus | 'todos',
): Promise<ContaPagar[]> {
  let query = supabase
    .from('contas_pagar')
    .select('*')
    .eq('empresa_id', empresaId)
    .neq('status', 'cancelada')
    .order('data_vencimento', { ascending: true })

  if (status !== 'todos') {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as ContaPagar[]
}

export async function createContaPagar(
  empresaId: string,
  data: ContaPagarFormData,
) {
  const { error } = await supabase
    .from('contas_pagar')
    .insert(normalizeContaInput(data, empresaId))

  if (error) {
    throw new Error(error.message)
  }
}

export async function updateContaPagar(
  empresaId: string,
  contaId: string,
  data: ContaPagarFormData,
) {
  const { error } = await supabase
    .from('contas_pagar')
    .update(normalizeContaInput(data, empresaId))
    .eq('empresa_id', empresaId)
    .eq('id', contaId)

  if (error) {
    throw new Error(error.message)
  }
}

export async function deleteContaPagar(empresaId: string, contaId: string) {
  const { error } = await supabase
    .from('contas_pagar')
    .delete()
    .eq('empresa_id', empresaId)
    .eq('id', contaId)

  if (error) {
    throw new Error(error.message)
  }
}

export async function marcarContaComoPaga(empresaId: string, contaId: string) {
  const { error } = await marcarContaPagaRpc('marcar_conta_paga', {
    p_conta_id: contaId,
    p_empresa_id: empresaId,
  })

  if (error) {
    throw new Error(error.message)
  }
}
