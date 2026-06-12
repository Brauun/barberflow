import { supabase } from '../lib/supabase'
import type { ContaPagarFormData, ContaPagarStatus } from '../types/contasPagar'
import type { Database } from '../types/database'
import { toAppError } from '../utils/handleAppError'
import { createAuditLog } from './observabilityService'

export type ContaPagar = Database['public']['Tables']['contas_pagar']['Row']

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

async function getContaPagarById(empresaId: string, contaId: string) {
  const { data, error } = await supabase
    .from('contas_pagar')
    .select('*')
    .eq('empresa_id', empresaId)
    .eq('id', contaId)
    .maybeSingle()

  if (error) {
    throw toAppError(error, 'Não foi possível carregar a conta.')
  }

  return data as ContaPagar | null
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
    throw toAppError(error, 'Não foi possível listar contas a pagar.')
  }

  return (data ?? []) as ContaPagar[]
}

export async function createContaPagar(
  empresaId: string,
  data: ContaPagarFormData,
) {
  const shouldMarkAsPaid = data.status === 'paga'
  const payload = {
    ...normalizeContaInput(data, empresaId),
    status: shouldMarkAsPaid ? 'pendente' : data.status,
  }

  const { data: conta, error } = await supabase
    .from('contas_pagar')
    .insert(payload)
    .select('*')
    .single()

  if (error) {
    throw toAppError(error, 'Não foi possível criar a conta.')
  }

  if (shouldMarkAsPaid) {
    await marcarContaComoPaga(empresaId, (conta as ContaPagar).id)
  }

  await createAuditLog({
    action: 'despesa_criada',
    empresaId,
    entityId: (conta as ContaPagar).id,
    entityType: 'contas_pagar',
    metadata: {
      categoria: data.categoria,
      status: data.status,
      valor: Number(data.valor),
    },
  })
}

export async function updateContaPagar(
  empresaId: string,
  contaId: string,
  data: ContaPagarFormData,
) {
  const currentConta = await getContaPagarById(empresaId, contaId)
  const shouldMarkAsPaid = data.status === 'paga' && currentConta?.status !== 'paga'
  const payload = {
    ...normalizeContaInput(data, empresaId),
    status: shouldMarkAsPaid ? 'pendente' : data.status,
  }

  const { error } = await supabase
    .from('contas_pagar')
    .update(payload)
    .eq('empresa_id', empresaId)
    .eq('id', contaId)

  if (error) {
    throw toAppError(error, 'Não foi possível atualizar a conta.')
  }

  if (shouldMarkAsPaid) {
    await marcarContaComoPaga(empresaId, contaId)
  }
}

export async function deleteContaPagar(empresaId: string, contaId: string) {
  const { error } = await supabase
    .from('contas_pagar')
    .delete()
    .eq('empresa_id', empresaId)
    .eq('id', contaId)

  if (error) {
    throw toAppError(error, 'Não foi possível excluir a conta.')
  }
}

export async function marcarContaComoPaga(empresaId: string, contaId: string) {
  const { error } = await supabase.rpc('marcar_conta_paga', {
    p_conta_id: contaId,
    p_empresa_id: empresaId,
  })

  if (error) {
    throw toAppError(error, 'Não foi possível marcar a conta como paga.')
  }
}
