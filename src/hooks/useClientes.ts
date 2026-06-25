import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '../lib/queryKeys'
import {
  createCliente,
  deleteCliente,
  getClienteHistorico,
  listClientes,
  updateCliente,
  type Cliente,
} from '../services/clientesService'
import type { ClienteFormData } from '../types/clientes'

export function useClientes(input: {
  empresaId: string | undefined
  searchTerm: string
}) {
  const queryClient = useQueryClient()

  const clientesQuery = useQuery({
    enabled: Boolean(input.empresaId),
    queryFn: () => listClientes(input.empresaId as string, input.searchTerm),
    queryKey: queryKeys.clientes.list(input.empresaId, input.searchTerm),
  })

  const saveClienteMutation = useMutation({
    mutationFn: async (payload: { clienteId?: string; data: ClienteFormData }) => {
      if (!input.empresaId) {
        throw new Error('Empresa não encontrada.')
      }

      if (payload.clienteId) {
        await updateCliente(input.empresaId, payload.clienteId, payload.data)
        return
      }

      await createCliente(input.empresaId, payload.data)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.clientes.all })
    },
  })

  const deleteClienteMutation = useMutation({
    mutationFn: async (cliente: Cliente) => {
      if (!input.empresaId) {
        throw new Error('Empresa não encontrada.')
      }

      await deleteCliente(input.empresaId, cliente.id)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.clientes.all })
    },
  })

  return {
    clientes: clientesQuery.data ?? [],
    clientesError: clientesQuery.error,
    deleteClienteMutation,
    isLoadingClientes: clientesQuery.isLoading,
    saveClienteMutation,
  }
}

export function useClienteHistorico(input: {
  clienteId: string | undefined
  empresaId: string | undefined
}) {
  return useQuery({
    enabled: Boolean(input.empresaId && input.clienteId),
    queryFn: () =>
      getClienteHistorico(input.empresaId as string, input.clienteId as string),
    queryKey: queryKeys.clientes.historico(input.empresaId, input.clienteId),
  })
}
