import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bell,
  CalendarPlus,
  Eye,
  FileSpreadsheet,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useSearchParams } from 'react-router-dom'

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Input,
  Modal,
  Select,
} from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { useFeatureAccess } from '../hooks/useSubscription'
import {
  listAtendimentoBarbeiros,
  listAtendimentoClientes,
  listAtendimentoRecords,
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
import { listClientBenefits } from '../services/benefitsService'
import { exportHtmlReport } from '../utils/mobileExport'

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

function daysAgoInputValue(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)

  return date.toISOString().slice(0, 10)
}

function monthStartInputValue() {
  const date = new Date()
  date.setDate(1)

  return date.toISOString().slice(0, 10)
}

function getRecordQuickRange(filter: RecordQuickFilter) {
  const today = todayInputValue()

  if (filter === 'hoje') {
    return { end: today, start: today }
  }

  if (filter === '15d') {
    return { end: today, start: daysAgoInputValue(14) }
  }

  if (filter === '30d') {
    return { end: today, start: daysAgoInputValue(29) }
  }

  if (filter === 'mes') {
    return { end: today, start: monthStartInputValue() }
  }

  return { end: today, start: daysAgoInputValue(6) }
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

function fileSafeDate(value: string) {
  return value.replaceAll('/', '-')
}

function escapeCsv(value: string | number) {
  const text = String(value ?? '')

  if (/[;"\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`
  }

  return text
}

function escapeHtml(value: string | number) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
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
    benefit_id: '',
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

const recordStatusOptions = dailyStatusOptions.filter(
  (option) =>
    !['confirmado', 'em_atendimento', 'aguardando_finalizacao'].includes(
      option.value,
    ),
)

type RecordQuickFilter = 'hoje' | '7d' | '15d' | '30d' | 'mes' | 'custom'

const recordQuickFilters: Array<{ label: string; value: RecordQuickFilter }> = [
  { label: 'Hoje', value: 'hoje' },
  { label: 'Últimos 7 dias', value: '7d' },
  { label: 'Últimos 15 dias', value: '15d' },
  { label: 'Últimos 30 dias', value: '30d' },
  { label: 'Este mês', value: 'mes' },
  { label: 'Personalizado', value: 'custom' },
]

const recordPageSize = 20

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
  const [searchParams] = useSearchParams()
  const deepLinkAppointmentId = searchParams.get('appointmentId')
  const deepLinkFocus = searchParams.get('focus')
  const today = todayInputValue()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [dailyDate, setDailyDate] = useState(
    () => searchParams.get('date') ?? todayInputValue(),
  )
  const [dailyBarberId, setDailyBarberId] = useState(
    () => searchParams.get('barberId') ?? '',
  )
  const [dailyStatus, setDailyStatus] = useState(
    () => searchParams.get('status') ?? '',
  )
  const [selectedDailyAppointment, setSelectedDailyAppointment] =
    useState<DailyAppointment | null>(null)
  const [rescheduleAppointment, setRescheduleAppointment] =
    useState<DailyAppointment | null>(null)
  const [rescheduleDate, setRescheduleDate] = useState(todayInputValue())
  const [rescheduleTime, setRescheduleTime] = useState(currentTimeInputValue())
  const defaultRecordRange = getRecordQuickRange('7d')
  const [recordQuickFilter, setRecordQuickFilter] =
    useState<RecordQuickFilter>('7d')
  const [recordStartDate, setRecordStartDate] = useState(defaultRecordRange.start)
  const [recordEndDate, setRecordEndDate] = useState(defaultRecordRange.end)
  const [recordBarberId, setRecordBarberId] = useState('')
  const [recordClientId, setRecordClientId] = useState('')
  const [recordServiceId, setRecordServiceId] = useState('')
  const [recordStatus, setRecordStatus] = useState('')
  const [recordPage, setRecordPage] = useState(0)
  const [appliedRecordFilters, setAppliedRecordFilters] = useState({
    barbeiroId: '',
    clienteId: '',
    dataFim: defaultRecordRange.end,
    dataInicio: defaultRecordRange.start,
    servicoId: '',
    status: '',
  })
  const handledDeepLinkRef = useRef<string | null>(null)

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
  const selectedClienteId = useWatch({
    control,
    name: 'cliente_id',
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
    queryFn: () =>
      listAtendimentoRecords(empresaId as string, {
        ...appliedRecordFilters,
        page: recordPage,
        pageSize: recordPageSize,
      }),
    queryKey: [
      'atendimentos',
      empresaId,
      appliedRecordFilters,
      recordPage,
      recordPageSize,
    ],
  })

  const clientesQuery = useQuery({
    enabled: Boolean(empresaId),
    queryFn: () => listAtendimentoClientes(empresaId as string),
    queryKey: ['atendimentos-clientes', empresaId],
  })

  const clientBenefitsQuery = useQuery({
    enabled: Boolean(empresaId),
    queryFn: () => listClientBenefits(empresaId as string),
    queryKey: ['client-benefits', empresaId, 'atendimentos'],
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

  const benefitOptions = useMemo(() => {
    const benefits = (clientBenefitsQuery.data ?? []).filter(
      (benefit) =>
        benefit.cliente_id === selectedClienteId &&
        benefit.status === 'ativo' &&
        (Number(benefit.saldo_usos) > 0 || Number(benefit.saldo_credito) > 0),
    )

    return [
      { label: 'Não aplicar benefício', value: '' },
      ...benefits.map((benefit) => ({
        label: `${benefit.program?.nome ?? 'Benefício'} (${Number(benefit.saldo_usos)} uso(s))`,
        value: benefit.id,
      })),
    ]
  }, [clientBenefitsQuery.data, selectedClienteId])

  useEffect(() => {
    if (
      !deepLinkAppointmentId ||
      dailyAppointmentsQuery.isLoading ||
      handledDeepLinkRef.current === deepLinkAppointmentId
    ) {
      return
    }

    const appointment = dailyAppointmentsQuery.data?.find(
      (item) => item.id === deepLinkAppointmentId,
    )

    handledDeepLinkRef.current = deepLinkAppointmentId

    if (appointment) {
      setSelectedDailyAppointment(appointment)
      return
    }

    window.alert('Registro não encontrado.')
  }, [
    dailyAppointmentsQuery.data,
    dailyAppointmentsQuery.isLoading,
    deepLinkAppointmentId,
  ])

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

  useEffect(() => {
    setValue('benefit_id', '', { shouldDirty: true })
  }, [selectedClienteId, setValue])

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

  function setQuickRecordFilter(filter: RecordQuickFilter) {
    setRecordQuickFilter(filter)

    if (filter === 'custom') {
      return
    }

    const range = getRecordQuickRange(filter)
    setRecordStartDate(range.start)
    setRecordEndDate(range.end)
    setRecordPage(0)
    setAppliedRecordFilters({
      barbeiroId: '',
      clienteId: '',
      dataFim: range.end,
      dataInicio: range.start,
      servicoId: '',
      status: '',
    })
  }

  function applyRecordFilters() {
    setRecordPage(0)
    setAppliedRecordFilters({
      barbeiroId: recordBarberId,
      clienteId: recordClientId,
      dataFim: recordEndDate,
      dataInicio: recordStartDate,
      servicoId: recordServiceId,
      status: recordStatus,
    })
  }

  function resetRecordFilters() {
    const range = getRecordQuickRange('7d')
    setRecordQuickFilter('7d')
    setRecordStartDate(range.start)
    setRecordEndDate(range.end)
    setRecordBarberId('')
    setRecordClientId('')
    setRecordServiceId('')
    setRecordStatus('')
    setRecordPage(0)
    setAppliedRecordFilters({
      barbeiroId: '',
      clienteId: '',
      dataFim: range.end,
      dataInicio: range.start,
      servicoId: '',
      status: '',
    })
  }

  async function getExportRecords() {
    if (!empresaId) {
      return null
    }

    return listAtendimentoRecords(empresaId, {
      ...appliedRecordFilters,
      page: 0,
      pageSize: 5000,
    })
  }

  async function exportAtendimentosCsv() {
    const result = await getExportRecords()

    if (!result) {
      return
    }

    const rows = [
      [
        'Data',
        'Horário',
        'Cliente',
        'Tipo cliente',
        'Barbeiro',
        'Serviço',
        'Status',
        'Valor',
        'Desconto',
        'Valor final',
      ],
      ...result.items.map((record) => {
        const date = new Date(record.starts_at)

        return [
          date.toLocaleDateString('pt-BR'),
          date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          record.cliente,
          record.cliente_tipo === 'avulso' ? 'Avulso' : 'Cadastrado',
          record.barbeiro,
          record.servico,
          getStatusLabel(record.status),
          currencyFormatter.format(record.valor),
          currencyFormatter.format(record.valor_desconto),
          currencyFormatter.format(record.valor_final),
        ]
      }),
    ]
    const csv = rows.map((row) => row.map(escapeCsv).join(';')).join('\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `BW-Barber-Atendimentos-${fileSafeDate(appliedRecordFilters.dataInicio)}-a-${fileSafeDate(appliedRecordFilters.dataFim)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function exportAtendimentosPdf() {
    const result = await getExportRecords()

    if (!result) {
      return
    }

    const rows = result.items
      .map((record) => {
        const date = new Date(record.starts_at)

        return `
          <tr>
            <td>${escapeHtml(date.toLocaleDateString('pt-BR'))}</td>
            <td>${escapeHtml(date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))}</td>
            <td><strong>${escapeHtml(record.cliente)}</strong><br><span>${record.cliente_tipo === 'avulso' ? 'Avulso' : 'Cadastrado'}</span></td>
            <td>${escapeHtml(record.barbeiro)}</td>
            <td>${escapeHtml(record.servico)}</td>
            <td>${escapeHtml(getStatusLabel(record.status))}</td>
            <td>${escapeHtml(currencyFormatter.format(record.valor))}</td>
            <td>${escapeHtml(currencyFormatter.format(record.valor_desconto))}</td>
            <td>${escapeHtml(currencyFormatter.format(record.valor_final))}</td>
          </tr>
        `
      })
      .join('')
    const html = `<!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>BW Barber - Atendimentos</title>
          <style>
            @page { size: A4 landscape; margin: 12mm; }
            * { box-sizing: border-box; }
            body { color: #0f172a; font-family: Inter, Arial, sans-serif; margin: 0; }
            header { align-items: center; border-bottom: 1px solid #dbe7ef; display: flex; justify-content: space-between; padding-bottom: 16px; }
            .brand { align-items: center; display: flex; gap: 12px; }
            .logo { align-items: center; background: #071426; border-radius: 14px; color: #12c6f3; display: flex; font-weight: 900; height: 44px; justify-content: center; width: 44px; }
            .eyebrow { color: #0891b2; font-size: 10px; font-weight: 900; letter-spacing: .18em; text-transform: uppercase; }
            h1 { font-size: 28px; margin: 22px 0 8px; }
            h2, h3, p { margin: 0; }
            .muted { color: #64748b; font-size: 12px; }
            .kpis { display: grid; gap: 10px; grid-template-columns: repeat(6, 1fr); margin: 18px 0; }
            .kpi { border: 1px solid #dbe7ef; border-radius: 14px; padding: 12px; }
            .kpi span { color: #64748b; display: block; font-size: 9px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; }
            .kpi strong { color: #071426; display: block; font-size: 16px; margin-top: 6px; }
            table { border-collapse: collapse; width: 100%; }
            th { background: #f1f7fb; color: #334155; font-size: 10px; letter-spacing: .08em; padding: 10px; text-align: left; text-transform: uppercase; }
            td { border-bottom: 1px solid #e5edf3; font-size: 11px; padding: 10px; vertical-align: top; }
            td span { color: #64748b; font-size: 10px; }
          </style>
        </head>
        <body>
          <header>
            <div class="brand">
              <div class="logo">BW</div>
              <div>
                <div class="eyebrow">BW Barber</div>
                <h3>${escapeHtml(profile?.empresa?.nome ?? 'Barbearia')}</h3>
              </div>
            </div>
            <p class="muted">Emitido em ${escapeHtml(new Date().toLocaleString('pt-BR'))}</p>
          </header>
          <h1>Relatório de Atendimentos</h1>
          <p class="muted">Período: ${escapeHtml(formatDateInputLabel(appliedRecordFilters.dataInicio))} até ${escapeHtml(formatDateInputLabel(appliedRecordFilters.dataFim))}</p>
          <section class="kpis">
            <div class="kpi"><span>Total</span><strong>${result.summary.total}</strong></div>
            <div class="kpi"><span>Concluídos</span><strong>${result.summary.concluidos}</strong></div>
            <div class="kpi"><span>Cancelados</span><strong>${result.summary.cancelados}</strong></div>
            <div class="kpi"><span>Não compareceu</span><strong>${result.summary.naoCompareceu}</strong></div>
            <div class="kpi"><span>Receita</span><strong>${escapeHtml(currencyFormatter.format(result.summary.receita))}</strong></div>
            <div class="kpi"><span>Comissão</span><strong>${escapeHtml(currencyFormatter.format(result.summary.comissao))}</strong></div>
          </section>
          <table>
            <thead>
              <tr>
                <th>Data</th><th>Hora</th><th>Cliente</th><th>Barbeiro</th><th>Serviço</th><th>Status</th><th>Valor</th><th>Desconto</th><th>Final</th>
              </tr>
            </thead>
            <tbody>
              ${rows || '<tr><td colspan="9">Nenhum atendimento encontrado.</td></tr>'}
            </tbody>
          </table>
        </body>
      </html>`

    exportHtmlReport({
      filename: `BW-Barber-Atendimentos-${fileSafeDate(appliedRecordFilters.dataInicio)}-a-${fileSafeDate(appliedRecordFilters.dataFim)}.html`,
      html,
      previewFeatures: 'width=1100,height=900',
    })
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
          <h2 className="mt-1.5 text-xl font-semibold tracking-normal text-zinc-950 sm:mt-2 md:text-2xl dark:text-zinc-50">
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
            <p className="mt-1.5 text-xl font-semibold text-zinc-950 sm:mt-2 md:text-2xl dark:text-zinc-50">
              {comissaoPercentual}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Parte da empresa
            </p>
            <p className="mt-1.5 text-xl font-semibold text-zinc-950 sm:mt-2 md:text-2xl dark:text-zinc-50">
              {empresaPercentual}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Concluídos hoje
            </p>
            <p className="mt-1.5 text-xl font-semibold text-zinc-950 sm:mt-2 md:text-2xl dark:text-zinc-50">
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
              <Loader2 className="h-5 w-5 animate-spin text-brand-500 md:h-7 md:w-7" />
            </div>
          ) : !dailyAppointmentsQuery.data?.length ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-center text-sm font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-300 sm:rounded-[1.35rem] sm:p-6">
              Nenhum atendimento agendado para esta data.
            </div>
          ) : (
            <div className="space-y-3">
              {dailyAppointmentsQuery.data.map((appointment) => (
                <div
                  className="grid min-w-0 gap-2.5 rounded-xl border border-slate-200 bg-white p-3 shadow-[0_14px_50px_rgb(15_23_42/0.025)] dark:border-slate-800 dark:bg-slate-950/70 sm:rounded-[1.35rem] md:gap-4 md:p-4 lg:grid-cols-[5rem_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
                  key={`${appointment.source}-${appointment.id}`}
                >
                  <div>
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Horário
                    </p>
                    <p className="mt-1 text-lg font-black text-brand-600 md:text-xl">
                      {new Date(appointment.starts_at).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div>
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <p className="text-sm font-black text-slate-950 dark:text-white md:text-base">
                        {appointment.cliente}
                      </p>
                      {appointment.is_walk_in && (
                        <Badge variant="info">Avulso</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 md:text-sm">
                      {appointment.servico}
                    </p>
                    {appointment.cliente_telefone && (
                      <p className="mt-1 text-xs font-medium text-slate-400 dark:text-slate-500">
                        {appointment.cliente_telefone}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-950 dark:text-white md:text-sm">
                      {appointment.barbeiro}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 md:text-sm">
                      {appointment.duration_minutes}min
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-black text-brand-600 md:text-base">
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
            <div className="rounded-xl border border-brand-100 bg-brand-50/70 p-4 text-sm font-semibold text-slate-700 dark:border-brand-400/20 dark:bg-brand-400/10 dark:text-brand-100 sm:rounded-[1.35rem] sm:p-6">
              A lista de espera não está disponível no seu plano atual. Faça
              upgrade em Assinatura para liberar este recurso.
            </div>
          ) : waitlistQuery.error ? (
            <p className="text-sm text-red-600">{waitlistQuery.error.message}</p>
          ) : waitlistQuery.isLoading ? (
            <div className="flex min-h-28 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-brand-500 md:h-6 md:w-6" />
            </div>
          ) : !waitlistQuery.data?.length ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-center text-sm font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-300 sm:rounded-[1.35rem] sm:p-6">
              Nenhum cliente na lista de espera.
            </div>
          ) : (
            waitlistQuery.data.map((entry) => (
              <div
                className="grid min-w-0 gap-2.5 rounded-xl border border-slate-200 bg-white p-3 shadow-[0_14px_50px_rgb(15_23_42/0.025)] dark:border-slate-800 dark:bg-slate-950/70 sm:rounded-[1.35rem] md:gap-4 md:p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
                key={entry.id}
              >
                <div>
                  <p className="text-sm font-black text-slate-950 dark:text-white md:text-base">
                    {entry.client?.nome?.trim() || 'Cliente não identificado'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 md:text-sm">
                    {entry.client?.telefone ?? 'Telefone não informado'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-950 dark:text-white md:text-sm">
                    {entry.service?.nome ?? 'Serviço'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 md:text-sm">
                    {entry.barber?.nome ?? 'Qualquer profissional'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-black text-brand-600 md:text-base">
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
          <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-start gap-3 sm:items-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                <CalendarPlus size={20} />
              </span>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                  Atendimentos registrados
                </h3>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {recordQuickFilter === '7d' && !appliedRecordFilters.barbeiroId && !appliedRecordFilters.clienteId && !appliedRecordFilters.servicoId && !appliedRecordFilters.status
                    ? 'Exibindo atendimentos dos últimos 7 dias.'
                    : `${formatDateInputLabel(appliedRecordFilters.dataInicio)} até ${formatDateInputLabel(appliedRecordFilters.dataFim)}.`}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                className="w-full sm:w-auto"
                disabled={!atendimentosQuery.data?.items.length}
                leftIcon={<FileText size={16} />}
                onClick={exportAtendimentosPdf}
                size="sm"
                type="button"
              >
                Exportar PDF
              </Button>
              <Button
                className="w-full sm:w-auto"
                disabled={!atendimentosQuery.data?.items.length}
                leftIcon={<FileSpreadsheet size={16} />}
                onClick={exportAtendimentosCsv}
                size="sm"
                type="button"
                variant="secondary"
              >
                Exportar CSV
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 md:space-y-5">
          <div className="flex flex-wrap gap-2">
            {recordQuickFilters.map((filter) => {
              const isActive = recordQuickFilter === filter.value

              return (
                <button
                  className={[
                    'min-h-10 rounded-full border px-3 text-xs font-black transition duration-200 md:min-h-11 md:px-4 md:text-sm',
                    isActive
                      ? 'border-brand-300 bg-brand-500 text-slate-950 shadow-[0_12px_28px_rgb(18_198_243/0.22)]'
                      : 'border-slate-200 bg-white text-slate-600 hover:-translate-y-0.5 hover:border-brand-200 hover:bg-brand-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-brand-700 dark:hover:bg-brand-950/40',
                  ].join(' ')}
                  key={filter.value}
                  onClick={() => setQuickRecordFilter(filter.value)}
                  type="button"
                >
                  {filter.label}
                </button>
              )
            })}
          </div>

          {recordQuickFilter === 'custom' && (
            <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/50 sm:grid-cols-2 md:gap-3 md:rounded-[1.35rem] md:p-4 xl:grid-cols-3">
              <DateFilterField
                label="Data inicial"
                onChange={setRecordStartDate}
                value={recordStartDate}
              />
              <DateFilterField
                label="Data final"
                onChange={setRecordEndDate}
                value={recordEndDate}
              />
              <Select
                className="h-12 sm:h-11"
                label="Barbeiro"
                onChange={(event) => setRecordBarberId(event.target.value)}
                options={barbeiroOptions}
                value={recordBarberId}
              />
              <Select
                className="h-12 sm:h-11"
                label="Cliente"
                onChange={(event) => setRecordClientId(event.target.value)}
                options={clienteOptions}
                value={recordClientId}
              />
              <Select
                className="h-12 sm:h-11"
                label="Serviço"
                onChange={(event) => setRecordServiceId(event.target.value)}
                options={servicoOptions}
                value={recordServiceId}
              />
              <Select
                className="h-12 sm:h-11"
                label="Status"
                onChange={(event) => setRecordStatus(event.target.value)}
                options={recordStatusOptions}
                value={recordStatus}
              />
              <div className="flex gap-2 sm:col-span-2 xl:col-span-3">
                <Button className="flex-1" onClick={applyRecordFilters} type="button">
                  Aplicar filtros
                </Button>
                <Button
                  className="flex-1"
                  onClick={resetRecordFilters}
                  type="button"
                  variant="secondary"
                >
                  Limpar
                </Button>
              </div>
            </div>
          )}

          {atendimentosQuery.data && (
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              {[
                ['Total', atendimentosQuery.data.summary.total],
                ['Concluídos', atendimentosQuery.data.summary.concluidos],
                ['Cancelados', atendimentosQuery.data.summary.cancelados],
                ['Não compareceu', atendimentosQuery.data.summary.naoCompareceu],
                ['Receita', currencyFormatter.format(atendimentosQuery.data.summary.receita)],
                ['Comissão', currencyFormatter.format(atendimentosQuery.data.summary.comissao)],
              ].map(([label, value]) => (
                <div
                  className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950/60 md:rounded-2xl md:p-4"
                  key={label}
                >
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                    {label}
                  </p>
                  <p className="mt-1.5 text-base font-black text-slate-950 dark:text-white md:mt-2 md:text-lg">
                    {value}
                  </p>
                </div>
              ))}
            </section>
          )}

          {atendimentosQuery.error && (
            <div className="text-sm text-red-600">
              {atendimentosQuery.error.message}
            </div>
          )}

          {atendimentosQuery.isLoading ? (
            <div className="flex min-h-56 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-brand-500 md:h-7 md:w-7" />
            </div>
          ) : !atendimentosQuery.data?.items.length ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-center text-sm font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-300 sm:rounded-[1.35rem] sm:p-6">
              Nenhum atendimento encontrado para o filtro selecionado.
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {atendimentosQuery.data.items.map((atendimento) => (
                  <div
                    className="grid min-w-0 gap-2.5 rounded-xl border border-slate-200 bg-white p-3 shadow-[0_14px_50px_rgb(15_23_42/0.025)] dark:border-slate-800 dark:bg-slate-950/70 sm:rounded-[1.35rem] md:gap-4 md:p-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
                    key={`${atendimento.source}-${atendimento.id}`}
                  >
                    <div>
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <p className="text-sm font-black text-slate-950 dark:text-white md:text-base">
                          {atendimento.cliente}
                        </p>
                        <Badge variant="info">
                          {atendimento.cliente_tipo === 'avulso'
                            ? 'Avulso'
                            : 'Cadastrado'}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 md:text-sm">
                        {dateTimeFormatter.format(new Date(atendimento.starts_at))}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-950 dark:text-white md:text-sm">
                        {atendimento.barbeiro}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 md:text-sm">
                        {atendimento.servico}
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs md:text-sm xl:block">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                          Valor
                        </p>
                        <p className="mt-1 font-black text-brand-600">
                          {currencyFormatter.format(atendimento.valor_final)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                          Desc.
                        </p>
                        <p className="mt-1 font-semibold text-slate-600 dark:text-slate-300">
                          {currencyFormatter.format(atendimento.valor_desconto)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                          Comissão
                        </p>
                        <p className="mt-1 font-semibold text-slate-600 dark:text-slate-300">
                          {currencyFormatter.format(
                            atendimento.valor_final * (comissaoPercentual / 100),
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center xl:justify-end">
                      <Badge variant={getStatusVariant(atendimento.status)}>
                        {getStatusLabel(atendimento.status)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800 sm:flex-row">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Página {recordPage + 1} · {recordPageSize} registros por página
                </p>
                <div className="flex w-full gap-2 sm:w-auto">
                  <Button
                    className="flex-1 sm:flex-none"
                    disabled={recordPage === 0}
                    onClick={() => setRecordPage((page) => Math.max(0, page - 1))}
                    type="button"
                    variant="secondary"
                  >
                    Anterior
                  </Button>
                  <Button
                    className="flex-1 sm:flex-none"
                    disabled={!atendimentosQuery.data.hasMore}
                    onClick={() => setRecordPage((page) => page + 1)}
                    type="button"
                    variant="secondary"
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            </>
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
            <div className="space-y-4">
              <Select
                error={errors.cliente_id?.message}
                label="Cliente"
                options={clienteOptions}
                {...register('cliente_id')}
              />
              {benefitOptions.length > 1 && (
                <Select
                  label="Benefício disponível"
                  options={benefitOptions}
                  {...register('benefit_id')}
                />
              )}
            </div>
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
            {selectedDailyAppointment.status === 'aguardando_finalizacao' && (
              <div
                className={
                  deepLinkFocus === 'completion'
                    ? 'rounded-2xl border border-brand-200 bg-brand-50 p-4 dark:border-brand-400/30 dark:bg-brand-400/10'
                    : 'rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/70'
                }
              >
                <p className="text-sm font-semibold text-slate-950 dark:text-white">
                  Finalização pendente
                </p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Confirme se o atendimento foi concluído ou se o cliente não
                  compareceu.
                </p>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <Button
                    disabled={updateStatusMutation.isPending}
                    onClick={() => {
                      updateStatusMutation.mutate({
                        appointment: selectedDailyAppointment,
                        status: 'concluido',
                      })
                      setSelectedDailyAppointment(null)
                    }}
                    type="button"
                  >
                    Concluir
                  </Button>
                  <Button
                    disabled={updateStatusMutation.isPending}
                    onClick={() => {
                      updateStatusMutation.mutate({
                        appointment: selectedDailyAppointment,
                        status: 'nao_compareceu',
                      })
                      setSelectedDailyAppointment(null)
                    }}
                    type="button"
                    variant="secondary"
                  >
                    Não compareceu
                  </Button>
                </div>
              </div>
            )}
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
