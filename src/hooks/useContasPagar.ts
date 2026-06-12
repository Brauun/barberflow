import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '../lib/queryKeys'
import {
  createContaPagar,
  deleteContaPagar,
  listContasPagar,
  marcarContaComoPaga,
  updateContaPagar,
  type ContaPagar,
} from '../services/contasPagarService'
import type {
  ContaPagarFormData,
  ContaPagarStatus,
} from '../types/contasPagar'

export function useContasPagar(input: {
  empresaId: string | undefined
  statusFilter: ContaPagarStatus | 'todos'
}) {
  const queryClient = useQueryClient()

  const contasQuery = useQuery({
    enabled: Boolean(input.empresaId),
    queryFn: () =>
      listContasPagar(input.empresaId as string, input.statusFilter),
    queryKey: queryKeys.contasPagar.list(input.empresaId, input.statusFilter),
  })

  async function invalidateRelatedQueries() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.contasPagar.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.financeiro.fluxoCaixa }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.relatorios.all }),
    ])
  }

  const saveContaMutation = useMutation({
    mutationFn: async (payload: { contaId?: string; data: ContaPagarFormData }) => {
      if (!input.empresaId) {
        throw new Error('Empresa nao encontrada.')
      }

      if (payload.contaId) {
        await updateContaPagar(input.empresaId, payload.contaId, payload.data)
        return
      }

      await createContaPagar(input.empresaId, payload.data)
    },
    onSuccess: invalidateRelatedQueries,
  })

  const deleteContaMutation = useMutation({
    mutationFn: async (conta: ContaPagar) => {
      if (!input.empresaId) {
        throw new Error('Empresa nao encontrada.')
      }

      await deleteContaPagar(input.empresaId, conta.id)
    },
    onSuccess: invalidateRelatedQueries,
  })

  const payContaMutation = useMutation({
    mutationFn: async (conta: ContaPagar) => {
      if (!input.empresaId) {
        throw new Error('Empresa nao encontrada.')
      }

      await marcarContaComoPaga(input.empresaId, conta.id)
    },
    onSuccess: invalidateRelatedQueries,
  })

  return {
    contas: contasQuery.data ?? [],
    contasError: contasQuery.error,
    deleteContaMutation,
    isLoading: contasQuery.isLoading,
    payContaMutation,
    saveContaMutation,
  }
}
