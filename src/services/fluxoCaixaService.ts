import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'
import type { FluxoCaixaFormData } from '../types/fluxoCaixa'
import { createAuditLog } from './observabilityService'

export type MovimentacaoFinanceira =
  Database['public']['Tables']['movimentacoes_financeiras']['Row']

type ContaPaga = Database['public']['Tables']['contas_pagar']['Row']

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
  let movementsQuery = supabase
    .from('movimentacoes_financeiras')
    .select('*')
    .eq('empresa_id', empresaId)
    .neq('status', 'cancelada')
    .order('data_movimentacao', { ascending: false })

  if (dataInicio) {
    movementsQuery = movementsQuery.gte('data_movimentacao', dataInicio)
  }

  if (dataFim) {
    movementsQuery = movementsQuery.lte('data_movimentacao', dataFim)
  }

  const paidBillsQuery = supabase
    .from('contas_pagar')
    .select('*')
    .eq('empresa_id', empresaId)
    .eq('status', 'paga')
    .order('data_pagamento', { ascending: false })

  const [movementsResponse, paidBillsResponse] = await Promise.all([
    movementsQuery,
    paidBillsQuery,
  ])

  if (movementsResponse.error) {
    throw new Error(movementsResponse.error.message)
  }

  if (paidBillsResponse.error) {
    throw new Error(paidBillsResponse.error.message)
  }

  const movements = (movementsResponse.data ?? []) as MovimentacaoFinanceira[]
  const paidBills = ((paidBillsResponse.data ?? []) as ContaPaga[]).filter(
    (conta) => {
      const dataPagamento = conta.data_pagamento ?? conta.data_vencimento

      return (
        (!dataInicio || dataPagamento >= dataInicio) &&
        (!dataFim || dataPagamento <= dataFim)
      )
    },
  )

  const syntheticPaidBillMovements = paidBills
    .filter((conta) => {
      const dataPagamento = conta.data_pagamento ?? conta.data_vencimento
      const descricao = `Pagamento - ${conta.descricao}`

      return !movements.some(
        (movement) =>
          movement.tipo === 'saida' &&
          movement.data_movimentacao === dataPagamento &&
          Number(movement.valor) === Number(conta.valor) &&
          movement.descricao === descricao,
      )
    })
    .map((conta) => {
      const dataPagamento = conta.data_pagamento ?? conta.data_vencimento

      return {
        atendimento_id: null,
        categoria: conta.categoria ?? 'Contas a Pagar',
        created_at: conta.created_at,
        data_movimentacao: dataPagamento,
        descricao: `Pagamento - ${conta.descricao}`,
        empresa_id: conta.empresa_id,
        forma_pagamento: null,
        id: `conta-pagar-${conta.id}`,
        status: 'confirmada',
        tipo: 'saida',
        updated_at: conta.updated_at,
        valor: conta.valor,
      } as MovimentacaoFinanceira
    })

  return [...movements, ...syntheticPaidBillMovements].sort((first, second) =>
    second.data_movimentacao.localeCompare(first.data_movimentacao),
  )
}

export async function createMovimentacaoFinanceira(
  empresaId: string,
  data: FluxoCaixaFormData,
) {
  const { data: created, error } = await supabase
    .from('movimentacoes_financeiras')
    .insert(normalizeMovimentacaoInput(data, empresaId))
    .select('id,tipo,valor,categoria')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  await createAuditLog({
    action: 'movimentacao_criada',
    empresaId,
    entityId: created.id,
    entityType: 'movimentacoes_financeiras',
    metadata: {
      categoria: created.categoria,
      tipo: created.tipo,
      valor: created.valor,
    },
  })
}
