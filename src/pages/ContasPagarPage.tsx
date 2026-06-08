import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Edit, Loader2, Plus, Trash2 } from 'lucide-react'
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
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import {
  createContaPagar,
  deleteContaPagar,
  listContasPagar,
  marcarContaComoPaga,
  updateContaPagar,
  type ContaPagar,
} from '../services/contasPagarService'
import {
  contaPagarSchema,
  type ContaPagarFormData,
  type ContaPagarFormInput,
  type ContaPagarStatus,
} from '../types/contasPagar'

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  currency: 'BRL',
  style: 'currency',
})

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
})

function todayDateOnly() {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

function emptyFormValues(): ContaPagarFormInput {
  return {
    categoria: '',
    data_vencimento: new Date().toISOString().slice(0, 10),
    descricao: '',
    status: 'pendente',
    valor: 0,
  }
}

function contaToFormValues(conta: ContaPagar): ContaPagarFormInput {
  return {
    categoria: conta.categoria ?? '',
    data_vencimento: conta.data_vencimento,
    descricao: conta.descricao,
    status: conta.status === 'cancelada' ? 'pendente' : conta.status,
    valor: conta.valor,
  }
}

function getStatusLabel(status: string) {
  if (status === 'paga') {
    return 'Pago'
  }

  if (status === 'vencida') {
    return 'Vencido'
  }

  return 'Pendente'
}

function getStatusVariant(status: string) {
  if (status === 'paga') {
    return 'success'
  }

  if (status === 'vencida') {
    return 'danger'
  }

  return 'warning'
}

function isNearDue(conta: ContaPagar) {
  if (conta.status !== 'pendente') {
    return false
  }

  const today = todayDateOnly()
  const dueDate = new Date(`${conta.data_vencimento}T00:00:00`)
  const sevenDaysFromNow = new Date(today)
  sevenDaysFromNow.setDate(today.getDate() + 7)

  return dueDate >= today && dueDate <= sevenDaysFromNow
}

export function ContasPagarPage() {
  const { profile } = useAuth()
  const empresaId = profile?.empresa_id
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<ContaPagarStatus | 'todos'>(
    'todos',
  )
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingConta, setEditingConta] = useState<ContaPagar | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    data: contas = [],
    error: contasError,
    isLoading,
  } = useQuery({
    enabled: Boolean(empresaId),
    queryFn: () => listContasPagar(empresaId as string, statusFilter),
    queryKey: ['contas-pagar', empresaId, statusFilter],
  })

  const proximasVencimento = useMemo(
    () => contas.filter((conta) => isNearDue(conta)),
    [contas],
  )

  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm<ContaPagarFormInput, unknown, ContaPagarFormData>({
    defaultValues: emptyFormValues(),
    resolver: zodResolver(contaPagarSchema),
  })

  useEffect(() => {
    if (editingConta) {
      reset(contaToFormValues(editingConta))
      return
    }

    reset(emptyFormValues())
  }, [editingConta, reset])

  const saveMutation = useMutation({
    mutationFn: async (data: ContaPagarFormData) => {
      if (!empresaId) {
        throw new Error('Empresa nao encontrada.')
      }

      if (editingConta) {
        await updateContaPagar(empresaId, editingConta.id, data)
        return
      }

      await createContaPagar(empresaId, data)
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['contas-pagar'] }),
        queryClient.invalidateQueries({ queryKey: ['fluxo-caixa'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['relatorios'] }),
      ])
      setIsFormOpen(false)
      setEditingConta(null)
      setFormError(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (conta: ContaPagar) => {
      if (!empresaId) {
        throw new Error('Empresa nao encontrada.')
      }

      await deleteContaPagar(empresaId, conta.id)
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['contas-pagar'] }),
        queryClient.invalidateQueries({ queryKey: ['fluxo-caixa'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['relatorios'] }),
      ])
    },
  })

  const payMutation = useMutation({
    mutationFn: async (conta: ContaPagar) => {
      if (!empresaId) {
        throw new Error('Empresa nao encontrada.')
      }

      await marcarContaComoPaga(empresaId, conta.id)
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['contas-pagar'] }),
        queryClient.invalidateQueries({ queryKey: ['fluxo-caixa'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['relatorios'] }),
      ])
    },
  })

  function openCreateModal() {
    setEditingConta(null)
    setFormError(null)
    setIsFormOpen(true)
  }

  function openEditModal(conta: ContaPagar) {
    setEditingConta(conta)
    setFormError(null)
    setIsFormOpen(true)
  }

  async function onSubmit(data: ContaPagarFormData) {
    setFormError(null)

    try {
      await saveMutation.mutateAsync(data)
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Nao foi possivel salvar a conta.',
      )
    }
  }

  async function handleDelete(conta: ContaPagar) {
    const shouldDelete = window.confirm(
      `Excluir a conta "${conta.descricao}"? Esta acao nao pode ser desfeita.`,
    )

    if (!shouldDelete) {
      return
    }

    await deleteMutation.mutateAsync(conta)
  }

  async function handlePay(conta: ContaPagar) {
    await payMutation.mutateAsync(conta)
  }

  if (!empresaId) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Complete o vínculo do usuário com uma empresa para gerenciar contas a
            pagar.
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
            Contas a Pagar
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-normal text-zinc-950 dark:text-zinc-50">
            Obrigações financeiras
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Cadastre despesas, acompanhe vencimentos e registre pagamentos com
            saída automática no caixa.
          </p>
        </div>

        <Button leftIcon={<Plus size={18} />} onClick={openCreateModal}>
          Nova conta
        </Button>
      </section>

      {proximasVencimento.length > 0 && (
        <Card className="border-brand-200 bg-brand-50 dark:border-brand-500/30 dark:bg-brand-500/10">
          <CardContent>
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-brand-600 dark:text-brand-400" size={22} />
              <div>
                <p className="font-semibold text-zinc-950 dark:text-zinc-50">
                  {proximasVencimento.length} conta
                  {proximasVencimento.length === 1 ? '' : 's'} próxima
                  {proximasVencimento.length === 1 ? '' : 's'} do vencimento
                </p>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Revise as contas pendentes com vencimento nos próximos 7 dias.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                Contas cadastradas
              </h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {contas.length} conta{contas.length === 1 ? '' : 's'} na
                listagem atual.
              </p>
            </div>

            <Select
              className="lg:w-56"
              label="Filtrar por status"
              onChange={(event) =>
                setStatusFilter(event.target.value as ContaPagarStatus | 'todos')
              }
              options={[
                { label: 'Todos', value: 'todos' },
                { label: 'Pendente', value: 'pendente' },
                { label: 'Pago', value: 'paga' },
                { label: 'Vencido', value: 'vencida' },
              ]}
              value={statusFilter}
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {contasError && (
            <div className="p-5 text-sm text-red-600">{contasError.message}</div>
          )}

          {isLoading ? (
            <div className="flex min-h-56 items-center justify-center">
              <Loader2 className="animate-spin text-brand-500" size={28} />
            </div>
          ) : contas.length === 0 ? (
            <div className="p-5 text-sm text-zinc-500 dark:text-zinc-400">
              Nenhuma conta encontrada para o filtro selecionado.
            </div>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Descrição</TableHeaderCell>
                  <TableHeaderCell>Categoria</TableHeaderCell>
                  <TableHeaderCell>Valor</TableHeaderCell>
                  <TableHeaderCell>Vencimento</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell className="text-right">Ações</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {contas.map((conta) => (
                  <TableRow key={conta.id}>
                    <TableCell className="font-medium text-zinc-950 dark:text-zinc-50">
                      {conta.descricao}
                    </TableCell>
                    <TableCell>{conta.categoria ?? '-'}</TableCell>
                    <TableCell>
                      {currencyFormatter.format(Number(conta.valor))}
                    </TableCell>
                    <TableCell>
                      {dateFormatter.format(
                        new Date(`${conta.data_vencimento}T00:00:00`),
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(conta.status)}>
                        {getStatusLabel(conta.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        {conta.status !== 'paga' && (
                          <Button
                            aria-label="Marcar como paga"
                            size="icon-sm"
                            disabled={payMutation.isPending}
                            onClick={() => void handlePay(conta)}
                            variant="ghost"
                          >
                            <CheckCircle2 size={16} />
                          </Button>
                        )}
                        <Button
                          aria-label="Editar conta"
                          size="icon-sm"
                          onClick={() => openEditModal(conta)}
                          variant="ghost"
                        >
                          <Edit size={16} />
                        </Button>
                        <Button
                          aria-label="Excluir conta"
                          size="icon-sm"
                          disabled={deleteMutation.isPending}
                          onClick={() => void handleDelete(conta)}
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
        title={editingConta ? 'Editar conta' : 'Cadastrar conta'}
      >
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          {formError && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </p>
          )}

          <Input
            error={errors.descricao?.message}
            label="Descrição"
            {...register('descricao')}
          />

          <Input
            error={errors.categoria?.message}
            label="Categoria"
            {...register('categoria')}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              error={errors.valor?.message}
              label="Valor"
              min={0}
              step="0.01"
              type="number"
              {...register('valor')}
            />
            <Input
              error={errors.data_vencimento?.message}
              label="Data de vencimento"
              type="date"
              {...register('data_vencimento')}
            />
          </div>

          <Select
            error={errors.status?.message}
            label="Status"
            options={[
              { label: 'Pendente', value: 'pendente' },
              { label: 'Pago', value: 'paga' },
              { label: 'Vencido', value: 'vencida' },
            ]}
            {...register('status')}
          />

          <div className="flex justify-end gap-3 pt-2">
            <Button
              onClick={() => setIsFormOpen(false)}
              type="button"
              variant="secondary"
            >
              Cancelar
            </Button>
            <Button disabled={isSubmitting || saveMutation.isPending} type="submit">
              {saveMutation.isPending ? 'Salvando...' : 'Salvar conta'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
