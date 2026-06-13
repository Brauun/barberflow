import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { canManageServices } from '../auth/permissions'
import { queryKeys } from '../lib/queryKeys'
import {
  createServico,
  deleteServico,
  listServiceBarbers,
  listServicoBarberIds,
  listServicos,
  saveServicoBarberLinks,
  updateServico,
  type Servico,
} from '../services/servicosService'
import type { UserRole } from '../types/database'
import type { ServicoFormData } from '../types/servicos'

export function useServicos(input: {
  empresaId: string | undefined
  role: UserRole | undefined
  searchTerm: string
}) {
  const queryClient = useQueryClient()
  const canManage = canManageServices(input.role)

  const servicosQuery = useQuery({
    enabled: Boolean(input.empresaId),
    queryFn: () => listServicos(input.empresaId as string, input.searchTerm),
    queryKey: queryKeys.servicos.list(input.empresaId, input.searchTerm),
  })

  const saveServicoMutation = useMutation({
    mutationFn: async (payload: {
      barbeiroIds: string[]
      data: ServicoFormData
      servicoId?: string
    }) => {
      if (!input.empresaId) {
        throw new Error('Empresa não encontrada.')
      }

      if (!canManage) {
        throw new Error('Apenas administradores podem gerenciar servicos.')
      }

      if (payload.servicoId) {
        await updateServico(input.empresaId, payload.servicoId, payload.data)
        await saveServicoBarberLinks({
          barbeiroIds: payload.barbeiroIds,
          empresaId: input.empresaId,
          servicoId: payload.servicoId,
        })
        return
      }

      const created = await createServico(input.empresaId, payload.data)

      return created
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.servicos.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.servicos.booking }),
      ])
    },
  })

  const deleteServicoMutation = useMutation({
    mutationFn: async (servico: Servico) => {
      if (!input.empresaId) {
        throw new Error('Empresa não encontrada.')
      }

      if (!canManage) {
        throw new Error('Apenas administradores podem gerenciar servicos.')
      }

      await deleteServico(input.empresaId, servico.id)
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.servicos.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.servicos.booking }),
      ])
    },
  })

  return {
    canManageServices: canManage,
    deleteServicoMutation,
    isLoadingServicos: servicosQuery.isLoading,
    saveServicoMutation,
    servicos: servicosQuery.data ?? [],
    servicosError: servicosQuery.error,
  }
}

export function useServiceBarbers(input: {
  canManageServices: boolean
  empresaId: string | undefined
  isFormOpen: boolean
}) {
  return useQuery({
    enabled: Boolean(input.empresaId && input.isFormOpen && input.canManageServices),
    queryFn: () => listServiceBarbers(input.empresaId as string),
    queryKey: queryKeys.servicos.barbeiros(input.empresaId),
  })
}

export function useServicoBarberIds(input: {
  canManageServices: boolean
  empresaId: string | undefined
  isFormOpen: boolean
  servicoId: string | undefined
}) {
  return useQuery({
    enabled: Boolean(
      input.empresaId &&
        input.servicoId &&
        input.isFormOpen &&
        input.canManageServices,
    ),
    queryFn: () =>
      listServicoBarberIds(input.empresaId as string, input.servicoId as string),
    queryKey: queryKeys.servicos.barbeiroLinks(input.empresaId, input.servicoId),
  })
}
