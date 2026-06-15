import { supabase } from '../lib/supabase'

export type ReportSummary = {
  receitaServicos: number
  receitaProdutos: number
  despesas: number
  lucroLiquido: number
  comissoes: number
}

export type TopProduct = {
  estoqueAtual?: number
  nome: string
  quantidade: number
  valorTotal: number
}

export type TopBarber = {
  nome: string
  atendimentos: number
  cancelamentos: number
  comissao: number
  faturamento: number
  ticketMedio: number
}

export type ReportClient = {
  gastoTotal: number
  nome: string
  novo: boolean
  recorrente: boolean
  ultimaVisita: string | null
  visitas: number
}

export type ReportAgendaItem = {
  barbeiro: string
  cliente: string
  horario: string
  servico: string
  status: string
  valor: number
}

export type ReportData = {
  agendaItems: ReportAgendaItem[]
  clients: ReportClient[]
  summary: ReportSummary
  topProducts: TopProduct[]
  topBarbers: TopBarber[]
}

export type ExecutiveBarber = TopBarber & {
  cancelamentos: number
  comissao: number
  tempoMedio: number
  ticketMedio: number
}

export type ExecutiveClient = {
  gastoTotal: number
  nome: string
  ultimaVisita: string | null
  visitas: number
}

export type ExecutiveAppointmentStatus = {
  agendado: number
  cancelado: number
  concluido: number
  confirmado: number
  emAtendimento: number
  remarcado: number
}

export type ExecutiveProductAlert = {
  categoria: string | null
  estoqueAtual: number
  estoqueMinimo: number
  nome: string
  precoVenda: number
  status: 'baixo' | 'excesso' | 'ok'
}

export type ExecutiveSeriesPoint = {
  label: string
  receita: number
}

export type ExecutiveReportData = ReportData & {
  agenda: {
    heatmap: Array<{ dia: string; hora: string; total: number }>
    ociosidadePercentual: number
    ocupacaoPercentual: number
    status: ExecutiveAppointmentStatus
  }
  clientes: {
    ativos: number
    inativos: number
    novos: number
    retencaoPercentual: number
    topClientes: ExecutiveClient[]
  }
  equipe: ExecutiveBarber[]
  margemPercentual: number
  periodoAnterior: ReportData
  previsao: {
    clientes30Dias: number
    lucro30Dias: number
    receita30Dias: number
    receita90Dias: number
    receita12Meses: number
  }
  produtos: {
    alertas: ExecutiveProductAlert[]
    baixoEstoque: number
    lucroProdutos: number
    maisVendidos: TopProduct[]
  }
  score: {
    label: string
    value: number
  }
  series: ExecutiveSeriesPoint[]
}

type Movement = {
  categoria: string
  data_movimentacao: string
  descricao: string | null
  tipo: 'entrada' | 'saida'
  valor: number
}

type PaidBill = {
  categoria: string | null
  data_pagamento: string | null
  data_vencimento: string
  descricao: string
  valor: number
}

type Commission = {
  barbeiro_id: string
  valor_comissao: number
}

type ProductSale = {
  quantidade: number
  valor_total: number
  produtos: { nome: string } | null
}

type BarberAppointment = {
  barbeiro_id?: string
  cliente_id?: string
  id?: string
  data_hora_fim?: string | null
  data_hora_inicio?: string
  status?: string
  valor: number
  valor_final?: number | null
  valor_desconto?: number | null
  barbeiros: { nome: string } | null
  clientes?: { nome: string } | null
  servicos?: {
    duracao_minutos: number
    duration_minutes: number | null
    nome?: string
  } | null
}

type ClientRow = {
  id: string
  nome: string
  status: 'ativo' | 'inativo'
  created_at: string
}

type ProductRow = {
  categoria: string | null
  estoque_atual: number
  estoque_minimo: number
  nome: string
  preco_custo: number
  preco_venda: number
}

function addOneDay(date: string) {
  const nextDate = new Date(`${date}T00:00:00`)
  nextDate.setDate(nextDate.getDate() + 1)
  return nextDate.toISOString()
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0)
}

function addDays(date: string, days: number) {
  const nextDate = new Date(`${date}T00:00:00`)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate.toISOString().slice(0, 10)
}

function differenceInDays(dataInicio: string, dataFim: string) {
  const start = new Date(`${dataInicio}T00:00:00`).getTime()
  const end = new Date(`${dataFim}T00:00:00`).getTime()

  return Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1)
}

function statusKey(status: string | undefined): keyof ExecutiveAppointmentStatus {
  if (status === 'confirmado') {
    return 'confirmado'
  }

  if (status === 'em_atendimento') {
    return 'emAtendimento'
  }

  if (status === 'concluido' || status === 'concluido_automatico') {
    return 'concluido'
  }

  if (status === 'cancelado' || status === 'nao_compareceu' || status === 'faltou') {
    return 'cancelado'
  }

  if (status === 'remarcado') {
    return 'remarcado'
  }

  return 'agendado'
}

function monthDayLabel(value: string) {
  return new Date(value).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  })
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
    paidBillsResponse,
    clientsResponse,
    productsResponse,
  ] = await Promise.all([
    supabase
      .from('movimentacoes_financeiras')
      .select('categoria,data_movimentacao,descricao,tipo,valor')
      .eq('empresa_id', empresaId)
      .eq('status', 'confirmada')
      .gte('data_movimentacao', dataInicio)
      .lte('data_movimentacao', dataFim),
    supabase
      .from('comissoes')
      .select('barbeiro_id,valor_comissao')
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
      .select(
        'barbeiro_id,cliente_id,data_hora_inicio,data_hora_fim,status,valor,valor_final,barbeiros(nome),clientes(nome),servicos(nome,duracao_minutos,duration_minutes)',
      )
      .eq('empresa_id', empresaId)
      .gte('data_hora_inicio', startIso)
      .lt('data_hora_inicio', endIso),
    supabase
      .from('contas_pagar')
      .select('categoria,data_pagamento,data_vencimento,descricao,valor')
      .eq('empresa_id', empresaId)
      .eq('status', 'paga'),
    supabase
      .from('clientes')
      .select('id,nome,status,created_at')
      .eq('empresa_id', empresaId),
    supabase
      .from('produtos')
      .select('nome,estoque_atual')
      .eq('empresa_id', empresaId),
  ])

  const failedResponse = [
    movementsResponse,
    commissionsResponse,
    productSalesResponse,
    barberAppointmentsResponse,
    paidBillsResponse,
    clientsResponse,
    productsResponse,
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
  const clients = (clientsResponse.data ?? []) as ClientRow[]
  const products = (productsResponse.data ?? []) as Pick<
    ProductRow,
    'estoque_atual' | 'nome'
  >[]
  const paidBills = ((paidBillsResponse.data ?? []) as PaidBill[]).filter(
    (bill) => {
      const paymentDate = bill.data_pagamento ?? bill.data_vencimento

      return paymentDate >= dataInicio && paymentDate <= dataFim
    },
  )

  const receitaProdutos = sum(
    productSales.map((sale) => Number(sale.valor_total)),
  )
  const receitaServicos = sum(
    movements
      .filter(
        (movement) =>
          movement.tipo === 'entrada' &&
          ['servico', 'servico', 'atendimento'].some((category) =>
            movement.categoria.toLowerCase().includes(category),
          ),
      )
      .map((movement) => Number(movement.valor)),
  )
  const despesas = sum(
    movements
      .filter((movement) => movement.tipo === 'saida')
      .map((movement) => Number(movement.valor)),
  ) + sum(
    paidBills
      .filter((bill) => {
        const paymentDate = bill.data_pagamento ?? bill.data_vencimento
        const description = `Pagamento - ${bill.descricao}`

        return !movements.some(
          (movement) =>
            movement.tipo === 'saida' &&
            movement.data_movimentacao === paymentDate &&
            Number(movement.valor) === Number(bill.valor) &&
            movement.descricao === description,
        )
      })
      .map((bill) => Number(bill.valor)),
  )
  const comissoes = sum(
    commissions.map((commission) => Number(commission.valor_comissao)),
  )
  const commissionByBarber = commissions.reduce<Map<string, number>>(
    (map, commission) => {
      map.set(
        commission.barbeiro_id,
        (map.get(commission.barbeiro_id) ?? 0) +
          Number(commission.valor_comissao),
      )

      return map
    },
    new Map(),
  )
  const stockByProduct = new Map(
    products.map((product) => [product.nome, Number(product.estoque_atual)]),
  )

  const productsMap = new Map<string, TopProduct>()

  productSales.forEach((sale) => {
    const nome = sale.produtos?.nome ?? 'Produto'
    const current = productsMap.get(nome) ?? {
      estoqueAtual: stockByProduct.get(nome),
      nome,
      quantidade: 0,
      valorTotal: 0,
    }

    productsMap.set(nome, {
      estoqueAtual: current.estoqueAtual ?? stockByProduct.get(nome),
      nome,
      quantidade: current.quantidade + Number(sale.quantidade),
      valorTotal: current.valorTotal + Number(sale.valor_total),
    })
  })

  const barbersMap = new Map<string, TopBarber>()
  const completedStatuses = ['concluido', 'concluido_automatico']
  const canceledStatuses = ['cancelado', 'nao_compareceu', 'faltou']

  barberAppointments.forEach((appointment) => {
    const nome = appointment.barbeiros?.nome ?? 'Barbeiro'
    const barberId = appointment.barbeiro_id ?? nome
    const current = barbersMap.get(nome) ?? {
      atendimentos: 0,
      cancelamentos: 0,
      comissao: 0,
      faturamento: 0,
      nome,
      ticketMedio: 0,
    }
    const isCompleted = completedStatuses.includes(appointment.status ?? '')
    const isCanceled = canceledStatuses.includes(appointment.status ?? '')
    const nextAtendimentos = current.atendimentos + (isCompleted ?1 : 0)
    const nextFaturamento =
      current.faturamento +
      (isCompleted
        ?Number(appointment.valor_final ?? appointment.valor)
        : 0)

    barbersMap.set(nome, {
      nome,
      atendimentos: nextAtendimentos,
      cancelamentos: current.cancelamentos + (isCanceled ?1 : 0),
      comissao: commissionByBarber.get(barberId) ?? current.comissao,
      faturamento: nextFaturamento,
      ticketMedio: nextAtendimentos > 0 ?nextFaturamento / nextAtendimentos : 0,
    })
  })

  const clientsMap = new Map<string, ReportClient>()

  clients.forEach((client) => {
    clientsMap.set(client.id, {
      gastoTotal: 0,
      nome: client.nome,
      novo: client.created_at >= startIso && client.created_at < endIso,
      recorrente: false,
      ultimaVisita: null,
      visitas: 0,
    })
  })

  barberAppointments
    .filter((appointment) => completedStatuses.includes(appointment.status ?? ''))
    .forEach((appointment) => {
      const clientId = appointment.cliente_id ?? appointment.clientes?.nome ?? 'cliente'
      const current = clientsMap.get(clientId) ?? {
        gastoTotal: 0,
        nome: appointment.clientes?.nome ?? 'Cliente',
        novo: false,
        recorrente: false,
        ultimaVisita: null,
        visitas: 0,
      }
      const visitas = current.visitas + 1
      const ultimaVisita =
        !current.ultimaVisita ||
        (appointment.data_hora_inicio &&
          appointment.data_hora_inicio > current.ultimaVisita)
          ?appointment.data_hora_inicio ?? current.ultimaVisita
          : current.ultimaVisita

      clientsMap.set(clientId, {
        ...current,
        gastoTotal:
          current.gastoTotal + Number(appointment.valor_final ?? appointment.valor),
        recorrente: visitas > 1,
        ultimaVisita,
        visitas,
      })
    })

  const agendaItems = barberAppointments.map<ReportAgendaItem>((appointment) => ({
    barbeiro: appointment.barbeiros?.nome ?? 'Barbeiro',
    cliente: appointment.clientes?.nome ?? 'Cliente',
    horario: appointment.data_hora_inicio ?? '',
    servico: appointment.servicos?.nome ?? 'Serviço',
    status: appointment.status ?? 'agendado',
    valor: Number(appointment.valor_final ?? appointment.valor),
  }))

  return {
    agendaItems,
    clients: Array.from(clientsMap.values()).sort(
      (a, b) => b.gastoTotal - a.gastoTotal,
    ),
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

export async function getExecutiveRelatorioData(
  empresaId: string,
  dataInicio: string,
  dataFim: string,
): Promise<ExecutiveReportData> {
  const periodDays = differenceInDays(dataInicio, dataFim)
  const previousEnd = addDays(dataInicio, -1)
  const previousStart = addDays(previousEnd, -(periodDays - 1))
  const startIso = new Date(`${dataInicio}T00:00:00`).toISOString()
  const endIso = addOneDay(dataFim)

  const [
    current,
    previous,
    clientsResponse,
    appointmentsResponse,
    productsResponse,
  ] = await Promise.all([
    getRelatorioData(empresaId, dataInicio, dataFim),
    getRelatorioData(empresaId, previousStart, previousEnd),
    supabase
      .from('clientes')
      .select('id,nome,status,created_at')
      .eq('empresa_id', empresaId),
    supabase
      .from('atendimentos')
      .select(
        'id,status,data_hora_inicio,data_hora_fim,valor,valor_final,valor_desconto,barbeiros(nome),clientes(nome),servicos(duracao_minutos,duration_minutes)',
      )
      .eq('empresa_id', empresaId)
      .gte('data_hora_inicio', startIso)
      .lt('data_hora_inicio', endIso),
    supabase
      .from('produtos')
      .select('nome,categoria,estoque_atual,estoque_minimo,preco_custo,preco_venda')
      .eq('empresa_id', empresaId),
  ])

  const failedResponse = [clientsResponse, appointmentsResponse, productsResponse].find(
    (response) => response.error,
  )

  if (failedResponse?.error) {
    throw new Error(failedResponse.error.message)
  }

  const clients = (clientsResponse.data ?? []) as ClientRow[]
  const appointments =
    (appointmentsResponse.data ?? []) as unknown as BarberAppointment[]
  const products = (productsResponse.data ?? []) as ProductRow[]
  const entradas = current.summary.receitaServicos + current.summary.receitaProdutos
  const previousEntradas =
    previous.summary.receitaServicos + previous.summary.receitaProdutos
  const concluidoAppointments = appointments.filter((appointment) =>
    ['concluido', 'concluido_automatico'].includes(appointment.status ?? ''),
  )
  const status = appointments.reduce<ExecutiveAppointmentStatus>(
    (acc, appointment) => {
      acc[statusKey(appointment.status)] += 1
      return acc
    },
    {
      agendado: 0,
      cancelado: 0,
      concluido: 0,
      confirmado: 0,
      emAtendimento: 0,
      remarcado: 0,
    },
  )
  const totalAgenda = Math.max(1, appointments.length)
  const ocupacaoPercentual = Math.round(
    ((status.concluido + status.confirmado + status.emAtendimento) / totalAgenda) * 100,
  )
  const ociosidadePercentual = Math.max(0, 100 - ocupacaoPercentual)

  const clientMap = new Map<string, ExecutiveClient>()
  concluidoAppointments.forEach((appointment) => {
    const nome = appointment.clientes?.nome ?? 'Cliente'
    const currentClient = clientMap.get(nome) ?? {
      gastoTotal: 0,
      nome,
      ultimaVisita: null,
      visitas: 0,
    }

    clientMap.set(nome, {
      gastoTotal:
        currentClient.gastoTotal +
        Number(appointment.valor_final ?? appointment.valor),
      nome,
      ultimaVisita:
        !currentClient.ultimaVisita ||
        String(appointment.data_hora_inicio) > currentClient.ultimaVisita
          ?String(appointment.data_hora_inicio)
          : currentClient.ultimaVisita,
      visitas: currentClient.visitas + 1,
    })
  })

  const equipeMap = new Map<string, ExecutiveBarber>()
  appointments.forEach((appointment) => {
    const nome = appointment.barbeiros?.nome ?? 'Barbeiro'
    const currentBarber = equipeMap.get(nome) ?? {
      atendimentos: 0,
      cancelamentos: 0,
      comissao: 0,
      faturamento: 0,
      nome,
      tempoMedio: 0,
      ticketMedio: 0,
    }
    const duration =
      appointment.servicos?.duration_minutes ??
      appointment.servicos?.duracao_minutos ??
      0
    const isConcluido = ['concluido', 'concluido_automatico'].includes(
      appointment.status ?? '',
    )
    const nextAtendimentos = currentBarber.atendimentos + (isConcluido ?1 : 0)
    const nextFaturamento =
      currentBarber.faturamento +
      (isConcluido ?Number(appointment.valor_final ?? appointment.valor) : 0)

    equipeMap.set(nome, {
      atendimentos: nextAtendimentos,
      cancelamentos:
        currentBarber.cancelamentos + (statusKey(appointment.status) === 'cancelado' ? 1 : 0),
      comissao: nextFaturamento * 0.6,
      faturamento: nextFaturamento,
      nome,
      tempoMedio: nextAtendimentos
        ?Math.round(
            ((currentBarber.tempoMedio * currentBarber.atendimentos) + duration) /
              nextAtendimentos,
          )
        : 0,
      ticketMedio: nextAtendimentos ?nextFaturamento / nextAtendimentos : 0,
    })
  })

  const lowStock = products.filter(
    (product) => product.estoque_atual <= product.estoque_minimo,
  )
  const lucroProdutos = current.topProducts.reduce((total, product) => {
    const productData = products.find((item) => item.nome === product.nome)
    const margin = productData
      ?Number(productData.preco_venda) - Number(productData.preco_custo)
      : 0

    return total + margin * product.quantidade
  }, 0)
  const margemPercentual = entradas > 0 ?(current.summary.lucroLiquido / entradas) * 100 : 0
  const crescimentoReceita =
    previousEntradas > 0 ?((entradas - previousEntradas) / previousEntradas) * 100 : 0
  const cancelamentoPercentual = appointments.length
    ?(status.cancelado / appointments.length) * 100
    : 0
  const retencaoPercentual = clients.length
    ?Math.round((clientMap.size / clients.length) * 100)
    : 0
  const scoreValue = Math.round(
    Math.min(
      100,
      Math.max(
        0,
        55 +
          Math.min(18, Math.max(-12, crescimentoReceita / 2)) +
          Math.min(12, Math.max(-10, margemPercentual / 3)) +
          Math.min(10, ocupacaoPercentual / 10) -
          Math.min(18, cancelamentoPercentual),
      ),
    ),
  )
  const dailyAverage = entradas / periodDays
  const dayBuckets = new Map<string, number>()
  appointments.forEach((appointment) => {
    if (
      !['concluido', 'concluido_automatico'].includes(appointment.status ?? '') ||
      !appointment.data_hora_inicio
    ) {
      return
    }

    const key = String(appointment.data_hora_inicio).slice(0, 10)
    dayBuckets.set(
      key,
      (dayBuckets.get(key) ?? 0) + Number(appointment.valor_final ?? appointment.valor),
    )
  })
  const series = Array.from({ length: Math.min(7, periodDays) }, (_, index) => {
    const offset = periodDays <= 7 ?index : Math.floor((index * (periodDays - 1)) / 6)
    const date = addDays(dataInicio, offset)

    return {
      label: monthDayLabel(date),
      receita: dayBuckets.get(date) ?? 0,
    }
  })
  const heatmap = appointments.reduce<Array<{ dia: string; hora: string; total: number }>>(
    (acc, appointment) => {
      if (!appointment.data_hora_inicio) {
        return acc
      }

      const date = new Date(appointment.data_hora_inicio)
      const dia = date.toLocaleDateString('pt-BR', { weekday: 'short' })
      const hora = `${String(date.getHours()).padStart(2, '0')}:00`
      const existing = acc.find((item) => item.dia === dia && item.hora === hora)

      if (existing) {
        existing.total += 1
        return acc
      }

      acc.push({ dia, hora, total: 1 })
      return acc
    },
    [],
  )

  return {
    ...current,
    agenda: {
      heatmap: heatmap.sort((a, b) => b.total - a.total).slice(0, 12),
      ociosidadePercentual,
      ocupacaoPercentual,
      status,
    },
    clientes: {
      ativos: clients.filter((client) => client.status === 'ativo').length,
      inativos: clients.filter((client) => client.status === 'inativo').length,
      novos: clients.filter(
        (client) => client.created_at >= startIso && client.created_at < endIso,
      ).length,
      retencaoPercentual,
      topClientes: Array.from(clientMap.values())
        .sort((a, b) => b.gastoTotal - a.gastoTotal)
        .slice(0, 8),
    },
    equipe: Array.from(equipeMap.values()).sort((a, b) => b.faturamento - a.faturamento),
    margemPercentual,
    periodoAnterior: previous,
    previsao: {
      clientes30Dias: Math.round((clients.filter((client) => client.status === 'ativo').length / Math.max(1, periodDays)) * 30),
      lucro30Dias: (current.summary.lucroLiquido / periodDays) * 30,
      receita12Meses: dailyAverage * 365,
      receita30Dias: dailyAverage * 30,
      receita90Dias: dailyAverage * 90,
    },
    produtos: {
      alertas: products
        .map<ExecutiveProductAlert>((product) => ({
          categoria: product.categoria,
          estoqueAtual: product.estoque_atual,
          estoqueMinimo: product.estoque_minimo,
          nome: product.nome,
          precoVenda: product.preco_venda,
          status:
            product.estoque_atual <= product.estoque_minimo
              ?'baixo'
              : product.estoque_atual > product.estoque_minimo * 4
                ?'excesso'
                : 'ok',
        }))
        .filter((product) => product.status !== 'ok')
        .slice(0, 8),
      baixoEstoque: lowStock.length,
      lucroProdutos,
      maisVendidos: current.topProducts,
    },
    score: {
      label:
        scoreValue >= 85
          ?'Excelente operação'
          : scoreValue >= 70
            ?'Operação saudável'
            : scoreValue >= 55
              ?'Operação em atenção'
              : 'Precisa de ajuste',
      value: scoreValue,
    },
    series,
  }
}
