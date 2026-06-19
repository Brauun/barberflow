import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CalendarPlus, Eye, Loader2, Plus, RefreshCw, X } from 'lucide-react'
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
import { useFeatureAccess } from '../hooks/useSubscription'
import {
  listAtendimentoBarbeiros,
  listAtendimentoClientes,
  listAtendimentos,
  listAtendimentoServicos,
  listAdminWaitlist,
  listDailyAppointments,
  notifyWaitlistEntry,
  processPendingAppointmentCompletions,
  registrarAtendimento,
  removeAdminWaitlistEntry,
  reverseAutoCompletedAppointment,
  rescheduleDailyAppointment,
  updateDailyAppointmentStatus,
  type DailyAppointment,
  type DailyAppointmentStatus,
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

function formatDateInputLabel(value: string) {
  if (!value) {
    return ''
  }

  const [year, month, day] = value.split('-')

  if (!year || !month || !day) {
    return value
  }

  return `${day}/${month}/${year}`
}

type DateFilterFieldProps = {
  label: string
  onChange: (value: string) => void
  value: string
}

function DateFilterField({ label, onChange, value }: DateFilterFieldProps) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </span>
      <div className="relative mt-2">
        <div className="flex h-12 w-full min-w-0 items-center rounded-xl border border-slate-200 bg-white px-3.5 text-base text-slate-950 transition duration-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50 sm:h-11 sm:text-sm">
          {formatDateInputLabel(value)}
        </div>
        <input
          aria-label={label}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          onChange={(event) => onChange(event.target.value)}
          type="date"
          value={value}
        />
      </div>
    </label>
  )
}

function emptyFormValues(): AtendimentoFormInput {
  return {
    atendimento_tipo: 'cadastrado',
    barbeiro_id: '',
    cliente_id: '',
    cliente_avulso_nome: '',
    cliente_avulso_observacao: '',
    cliente_avulso_telefone: '',
    data: todayInputValue(),
    desconto_tipo: 'valor',
    forma_pagamento: '',
    hora: currentTimeInputValue(),
    motivo_desconto: 'Outro',
    servico_id: '',
    valor: 0,
    valor_desconto: 0,
    comissao_base: 'liquido',
  }
}

function getStatusVariant(status: string) {
  if (status === 'concluido') {
    return 'success'
  }

  if (status === 'concluido_automatico' || status === 'remarcado') {
    return 'info'
  }

  if (status === 'cancelado' || status === 'faltou' || status === 'nao_compareceu') {
    return 'danger'
  }

  return 'warning'
}

const dailyStatusOptions = [
  { label: 'Todos', value: '' },
  { label: 'Agendado', value: 'agendado' },
  { label: 'Confirmado', value: 'confirmado' },
  { label: 'Em atendimento', value: 'em_atendimento' },
  { label: 'Finalização pendente', value: 'aguardando_finalizacao' },
  { label: 'Concluído', value: 'concluido' },
  { label: 'Concluído automático', value: 'concluido_automatico' },
  { label: 'Cancelado', value: 'cancelado' },
  { label: 'Remarcado', value: 'remarcado' },
  { label: 'Não compareceu', value: 'nao_compareceu' },
]

function getStatusLabel(status: string) {
  return (
    dailyStatusOptions.find((option) => option.value === status)?.label ??
    status
  )
}

export function AtendimentosPage() {
  const { profile } = useAuth()
  const empresaId = profile?.empresa_id
  const waitlistAccess = useFeatureAccess('HAS_WAITLIST')
  const queryClient = useQueryClient()
  const today = todayInputValue()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [dailyDate, setDailyDate] = useState(todayInputValue())
  const [dailyBarberId, setDailyBarberId] = useState('')
  const [dailyStatus, setDailyStatus] = useState('')
  const [selectedDailyAppointment, setSelectedDailyAppointment] =
    useState<DailyAppointment | null>(null)
  const [rescheduleAppointment, setRescheduleAppointment] =
    useState<DailyAppointment | null>(null)
  const [rescheduleDate, setRescheduleDate] = useState(todayInputValue())
  const [rescheduleTime, setRescheduleTime] = useState(currentTimeInputValue())

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
  const atendimentoTipo = useWatch({
    control,
    name: 'atendimento_tipo',
  })
  const watchedValor = Number(
    useWatch({
      control,
      name: 'valor',
    }) || 0,
  )
  const watchedDiscountType = useWatch({ control, name: 'desconto_tipo' })
  const watchedDiscount = Number(
    useWatch({ control, name: 'valor_desconto' }) || 0,
  )
  const watchedCommissionBase = useWatch({ control, name: 'comissao_base' })
  const discountAmount =
    watchedDiscountType === 'percentual'
      ? watchedValor * (watchedDiscount / 100)
      : watchedDiscount
  const valorFinal = Math.max(0, watchedValor - discountAmount)
  const commissionBase =
    watchedCommissionBase === 'cheio' ? watchedValor : valorFinal
  const comissaoPercentual = profile?.empresa?.percentual_comissao_padrao ?? 60
  const empresaPercentual = Math.max(0, 100 - comissaoPercentual)
  const comissaoBarbeiro = commissionBase * (comissaoPercentual / 100)
  const valorEmpresa = valorFinal - comissaoBarbeiro

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
    queryKey: ['atendimentos-serviços', empresaId],
  })

  const dailyAppointmentsQuery = useQuery({
    enabled: Boolean(empresaId),
    queryFn: async () => {
      await processPendingAppointmentCompletions(empresaId as string)

      return listDailyAppointments({
        barbeiroId: dailyBarberId,
        date: dailyDate,
        empresaId: empresaId as string,
        status: dailyStatus,
      })
    },
    queryKey: [
      'daily-appointments',
      empresaId,
      dailyDate,
      dailyBarberId,
      dailyStatus,
    ],
  })

  const todayAppointmentsQuery = useQuery({
    enabled: Boolean(empresaId),
    queryFn: () =>
      listDailyAppointments({
        date: today,
        empresaId: empresaId as string,
      }),
    queryKey: ['today-appointments-summary', empresaId, today],
  })

  const completedToday = (todayAppointmentsQuery.data ?? []).filter((appointment) =>
    ['concluido', 'concluido_automatico'].includes(appointment.status),
  ).length

  const waitlistQuery = useQuery({
    enabled: Boolean(empresaId && waitlistAccess.canUse),
    queryFn: () => listAdminWaitlist(empresaId as string),
    queryKey: ['admin-waitlist', empresaId],
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
        throw new Error('Empresa não encontrada.')
      }

      await registrarAtendimento(empresaId, data)
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['atendimentos'] }),
        queryClient.invalidateQueries({ queryKey: ['daily-appointments'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['barbeiros'] }),
      ])
      reset(emptyFormValues())
      setFormError(null)
      setIsFormOpen(false)
    },
  })

  const updateStatusMutation = useMutation({
    mutationFn: async (input: {
      appointment: DailyAppointment
      status: DailyAppointmentStatus
    }) => {
      if (!empresaId) {
        throw new Error('Empresa não encontrada.')
      }

      await updateDailyAppointmentStatus({
        empresaId,
        id: input.appointment.id,
        reason:
          input.status === 'cancelado'
            ? window.prompt('Motivo do cancelamento') || null
            : null,
        source: input.appointment.source,
        status: input.status,
      })
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['daily-appointments'] }),
        queryClient.invalidateQueries({ queryKey: ['atendimentos'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['fluxo-caixa'] }),
        queryClient.invalidateQueries({ queryKey: ['relatórios'] }),
        queryClient.invalidateQueries({ queryKey: ['relatorios-executivos'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-waitlist'] }),
      ])
    },
  })

  const reverseAutoMutation = useMutation({
    mutationFn: async (input: {
      appointment: DailyAppointment
      nextStatus: 'concluido' | 'nao_compareceu'
    }) => {
      if (!empresaId) {
        throw new Error('Empresa não encontrada.')
      }

      await reverseAutoCompletedAppointment({
        appointmentId: input.appointment.id,
        empresaId,
        nextStatus: input.nextStatus,
      })
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['daily-appointments'] }),
        queryClient.invalidateQueries({ queryKey: ['atendimentos'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['fluxo-caixa'] }),
        queryClient.invalidateQueries({ queryKey: ['relatórios'] }),
        queryClient.invalidateQueries({ queryKey: ['relatorios-executivos'] }),
      ])
    },
  })

  const rescheduleMutation = useMutation({
    mutationFn: async () => {
      if (!empresaId || !rescheduleAppointment) {
        throw new Error('Atendimento não encontrado.')
      }

      const startsAt = new Date(`${rescheduleDate}T${rescheduleTime}:00`)
      const endsAt = new Date(
        startsAt.getTime() + rescheduleAppointment.duration_minutes * 60 * 1000,
      )

      await rescheduleDailyAppointment({
        appointment: rescheduleAppointment,
        empresaId,
        endsAt: endsAt.toISOString(),
        startsAt: startsAt.toISOString(),
      })
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['daily-appointments'] }),
        queryClient.invalidateQueries({ queryKey: ['atendimentos'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ])
      setRescheduleAppointment(null)
    },
  })

  const notifyWaitlistMutation = useMutation({
    mutationFn: notifyWaitlistEntry,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-waitlist'] })
    },
  })

  const removeWaitlistMutation = useMutation({
    mutationFn: removeAdminWaitlistEntry,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-waitlist'] })
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
          : 'Não foi possível registrar o atendimento.',
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
    <div className="min-w-0 space-y-5 overflow-x-hidden pt-2 pb-[calc(env(safe-area-inset-bottom)+5rem)] sm:space-y-6 sm:pt-0 sm:pb-[env(safe-area-inset-bottom)]">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase text-brand-600 dark:text-brand-400">
            Atendimentos
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-normal text-zinc-950 dark:text-zinc-50">
            Registro de atendimentos
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Agende clientes cadastrados ou avulsos. O caixa e a comissão são
            gerados somente quando o atendimento for concluído.
          </p>
        </div>

        <Button
          className="w-full sm:w-auto"
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

      <section className="grid min-w-0 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:gap-4">
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
              Concluídos hoje
            </p>
            <p className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
              {completedToday}
            </p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                Atendimentos do dia
              </h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Consulte a agenda por data, barbeiro e status.
              </p>
            </div>
            <div className="grid w-full min-w-0 gap-3 sm:grid-cols-2 lg:w-auto lg:min-w-[46rem] lg:grid-cols-3">
              <DateFilterField
                label="Data"
                onChange={setDailyDate}
                value={dailyDate}
              />
              <Select
                className="h-12 sm:h-11"
                label="Barbeiro"
                onChange={(event) => setDailyBarberId(event.target.value)}
                options={barbeiroOptions}
                value={dailyBarberId}
              />
              <Select
                className="h-12 sm:h-11"
                label="Status"
                onChange={(event) => setDailyStatus(event.target.value)}
                options={dailyStatusOptions}
                value={dailyStatus}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {dailyAppointmentsQuery.error && (
            <p className="mb-4 text-sm text-red-600">
              {dailyAppointmentsQuery.error.message}
            </p>
          )}

          {dailyAppointmentsQuery.isLoading ? (
            <div className="flex min-h-40 items-center justify-center">
              <Loader2 className="animate-spin text-brand-500" size={28} />
            </div>
          ) : !dailyAppointmentsQuery.data?.length ? (
            <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50/70 p-6 text-center text-sm font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-300">
              Nenhum atendimento agendado para esta data.
            </div>
          ) : (
            <div className="space-y-3">
              {dailyAppointmentsQuery.data.map((appointment) => (
                <div
                  className="grid min-w-0 gap-4 rounded-[1.1rem] border border-slate-200 bg-white p-4 shadow-[0_14px_50px_rgb(15_23_42/0.025)] dark:border-slate-800 dark:bg-slate-950/70 sm:rounded-[1.35rem] lg:grid-cols-[5rem_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
                  key={`${appointment.source}-${appointment.id}`}
                >
                  <div>
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Horário
                    </p>
                    <p className="mt-1 text-xl font-black text-brand-600">
                      {new Date(appointment.starts_at).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div>
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <p className="font-black text-slate-950 dark:text-white">
                        {appointment.cliente}
                      </p>
                      {appointment.is_walk_in && (
                        <Badge variant="info">Avulso</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {appointment.servico}
                    </p>
                    {appointment.cliente_telefone && (
                      <p className="mt-1 text-xs font-medium text-slate-400 dark:text-slate-500">
                        {appointment.cliente_telefone}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-950 dark:text-white">
                      {appointment.barbeiro}
                    </p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {appointment.duration_minutes}min
                    </p>
                  </div>
                  <div>
                    <p className="font-black text-brand-600">
                      {currencyFormatter.format(appointment.valor)}
                    </p>
                    <Badge variant={getStatusVariant(appointment.status)}>
                      {getStatusLabel(appointment.status)}
                    </Badge>
                  </div>
                  <div className="flex min-w-0 flex-wrap items-center gap-2 lg:justify-end">
                    <Select
                      className="min-w-0 sm:min-w-44"
                      onChange={(event) =>
                        updateStatusMutation.mutate({
                          appointment,
                          status: event.target.value as DailyAppointmentStatus,
                        })
                      }
                      options={dailyStatusOptions.filter((option) => option.value)}
                      value={appointment.status}
                    />
                    {appointment.status === 'aguardando_finalizacao' && (
                      <>
                        <Button
                          disabled={updateStatusMutation.isPending}
                          onClick={() =>
                            updateStatusMutation.mutate({
                              appointment,
                              status: 'concluido',
                            })
                          }
                          size="sm"
                          type="button"
                        >
                          Concluído
                        </Button>
                        <Button
                          disabled={updateStatusMutation.isPending}
                          onClick={() =>
                            updateStatusMutation.mutate({
                              appointment,
                              status: 'nao_compareceu',
                            })
                          }
                          size="sm"
                          type="button"
                          variant="secondary"
                        >
                          Não compareceu
                        </Button>
                      </>
                    )}
                    {appointment.status === 'concluido_automatico' &&
                      appointment.source === 'appointment' && (
                        <Button
                          disabled={reverseAutoMutation.isPending}
                          onClick={() => {
                            const markNoShow = window.confirm(
                              'Corrigir para Não compareceu? Cancele para apenas confirmar como concluído.',
                            )

                            reverseAutoMutation.mutate({
                              appointment,
                              nextStatus: markNoShow
                                ? 'nao_compareceu'
                                : 'concluido',
                            })
                          }}
                          size="sm"
                          type="button"
                          variant="secondary"
                        >
                          Corrigir status
                        </Button>
                      )}
                    {![
                      'cancelado',
                      'concluido',
                      'concluido_automatico',
                      'remarcado',
                      'nao_compareceu',
                      'faltou',
                      'aguardando_finalizacao',
                    ].includes(appointment.status) && (
                      <>
                        <Button
                          aria-label="Remarcar"
                          onClick={() => {
                            setRescheduleAppointment(appointment)
                            setRescheduleDate(appointment.starts_at.slice(0, 10))
                            setRescheduleTime(
                              new Date(appointment.starts_at).toLocaleTimeString(
                                'pt-BR',
                                {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                },
                              ),
                            )
                          }}
                          size="icon-sm"
                          variant="ghost"
                        >
                          <RefreshCw size={16} />
                        </Button>
                        <Button
                          aria-label="Cancelar"
                          disabled={updateStatusMutation.isPending}
                          onClick={() => {
                            if (
                              !window.confirm(
                                'Cancelar este atendimento e liberar o horário?',
                              )
                            ) {
                              return
                            }

                            updateStatusMutation.mutate({
                              appointment,
                              status: 'cancelado',
                            })
                          }}
                          size="icon-sm"
                          variant="ghost"
                        >
                          <X size={16} />
                        </Button>
                        <Button
                          aria-label="Concluir"
                          disabled={updateStatusMutation.isPending}
                          onClick={() =>
                            updateStatusMutation.mutate({
                              appointment,
                              status: 'concluido',
                            })
                          }
                          size="icon-sm"
                          variant="ghost"
                        >
                          <CalendarPlus size={16} />
                        </Button>
                      </>
                    )}
                    <Button
                      aria-label="Ver detalhes"
                      onClick={() => setSelectedDailyAppointment(appointment)}
                      size="icon-sm"
                      variant="ghost"
                    >
                      <Eye size={16} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex min-w-0 items-start gap-3 sm:items-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
              <Bell size={20} />
            </span>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                Lista de espera
              </h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Clientes aguardando vaga por data, serviço e profissional.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {!waitlistAccess.isLoading && !waitlistAccess.canUse ? (
            <div className="rounded-[1.35rem] border border-brand-100 bg-brand-50/70 p-6 text-sm font-semibold text-slate-700 dark:border-brand-400/20 dark:bg-brand-400/10 dark:text-brand-100">
              A lista de espera não está disponível no seu plano atual. Faça
              upgrade em Assinatura para liberar este recurso.
            </div>
          ) : waitlistQuery.error ? (
            <p className="text-sm text-red-600">{waitlistQuery.error.message}</p>
          ) : waitlistQuery.isLoading ? (
            <div className="flex min-h-28 items-center justify-center">
              <Loader2 className="animate-spin text-brand-500" size={24} />
            </div>
          ) : !waitlistQuery.data?.length ? (
            <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50/70 p-6 text-center text-sm font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-300">
              Nenhum cliente na lista de espera.
            </div>
          ) : (
            waitlistQuery.data.map((entry) => (
              <div
                className="grid min-w-0 gap-4 rounded-[1.1rem] border border-slate-200 bg-white p-4 shadow-[0_14px_50px_rgb(15_23_42/0.025)] dark:border-slate-800 dark:bg-slate-950/70 sm:rounded-[1.35rem] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
                key={entry.id}
              >
                <div>
                  <p className="font-black text-slate-950 dark:text-white">
                    {entry.client?.nome ?? 'Cliente'}
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {entry.client?.telefone ?? 'Telefone não informado'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-950 dark:text-white">
                    {entry.service?.nome ?? 'Serviço'}
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {entry.barber?.nome ?? 'Qualquer profissional'}
                  </p>
                </div>
                <div>
                  <p className="font-black text-brand-600">
                    {new Date(`${entry.desired_date}T00:00:00`).toLocaleDateString(
                      'pt-BR',
                    )}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <Badge variant="info">{entry.preferred_period ?? 'qualquer'}</Badge>
                    <Badge
                      variant={
                        entry.status === 'aguardando'
                          ? 'warning'
                          : entry.status === 'notificado'
                            ? 'info'
                            : 'default'
                      }
                    >
                      {entry.status}
                    </Badge>
                  </div>
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-2 lg:justify-end">
                  <Button
                    className="w-full sm:w-auto"
                    disabled={notifyWaitlistMutation.isPending}
                    leftIcon={<Bell size={14} />}
                    onClick={() =>
                      notifyWaitlistMutation.mutate({
                        barbershopName: profile?.empresa?.nome,
                        entry,
                      })
                    }
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    Avisar
                  </Button>
                  <Button
                    className="w-full sm:w-auto"
                    disabled={removeWaitlistMutation.isPending}
                    leftIcon={<X size={14} />}
                    onClick={() =>
                      removeWaitlistMutation.mutate({
                        empresaId: empresaId as string,
                        id: entry.id,
                      })
                    }
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    Remover
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex min-w-0 items-start gap-3 sm:items-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
              <CalendarPlus size={20} />
            </span>
            <div className="min-w-0">
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

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition has-[:checked]:border-brand-400 has-[:checked]:bg-brand-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:has-[:checked]:border-brand-400 dark:has-[:checked]:bg-brand-400/10">
              <input
                className="h-4 w-4 accent-brand-500"
                type="radio"
                value="cadastrado"
                {...register('atendimento_tipo')}
              />
              Cliente cadastrado
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition has-[:checked]:border-brand-400 has-[:checked]:bg-brand-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:has-[:checked]:border-brand-400 dark:has-[:checked]:bg-brand-400/10">
              <input
                className="h-4 w-4 accent-brand-500"
                type="radio"
                value="avulso"
                {...register('atendimento_tipo')}
              />
              Cliente avulso
            </label>
          </div>

          {atendimentoTipo === 'avulso' ? (
            <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/70 sm:grid-cols-2">
              <Input
                error={errors.cliente_avulso_nome?.message}
                label="Nome do cliente"
                placeholder="João da Silva"
                {...register('cliente_avulso_nome')}
              />
              <Input
                error={errors.cliente_avulso_telefone?.message}
                label="Telefone"
                placeholder="(51) 9 9999-9999"
                {...register('cliente_avulso_telefone')}
              />
              <div className="sm:col-span-2">
                <Input
                  error={errors.cliente_avulso_observacao?.message}
                  label="Observação"
                  placeholder="Cliente presencial, indicação, preferência..."
                  {...register('cliente_avulso_observacao')}
                />
              </div>
            </div>
          ) : (
            <Select
              error={errors.cliente_id?.message}
              label="Cliente"
              options={clienteOptions}
              {...register('cliente_id')}
            />
          )}

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
            label="Preço"
            min={0}
            step="0.01"
            type="number"
            {...register('valor')}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              error={errors.desconto_tipo?.message}
              label="Tipo de desconto"
              options={[
                { label: 'Valor', value: 'valor' },
                { label: 'Percentual', value: 'percentual' },
              ]}
              {...register('desconto_tipo')}
            />
            <Input
              error={errors.valor_desconto?.message}
              label="Desconto"
              min={0}
              step="0.01"
              type="number"
              {...register('valor_desconto')}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              error={errors.motivo_desconto?.message}
              label="Motivo do desconto"
              options={[
                { label: 'Promoção', value: 'Promoção' },
                { label: 'Cliente fiel', value: 'Cliente fiel' },
                { label: 'Cupom', value: 'Cupom' },
                { label: 'Cortesia', value: 'Cortesia' },
                { label: 'Outro', value: 'Outro' },
              ]}
              {...register('motivo_desconto')}
            />
            <Select
              error={errors.comissao_base?.message}
              label="Comissão sobre"
              options={[
                { label: 'Valor cheio', value: 'cheio' },
                { label: 'Valor líquido', value: 'liquido' },
              ]}
              {...register('comissao_base')}
            />
          </div>

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
              <p className="text-zinc-500 dark:text-zinc-400">Pago</p>
              <p className="mt-1 font-semibold text-brand-600">
                {currencyFormatter.format(valorFinal)}
              </p>
            </div>
            <div>
              <p className="text-zinc-500 dark:text-zinc-400">Desconto</p>
              <p className="mt-1 font-semibold text-zinc-950 dark:text-zinc-50">
                {currencyFormatter.format(discountAmount)}
              </p>
            </div>
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

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Button
              className="w-full sm:w-auto"
              onClick={() => setIsFormOpen(false)}
              type="button"
              variant="secondary"
            >
              Cancelar
            </Button>
            <Button
              className="w-full sm:w-auto"
              disabled={isSubmitting || saveMutation.isPending}
              type="submit"
            >
              {saveMutation.isPending ? 'Salvando...' : 'Salvar atendimento'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(selectedDailyAppointment)}
        onClose={() => setSelectedDailyAppointment(null)}
        title="Detalhes do atendimento"
      >
        {selectedDailyAppointment && (
          <div className="space-y-4 text-sm">
            {[
              ['Horário', dateTimeFormatter.format(new Date(selectedDailyAppointment.starts_at))],
              ['Cliente', selectedDailyAppointment.cliente],
              ['Barbeiro', selectedDailyAppointment.barbeiro],
              ['Serviço', selectedDailyAppointment.servico],
              ['Duração', `${selectedDailyAppointment.duration_minutes}min`],
              ['Valor', currencyFormatter.format(selectedDailyAppointment.valor)],
              ['Status', getStatusLabel(selectedDailyAppointment.status)],
            ].map(([label, value]) => (
              <div
                className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/70"
                key={label}
              >
                <span className="font-semibold text-slate-500 dark:text-slate-400">{label}</span>
                <span className="text-right font-bold text-slate-950 dark:text-white">
                  {value}
                </span>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(rescheduleAppointment)}
        onClose={() => setRescheduleAppointment(null)}
        title="Remarcar atendimento"
      >
        <div className="space-y-4">
          {rescheduleMutation.error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {rescheduleMutation.error.message}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Nova data"
              min={todayInputValue()}
              onChange={(event) => setRescheduleDate(event.target.value)}
              type="date"
              value={rescheduleDate}
            />
            <Input
              label="Novo horário"
              onChange={(event) => setRescheduleTime(event.target.value)}
              type="time"
              value={rescheduleTime}
            />
          </div>
          {rescheduleAppointment && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-950/70">
              <p className="font-semibold text-slate-950 dark:text-white">
                {rescheduleAppointment.cliente}
              </p>
              <p className="mt-1 text-slate-500 dark:text-slate-400">
                {rescheduleAppointment.servico} ·{' '}
                {rescheduleAppointment.duration_minutes}min
              </p>
            </div>
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              className="w-full sm:w-auto"
              onClick={() => setRescheduleAppointment(null)}
              type="button"
              variant="secondary"
            >
              Fechar
            </Button>
            <Button
              className="w-full sm:w-auto"
              disabled={rescheduleMutation.isPending}
              onClick={() => rescheduleMutation.mutate()}
              type="button"
            >
              {rescheduleMutation.isPending ? 'Remarcando...' : 'Confirmar'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
