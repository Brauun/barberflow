import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDownCircle, ArrowUpCircle, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  DateInput,
  Input,
  Modal,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import {
  createMovimentacaoFinanceira,
  listMovimentacoesFinanceiras,
} from '../services/fluxoCaixaService'
import {
  entradaCategorias,
  fluxoCaixaSchema,
  saidaCategorias,
  type FluxoCaixaFormData,
  type FluxoCaixaFormInput,
} from '../types/fluxoCaixa'

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  currency: 'BRL',
  style: 'currency',
})

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
})

function todayInputValue() {
  return new Date().toISOString().slice(0, 10)
}

function monthStartInputValue() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10)
}

function emptyFormValues(): FluxoCaixaFormInput {
  return {
    categoria: 'Serviços',
    data_movimentacao: todayInputValue(),
    descricao: '',
    tipo: 'entrada',
    valor: 0,
  }
}

export function FluxoCaixaPage() {
  const { profile } = useAuth()
  const empresaId = profile?.empresa_id
  const queryClient = useQueryClient()
  const [dataInicio, setDataInicio] = useState(monthStartInputValue())
  const [dataFim, setDataFim] = useState(todayInputValue())
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    data: movimentacoes = [],
    error: movimentacoesError,
    isLoading,
  } = useQuery({
    enabled: Boolean(empresaId),
    queryFn: () =>
      listMovimentacoesFinanceiras(empresaId as string, dataInicio, dataFim),
    queryKey: ['fluxo-caixa', empresaId, dataInicio, dataFim],
  })

  const totals = useMemo(() => {
    const entradas = movimentacoes
      .filter((movimentacao) => movimentacao.tipo === 'entrada')
      .reduce((total, movimentacao) => total + Number(movimentacao.valor), 0)
    const saidas = movimentacoes
      .filter((movimentacao) => movimentacao.tipo === 'saida')
      .reduce((total, movimentacao) => total + Number(movimentacao.valor), 0)
    const saldo = entradas - saidas

    return {
      entradas,
      lucroLiquido: saldo,
      saidas,
      saldo,
    }
  }, [movimentacoes])

  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
    setValue,
  } = useForm<FluxoCaixaFormInput, unknown, FluxoCaixaFormData>({
    defaultValues: emptyFormValues(),
    resolver: zodResolver(fluxoCaixaSchema),
  })

  const selectedTipo = useWatch({
    control,
    name: 'tipo',
  })

  const categoriaOptions = useMemo(() => {
    const categorias =
      selectedTipo === 'saida' ? saidaCategorias : entradaCategorias

    return categorias.map((categoria) => ({
      label: categoria,
      value: categoria,
    }))
  }, [selectedTipo])

  const saveMutation = useMutation({
    mutationFn: async (data: FluxoCaixaFormData) => {
      if (!empresaId) {
        throw new Error('Empresa não encontrada.')
      }

      await createMovimentacaoFinanceira(empresaId, data)
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['fluxo-caixa'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['relatórios'] }),
      ])
      setFormError(null)
      setIsFormOpen(false)
      reset(emptyFormValues())
    },
  })

  async function onSubmit(data: FluxoCaixaFormData) {
    setFormError(null)

    try {
      await saveMutation.mutateAsync(data)
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar a movimentação.',
      )
    }
  }

  if (!empresaId) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Complete o vínculo do usuário com uma empresa para visualizar o
            fluxo de caixa.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-5 md:space-y-8">
      <section className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-brand-600 dark:text-brand-400">
            Fluxo de Caixa
          </p>
          <h2 className="mt-2 text-xl font-black tracking-normal text-zinc-950 md:mt-3 md:text-3xl dark:text-zinc-50">
            Entradas e saídas
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Acompanhe receitas, despesas, saldo atual e lucro líquido por
            período.
          </p>
        </div>

        <Button
          leftIcon={<Plus size={18} />}
          onClick={() => {
            reset(emptyFormValues())
            setFormError(null)
            setIsFormOpen(true)
          }}
        >
          Nova movimentação
        </Button>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr_0.75fr]">
        <Card>
          <CardContent>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Total de entradas
            </p>
            <p className="mt-1.5 text-xl font-semibold text-emerald-600 md:mt-2 md:text-2xl dark:text-emerald-400">
              {currencyFormatter.format(totals.entradas)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Total de saídas
            </p>
            <p className="mt-1.5 text-xl font-semibold text-red-600 md:mt-2 md:text-2xl dark:text-red-400">
              {currencyFormatter.format(totals.saidas)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Saldo atual
            </p>
            <p className="mt-1.5 text-xl font-semibold text-zinc-950 md:mt-2 md:text-2xl dark:text-zinc-50">
              {currencyFormatter.format(totals.saldo)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Lucro líquido
            </p>
            <p className="mt-1.5 text-xl font-semibold text-brand-600 md:mt-2 md:text-2xl dark:text-brand-400">
              {currencyFormatter.format(totals.lucroLiquido)}
            </p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <div className="flex min-w-0 max-w-full flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                Movimentações financeiras
              </h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {movimentacoes.length} lançamento
                {movimentacoes.length === 1 ? '' : 's'} no período.
              </p>
            </div>

            <div className="grid w-full min-w-0 max-w-full gap-3 sm:grid-cols-2 lg:w-auto">
              <DateInput
                label="Data inicial"
                onChange={setDataInicio}
                value={dataInicio}
              />
              <DateInput
                label="Data final"
                onChange={setDataFim}
                value={dataFim}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {movimentacoesError && (
            <div className="p-3 text-sm text-red-600 md:p-5">
              {movimentacoesError.message}
            </div>
          )}

          {isLoading ? (
            <div className="space-y-3 p-4 md:p-6">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : movimentacoes.length === 0 ? (
            <div className="p-3 text-sm text-zinc-500 md:p-5 dark:text-zinc-400">
              Nenhuma movimentação encontrada para o período.
            </div>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Tipo</TableHeaderCell>
                  <TableHeaderCell>Descrição</TableHeaderCell>
                  <TableHeaderCell>Categoria</TableHeaderCell>
                  <TableHeaderCell>Data</TableHeaderCell>
                  <TableHeaderCell>Valor</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {movimentacoes.map((movimentacao) => (
                  <TableRow key={movimentacao.id}>
                    <TableCell>
                      <span className="inline-flex items-center gap-2">
                        {movimentacao.tipo === 'entrada' ? (
                          <ArrowUpCircle
                            className="text-emerald-600 dark:text-emerald-400"
                            size={16}
                          />
                        ) : (
                          <ArrowDownCircle
                            className="text-red-600 dark:text-red-400"
                            size={16}
                          />
                        )}
                        {movimentacao.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium text-zinc-950 dark:text-zinc-50">
                      {movimentacao.descricao ?? '-'}
                    </TableCell>
                    <TableCell>{movimentacao.categoria}</TableCell>
                    <TableCell>
                      {dateFormatter.format(
                        new Date(`${movimentacao.data_movimentacao}T00:00:00`),
                      )}
                    </TableCell>
                    <TableCell>
                      {currencyFormatter.format(Number(movimentacao.valor))}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          movimentacao.status === 'confirmada'
                            ? 'success'
                            : 'warning'
                        }
                      >
                        {movimentacao.status}
                      </Badge>
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
        title="Nova movimentação"
      >
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          {formError && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </p>
          )}

          <Select
            error={errors.tipo?.message}
            label="Tipo"
            options={[
              { label: 'Entrada', value: 'entrada' },
              { label: 'Saída', value: 'saida' },
            ]}
            {...register('tipo', {
              onChange: (event) => {
                setValue(
                  'categoria',
                  event.target.value === 'saida'
                    ? saidaCategorias[0]
                    : entradaCategorias[0],
                  { shouldValidate: true },
                )
              },
            })}
          />

          <Input
            error={errors.descricao?.message}
            label="Descrição"
            {...register('descricao')}
          />

          <Select
            error={errors.categoria?.message}
            label="Categoria"
            options={categoriaOptions}
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
              error={errors.data_movimentacao?.message}
              label="Data"
              type="date"
              {...register('data_movimentacao')}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              onClick={() => setIsFormOpen(false)}
              type="button"
              variant="secondary"
            >
              Cancelar
            </Button>
            <Button disabled={isSubmitting || saveMutation.isPending} type="submit">
              {saveMutation.isPending ? 'Salvando...' : 'Salvar movimentação'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
