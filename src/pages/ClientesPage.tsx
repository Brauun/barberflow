import { zodResolver } from '@hookform/resolvers/zod'
import {
  Edit,
  History,
  Loader2,
  Plus,
  Trash2,
  UserRound,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  Input,
  Modal,
  RecordAvatar,
  RecordCard,
  RecordMetric,
  SearchInput,
  Skeleton,
} from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { useClienteHistorico, useClientes } from '../hooks/useClientes'
import type { Cliente, ClienteWithIndicators } from '../services/clientesService'
import { clienteSchema, type ClienteFormData } from '../types/clientes'
import { formatPhone, maskPhoneChange } from '../utils/masks'

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
    telefone: formatPhone(cliente.telefone),
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

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
}

export function ClientesPage() {
  const { profile } = useAuth()
  const empresaId = profile?.empresa_id
  const [searchTerm, setSearchTerm] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null)
  const [historyCliente, setHistoryCliente] = useState<ClienteWithIndicators | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    clientes,
    clientesError,
    deleteClienteMutation,
    isLoadingClientes,
    saveClienteMutation,
  } = useClientes({
    empresaId,
    searchTerm,
  })
  const normalizedSearchTerm = searchTerm.trim()
  const isSearchingClientes = normalizedSearchTerm.length >= 2
  const listTitle = isSearchingClientes
    ? 'Resultados da pesquisa'
    : 'Últimos clientes cadastrados'
  const listDescription = isSearchingClientes
    ? `${clientes.length} resultado${clientes.length === 1 ? '' : 's'} encontrado${
        clientes.length === 1 ? '' : 's'
      }.`
    : `${clientes.length} cliente${clientes.length === 1 ? '' : 's'} recente${
        clientes.length === 1 ? '' : 's'
      }.`

  const historicoQuery = useClienteHistorico({
    clienteId: historyCliente?.id,
    empresaId,
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
      await saveClienteMutation.mutateAsync({
        clienteId: editingCliente?.id,
        data,
      })
      setIsFormOpen(false)
      setEditingCliente(null)
      setFormError(null)
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar o cliente.',
      )
    }
  }

  async function handleDelete(cliente: Cliente) {
    const shouldDelete = window.confirm(
      `Excluir o cliente ${cliente.nome}? Esta ação não pode ser desfeita.`,
    )

    if (!shouldDelete) {
      return
    }

    await deleteClienteMutation.mutateAsync(cliente)
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
    <div className="w-full max-w-full min-w-0 space-y-4 overflow-x-hidden md:space-y-8">
      <section className="flex min-w-0 flex-wrap items-end justify-between gap-2.5 md:gap-5">
        <div className="min-w-0">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-brand-600 dark:text-brand-400">
            Clientes
          </p>
          <h2 className="mt-2 text-xl font-black tracking-normal text-zinc-950 md:mt-3 md:text-3xl dark:text-zinc-50">
            Base de clientes
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-5 text-zinc-600 dark:text-zinc-400 md:mt-2 md:leading-6">
            Cadastre, edite, pesquise e acompanhe o histórico de atendimentos
            dos clientes da empresa.
          </p>
        </div>

        <Button className="h-10 max-w-full text-sm md:h-auto md:text-base" data-subscription-write="true" leftIcon={<Plus size={18} />} onClick={openCreateModal}>
          Novo cliente
        </Button>
      </section>

      <Card>
        <CardHeader className="p-3 md:p-6 lg:p-7">
          <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                {listTitle}
              </h3>
              <p className="mt-0.5 text-xs text-zinc-500 md:mt-1 md:text-sm dark:text-zinc-400">
                {listDescription}
              </p>
            </div>

            <div className="w-full max-w-full min-w-0 lg:max-w-sm">
              <SearchInput
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Pesquisar por nome, telefone ou email"
                value={searchTerm}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {clientesError && (
            <div className="p-3 text-sm text-red-600 md:p-5">
              {clientesError.message}
            </div>
          )}

          {isLoadingClientes ? (
            <div className="space-y-2 p-3 md:space-y-3 md:p-6">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : clientes.length === 0 ? (
            <EmptyState
              description="Cadastre o primeiro cliente ou ajuste a pesquisa para reencontrar alguem da base."
              icon={<UserRound size={22} />}
              title="Nenhum cliente encontrado"
            />
          ) : (
            <div className="w-full max-w-full min-w-0 space-y-2.5 p-3 sm:space-y-3 sm:p-5">
              {clientes.map((cliente) => (
                <RecordCard key={cliente.id}>
                  <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 items-start gap-2.5 sm:gap-4">
                      <RecordAvatar>{getInitials(cliente.nome)}</RecordAvatar>
                      <div className="min-w-0">
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
                          <h4 className="min-w-0 truncate text-sm font-black text-slate-950 md:text-base">
                            {cliente.nome}
                          </h4>
                          <Badge
                            variant={
                              cliente.status === 'ativo' ? 'success' : 'default'
                            }
                          >
                            {cliente.status}
                          </Badge>
                          {cliente.is_online_only && (
                            <Badge variant="info">Agendado</Badge>
                          )}
                        </div>
                        <p className="mt-1 min-w-0 break-words text-xs leading-5 text-slate-500 md:text-sm">
                          <span className="break-words">
                            {cliente.telefone
                              ? formatPhone(cliente.telefone)
                              : 'Telefone não informado'}
                          </span>
                          <span className="mx-1 hidden sm:inline">·</span>
                          <span className="block min-w-0 break-all sm:inline">
                            {cliente.email ?? 'Email não informado'}
                          </span>
                        </p>
                        <p className="mt-2 text-xs font-medium text-slate-400">
                          Nascimento:{' '}
                          {cliente.data_nascimento
                            ? dateFormatter.format(
                                new Date(cliente.data_nascimento),
                              )
                            : 'Não informado'}
                        </p>
                      </div>
                    </div>

                    <div className="grid min-w-0 grid-cols-2 gap-3 sm:flex sm:flex-row sm:items-center sm:justify-end sm:gap-4">
                      <RecordMetric
                        label="Última visita"
                        value={
                          cliente.ultima_visita
                            ? dateFormatter.format(new Date(cliente.ultima_visita))
                            : 'Sem visitas'
                        }
                      />
                      <RecordMetric
                        accent
                        label={
                          cliente.agendamentos_count > 0
                            ? 'Total concluído'
                            : 'Total gasto'
                        }
                        value={currencyFormatter.format(cliente.total_gasto)}
                      />
                      <RecordMetric
                        label={
                          cliente.agendamentos_count > 0
                            ? 'Atend./agend.'
                            : 'Visitas'
                        }
                        value={cliente.visitas_count}
                      />
                      <div className="col-span-2 flex min-w-0 flex-wrap gap-1.5 sm:col-span-1 sm:justify-end sm:gap-2">
                        {!cliente.is_online_only && (
                          <>
                            <Button
                              aria-label="Ver histórico"
                              size="icon-sm"
                              onClick={() => setHistoryCliente(cliente)}
                              variant="ghost"
                            >
                              <History size={16} />
                            </Button>
                            <Button
                              aria-label="Editar cliente"
                              data-subscription-write="true"
                              size="icon-sm"
                              onClick={() => openEditModal(cliente)}
                              variant="ghost"
                            >
                              <Edit size={16} />
                            </Button>
                            <Button
                              aria-label="Excluir cliente"
                              data-subscription-write="true"
                              size="icon-sm"
                              disabled={deleteClienteMutation.isPending}
                              onClick={() => void handleDelete(cliente)}
                              variant="ghost"
                            >
                              <Trash2 size={16} />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </RecordCard>
                ))}
            </div>
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
            placeholder="Joao Silva"
            {...register('nome')}
          />

          <Input
            error={errors.telefone?.message}
            inputMode="numeric"
            label="Telefone"
            placeholder="(99) 9 9999-9999"
            autoComplete="tel"
            {...register('telefone', {
              onChange: maskPhoneChange,
            })}
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
            <Button data-subscription-write="true" disabled={isSubmitting || saveClienteMutation.isPending} type="submit">
              {saveClienteMutation.isPending ? 'Salvando...' : 'Salvar cliente'}
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
            <Loader2 className="h-5 w-5 animate-spin text-brand-500 md:h-6 md:w-6" />
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
