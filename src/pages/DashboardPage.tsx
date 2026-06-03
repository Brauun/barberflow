import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  CalendarClock,
  DollarSign,
  Loader2,
  TrendingUp,
} from 'lucide-react'

import {
  Badge,
  Card,
  CardContent,
  CardHeader,
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

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
})

function formatCurrency(value: number) {
  return currencyFormatter.format(value)
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

function FinancialChart({ data }: { data: MonthlyFinancePoint[] }) {
  const maxValue = Math.max(
    1,
    ...data.flatMap((point) => [point.entradas, point.saidas]),
  )

  return (
    <div className="h-72">
      <div className="flex h-60 items-end gap-3 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        {data.map((point) => {
          const entradaHeight = Math.max(8, (point.entradas / maxValue) * 180)
          const saidaHeight = Math.max(8, (point.saidas / maxValue) * 180)

          return (
            <div
              className="flex flex-1 flex-col items-center gap-3"
              key={point.label}
            >
              <div className="flex h-48 items-end gap-1.5">
                <div
                  className="w-4 rounded-t bg-brand-500 dark:bg-brand-400"
                  style={{ height: entradaHeight }}
                  title={`Entradas: ${formatCurrency(point.entradas)}`}
                />
                <div
                  className="w-4 rounded-t bg-zinc-800 dark:bg-zinc-500"
                  style={{ height: saidaHeight }}
                  title={`Saídas: ${formatCurrency(point.saidas)}`}
                />
              </div>
              <span className="text-xs font-medium capitalize text-zinc-500 dark:text-zinc-400">
                {point.label}
              </span>
            </div>
          )
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-brand-500 dark:bg-brand-400" />
          Entradas
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-800 dark:bg-zinc-500" />
          Saídas
        </span>
      </div>
    </div>
  )
}

export function DashboardPage() {
  const { profile } = useAuth()
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
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Complete o vínculo do usuário com uma empresa para visualizar o
            Dashboard.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <div className="flex min-h-80 items-center justify-center">
        <Loader2 className="animate-spin text-brand-500" size={28} />
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm font-medium text-red-600">
            Não foi possível carregar o Dashboard.
          </p>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {error.message}
          </p>
        </CardContent>
      </Card>
    )
  }

  if (!data) {
    return null
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase text-brand-600 dark:text-brand-400">
            Dashboard
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-normal text-zinc-950 dark:text-zinc-50">
            Visão geral da operação
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Indicadores financeiros, atendimentos recentes e alertas da empresa.
          </p>
        </div>
        <Badge variant="warning">Empresa isolada por RLS</Badge>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data.metrics.map((metric, index) => {
          const Icon =
            index <= 3 ? DollarSign : index <= 5 ? CalendarClock : TrendingUp

          return (
            <Card key={metric.label}>
              <CardContent>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                      {metric.label}
                    </p>
                    <p className="mt-2 text-2xl font-semibold tracking-normal text-zinc-950 dark:text-zinc-50">
                      {metric.value}
                    </p>
                  </div>
                  <span className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                    <Icon size={20} />
                  </span>
                </div>
                <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
                  {metric.helper}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                  Gráfico financeiro mensal
                </h3>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Entradas e saídas confirmadas dos últimos 6 meses.
                </p>
              </div>
              <Badge variant="success">Atualizado</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <FinancialChart data={data.monthlyFinance} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                <AlertTriangle size={20} />
              </span>
              <div>
                <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                  Contas próximas
                </h3>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Vencimentos dos próximos 7 dias.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.dueBills.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Nenhuma conta próxima do vencimento.
              </p>
            ) : (
              data.dueBills.map((bill) => (
                <div
                  className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
                  key={bill.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-zinc-950 dark:text-zinc-50">
                        {bill.descricao}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {bill.fornecedor ?? 'Sem fornecedor'} ·{' '}
                        {dateFormatter.format(new Date(bill.data_vencimento))}
                      </p>
                    </div>
                    <Badge variant={getStatusVariant(bill.status)}>
                      {bill.status}
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                    {formatCurrency(Number(bill.valor))}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                Últimos atendimentos
              </h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Atendimentos mais recentes registrados para a empresa.
              </p>
            </div>
            <Badge variant="default">{data.latestAppointments.length} itens</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {data.latestAppointments.length === 0 ? (
            <div className="p-5 text-sm text-zinc-500 dark:text-zinc-400">
              Nenhum atendimento registrado ainda.
            </div>
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
                    <TableCell className="font-medium text-zinc-950 dark:text-zinc-50">
                      {appointment.clientes?.nome ?? 'Cliente'}
                    </TableCell>
                    <TableCell>{appointment.servicos?.nome ?? 'Serviço'}</TableCell>
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
