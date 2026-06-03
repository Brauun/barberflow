import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarPlus, Loader2, Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'

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
  listAtendimentoBarbeiros,
  listAtendimentoClientes,
  listAtendimentos,
  listAtendimentoServicos,
  registrarAtendimento,
} from '../services/atendimentosService'
import {
  atendimentoSchema,
  type AtendimentoFormData,
  type AtendimentoFormInput,
} from '../types/atendimentos'

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  currency: 'BRL',
  style: 'currency',
})

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
})

function todayInputValue() {
  return new Date().toISOString().slice(0, 10)
}

function currentTimeInputValue() {
  return new Date().toTimeString().slice(0, 5)
}

function emptyFormValues(): AtendimentoFormInput {
  return {
    barbeiro_id: '',
    cliente_id: '',
    data: todayInputValue(),
    forma_pagamento: 'Dinheiro',
    hora: currentTimeInputValue(),
    servico_id: '',
    valor: 0,
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

export function AtendimentosPage() {
  const { profile } = useAuth()
  const empresaId = profile?.empresa_id
  const queryClient = useQueryClient()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    control,
    register,
    reset,
    setValue,
  } = useForm<AtendimentoFormInput, unknown, AtendimentoFormData>({
    defaultValues: emptyFormValues(),
    resolver: zodResolver(atendimentoSchema),
  })

  const selectedServicoId = useWatch({
    control,
    name: 'servico_id',
  })
  const watchedValor = Number(
    useWatch({
      control,
      name: 'valor',
    }) || 0,
  )
  const comissaoPercentual = profile?.empresa?.percentual_comissao_padrao ?? 60
  const empresaPercentual = Math.max(0, 100 - comissaoPercentual)
  const comissaoBarbeiro = watchedValor * (comissaoPercentual / 100)
  const valorEmpresa = watchedValor * (empresaPercentual / 100)

  const atendimentosQuery = useQuery({
    enabled: Boolean(empresaId),
    queryFn: () => listAtendimentos(empresaId as string),
    queryKey: ['atendimentos', empresaId],
  })

  const clientesQuery = useQuery({
    enabled: Boolean(empresaId),
    queryFn: () => listAtendimentoClientes(empresaId as string),
    queryKey: ['atendimentos-clientes', empresaId],
  })

  const barbeirosQuery = useQuery({
    enabled: Boolean(empresaId),
    queryFn: () => listAtendimentoBarbeiros(empresaId as string),
    queryKey: ['atendimentos-barbeiros', empresaId],
  })

  const servicosQuery = useQuery({
    enabled: Boolean(empresaId),
    queryFn: () => listAtendimentoServicos(empresaId as string),
    queryKey: ['atendimentos-servicos', empresaId],
  })

  const clienteOptions = useMemo(
    () => [
      { label: 'Selecione um cliente', value: '' },
      ...(clientesQuery.data ?? []).map((cliente) => ({
        label: cliente.nome,
        value: cliente.id,
      })),
    ],
    [clientesQuery.data],
  )

  const barbeiroOptions = useMemo(
    () => [
      { label: 'Selecione um barbeiro', value: '' },
      ...(barbeirosQuery.data ?? []).map((barbeiro) => ({
        label: barbeiro.nome,
        value: barbeiro.id,
      })),
    ],
    [barbeirosQuery.data],
  )

  const servicoOptions = useMemo(
    () => [
      { label: 'Selecione um serviço', value: '' },
      ...(servicosQuery.data ?? []).map((servico) => ({
        label: `${servico.nome} - ${currencyFormatter.format(Number(servico.preco))}`,
        value: servico.id,
      })),
    ],
    [servicosQuery.data],
  )

  useEffect(() => {
    const selectedServico = servicosQuery.data?.find(
      (servico) => servico.id === selectedServicoId,
    )

    if (selectedServico) {
      setValue('valor', Number(selectedServico.preco), {
        shouldDirty: true,
        shouldValidate: true,
      })
    }
  }, [selectedServicoId, servicosQuery.data, setValue])

  const saveMutation = useMutation({
    mutationFn: async (data: AtendimentoFormData) => {
      if (!empresaId) {
        throw new Error('Empresa nao encontrada.')
      }

      await registrarAtendimento(empresaId, data)
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['atendimentos'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['barbeiros'] }),
      ])
      reset(emptyFormValues())
      setFormError(null)
      setIsFormOpen(false)
    },
  })

  async function onSubmit(data: AtendimentoFormData) {
    setFormError(null)

    try {
      await saveMutation.mutateAsync(data)
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Nao foi possivel registrar o atendimento.',
      )
    }
  }

  if (!empresaId) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Complete o vínculo do usuário com uma empresa para registrar
            atendimentos.
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
            Atendimentos
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-normal text-zinc-950 dark:text-zinc-50">
            Registro de atendimentos
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Ao salvar, o sistema registra o atendimento, gera entrada financeira
            e cria comissão para o barbeiro em uma única transação.
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
          Novo atendimento
        </Button>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Comissão barbeiro
            </p>
            <p className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
              {comissaoPercentual}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Parte da empresa
            </p>
            <p className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
              {empresaPercentual}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Fluxo seguro
            </p>
            <p className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
              RPC transacional
            </p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
              <CalendarPlus size={20} />
            </span>
            <div>
              <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                Atendimentos registrados
              </h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {atendimentosQuery.data?.length ?? 0} atendimento
                {(atendimentosQuery.data?.length ?? 0) === 1 ? '' : 's'} na
                listagem.
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {atendimentosQuery.error && (
            <div className="p-5 text-sm text-red-600">
              {atendimentosQuery.error.message}
            </div>
          )}

          {atendimentosQuery.isLoading ? (
            <div className="flex min-h-56 items-center justify-center">
              <Loader2 className="animate-spin text-brand-500" size={28} />
            </div>
          ) : !atendimentosQuery.data?.length ? (
            <div className="p-5 text-sm text-zinc-500 dark:text-zinc-400">
              Nenhum atendimento registrado ainda.
            </div>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Cliente</TableHeaderCell>
                  <TableHeaderCell>Barbeiro</TableHeaderCell>
                  <TableHeaderCell>Serviço</TableHeaderCell>
                  <TableHeaderCell>Data</TableHeaderCell>
                  <TableHeaderCell>Pagamento</TableHeaderCell>
                  <TableHeaderCell>Valor</TableHeaderCell>
                  <TableHeaderCell>Comissão</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {atendimentosQuery.data.map((atendimento) => (
                  <TableRow key={atendimento.id}>
                    <TableCell className="font-medium text-zinc-950 dark:text-zinc-50">
                      {atendimento.clientes?.nome ?? 'Cliente'}
                    </TableCell>
                    <TableCell>{atendimento.barbeiros?.nome ?? 'Barbeiro'}</TableCell>
                    <TableCell>{atendimento.servicos?.nome ?? 'Serviço'}</TableCell>
                    <TableCell>
                      {dateTimeFormatter.format(
                        new Date(atendimento.data_hora_inicio),
                      )}
                    </TableCell>
                    <TableCell>{atendimento.forma_pagamento ?? '-'}</TableCell>
                    <TableCell>
                      {currencyFormatter.format(Number(atendimento.valor))}
                    </TableCell>
                    <TableCell>
                      {currencyFormatter.format(
                        Number(atendimento.valor) * (comissaoPercentual / 100),
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(atendimento.status)}>
                        {atendimento.status}
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
        title="Registrar atendimento"
      >
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          {formError && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </p>
          )}

          <Select
            error={errors.cliente_id?.message}
            label="Cliente"
            options={clienteOptions}
            {...register('cliente_id')}
          />

          <Select
            error={errors.barbeiro_id?.message}
            label="Barbeiro"
            options={barbeiroOptions}
            {...register('barbeiro_id')}
          />

          <Select
            error={errors.servico_id?.message}
            label="Serviço"
            options={servicoOptions}
            {...register('servico_id')}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              error={errors.data?.message}
              label="Data"
              type="date"
              {...register('data')}
            />

            <Input
              error={errors.hora?.message}
              label="Hora"
              type="time"
              {...register('hora')}
            />
          </div>

          <Input
            error={errors.valor?.message}
            label="Valor"
            min={0}
            step="0.01"
            type="number"
            {...register('valor')}
          />

          <Select
            error={errors.forma_pagamento?.message}
            label="Forma de pagamento"
            options={[
              { label: 'Dinheiro', value: 'Dinheiro' },
              { label: 'Pix', value: 'Pix' },
              { label: 'Cartão de crédito', value: 'Cartão de crédito' },
              { label: 'Cartão de débito', value: 'Cartão de débito' },
            ]}
            {...register('forma_pagamento')}
          />

          <div className="grid gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-950 sm:grid-cols-2">
            <div>
              <p className="text-zinc-500 dark:text-zinc-400">
                Comissão barbeiro {comissaoPercentual}%
              </p>
              <p className="mt-1 font-semibold text-zinc-950 dark:text-zinc-50">
                {currencyFormatter.format(comissaoBarbeiro)}
              </p>
            </div>
            <div>
              <p className="text-zinc-500 dark:text-zinc-400">
                Empresa {empresaPercentual}%
              </p>
              <p className="mt-1 font-semibold text-zinc-950 dark:text-zinc-50">
                {currencyFormatter.format(valorEmpresa)}
              </p>
            </div>
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
              {saveMutation.isPending ? 'Salvando...' : 'Salvar atendimento'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
