import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Edit,
  History,
  Loader2,
  Plus,
  Search,
  Trash2,
  UserRound,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Input,
  Modal,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import {
  createCliente,
  deleteCliente,
  getClienteHistorico,
  listClientes,
  type Cliente,
} from '../services/clientesService'
import { updateCliente } from '../services/clientesService'
import { clienteSchema, type ClienteFormData } from '../types/clientes'

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
})

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
})

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  currency: 'BRL',
  style: 'currency',
})

function emptyFormValues(): ClienteFormData {
  return {
    data_nascimento: '',
    nome: '',
    observacoes: '',
    telefone: '',
  }
}

function clienteToFormValues(cliente: Cliente): ClienteFormData {
  return {
    data_nascimento: cliente.data_nascimento ?? '',
    nome: cliente.nome,
    observacoes: cliente.observacoes ?? '',
    telefone: cliente.telefone ?? '',
  }
}

function getStatusVariant(status: string) {
  if (status === 'concluido') {
    return 'success'
  }

  if (status === 'cancelado' || status === 'faltou') {
    return 'danger'
  }

  return 'warning'
}

export function ClientesPage() {
  const { profile } = useAuth()
  const empresaId = profile?.empresa_id
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null)
  const [historyCliente, setHistoryCliente] = useState<Cliente | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const clientesQueryKey = useMemo(
    () => ['clientes', empresaId, searchTerm],
    [empresaId, searchTerm],
  )

  const {
    data: clientes = [],
    error: clientesError,
    isLoading: isLoadingClientes,
  } = useQuery({
    enabled: Boolean(empresaId),
    queryFn: () => listClientes(empresaId as string, searchTerm),
    queryKey: clientesQueryKey,
  })

  const historicoQuery = useQuery({
    enabled: Boolean(empresaId && historyCliente),
    queryFn: () =>
      getClienteHistorico(empresaId as string, historyCliente?.id as string),
    queryKey: ['clientes-historico', empresaId, historyCliente?.id],
  })

  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm<ClienteFormData>({
    defaultValues: emptyFormValues(),
    resolver: zodResolver(clienteSchema),
  })

  useEffect(() => {
    if (editingCliente) {
      reset(clienteToFormValues(editingCliente))
      return
    }

    reset(emptyFormValues())
  }, [editingCliente, reset])

  const saveMutation = useMutation({
    mutationFn: async (data: ClienteFormData) => {
      if (!empresaId) {
        throw new Error('Empresa nao encontrada.')
      }

      if (editingCliente) {
        await updateCliente(empresaId, editingCliente.id, data)
        return
      }

      await createCliente(empresaId, data)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['clientes'] })
      setIsFormOpen(false)
      setEditingCliente(null)
      setFormError(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (cliente: Cliente) => {
      if (!empresaId) {
        throw new Error('Empresa nao encontrada.')
      }

      await deleteCliente(empresaId, cliente.id)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['clientes'] })
    },
  })

  function openCreateModal() {
    setEditingCliente(null)
    setFormError(null)
    setIsFormOpen(true)
  }

  function openEditModal(cliente: Cliente) {
    setEditingCliente(cliente)
    setFormError(null)
    setIsFormOpen(true)
  }

  async function onSubmit(data: ClienteFormData) {
    setFormError(null)

    try {
      await saveMutation.mutateAsync(data)
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Nao foi possivel salvar o cliente.',
      )
    }
  }

  async function handleDelete(cliente: Cliente) {
    const shouldDelete = window.confirm(
      `Excluir o cliente ${cliente.nome}? Esta acao nao pode ser desfeita.`,
    )

    if (!shouldDelete) {
      return
    }

    await deleteMutation.mutateAsync(cliente)
  }

  if (!empresaId) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Complete o vínculo do usuário com uma empresa para gerenciar
            clientes.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase text-brand-600 dark:text-brand-400">
            Clientes
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-normal text-zinc-950 dark:text-zinc-50">
            Base de clientes
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Cadastre, edite, pesquise e acompanhe o histórico de atendimentos
            dos clientes da empresa.
          </p>
        </div>

        <Button leftIcon={<Plus size={18} />} onClick={openCreateModal}>
          Novo cliente
        </Button>
      </section>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                Clientes cadastrados
              </h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {clientes.length} cliente{clientes.length === 1 ? '' : 's'} na
                listagem atual.
              </p>
            </div>

            <div className="relative w-full lg:max-w-sm">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
                size={16}
              />
              <input
                className="h-10 w-full rounded-md border border-zinc-300 bg-white pl-9 pr-3 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-brand-400 dark:focus:ring-brand-500/20"
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Pesquisar por nome ou telefone"
                value={searchTerm}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {clientesError && (
            <div className="p-5 text-sm text-red-600">
              {clientesError.message}
            </div>
          )}

          {isLoadingClientes ? (
            <div className="flex min-h-56 items-center justify-center">
              <Loader2 className="animate-spin text-brand-500" size={28} />
            </div>
          ) : clientes.length === 0 ? (
            <div className="flex min-h-56 flex-col items-center justify-center px-5 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-md bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                <UserRound size={22} />
              </span>
              <p className="mt-4 font-semibold text-zinc-950 dark:text-zinc-50">
                Nenhum cliente encontrado
              </p>
              <p className="mt-2 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
                Cadastre o primeiro cliente ou ajuste a pesquisa.
              </p>
            </div>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Nome</TableHeaderCell>
                  <TableHeaderCell>Telefone</TableHeaderCell>
                  <TableHeaderCell>Nascimento</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell className="text-right">Ações</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {clientes.map((cliente) => (
                  <TableRow key={cliente.id}>
                    <TableCell className="font-medium text-zinc-950 dark:text-zinc-50">
                      {cliente.nome}
                    </TableCell>
                    <TableCell>{cliente.telefone ?? '-'}</TableCell>
                    <TableCell>
                      {cliente.data_nascimento
                        ? dateFormatter.format(new Date(cliente.data_nascimento))
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={cliente.status === 'ativo' ? 'success' : 'default'}
                      >
                        {cliente.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          aria-label="Ver histórico"
                          className="h-9 w-9 px-0"
                          onClick={() => setHistoryCliente(cliente)}
                          variant="ghost"
                        >
                          <History size={16} />
                        </Button>
                        <Button
                          aria-label="Editar cliente"
                          className="h-9 w-9 px-0"
                          onClick={() => openEditModal(cliente)}
                          variant="ghost"
                        >
                          <Edit size={16} />
                        </Button>
                        <Button
                          aria-label="Excluir cliente"
                          className="h-9 w-9 px-0"
                          disabled={deleteMutation.isPending}
                          onClick={() => void handleDelete(cliente)}
                          variant="ghost"
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingCliente ? 'Editar cliente' : 'Cadastrar cliente'}
      >
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          {formError && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </p>
          )}

          <Input
            error={errors.nome?.message}
            label="Nome"
            {...register('nome')}
          />

          <Input
            error={errors.telefone?.message}
            label="Telefone"
            {...register('telefone')}
          />

          <Input
            error={errors.data_nascimento?.message}
            label="Data de nascimento"
            type="date"
            {...register('data_nascimento')}
          />

          <label className="block">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Observações
            </span>
            <textarea
              className="mt-2 min-h-28 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-brand-400 dark:focus:ring-brand-500/20"
              {...register('observacoes')}
            />
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              onClick={() => setIsFormOpen(false)}
              type="button"
              variant="secondary"
            >
              Cancelar
            </Button>
            <Button disabled={isSubmitting || saveMutation.isPending} type="submit">
              {saveMutation.isPending ? 'Salvando...' : 'Salvar cliente'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(historyCliente)}
        onClose={() => setHistoryCliente(null)}
        title={`Histórico de ${historyCliente?.nome ?? 'cliente'}`}
      >
        {historicoQuery.isLoading ? (
          <div className="flex min-h-40 items-center justify-center">
            <Loader2 className="animate-spin text-brand-500" size={24} />
          </div>
        ) : historicoQuery.data?.length ? (
          <div className="space-y-3">
            {historicoQuery.data.map((atendimento) => (
              <div
                className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
                key={atendimento.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-zinc-950 dark:text-zinc-50">
                      {atendimento.servicos?.nome ?? 'Serviço'}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {dateTimeFormatter.format(
                        new Date(atendimento.data_hora_inicio),
                      )}{' '}
                      · {atendimento.barbeiros?.nome ?? 'Barbeiro'}
                    </p>
                  </div>
                  <Badge variant={getStatusVariant(atendimento.status)}>
                    {atendimento.status}
                  </Badge>
                </div>
                <p className="mt-3 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                  {currencyFormatter.format(Number(atendimento.valor))}
                </p>
                {atendimento.observacoes && (
                  <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                    {atendimento.observacoes}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Nenhum atendimento encontrado para este cliente.
          </p>
        )}
      </Modal>
    </div>
  )
}
