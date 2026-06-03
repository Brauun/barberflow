import { supabase } from '../lib/supabase'

type FinanceMovement = {
  categoria: string
  data_movimentacao: string
  tipo: 'entrada' | 'saida'
  valor: number
}

type Commission = {
  created_at: string
  valor_comissao: number
}

type LatestAppointment = {
  id: string
  data_hora_inicio: string
  valor: number
  status: string
  clientes: { nome: string } | null
  barbeiros: { nome: string } | null
  servicos: { nome: string } | null
}

type DueBill = {
  id: string
  descricao: string
  fornecedor: string | null
  valor: number
  data_vencimento: string
  status: string
}

export type DashboardMetric = {
  label: string
  value: string
  helper: string
}

export type MonthlyFinancePoint = {
  label: string
  entradas: number
  saidas: number
  lucro: number
}

export type DashboardData = {
  metrics: DashboardMetric[]
  monthlyFinance: MonthlyFinancePoint[]
  latestAppointments: LatestAppointment[]
  dueBills: DueBill[]
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  currency: 'BRL',
  style: 'currency',
})

function formatCurrency(value: number) {
  return currencyFormatter.format(value)
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10)
}

function startOfDay(date: Date) {
  const nextDate = new Date(date)
  nextDate.setHours(0, 0, 0, 0)
  return nextDate
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

function startOfWeek(date: Date) {
  const nextDate = startOfDay(date)
  const day = nextDate.getDay()
  const diff = day === 0 ? -6 : 1 - day
  return addDays(nextDate, diff)
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function startOfNextMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1)
}

function sumMovements(
  movements: FinanceMovement[],
  type: 'entrada' | 'saida',
  from: string,
  to: string,
) {
  return movements
    .filter(
      (movement) =>
        movement.tipo === type &&
        movement.data_movimentacao >= from &&
        movement.data_movimentacao < to,
    )
    .reduce((total, movement) => total + Number(movement.valor), 0)
}

function sumCommissions(commissions: Commission[], from: string, to: string) {
  return commissions
    .filter(
      (commission) =>
        commission.created_at >= from && commission.created_at < to,
    )
    .reduce((total, commission) => total + Number(commission.valor_comissao), 0)
}

function getMonthlyFinance(movements: FinanceMovement[]) {
  const now = new Date()
  const points: MonthlyFinancePoint[] = []

  for (let index = 5; index >= 0; index -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1)
    const nextMonth = startOfNextMonth(date)
    const from = toDateInputValue(date)
    const to = toDateInputValue(nextMonth)
    const entradas = sumMovements(movements, 'entrada', from, to)
    const saidas = sumMovements(movements, 'saida', from, to)

    points.push({
      label: date.toLocaleDateString('pt-BR', { month: 'short' }),
      entradas,
      saidas,
      lucro: entradas - saidas,
    })
  }

  return points
}

export async function getDashboardData(empresaId: string): Promise<DashboardData> {
  const now = new Date()
  const today = startOfDay(now)
  const tomorrow = addDays(today, 1)
  const weekStart = startOfWeek(now)
  const monthStart = startOfMonth(now)
  const nextMonth = startOfNextMonth(now)
  const sixMonthsStart = new Date(now.getFullYear(), now.getMonth() - 5, 1)
  const dueLimit = addDays(today, 7)

  const [
    movementsResponse,
    commissionsResponse,
    activeClientsResponse,
    completedServicesResponse,
    latestAppointmentsResponse,
    dueBillsResponse,
  ] = await Promise.all([
    supabase
      .from('movimentacoes_financeiras')
      .select('categoria,data_movimentacao,tipo,valor')
      .eq('empresa_id', empresaId)
      .eq('status', 'confirmada')
      .gte('data_movimentacao', toDateInputValue(sixMonthsStart))
      .lt('data_movimentacao', toDateInputValue(nextMonth)),
    supabase
      .from('comissoes')
      .select('created_at,valor_comissao')
      .eq('empresa_id', empresaId)
      .neq('status', 'cancelada')
      .gte('created_at', monthStart.toISOString())
      .lt('created_at', nextMonth.toISOString()),
    supabase
      .from('clientes')
      .select('id', { count: 'exact', head: true })
      .eq('empresa_id', empresaId)
      .eq('status', 'ativo'),
    supabase
      .from('atendimentos')
      .select('id', { count: 'exact', head: true })
      .eq('empresa_id', empresaId)
      .eq('status', 'concluido')
      .gte('data_hora_inicio', monthStart.toISOString())
      .lt('data_hora_inicio', nextMonth.toISOString()),
    supabase
      .from('atendimentos')
      .select(
        'id,data_hora_inicio,valor,status,clientes(nome),barbeiros(nome),servicos(nome)',
      )
      .eq('empresa_id', empresaId)
      .order('data_hora_inicio', { ascending: false })
      .limit(6),
    supabase
      .from('contas_pagar')
      .select('id,descricao,fornecedor,valor,data_vencimento,status')
      .eq('empresa_id', empresaId)
      .in('status', ['pendente', 'vencida'])
      .gte('data_vencimento', toDateInputValue(today))
      .lte('data_vencimento', toDateInputValue(dueLimit))
      .order('data_vencimento', { ascending: true })
      .limit(6),
  ])

  const responses = [
    movementsResponse,
    commissionsResponse,
    activeClientsResponse,
    completedServicesResponse,
    latestAppointmentsResponse,
    dueBillsResponse,
  ]

  const failedResponse = responses.find((response) => response.error)

  if (failedResponse?.error) {
    throw new Error(failedResponse.error.message)
  }

  const movements = (movementsResponse.data ?? []) as FinanceMovement[]
  const commissions = (commissionsResponse.data ?? []) as Commission[]
  const monthFrom = toDateInputValue(monthStart)
  const monthTo = toDateInputValue(nextMonth)
  const todayFrom = toDateInputValue(today)
  const tomorrowTo = toDateInputValue(tomorrow)
  const weekFrom = toDateInputValue(weekStart)
  const faturamentoHoje = sumMovements(
    movements,
    'entrada',
    todayFrom,
    tomorrowTo,
  )
  const faturamentoSemana = sumMovements(
    movements,
    'entrada',
    weekFrom,
    tomorrowTo,
  )
  const faturamentoMes = sumMovements(movements, 'entrada', monthFrom, monthTo)
  const saidasMes = sumMovements(movements, 'saida', monthFrom, monthTo)
  const comissoesMes = sumCommissions(
    commissions,
    monthStart.toISOString(),
    nextMonth.toISOString(),
  )
  const produtosVendidos = movements.filter(
    (movement) =>
      movement.tipo === 'entrada' &&
      movement.data_movimentacao >= monthFrom &&
      movement.data_movimentacao < monthTo &&
      movement.categoria.toLowerCase().includes('produto'),
  ).length

  return {
    dueBills: (dueBillsResponse.data ?? []) as DueBill[],
    latestAppointments:
      (latestAppointmentsResponse.data ?? []) as unknown as LatestAppointment[],
    metrics: [
      {
        label: 'Faturamento Hoje',
        value: formatCurrency(faturamentoHoje),
        helper: 'Entradas confirmadas no dia',
      },
      {
        label: 'Faturamento da Semana',
        value: formatCurrency(faturamentoSemana),
        helper: 'Entradas desde segunda-feira',
      },
      {
        label: 'Faturamento do Mês',
        value: formatCurrency(faturamentoMes),
        helper: 'Entradas confirmadas no mês',
      },
      {
        label: 'Lucro Líquido',
        value: formatCurrency(faturamentoMes - saidasMes - comissoesMes),
        helper: 'Entradas menos saídas e comissões',
      },
      {
        label: 'Clientes Ativos',
        value: String(activeClientsResponse.count ?? 0),
        helper: 'Clientes ativos na empresa',
      },
      {
        label: 'Serviços Realizados',
        value: String(completedServicesResponse.count ?? 0),
        helper: 'Atendimentos concluídos no mês',
      },
      {
        label: 'Produtos Vendidos',
        value: String(produtosVendidos),
        helper: 'Movimentações de produto no mês',
      },
      {
        label: 'Comissões do Mês',
        value: formatCurrency(comissoesMes),
        helper: 'Comissões não canceladas',
      },
    ],
    monthlyFinance: getMonthlyFinance(movements),
  }
}
