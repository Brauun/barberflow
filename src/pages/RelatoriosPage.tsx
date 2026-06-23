import { useQuery } from '@tanstack/react-query'
import { Download, FileSpreadsheet, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button, ClienteAutocomplete } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import type { ClienteSearchResult } from '../services/clientesService'
import { getRelatorioData, type ReportAgendaItem, type ReportData } from '../services/relatoriosService'
import { exportHtmlReport } from '../utils/mobileExport'

type ReportType =
  | 'diario'
  | 'mensal'
  | 'anual'
  | 'financeiro'
  | 'barbeiros'
  | 'produtos'
  | 'clientes'
  | 'agenda'
  | 'atendimentos'

type PeriodPreset = 'hoje' | '7dias' | '30dias' | 'mensal' | 'anual' | 'personalizado'

type AdvancedFilters = {
  barbeiro: string
  cliente: string
  formaPagamento: string
  servico: string
  status: string
}

type ReportRow = {
  amount?: number
  cells: Array<string | number>
  detail: string
  status?: string
  subtitle: string
  title: string
}

type BuiltReport = {
  columns: string[]
  description: string
  kpis: Array<{ label: string; value: string }>
  rows: ReportRow[]
  title: string
}

const pageSize = 20
const completedStatuses = new Set(['concluido', 'concluido_automatico'])

const reportTypeLabels: Record<ReportType, string> = {
  agenda: 'Agenda',
  anual: 'Anual',
  atendimentos: 'Atendimentos',
  barbeiros: 'Barbeiros',
  clientes: 'Clientes',
  diario: 'Diário',
  financeiro: 'Financeiro',
  mensal: 'Mensal',
  produtos: 'Produtos',
}

const presetLabels: Record<PeriodPreset, string> = {
  '7dias': '7 dias',
  '30dias': '30 dias',
  anual: 'Anual',
  hoje: 'Hoje',
  mensal: 'Mensal',
  personalizado: 'Personalizado',
}

const reportTypes = Object.entries(reportTypeLabels) as Array<[ReportType, string]>
const periodPresets = Object.entries(presetLabels) as Array<[PeriodPreset, string]>

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  currency: 'BRL',
  style: 'currency',
})

function todayInputValue() {
  return new Date().toISOString().slice(0, 10)
}

function toInputValue(date: Date) {
  return date.toISOString().slice(0, 10)
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function monthStartInputValue() {
  const today = new Date()
  return toInputValue(new Date(today.getFullYear(), today.getMonth(), 1))
}

function yearStartInputValue() {
  const today = new Date()
  return toInputValue(new Date(today.getFullYear(), 0, 1))
}

function rangeForPreset(preset: PeriodPreset) {
  const today = new Date()
  const todayInput = todayInputValue()

  if (preset === 'hoje') {
    return { dataFim: todayInput, dataInicio: todayInput }
  }

  if (preset === '7dias') {
    return { dataFim: todayInput, dataInicio: toInputValue(addDays(today, -6)) }
  }

  if (preset === '30dias') {
    return { dataFim: todayInput, dataInicio: toInputValue(addDays(today, -29)) }
  }

  if (preset === 'anual') {
    return { dataFim: todayInput, dataInicio: yearStartInputValue() }
  }

  return { dataFim: todayInput, dataInicio: monthStartInputValue() }
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR')
}

function formatDateTime(value: string) {
  if (!value) return '-'
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatStatus(value: string) {
  const labels: Record<string, string> = {
    agendado: 'Agendado',
    aguardando_finalizacao: 'Aguardando finalização',
    cancelado: 'Cancelado',
    confirmado: 'Confirmado',
    concluido: 'Concluído',
    concluido_automatico: 'Concluído automático',
    em_atendimento: 'Em atendimento',
    faltou: 'Não compareceu',
    nao_compareceu: 'Não compareceu',
    remarcado: 'Remarcado',
  }

  return labels[value] ?? value
}

function normalizeFilePart(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function escapeCsv(value: string | number | null | undefined) {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

function downloadCsv(filename: string, rows: Array<Array<string | number | null | undefined>>) {
  const csv = rows.map((row) => row.map(escapeCsv).join(';')).join('\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter(Boolean).map((item) => String(item)))).sort((a, b) =>
    a.localeCompare(b, 'pt-BR'),
  )
}

function matches(value: string | null | undefined, selected: string) {
  return !selected || String(value ?? '') === selected
}

function filterAgendaItems(items: ReportAgendaItem[], filters: AdvancedFilters) {
  return items.filter((item) => {
    return (
      matches(item.barbeiro, filters.barbeiro) &&
      matches(item.cliente, filters.cliente) &&
      matches(item.servico, filters.servico) &&
      matches(item.status, filters.status) &&
      matches(item.formaPagamento ?? '', filters.formaPagamento)
    )
  })
}

function validAppointments(items: ReportAgendaItem[]) {
  return items.filter((item) => completedStatuses.has(item.status))
}

function buildReport(type: ReportType, data: ReportData, filters: AdvancedFilters): BuiltReport {
  const agenda = filterAgendaItems(data.agendaItems, filters)
  const validAgenda = validAppointments(agenda)
  const receitaPeriodo = validAgenda.reduce((total, item) => total + Number(item.valor), 0)
  const ticketMedio = validAgenda.length ? receitaPeriodo / validAgenda.length : 0
  const baseKpis = [
    { label: 'Receita serviços', value: currencyFormatter.format(receitaPeriodo) },
    { label: 'Atendimentos válidos', value: String(validAgenda.length) },
    { label: 'Ticket médio', value: currencyFormatter.format(ticketMedio) },
    { label: 'Despesas', value: currencyFormatter.format(data.summary.despesas) },
  ]

  if (type === 'barbeiros') {
    const rows = data.topBarbers
      .filter((item) => matches(item.nome, filters.barbeiro))
      .map<ReportRow>((item) => ({
        amount: item.faturamento,
        cells: [
          item.nome,
          item.atendimentos,
          currencyFormatter.format(item.faturamento),
          currencyFormatter.format(item.comissao),
          currencyFormatter.format(item.ticketMedio),
          item.cancelamentos,
        ],
        detail: `Comissão: ${currencyFormatter.format(item.comissao)} • Cancelamentos: ${item.cancelamentos}`,
        subtitle: `${item.atendimentos} atendimentos • Ticket ${currencyFormatter.format(item.ticketMedio)}`,
        title: item.nome,
      }))

    return {
      columns: ['Barbeiro', 'Atendimentos', 'Faturamento', 'Comissão', 'Ticket médio', 'Cancelamentos'],
      description: 'Desempenho operacional por profissional.',
      kpis: [
        { label: 'Barbeiros', value: String(rows.length) },
        { label: 'Faturamento', value: currencyFormatter.format(rows.reduce((total, row) => total + Number(row.amount ?? 0), 0)) },
        { label: 'Comissões', value: currencyFormatter.format(data.summary.comissoes) },
        { label: 'Atendimentos', value: String(rows.reduce((total, row) => total + Number(row.cells[1] ?? 0), 0)) },
      ],
      rows,
      title: 'Relatório de Barbeiros',
    }
  }

  if (type === 'produtos') {
    const rows = data.topProducts.map<ReportRow>((item) => ({
      amount: item.valorTotal,
      cells: [item.nome, item.quantidade, currencyFormatter.format(item.valorTotal), item.estoqueAtual ?? '-'],
      detail: `Estoque atual: ${item.estoqueAtual ?? '-'}`,
      subtitle: `${item.quantidade} unidades vendidas`,
      title: item.nome,
    }))

    return {
      columns: ['Produto', 'Quantidade', 'Receita', 'Estoque'],
      description: 'Produtos vendidos, receita e posição de estoque.',
      kpis: [
        { label: 'Produtos vendidos', value: String(rows.reduce((total, row) => total + Number(row.cells[1] ?? 0), 0)) },
        { label: 'Receita produtos', value: currencyFormatter.format(data.summary.receitaProdutos) },
        { label: 'Itens listados', value: String(rows.length) },
        { label: 'Mais vendido', value: rows[0]?.title ?? '-' },
      ],
      rows,
      title: 'Relatório de Produtos',
    }
  }

  if (type === 'clientes') {
    const rows = data.clients
      .filter((item) => matches(item.nome, filters.cliente))
      .map<ReportRow>((item) => ({
        amount: item.gastoTotal,
        cells: [
          item.nome,
          item.visitas,
          currencyFormatter.format(item.gastoTotal),
          item.ultimaVisita ? formatDate(item.ultimaVisita.slice(0, 10)) : '-',
          item.novo ? 'Sim' : 'Não',
          item.recorrente ? 'Sim' : 'Não',
        ],
        detail: `Última visita: ${item.ultimaVisita ? formatDate(item.ultimaVisita.slice(0, 10)) : '-'}`,
        status: item.recorrente ? 'Recorrente' : item.novo ? 'Novo' : 'Ativo',
        subtitle: `${item.visitas} visitas • ${currencyFormatter.format(item.gastoTotal)}`,
        title: item.nome,
      }))

    return {
      columns: ['Cliente', 'Visitas', 'Total gasto', 'Última visita', 'Novo', 'Recorrente'],
      description: 'Clientes ativos, recorrência e histórico financeiro.',
      kpis: [
        { label: 'Clientes', value: String(rows.length) },
        { label: 'Recorrentes', value: String(rows.filter((row) => row.status === 'Recorrente').length) },
        { label: 'Novos', value: String(rows.filter((row) => row.status === 'Novo').length) },
        { label: 'Gasto total', value: currencyFormatter.format(rows.reduce((total, row) => total + Number(row.amount ?? 0), 0)) },
      ],
      rows,
      title: 'Relatório de Clientes',
    }
  }

  if (type === 'financeiro') {
    const lucro = receitaPeriodo + data.summary.receitaProdutos - data.summary.despesas - data.summary.comissoes
    const rows: ReportRow[] = [
      ['Receita de serviços', receitaPeriodo],
      ['Receita de produtos', data.summary.receitaProdutos],
      ['Despesas', data.summary.despesas],
      ['Comissões', data.summary.comissoes],
      ['Lucro líquido', lucro],
    ].map(([label, value]) => ({
      amount: Number(value),
      cells: [String(label), currencyFormatter.format(Number(value))],
      detail: 'Valor consolidado no período filtrado',
      subtitle: currencyFormatter.format(Number(value)),
      title: String(label),
    }))

    return {
      columns: ['Indicador', 'Valor'],
      description: 'Receitas, despesas, comissões e lucro líquido do período.',
      kpis: [
        { label: 'Entradas', value: currencyFormatter.format(receitaPeriodo + data.summary.receitaProdutos) },
        { label: 'Saídas', value: currencyFormatter.format(data.summary.despesas + data.summary.comissoes) },
        { label: 'Lucro', value: currencyFormatter.format(lucro) },
        { label: 'Ticket médio', value: currencyFormatter.format(ticketMedio) },
      ],
      rows,
      title: 'Relatório Financeiro',
    }
  }

  const agendaRows = agenda.map<ReportRow>((item) => ({
    amount: item.valor,
    cells: [
      formatDateTime(item.horario),
      item.cliente,
      item.barbeiro,
      item.servico,
      formatStatus(item.status),
      item.formaPagamento ?? '-',
      currencyFormatter.format(item.valor),
    ],
    detail: `${item.barbeiro} • ${formatStatus(item.status)}`,
    status: formatStatus(item.status),
    subtitle: `${formatDateTime(item.horario)} • ${item.barbeiro}`,
    title: `${item.cliente} • ${item.servico}`,
  }))

  return {
    columns: ['Data/Hora', 'Cliente', 'Barbeiro', 'Serviço', 'Status', 'Pagamento', 'Valor'],
    description:
      type === 'agenda'
        ? 'Agenda do período com status, profissional e valores.'
        : 'Atendimentos do período com filtros aplicados.',
    kpis: baseKpis,
    rows: agendaRows,
    title: type === 'agenda' ? 'Relatório de Agenda' : `Relatório ${reportTypeLabels[type]}`,
  }
}

function buildReportHtml(input: {
  builtReport: BuiltReport
  dataFim: string
  dataInicio: string
  filters: AdvancedFilters
}) {
  const filters = [
    input.filters.barbeiro && `Barbeiro: ${input.filters.barbeiro}`,
    input.filters.cliente && `Cliente: ${input.filters.cliente}`,
    input.filters.servico && `Serviço: ${input.filters.servico}`,
    input.filters.status && `Status: ${formatStatus(input.filters.status)}`,
    input.filters.formaPagamento && `Pagamento: ${input.filters.formaPagamento}`,
  ].filter(Boolean)

  return `<!doctype html>
  <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <title>${input.builtReport.title}</title>
      <style>
        * { box-sizing: border-box; }
        body { margin: 0; background: #f7fafc; color: #071426; font-family: Inter, Arial, sans-serif; }
        main { padding: 28px; }
        header { border-radius: 22px; background: #071426; color: white; padding: 24px; margin-bottom: 16px; }
        .eyebrow { color: #12c6f3; font-size: 10px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; }
        h1 { margin: 8px 0 6px; font-size: 28px; }
        .muted { color: #b8c7dc; font-size: 12px; line-height: 1.5; }
        .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 0 0 16px; }
        .kpi { background: white; border: 1px solid #dce6f2; border-radius: 14px; padding: 12px; }
        .kpi span { display: block; color: #64748b; font-size: 9px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
        .kpi strong { display: block; margin-top: 7px; font-size: 17px; }
        table { width: 100%; border-collapse: collapse; overflow: hidden; border-radius: 14px; background: white; }
        th, td { border-bottom: 1px solid #e2e8f0; padding: 9px 10px; text-align: left; font-size: 11px; vertical-align: top; }
        th { background: #edf6fb; color: #0f5f76; font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; }
        tr:last-child td { border-bottom: 0; }
        footer { margin-top: 18px; color: #64748b; font-size: 10px; }
        @media print { body { background: white; } main { padding: 15mm; } }
      </style>
    </head>
    <body>
      <main>
        <header>
          <div class="eyebrow">BW Barber</div>
          <h1>${input.builtReport.title}</h1>
          <div class="muted">${formatDate(input.dataInicio)} até ${formatDate(input.dataFim)}</div>
          <div class="muted">${input.builtReport.description}</div>
          ${filters.length ? `<div class="muted">Filtros: ${filters.join(' • ')}</div>` : ''}
        </header>
        <section class="kpis">
          ${input.builtReport.kpis.map((kpi) => `<div class="kpi"><span>${kpi.label}</span><strong>${kpi.value}</strong></div>`).join('')}
        </section>
        <table>
          <thead><tr>${input.builtReport.columns.map((cell) => `<th>${cell}</th>`).join('')}</tr></thead>
          <tbody>
            ${input.builtReport.rows.length
              ? input.builtReport.rows.map((row) => `<tr>${row.cells.map((cell) => `<td>${cell ?? ''}</td>`).join('')}</tr>`).join('')
              : `<tr><td colspan="${input.builtReport.columns.length}">Nenhum registro encontrado para os filtros aplicados.</td></tr>`}
          </tbody>
        </table>
        <footer>Gerado por BW Barber • Relatório operacional</footer>
      </main>
      <script>window.addEventListener('load',function(){setTimeout(function(){window.focus();window.print();},250);});</script>
    </body>
  </html>`
}

export default function RelatoriosPage() {
  const { profile } = useAuth()
  const empresaId = profile?.empresa_id
  const [reportType, setReportType] = useState<ReportType>('mensal')
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('mensal')
  const [pendingInicio, setPendingInicio] = useState(monthStartInputValue())
  const [pendingFim, setPendingFim] = useState(todayInputValue())
  const [page, setPage] = useState(1)
  const [reportClientId, setReportClientId] = useState('')
  const [reportClient, setReportClient] = useState<ClienteSearchResult | null>(null)
  const [filters, setFilters] = useState<AdvancedFilters>({
    barbeiro: '',
    cliente: '',
    formaPagamento: '',
    servico: '',
    status: '',
  })
  const [appliedFilters, setAppliedFilters] = useState({
    dataFim: todayInputValue(),
    dataInicio: monthStartInputValue(),
  })

  const reportQuery = useQuery({
    enabled: Boolean(empresaId),
    queryFn: () =>
      getRelatorioData(
        empresaId ?? '',
        appliedFilters.dataInicio,
        appliedFilters.dataFim,
      ),
    queryKey: ['relatorios', empresaId, appliedFilters.dataInicio, appliedFilters.dataFim],
  })

  const data = reportQuery.data
  const builtReport = useMemo(
    () =>
      data
        ? buildReport(reportType, data, filters)
        : null,
    [data, filters, reportType],
  )
  const totalPages = builtReport ? Math.max(1, Math.ceil(builtReport.rows.length / pageSize)) : 1
  const pagedRows = builtReport?.rows.slice((page - 1) * pageSize, page * pageSize) ?? []

  const options = useMemo(() => {
    const agenda = data?.agendaItems ?? []

    return {
      barbeiros: unique([...agenda.map((item) => item.barbeiro), ...(data?.topBarbers.map((item) => item.nome) ?? [])]),
      clientes: unique([...agenda.map((item) => item.cliente), ...(data?.clients.map((item) => item.nome) ?? [])]),
      formasPagamento: unique(agenda.map((item) => item.formaPagamento ?? '')),
      servicos: unique(agenda.map((item) => item.servico)),
      status: unique(agenda.map((item) => item.status)),
    }
  }, [data])

  const fileBaseName = useMemo(
    () =>
      `BW-Barber-Relatorio-${normalizeFilePart(reportTypeLabels[reportType])}-${appliedFilters.dataInicio}-a-${appliedFilters.dataFim}`,
    [appliedFilters.dataFim, appliedFilters.dataInicio, reportType],
  )

  function selectPreset(preset: PeriodPreset) {
    setPeriodPreset(preset)

    if (preset === 'personalizado') {
      return
    }

    const range = rangeForPreset(preset)
    setPendingInicio(range.dataInicio)
    setPendingFim(range.dataFim)
    setAppliedFilters(range)
    setPage(1)
  }

  function applyFilters() {
    if (pendingInicio > pendingFim) {
      window.alert('A data inicial não pode ser maior que a data final.')
      return
    }

    setPeriodPreset('personalizado')
    setAppliedFilters({ dataFim: pendingFim, dataInicio: pendingInicio })
    setPage(1)
  }

  function clearFilters() {
    const range = rangeForPreset(reportType === 'diario' ? 'hoje' : reportType === 'anual' ? 'anual' : 'mensal')
    setPendingInicio(range.dataInicio)
    setPendingFim(range.dataFim)
    setAppliedFilters(range)
    setPeriodPreset(reportType === 'diario' ? 'hoje' : reportType === 'anual' ? 'anual' : 'mensal')
    setReportClientId('')
    setReportClient(null)
    setFilters({ barbeiro: '', cliente: '', formaPagamento: '', servico: '', status: '' })
    setPage(1)
  }

  function exportPdf() {
    if (!builtReport) return

    try {
      exportHtmlReport({
        filename: `${fileBaseName}.html`,
        html: buildReportHtml({
          builtReport,
          dataFim: appliedFilters.dataFim,
          dataInicio: appliedFilters.dataInicio,
          filters,
        }),
        previewFeatures: 'width=1120,height=1200',
      })
    } catch {
      window.alert('Não foi possível exportar o relatório agora.')
    }
  }

  function exportCsv() {
    if (!builtReport) return

    downloadCsv(`${fileBaseName}.csv`, [
      builtReport.columns,
      ...builtReport.rows.map((row) => row.cells),
    ])
  }

  function updateFilter(key: keyof AdvancedFilters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }))
    setPage(1)
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0f1117] p-3 text-white sm:p-4 md:p-6">
      <div className="mx-auto w-full max-w-6xl space-y-4 md:space-y-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-cyan-300">
            Relatórios
          </p>
          <h1 className="mt-1 text-2xl font-black leading-tight text-white md:text-3xl">
            Relatórios operacionais
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-white/60">
            Escolha o tipo, aplique filtros e exporte somente os dados do relatório selecionado.
          </p>
        </div>

        <section className="rounded-2xl border border-white/10 bg-[#161b27] p-3 sm:p-4">
          <p className="mb-3 text-sm font-bold text-white">Tipo de relatório</p>
          <div className="flex max-w-full flex-wrap gap-2 overflow-hidden pb-1">
            {reportTypes.map(([value, label]) => (
              <button
                className={[
                  'min-h-10 shrink-0 rounded-full border px-4 text-sm font-bold transition-colors',
                  reportType === value
                    ? 'border-cyan-300 bg-cyan-500 text-slate-950'
                    : 'border-white/15 bg-transparent text-white/65 hover:border-white/30',
                ].join(' ')}
                key={value}
                onClick={() => {
                  setReportType(value)
                  setPage(1)
                }}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-4 flex max-w-full flex-wrap gap-2 overflow-hidden pb-1">
            {periodPresets.map(([value, label]) => (
              <button
                className={[
                  'min-h-9 shrink-0 rounded-full border px-3 text-xs font-bold transition-colors',
                  periodPreset === value
                    ? 'border-cyan-300 bg-cyan-400/15 text-cyan-200'
                    : 'border-white/15 bg-transparent text-white/55 hover:border-white/30',
                ].join(' ')}
                key={value}
                onClick={() => selectPreset(value)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-4 grid min-w-0 max-w-full gap-3 md:grid-cols-[1fr_1fr_auto_auto_auto_auto] md:items-end">
            <label className="min-w-0 space-y-2 text-sm font-semibold text-white/75">
              Data inicial
              <input
                className="block h-11 w-full max-w-full min-w-0 overflow-hidden rounded-xl border border-white/10 bg-[#101827] px-3 text-sm text-white outline-none focus:border-cyan-300 sm:text-base md:text-sm"
                onChange={(event) => setPendingInicio(event.target.value)}
                type="date"
                value={pendingInicio}
              />
            </label>
            <label className="min-w-0 space-y-2 text-sm font-semibold text-white/75">
              Data final
              <input
                className="block h-11 w-full max-w-full min-w-0 overflow-hidden rounded-xl border border-white/10 bg-[#101827] px-3 text-sm text-white outline-none focus:border-cyan-300 sm:text-base md:text-sm"
                onChange={(event) => setPendingFim(event.target.value)}
                type="date"
                value={pendingFim}
              />
            </label>
            <Button className="w-full min-w-0 md:w-auto" onClick={applyFilters} variant="secondary">
              Aplicar filtros
            </Button>
            <Button className="w-full min-w-0 md:w-auto" leftIcon={<RotateCcw size={16} />} onClick={clearFilters} variant="ghost">
              Limpar
            </Button>
            <Button className="w-full min-w-0 md:w-auto" disabled={!builtReport} leftIcon={<Download size={16} />} onClick={exportPdf}>
              Exportar PDF
            </Button>
            <Button className="w-full min-w-0 md:w-auto" disabled={!builtReport} leftIcon={<FileSpreadsheet size={16} />} onClick={exportCsv}>
              Exportar Excel
            </Button>
          </div>

          <details className="mt-4 rounded-xl border border-white/10 bg-[#101827] p-3">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-bold text-white">
              <SlidersHorizontal size={16} />
              Filtros avançados
            </summary>
            <div className="mt-3 grid gap-3 md:grid-cols-5">
              <ClienteAutocomplete
                className="md:col-span-1"
                empresaId={empresaId}
                label="Cliente"
                onChange={(clienteId, cliente) => {
                  setReportClientId(clienteId)
                  setReportClient(cliente)
                  updateFilter('cliente', cliente?.nome ?? '')
                }}
                selectedCliente={reportClient}
                value={reportClientId}
              />
              {[
                ['barbeiro', 'Barbeiro', options.barbeiros],
                ['servico', 'Serviço', options.servicos],
                ['status', 'Status', options.status],
                ['formaPagamento', 'Pagamento', options.formasPagamento],
              ].map(([key, label, values]) => (
                <label className="space-y-2 text-xs font-bold uppercase tracking-[0.08em] text-white/45" key={String(key)}>
                  {String(label)}
                  <select
                    className="h-10 w-full min-w-0 rounded-xl border border-white/10 bg-[#161b27] px-3 text-sm normal-case tracking-normal text-white outline-none focus:border-cyan-300"
                    onChange={(event) => updateFilter(key as keyof AdvancedFilters, event.target.value)}
                    value={filters[key as keyof AdvancedFilters]}
                  >
                    <option value="">Todos</option>
                    {(values as string[]).map((value) => (
                      <option key={value} value={value}>
                        {key === 'status' ? formatStatus(value) : value}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </details>
        </section>

        <section>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-black md:text-2xl">
                {builtReport?.title ?? `Relatório ${reportTypeLabels[reportType]}`}
              </h2>
              <p className="text-sm text-white/55">
                {formatDate(appliedFilters.dataInicio)} até {formatDate(appliedFilters.dataFim)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-bold text-cyan-300">
                Período filtrado
              </span>
              <span className="rounded-full bg-white/8 px-3 py-1 text-xs font-bold text-white/70">
                {builtReport?.rows.length ?? 0} registros
              </span>
            </div>
          </div>

          {reportQuery.error && (
            <div className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">
              Não foi possível carregar o relatório: {reportQuery.error.message}
            </div>
          )}

          {reportQuery.isLoading ? (
            <div className="mt-4 rounded-xl border border-white/10 bg-[#161b27] p-4 text-sm text-white/60">
              Carregando relatório...
            </div>
          ) : builtReport ? (
            <>
              <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
                {builtReport.kpis.map((kpi) => (
                  <div className="rounded-xl border border-white/10 bg-[#161b27] p-3 md:p-4" key={kpi.label}>
                    <p className="text-[11px] text-white/45">{kpi.label}</p>
                    <p className="mt-1 text-lg font-black md:text-xl">{kpi.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 space-y-2 md:hidden">
                {pagedRows.length ? (
                  pagedRows.map((row, index) => (
                    <article className="rounded-xl border border-white/10 bg-[#161b27] p-3" key={`${row.title}-${index}`}>
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="break-words text-sm font-black text-white">{row.title}</h3>
                          <p className="mt-1 break-words text-xs text-white/55">{row.subtitle}</p>
                          <p className="mt-1 break-words text-xs text-white/45">{row.detail}</p>
                        </div>
                        {row.amount !== undefined && (
                          <strong className="shrink-0 text-sm text-cyan-300">
                            {currencyFormatter.format(row.amount)}
                          </strong>
                        )}
                      </div>
                      {row.status && (
                        <span className="mt-2 inline-flex rounded-full bg-white/8 px-2 py-0.5 text-xs font-bold text-white/70">
                          {row.status}
                        </span>
                      )}
                    </article>
                  ))
                ) : (
                  <div className="rounded-xl border border-white/10 bg-[#161b27] p-4 text-sm text-white/55">
                    Nenhum registro encontrado para os filtros aplicados.
                  </div>
                )}
              </div>

              <div className="mt-4 hidden overflow-hidden rounded-xl border border-white/10 bg-[#161b27] md:block">
                <table className="w-full table-fixed text-left text-sm">
                  <thead className="bg-white/5 text-xs uppercase tracking-[0.08em] text-white/45">
                    <tr>
                      {builtReport.columns.map((cell) => (
                        <th className="break-words px-4 py-3" key={cell}>
                          {cell}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/8">
                    {pagedRows.length ? (
                      pagedRows.map((row, index) => (
                        <tr key={`${row.title}-${index}`}>
                          {row.cells.map((cell, cellIndex) => (
                            <td className="break-words px-4 py-3 text-white/75" key={`${index}-${cellIndex}`}>
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="px-4 py-5 text-white/55" colSpan={builtReport.columns.length}>
                          Nenhum registro encontrado para os filtros aplicados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <Button disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} variant="secondary">
                  Anterior
                </Button>
                <span className="text-xs font-bold text-white/55">
                  Página {page} de {totalPages}
                </span>
                <Button disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} variant="secondary">
                  Próxima
                </Button>
              </div>
            </>
          ) : null}
        </section>
      </div>
    </div>
  )
}
