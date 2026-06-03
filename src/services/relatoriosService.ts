import { supabase } from '../lib/supabase'

export type ReportSummary = {
  receitaServicos: number
  receitaProdutos: number
  despesas: number
  lucroLiquido: number
  comissoes: number
}

export type TopProduct = {
  nome: string
  quantidade: number
  valorTotal: number
}

export type TopBarber = {
  nome: string
  atendimentos: number
  faturamento: number
}

export type ReportData = {
  summary: ReportSummary
  topProducts: TopProduct[]
  topBarbers: TopBarber[]
}

type Movement = {
  categoria: string
  tipo: 'entrada' | 'saida'
  valor: number
}

type Commission = {
  valor_comissao: number
}

type ProductSale = {
  quantidade: number
  valor_total: number
  produtos: { nome: string } | null
}

type BarberAppointment = {
  valor: number
  barbeiros: { nome: string } | null
}

function addOneDay(date: string) {
  const nextDate = new Date(`${date}T00:00:00`)
  nextDate.setDate(nextDate.getDate() + 1)
  return nextDate.toISOString()
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0)
}

export async function getRelatorioData(
  empresaId: string,
  dataInicio: string,
  dataFim: string,
): Promise<ReportData> {
  const startIso = new Date(`${dataInicio}T00:00:00`).toISOString()
  const endIso = addOneDay(dataFim)

  const [
    movementsResponse,
    commissionsResponse,
    productSalesResponse,
    barberAppointmentsResponse,
  ] = await Promise.all([
    supabase
      .from('movimentacoes_financeiras')
      .select('categoria,tipo,valor')
      .eq('empresa_id', empresaId)
      .eq('status', 'confirmada')
      .gte('data_movimentacao', dataInicio)
      .lte('data_movimentacao', dataFim),
    supabase
      .from('comissoes')
      .select('valor_comissao')
      .eq('empresa_id', empresaId)
      .neq('status', 'cancelada')
      .gte('created_at', startIso)
      .lt('created_at', endIso),
    supabase
      .from('vendas_produtos')
      .select('quantidade,valor_total,produtos(nome)')
      .eq('empresa_id', empresaId)
      .gte('data_venda', dataInicio)
      .lte('data_venda', dataFim),
    supabase
      .from('atendimentos')
      .select('valor,barbeiros(nome)')
      .eq('empresa_id', empresaId)
      .eq('status', 'concluido')
      .gte('data_hora_inicio', startIso)
      .lt('data_hora_inicio', endIso),
  ])

  const failedResponse = [
    movementsResponse,
    commissionsResponse,
    productSalesResponse,
    barberAppointmentsResponse,
  ].find((response) => response.error)

  if (failedResponse?.error) {
    throw new Error(failedResponse.error.message)
  }

  const movements = (movementsResponse.data ?? []) as Movement[]
  const commissions = (commissionsResponse.data ?? []) as Commission[]
  const productSales =
    (productSalesResponse.data ?? []) as unknown as ProductSale[]
  const barberAppointments =
    (barberAppointmentsResponse.data ?? []) as unknown as BarberAppointment[]

  const receitaProdutos = sum(
    productSales.map((sale) => Number(sale.valor_total)),
  )
  const receitaServicos = sum(
    movements
      .filter(
        (movement) =>
          movement.tipo === 'entrada' &&
          ['serviço', 'servico', 'atendimento'].some((category) =>
            movement.categoria.toLowerCase().includes(category),
          ),
      )
      .map((movement) => Number(movement.valor)),
  )
  const despesas = sum(
    movements
      .filter((movement) => movement.tipo === 'saida')
      .map((movement) => Number(movement.valor)),
  )
  const comissoes = sum(
    commissions.map((commission) => Number(commission.valor_comissao)),
  )

  const productsMap = new Map<string, TopProduct>()

  productSales.forEach((sale) => {
    const nome = sale.produtos?.nome ?? 'Produto'
    const current = productsMap.get(nome) ?? {
      nome,
      quantidade: 0,
      valorTotal: 0,
    }

    productsMap.set(nome, {
      nome,
      quantidade: current.quantidade + Number(sale.quantidade),
      valorTotal: current.valorTotal + Number(sale.valor_total),
    })
  })

  const barbersMap = new Map<string, TopBarber>()

  barberAppointments.forEach((appointment) => {
    const nome = appointment.barbeiros?.nome ?? 'Barbeiro'
    const current = barbersMap.get(nome) ?? {
      atendimentos: 0,
      faturamento: 0,
      nome,
    }

    barbersMap.set(nome, {
      nome,
      atendimentos: current.atendimentos + 1,
      faturamento: current.faturamento + Number(appointment.valor),
    })
  })

  return {
    summary: {
      comissoes,
      despesas,
      lucroLiquido: receitaServicos + receitaProdutos - despesas - comissoes,
      receitaProdutos,
      receitaServicos,
    },
    topBarbers: Array.from(barbersMap.values()).sort(
      (a, b) => b.faturamento - a.faturamento,
    ),
    topProducts: Array.from(productsMap.values()).sort(
      (a, b) => b.quantidade - a.quantidade,
    ),
  }
}
