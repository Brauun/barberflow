import { useQuery } from '@tanstack/react-query'
import {
  ArrowDownRight,
  ArrowUpRight,
  CreditCard,
  Scissors,
  TrendingUp,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import {
  Badge,
  Card,
  CardContent,
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
  getDashboardData,
  type MonthlyFinancePoint,
} from '../services/dashboardService'
import { cn } from '../utils/cn'

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  currency: 'BRL',
  style: 'currency',
})

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
})

function formatCurrency(value: number) {
  return currencyFormatter.format(value)
}

function formatAxisCurrency(value: number) {
  if (value >= 1000) {
    return `R$ ${(value / 1000).toLocaleString('pt-BR', {
      maximumFractionDigits: 1,
    })} mil`
  }
  return `R$ ${Math.round(value).toLocaleString('pt-BR')}`
}

type RevenueChartPoint = MonthlyFinancePoint & {
  x: number
  y: number
}

function buildSmoothPath(segment: RevenueChartPoint[]) {
  if (segment.length === 0) return ''
  if (segment.length === 1) return `M ${segment[0].x} ${segment[0].y}`
  return segment
    .map((point, index) => {
      if (index === 0) return `M ${point.x} ${point.y}`
      const previous = segment[index - 1]
      const controlX = previous.x + (point.x - previous.x) / 2
      return `C ${controlX} ${previous.y}, ${controlX} ${point.y}, ${point.x} ${point.y}`
    })
    .join(' ')
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

function getStatusVariant(status: string) {
  if (['concluido', 'paga', 'confirmado'].includes(status)) return 'success'
  if (['pendente', 'agendado', 'vencida'].includes(status)) return 'warning'
  if (['cancelado', 'faltou'].includes(status)) return 'danger'
  return 'default'
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-20" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.5fr_0.95fr]">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    </div>
  )
}

function MetricCard({
  delta,
  deltaUp,
  icon: Icon,
  iconColor,
  label,
  value,
}: {
  delta: string
  deltaUp: boolean
  icon: typeof TrendingUp
  iconColor: 'blue' | 'green' | 'amber'
  label: string
  value: string
}) {
  const iconBg = {
    amber: 'bg-amber-500/10 text-amber-400',
    blue: 'bg-brand-500/10 text-brand-400',
    green: 'bg-emerald-500/10 text-emerald-400',
  }[iconColor]

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 sm:rounded-2xl sm:p-5">
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <p className="text-xs text-slate-500 dark:text-slate-400 sm:text-sm">{label}</p>
        <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:h-9 sm:w-9 sm:rounded-xl', iconBg)}>
          <Icon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
        </span>
      </div>
      <p className="mt-2 text-xl font-black tracking-normal text-slate-950 dark:text-white sm:mt-3 sm:text-3xl">
        {value}
      </p>
      <p className={cn('mt-1.5 inline-flex items-center gap-1 text-[0.68rem] font-semibold sm:mt-2 sm:text-xs', deltaUp ? 'text-emerald-500' : 'text-red-400')}>
        {deltaUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
        {delta}
      </p>
    </div>
  )
}

function RevenueChart({ data }: { data: MonthlyFinancePoint[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const chartWidth = Math.max(320, Math.min(containerWidth || 720, 820))
  const isCompact = chartWidth < 520
  const chartHeight = isCompact ? 238 : chartWidth < 700 ? 270 : 300
  const margin = isCompact
    ? { bottom: 36, left: 48, right: 16, top: 18 }
    : { bottom: 40, left: 72, right: 22, top: 18 }
  const plotWidth = chartWidth - margin.left - margin.right
  const plotHeight = chartHeight - margin.top - margin.bottom
  const normalizedData = useMemo(
    () => data.map((point) => ({ ...point, entradas: Number(point.entradas) || 0 })),
    [data],
  )
  const maxValue = Math.max(...normalizedData.map((point) => point.entradas), 0)
  const hasRevenue = maxValue > 0

  useEffect(() => {
    const element = containerRef.current

    if (!element) {
      return undefined
    }

    const updateWidth = () => setContainerWidth(element.clientWidth)
    updateWidth()

    const observer = new ResizeObserver(updateWidth)
    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  if (!hasRevenue) {
    return (
      <div className="flex h-[14rem] flex-col items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 text-center dark:border-slate-800 dark:bg-slate-900/50">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-400/10 dark:text-brand-300">
          <TrendingUp size={20} />
        </div>
        <p className="mt-3 text-sm font-semibold text-slate-950 dark:text-white">
          Ainda não existem receitas concluidas.
        </p>
        <p className="mt-1 max-w-xs text-xs text-slate-500 dark:text-slate-400">
          Conclua atendimentos para visualizar o fluxo de receita.
        </p>
      </div>
    )
  }

  const domainMax = maxValue * 1.2
  const yTicks = Array.from({ length: 4 }, (_, i) => domainMax - (domainMax / 3) * i)
  const points = normalizedData.map((point, index) => {
    const x =
      margin.left +
      (normalizedData.length === 1
        ? plotWidth / 2
        : (index / (normalizedData.length - 1)) * plotWidth)
    const y = margin.top + ((domainMax - point.entradas) / domainMax) * plotHeight
    return { ...point, x, y }
  })
  const linePath = buildSmoothPath(points)
  const lastPoint = points[points.length - 1]
  const areaPath =
    points.length > 1
      ? `${linePath} L ${lastPoint.x} ${chartHeight - margin.bottom} L ${points[0].x} ${chartHeight - margin.bottom} Z`
      : ''
  const activePoint = activeIndex !== null ? points[activeIndex] : null

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white px-2 py-3 dark:border-slate-800 dark:bg-slate-950 sm:px-3"
      ref={containerRef}
    >
      <svg
        className="mx-auto block max-w-full"
        height={chartHeight}
        preserveAspectRatio="xMidYMid meet"
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        width={chartWidth}
        onMouseLeave={() => setActiveIndex(null)}
      >
        <defs>
          <linearGradient id="revenueArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#12C6F3" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#12C6F3" stopOpacity="0" />
          </linearGradient>
        </defs>
        {yTicks.map((tick) => {
          const y = margin.top + ((domainMax - tick) / domainMax) * plotHeight
          return (
            <g key={tick}>
              <line
                className="text-slate-200 dark:text-slate-800"
                stroke="currentColor"
                strokeDasharray="3 6"
                strokeOpacity="0.7"
                x1={margin.left}
                x2={chartWidth - margin.right}
                y1={y}
                y2={y}
              />
              <text
                className="fill-slate-400 dark:fill-slate-500"
                dominantBaseline="middle"
                fontSize={isCompact ? 10 : 11}
                textAnchor="end"
                x={margin.left - (isCompact ? 6 : 8)}
                y={y}
              >
                {formatAxisCurrency(tick)}
              </text>
            </g>
          )
        })}
        {areaPath && <path d={areaPath} fill="url(#revenueArea)" />}
        <path
          d={linePath}
          fill="none"
          stroke="#12C6F3"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.5"
        />
        {points.map((point, index) => (
          <g key={point.label}>
            <circle
              className="fill-white stroke-brand-400 dark:fill-slate-950"
              cx={point.x}
              cy={point.y}
              r={activeIndex === index || point.entradas === maxValue ? 5 : 3.5}
              strokeWidth="2.5"
            />
            <circle
              cx={point.x}
              cy={point.y}
              fill="transparent"
              onMouseEnter={() => setActiveIndex(index)}
              r={16}
            />
          </g>
        ))}
        {points.map((point) => (
          <text
            className="fill-slate-400 dark:fill-slate-500"
            fontSize={isCompact ? 10 : 11}
            key={point.label}
            textAnchor="middle"
            x={point.x}
            y={chartHeight - 12}
          >
            {point.label}
          </text>
        ))}
      </svg>
      {activePoint && (
        <div
          className="pointer-events-none absolute z-10 min-w-36 rounded-xl border border-slate-100 bg-white px-3 py-2.5 text-sm shadow-lg dark:border-slate-800 dark:bg-slate-900"
          style={{
            left: `min(calc(100% - 10rem), max(0.5rem, ${(activePoint.x / chartWidth) * 100}% - 4.5rem))`,
            top: `max(0.5rem, ${(activePoint.y / chartHeight) * 100}% - 4rem)`,
          }}
        >
          <p className="font-semibold text-slate-950 dark:text-white">{activePoint.tooltipLabel}</p>
          <p className="mt-1 text-xs text-slate-500">Receita</p>
          <p className="font-black text-brand-500">{formatCurrency(activePoint.entradas)}</p>
        </div>
      )}
    </div>
  )
}

export function DashboardPage() {
  const { profile, user } = useAuth()
  const empresaId = profile?.empresa_id

  const { data, error, isLoading } = useQuery({
    enabled: Boolean(empresaId),
    queryFn: () => getDashboardData(empresaId as string),
    queryKey: ['dashboard', empresaId],
    staleTime: 1000 * 60 * 5, // 5 minutos — evita refetch a cada foco de aba
  })

  if (!empresaId) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-slate-600">
            Complete o vínculo do usuário com uma empresa para visualizar o Dashboard.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (isLoading) return <DashboardSkeleton />

  if (error) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm font-medium text-red-600">Não foi possível carregar o Dashboard.</p>
          <p className="mt-2 text-sm text-slate-600">{error.message}</p>
        </CardContent>
      </Card>
    )
  }

  if (!data) return null

  const userName = profile?.nome ?? user?.user_metadata.nome ?? 'Usuário'
  const todayRevenue = data.metrics[0]
  const appointments = {
    helper: 'Atendimentos concluídos hoje',
    label: 'Atendimentos Hoje',
    value: String(data.todayAppointments),
  }
  const monthRevenue = data.metrics[2]
  const netProfit = data.metrics[3]
  function formatDelta(current: number, previous: number): { text: string; up: boolean } {
    if (previous === 0) {
      return current > 0
        ? { text: '+100% vs. ontem', up: true }
        : { text: '0% vs. ontem', up: true }
    }
    const pct = ((current - previous) / previous) * 100
    const sign = pct >= 0 ? '+' : ''
    return {
      text: `${sign}${pct.toFixed(0)}% vs. ontem`,
      up: pct >= 0,
    }
  }

  const todayRevenueRaw = data.todayRevenue
  const yesterdayRevenueRaw = data.yesterdayRevenue
  const todayTicketRevenue = data.todayTicketRevenue
  const yesterdayTicketRevenue = data.yesterdayTicketRevenue
  const todayAppointmentsCount = data.todayAppointments
  const yesterdayAppointmentsCount = data.yesterdayAppointments

  const revenueTicketHoje =
    todayAppointmentsCount > 0 ? todayTicketRevenue / todayAppointmentsCount : 0
  const revenueTicketOntem =
    yesterdayAppointmentsCount > 0
      ? yesterdayTicketRevenue / yesterdayAppointmentsCount
      : 0

  const revenueDelta = formatDelta(todayRevenueRaw, yesterdayRevenueRaw)
  const appointmentsDelta = formatDelta(todayAppointmentsCount, yesterdayAppointmentsCount)
  const ticketDelta = formatDelta(revenueTicketHoje, revenueTicketOntem)

  const popularServices = Object.values(
    data.popularServicesToday.reduce<
      Record<string, { count: number; name: string; total: number }>
    >((acc, appointment) => {
      const name = appointment.servicos?.nome ?? 'Serviço'
      const current = acc[name] ?? { count: 0, name, total: 0 }
      current.count += 1
      current.total += Number(appointment.valor)
      acc[name] = current
      return acc
    }, {}),
  )
    .sort((a, b) => b.total - a.total)
    .slice(0, 4)

  const maxServiceCount = Math.max(...popularServices.map((s) => s.count), 1)

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-black tracking-normal text-slate-950 dark:text-white sm:text-3xl">
          {getGreeting()}, {String(userName).split(' ')[0]}
        </h2>
        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
          Hoje você teve{' '}
          <span className="font-semibold text-slate-950 dark:text-white">{appointments?.value}</span>{' '}
          atendimentos e faturou{' '}
          <span className="font-semibold text-brand-500">{todayRevenue?.value}</span>
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <MetricCard
          delta={revenueDelta.text}
          deltaUp={revenueDelta.up}
          icon={TrendingUp}
          iconColor="blue"
          label="Receita hoje"
          value={todayRevenue?.value ?? 'R$ 0'}
        />
        <MetricCard
          delta={appointmentsDelta.text}
          deltaUp={appointmentsDelta.up}
          icon={Scissors}
          iconColor="green"
          label="Atendimentos"
          value={String(appointments?.value ?? '0')}
        />
        <MetricCard
          delta={ticketDelta.text}
          deltaUp={ticketDelta.up}
          icon={CreditCard}
          iconColor="amber"
          label="Ticket médio"
          value={formatCurrency(revenueTicketHoje)}
        />
      </section>

      <section className="grid gap-3 sm:gap-4 xl:grid-cols-[1.45fr_0.95fr]">
        <div className="rounded-xl border border-slate-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 sm:rounded-2xl sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3 sm:mb-5 sm:gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-950 dark:text-white sm:text-base">Fluxo de Receita</h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Ultimos 6 meses</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
              <ArrowUpRight size={13} /> +24%
            </span>
          </div>
          <RevenueChart data={data.monthlyFinance} />
        </div>

        <div className="rounded-xl border border-slate-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 sm:rounded-2xl sm:p-5">
          <div className="mb-3 sm:mb-5">
            <h3 className="text-sm font-semibold text-slate-950 dark:text-white sm:text-base">Serviços Populares</h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Hoje</p>
          </div>
          {popularServices.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum serviço registrado ainda.</p>
          ) : (
            <div className="space-y-3 sm:space-y-5">
              {popularServices.map((service) => (
                <div key={service.name}>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{service.name}</p>
                    <p className="text-sm font-semibold text-slate-950 dark:text-white shrink-0">{service.count}</p>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-1.5 rounded-full bg-gradient-to-r from-brand-400 to-brand-600"
                      style={{ width: `${Math.round((service.count / maxServiceCount) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 sm:rounded-2xl sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 sm:mb-5">
          <div>
            <h3 className="text-sm font-semibold text-slate-950 dark:text-white sm:text-base">Atividade Recente</h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Ultimos atendimentos</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="warning">{monthRevenue?.label}: {monthRevenue?.value}</Badge>
            <Badge variant="default">{netProfit?.label}: {netProfit?.value}</Badge>
          </div>
        </div>

        {data.latestAppointments.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum atendimento registrado ainda.</p>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Cliente</TableHeaderCell>
                <TableHeaderCell>Serviço</TableHeaderCell>
                <TableHeaderCell>Barbeiro</TableHeaderCell>
                <TableHeaderCell>Data</TableHeaderCell>
                <TableHeaderCell>Valor</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.latestAppointments.map((appointment) => (
                <TableRow key={appointment.id}>
                  <TableCell className="font-semibold text-slate-950 dark:text-white">
                    {appointment.clientes?.nome?.trim() || 'Cliente não identificado'}
                  </TableCell>
                  <TableCell>{appointment.servicos?.nome ?? 'Serviço'}</TableCell>
                  <TableCell>{appointment.barbeiros?.nome ?? 'Barbeiro'}</TableCell>
                  <TableCell>
                    {dateTimeFormatter.format(new Date(appointment.data_hora_inicio))}
                  </TableCell>
                  <TableCell>{formatCurrency(Number(appointment.valor))}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(appointment.status)}>
                      {appointment.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  )
}
