import { useQuery } from '@tanstack/react-query'
import {
  ArrowDownRight,
  ArrowUpRight,
  CreditCard,
  Scissors,
  TrendingUp,
} from 'lucide-react'
import { useMemo, useState } from 'react'

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
  if (segment.length === 0) {
    return ''
  }

  if (segment.length === 1) {
    return `M ${segment[0].x} ${segment[0].y}`
  }

  return segment
    .map((point, index) => {
      if (index === 0) {
        return `M ${point.x} ${point.y}`
      }

      const previous = segment[index - 1]
      const controlX = previous.x + (point.x - previous.x) / 2

      return `C ${controlX} ${previous.y}, ${controlX} ${point.y}, ${point.x} ${point.y}`
    })
    .join(' ')
}

function getGreeting() {
  const hour = new Date().getHours()

  if (hour < 12) {
    return 'Bom dia'
  }

  if (hour < 18) {
    return 'Boa tarde'
  }

  return 'Boa noite'
}

function getStatusVariant(status: string) {
  if (['concluido', 'paga', 'confirmado'].includes(status)) {
    return 'success'
  }

  if (['pendente', 'agendado', 'vencida'].includes(status)) {
    return 'warning'
  }

  if (['cancelado', 'faltou'].includes(status)) {
    return 'danger'
  }

  return 'default'
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-24" />
      <div className="grid gap-5 lg:grid-cols-3">
        <Skeleton className="h-40 lg:col-span-1" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.5fr_0.95fr]">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    </div>
  )
}

function RevenueChart({ data }: { data: MonthlyFinancePoint[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const chartWidth = 720
  const chartHeight = 320
  const margin = { bottom: 46, left: 72, right: 26, top: 22 }
  const plotWidth = chartWidth - margin.left - margin.right
  const plotHeight = chartHeight - margin.top - margin.bottom
  const normalizedData = useMemo(
    () => data.map((point) => ({ ...point, entradas: Number(point.entradas) || 0 })),
    [data],
  )
  const maxValue = Math.max(...normalizedData.map((point) => point.entradas), 0)
  const hasRevenue = maxValue > 0

  if (!hasRevenue) {
    return (
      <div className="flex h-[15rem] flex-col items-center justify-center rounded-[1.4rem] border border-slate-200 bg-white text-center dark:border-slate-800 dark:bg-slate-950 sm:h-[18.75rem] lg:h-[22rem]">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-500 dark:bg-brand-400/10 dark:text-brand-300">
          <TrendingUp size={24} />
        </div>
        <p className="mt-4 text-base font-black text-slate-950 dark:text-white">
          Ainda nao existem receitas concluidas para exibir.
        </p>
        <p className="mt-2 max-w-xs text-sm text-slate-500 dark:text-slate-400">
          Conclua atendimentos para visualizar o fluxo de receita.
        </p>
      </div>
    )
  }

  const domainMin = 0
  const domainMax = maxValue * 1.2
  const yTicks = Array.from({ length: 4 }, (_, index) => {
    const ratio = index / 3

    return domainMax - (domainMax - domainMin) * ratio
  })
  const points = normalizedData.map((point, index) => {
    const x =
      margin.left +
      (normalizedData.length === 1
        ? plotWidth / 2
        : (index / (normalizedData.length - 1)) * plotWidth)
    const y =
      margin.top +
      ((domainMax - point.entradas) / (domainMax - domainMin)) * plotHeight

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
    <div className="relative h-[15rem] overflow-hidden rounded-[1.4rem] border border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-950 sm:h-[18.75rem] lg:h-[22rem]">
      <svg
        className="h-full w-full"
        preserveAspectRatio="none"
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        onMouseLeave={() => setActiveIndex(null)}
      >
        <defs>
          <linearGradient id="revenueArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </linearGradient>
        </defs>
        {yTicks.map((tick) => {
          const y =
            margin.top + ((domainMax - tick) / (domainMax - domainMin)) * plotHeight

          return (
            <g key={tick}>
              <line
                stroke="currentColor"
                strokeDasharray="4 8"
                strokeOpacity="0.18"
                x1={margin.left}
                x2={chartWidth - margin.right}
                y1={y}
                y2={y}
                className="text-slate-300 dark:text-slate-700"
              />
              <text
                className="fill-slate-500 text-[11px] dark:fill-slate-300"
                dominantBaseline="middle"
                textAnchor="end"
                x={margin.left - 12}
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
          strokeWidth="3"
        />
        {points.map((point, index) =>
          (
          <g key={point.label}>
            <circle
              className="fill-white stroke-brand-400 dark:fill-slate-950"
              cx={point.x}
              cy={point.y}
              r={activeIndex === index || point.entradas === maxValue ? 6 : 4}
              strokeWidth="3"
            />
            <circle
              cx={point.x}
              cy={point.y}
              fill="transparent"
              onMouseEnter={() => setActiveIndex(index)}
              r={18}
            />
          </g>
          ),
        )}
        {points.map((point) => (
          <text
            className="fill-slate-500 text-[12px] font-semibold dark:fill-slate-300"
            key={point.label}
            textAnchor="middle"
            x={point.x}
            y={chartHeight - 15}
          >
            {point.label}
          </text>
        ))}
      </svg>
      {activePoint && (
        <div
          className="pointer-events-none absolute z-10 min-w-40 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-[0_18px_48px_rgb(15_23_42/0.16)] dark:border-slate-800 dark:bg-slate-900"
          style={{
            left: `min(calc(100% - 11rem), max(0.75rem, ${(activePoint.x / chartWidth) * 100}% - 5rem))`,
            top: `max(0.75rem, ${(activePoint.y / chartHeight) * 100}% - 4.25rem)`,
          }}
        >
          <p className="font-black text-slate-950 dark:text-white">
            {activePoint.tooltipLabel}
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
            Receita:
          </p>
          <p className="mt-0.5 font-black text-brand-500">
            {formatCurrency(activePoint.entradas)}
          </p>
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
  })

  if (!empresaId) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-slate-600">
            Complete o vinculo do usuario com uma empresa para visualizar o
            Dashboard.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return <DashboardSkeleton />
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm font-medium text-red-600">
            Nao foi possivel carregar o Dashboard.
          </p>
          <p className="mt-2 text-sm text-slate-600">{error.message}</p>
        </CardContent>
      </Card>
    )
  }

  if (!data) {
    return null
  }

  const userName = profile?.nome ?? user?.user_metadata.nome ?? 'Usuario'
  const todayRevenue = data.metrics[0]
  const appointments = data.metrics[5] ?? data.metrics[1]
  const monthRevenue = data.metrics[2]
  const netProfit = data.metrics[3]
  const ticketMedio =
    Number(String(todayRevenue?.value ?? '0').replace(/\D/g, '')) /
    Math.max(1, Number(String(appointments?.value ?? '1').replace(/\D/g, '')))

  const popularServices = Object.values(
    data.latestAppointments.reduce<
      Record<string, { count: number; name: string; total: number }>
    >((acc, appointment) => {
      const name = appointment.servicos?.nome ?? 'Servico'
      const current = acc[name] ?? { count: 0, name, total: 0 }
      current.count += 1
      current.total += Number(appointment.valor)
      acc[name] = current
      return acc
    }, {}),
  )
    .sort((a, b) => b.total - a.total)
    .slice(0, 4)

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-3xl font-black tracking-normal text-slate-950 sm:text-4xl">
          {getGreeting()}, {String(userName).split(' ')[0]}
        </h2>
        <p className="text-base text-slate-500">
          Hoje voce teve{' '}
          <span className="font-black text-slate-950">{appointments?.value}</span>{' '}
          atendimentos e faturou{' '}
          <span className="font-black text-brand-500">
            {todayRevenue?.value}
          </span>
        </p>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.25fr_0.85fr_0.85fr]">
        <Card>
          <CardContent>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">Receita Hoje</p>
                <p className="mt-4 text-3xl font-black tracking-normal text-slate-950">
                  {todayRevenue?.value}
                </p>
                <p className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-emerald-500">
                  <ArrowUpRight size={16} /> +18% vs. ontem
                </p>
              </div>
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-500">
                <TrendingUp size={21} />
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">Atendimentos</p>
                <p className="mt-4 text-3xl font-black tracking-normal text-slate-950">
                  {appointments?.value}
                </p>
                <p className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-emerald-500">
                  <ArrowUpRight size={16} /> +12%
                </p>
              </div>
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                <Scissors size={21} />
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">Ticket Medio</p>
                <p className="mt-4 text-3xl font-black tracking-normal text-slate-950">
                  {formatCurrency(ticketMedio / 100)}
                </p>
                <p className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-red-500">
                  <ArrowDownRight size={16} /> -3%
                </p>
              </div>
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                <CreditCard size={21} />
              </span>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
        <Card>
          <CardContent>
            <div className="mb-8 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-black tracking-normal text-slate-950">
                  Fluxo de Receita
                </h3>
                <p className="mt-2 text-sm text-slate-500">Ultimos 6 meses</p>
              </div>
              <span className="inline-flex items-center gap-2 text-sm font-black text-emerald-500">
                <ArrowUpRight size={16} /> +24%
              </span>
            </div>
            <RevenueChart data={data.monthlyFinance} />
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="mb-8">
              <h3 className="text-2xl font-black tracking-normal text-slate-950">
                Servicos Populares
              </h3>
              <p className="mt-2 text-sm text-slate-500">Hoje</p>
            </div>

            {popularServices.length === 0 ? (
              <p className="text-sm text-slate-500">
                Nenhum servico registrado ainda.
              </p>
            ) : (
              <div className="space-y-7">
                {popularServices.map((service, index) => (
                  <div key={service.name}>
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-sm font-medium text-slate-600">
                        {service.name}
                      </p>
                      <p className="text-sm font-black text-slate-950">
                        {service.count}
                      </p>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-brand-400"
                        style={{
                          width: `${Math.max(18, 90 - index * 16)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardContent>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-2xl font-black tracking-normal text-slate-950">
                Atividade Recente
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Ultimos atendimentos
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="warning">{monthRevenue?.label}: {monthRevenue?.value}</Badge>
              <Badge variant="default">{netProfit?.label}: {netProfit?.value}</Badge>
            </div>
          </div>

          {data.latestAppointments.length === 0 ? (
            <p className="text-sm text-slate-500">
              Nenhum atendimento registrado ainda.
            </p>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Cliente</TableHeaderCell>
                  <TableHeaderCell>Servico</TableHeaderCell>
                  <TableHeaderCell>Barbeiro</TableHeaderCell>
                  <TableHeaderCell>Data</TableHeaderCell>
                  <TableHeaderCell>Valor</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.latestAppointments.map((appointment) => (
                  <TableRow key={appointment.id}>
                    <TableCell className="font-semibold text-slate-950">
                      {appointment.clientes?.nome ?? 'Cliente'}
                    </TableCell>
                    <TableCell>{appointment.servicos?.nome ?? 'Servico'}</TableCell>
                    <TableCell>
                      {appointment.barbeiros?.nome ?? 'Barbeiro'}
                    </TableCell>
                    <TableCell>
                      {dateTimeFormatter.format(
                        new Date(appointment.data_hora_inicio),
                      )}
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
        </CardContent>
      </Card>
    </div>
  )
}
