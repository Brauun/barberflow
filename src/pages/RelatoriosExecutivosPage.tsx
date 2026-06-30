import { useQuery } from '@tanstack/react-query'
import { Download, FileSpreadsheet } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button, DateInput } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import {
  getExecutiveRelatorioData,
  type ExecutiveReportData,
} from '../services/relatoriosService'
import { exportHtmlReport } from '../utils/mobileExport'

type Periodo = 'hoje' | '7dias' | '30dias' | 'mensal' | 'anual' | 'personalizado'
type Tab = 'visao-geral' | 'equipe' | 'clientes' | 'agenda' | 'inteligencia'

type ExecutiveInsight = {
  tone: 'good' | 'warning' | 'danger' | 'neutral'
  text: string
  title: string
}

const periodoLabels: Record<Periodo, string> = {
  '7dias': '7 dias',
  '30dias': '30 dias',
  anual: 'Anual',
  hoje: 'Hoje',
  mensal: 'Mensal',
  personalizado: 'Personalizado',
}

const tabLabels: Record<Tab, string> = {
  agenda: 'Agenda',
  clientes: 'Clientes',
  equipe: 'Equipe',
  inteligencia: 'Inteligência',
  'visao-geral': 'Visão Geral',
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  currency: 'BRL',
  style: 'currency',
})

const percentFormatter = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
  style: 'percent',
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

function rangeForPeriodo(periodo: Periodo) {
  const today = new Date()
  const todayInput = todayInputValue()

  if (periodo === 'hoje') {
    return { dataFim: todayInput, dataInicio: todayInput }
  }

  if (periodo === '7dias') {
    return { dataFim: todayInput, dataInicio: toInputValue(addDays(today, -6)) }
  }

  if (periodo === '30dias') {
    return { dataFim: todayInput, dataInicio: toInputValue(addDays(today, -29)) }
  }

  if (periodo === 'anual') {
    return { dataFim: todayInput, dataInicio: yearStartInputValue() }
  }

  return { dataFim: todayInput, dataInicio: monthStartInputValue() }
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR')
}

function formatPercent(value: number) {
  return percentFormatter.format((Number(value) || 0) / 100)
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

function growthPercent(current: number, previous: number) {
  if (previous <= 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

function getExecutiveMetrics(data: ExecutiveReportData) {
  const receita = data.summary.receitaServicos + data.summary.receitaProdutos
  const receitaAnterior =
    data.periodoAnterior.summary.receitaServicos +
    data.periodoAnterior.summary.receitaProdutos
  const atendimentos = data.agenda.status.concluido
  const ticketMedio = atendimentos ? data.summary.receitaServicos / atendimentos : 0

  return {
    atendimentos,
    crescimento: growthPercent(receita, receitaAnterior),
    lucro: data.summary.lucroLiquido,
    margem: data.margemPercentual,
    receita,
    ticketMedio,
  }
}

function buildInsights(data: ExecutiveReportData): ExecutiveInsight[] {
  const metrics = getExecutiveMetrics(data)
  const topBarber = data.equipe[0]
  const topProduct = data.produtos.maisVendidos[0]
  const insights: ExecutiveInsight[] = [
    {
      text:
        metrics.crescimento >= 0
          ? `A receita cresceu ${metrics.crescimento.toFixed(1)}% contra o período anterior.`
          : `A receita caiu ${Math.abs(metrics.crescimento).toFixed(1)}% contra o período anterior.`,
      title: 'Crescimento',
      tone: metrics.crescimento >= 0 ? 'good' : 'warning',
    },
    {
      text:
        data.margemPercentual >= 20
          ? 'A margem está saudável para o período analisado.'
          : 'A margem merece atenção. Revise despesas, descontos e comissões.',
      title: 'Margem',
      tone: data.margemPercentual >= 20 ? 'good' : 'warning',
    },
    {
      text: topBarber
        ? `${topBarber.nome} lidera em faturamento com ${currencyFormatter.format(topBarber.faturamento)}.`
        : 'Ainda não há dados suficientes para ranking da equipe.',
      title: 'Equipe',
      tone: topBarber ? 'neutral' : 'warning',
    },
    {
      text: topProduct
        ? `${topProduct.nome} é o produto mais vendido no período.`
        : 'Nenhuma venda de produto registrada no período.',
      title: 'Produtos',
      tone: topProduct ? 'neutral' : 'warning',
    },
  ]

  if (data.produtos.baixoEstoque > 0) {
    insights.push({
      text: `${data.produtos.baixoEstoque} produto(s) exigem reposição de estoque.`,
      title: 'Estoque',
      tone: 'danger',
    })
  }

  return insights
}

function buildExecutiveRows(data: ExecutiveReportData, tab: Tab) {
  if (tab === 'equipe') {
    return [
      ['Barbeiro', 'Atendimentos', 'Faturamento', 'Comissão', 'Ticket médio', 'Cancelamentos'],
      ...data.equipe.map((item) => [
        item.nome,
        item.atendimentos,
        currencyFormatter.format(item.faturamento),
        currencyFormatter.format(item.comissao),
        currencyFormatter.format(item.ticketMedio),
        item.cancelamentos,
      ]),
    ]
  }

  if (tab === 'clientes') {
    return [
      ['Cliente', 'Visitas', 'Gasto total', 'Última visita'],
      ...data.clientes.topClientes.map((item) => [
        item.nome,
        item.visitas,
        currencyFormatter.format(item.gastoTotal),
        item.ultimaVisita ? new Date(item.ultimaVisita).toLocaleDateString('pt-BR') : '',
      ]),
    ]
  }

  if (tab === 'agenda') {
    return [
      ['Indicador', 'Total'],
      ['Agendados', data.agenda.status.agendado],
      ['Confirmados', data.agenda.status.confirmado],
      ['Concluídos', data.agenda.status.concluido],
      ['Cancelados', data.agenda.status.cancelado],
      ['Remarcados', data.agenda.status.remarcado],
      ['Em atendimento', data.agenda.status.emAtendimento],
      ['Ocupação', `${data.agenda.ocupacaoPercentual}%`],
      ['Ociosidade', `${data.agenda.ociosidadePercentual}%`],
    ]
  }

  if (tab === 'inteligencia') {
    return [
      ['Indicador', 'Valor'],
      ['Receita prevista 30 dias', currencyFormatter.format(data.previsao.receita30Dias)],
      ['Lucro previsto 30 dias', currencyFormatter.format(data.previsao.lucro30Dias)],
      ['Receita prevista 90 dias', currencyFormatter.format(data.previsao.receita90Dias)],
      ['Receita prevista 12 meses', currencyFormatter.format(data.previsao.receita12Meses)],
      ['Produtos com baixo estoque', data.produtos.baixoEstoque],
    ]
  }

  const metrics = getExecutiveMetrics(data)

  return [
    ['Indicador', 'Valor'],
    ['Score da operação', `${data.score.value}/100`],
    ['Receita do período', currencyFormatter.format(metrics.receita)],
    ['Lucro líquido', currencyFormatter.format(metrics.lucro)],
    ['Margem', formatPercent(metrics.margem)],
    ['Ticket médio', currencyFormatter.format(metrics.ticketMedio)],
    ['Atendimentos', metrics.atendimentos],
    ['Crescimento', `${metrics.crescimento.toFixed(1)}%`],
  ]
}

function buildExecutiveHtml(input: {
  data: ExecutiveReportData
  dataFim: string
  dataInicio: string
}) {
  const metrics = getExecutiveMetrics(input.data)
  const insights = buildInsights(input.data)

  return `<!doctype html>
  <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <title>Relatório Executivo BW Barber</title>
      <style>
        * { box-sizing: border-box; }
        body { margin: 0; background: #f5f8fb; color: #071426; font-family: Inter, Arial, sans-serif; }
        main { padding: 28px; }
        header { display: grid; grid-template-columns: 1.35fr .65fr; gap: 16px; border-radius: 24px; background: #071426; color: white; padding: 26px; margin-bottom: 16px; }
        .eyebrow { color: #12c6f3; font-size: 10px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; }
        h1 { margin: 8px 0 6px; font-size: 30px; }
        .muted { color: #b8c7dc; font-size: 12px; line-height: 1.5; }
        .score { border: 1px solid rgba(18,198,243,.35); border-radius: 18px; padding: 16px; background: rgba(255,255,255,.06); }
        .score strong { display: block; font-size: 40px; }
        .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
        .kpi, .section { background: white; border: 1px solid #dce6f2; border-radius: 16px; padding: 14px; }
        .kpi span { display: block; color: #64748b; font-size: 9px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
        .kpi strong { display: block; margin-top: 7px; font-size: 18px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        h2 { margin: 0 0 8px; font-size: 17px; }
        ul { margin: 0; padding-left: 18px; }
        li { margin: 6px 0; font-size: 12px; line-height: 1.45; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th, td { border-bottom: 1px solid #e2e8f0; padding: 8px 9px; text-align: left; font-size: 11px; }
        th { color: #0f5f76; font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; }
        footer { margin-top: 16px; color: #64748b; font-size: 10px; }
        @media print { body { background: white; } main { padding: 15mm; } }
      </style>
    </head>
    <body>
      <main>
        <header>
          <div>
            <div class="eyebrow">BW Barber • BW Pro</div>
            <h1>Relatório Executivo</h1>
            <div class="muted">${formatDate(input.dataInicio)} até ${formatDate(input.dataFim)}</div>
            <div class="muted">Panorama gerencial para decisão: receita, equipe, agenda, clientes e recomendações.</div>
          </div>
          <div class="score">
            <span class="eyebrow">Score da operação</span>
            <strong>${input.data.score.value}/100</strong>
            <span>${input.data.score.label}</span>
          </div>
        </header>
        <section class="kpis">
          <div class="kpi"><span>Receita</span><strong>${currencyFormatter.format(metrics.receita)}</strong></div>
          <div class="kpi"><span>Lucro líquido</span><strong>${currencyFormatter.format(metrics.lucro)}</strong></div>
          <div class="kpi"><span>Margem</span><strong>${formatPercent(metrics.margem)}</strong></div>
          <div class="kpi"><span>Ticket médio</span><strong>${currencyFormatter.format(metrics.ticketMedio)}</strong></div>
          <div class="kpi"><span>Atendimentos</span><strong>${metrics.atendimentos}</strong></div>
          <div class="kpi"><span>Crescimento</span><strong>${metrics.crescimento.toFixed(1)}%</strong></div>
        </section>
        <div class="grid">
          <section class="section">
            <h2>Insights do período</h2>
            <ul>${insights.map((item) => `<li><strong>${item.title}:</strong> ${item.text}</li>`).join('')}</ul>
          </section>
          <section class="section">
            <h2>Equipe e serviços</h2>
            <table>
              <thead><tr><th>Barbeiro</th><th>Faturamento</th><th>Atendimentos</th></tr></thead>
              <tbody>${input.data.equipe.slice(0, 5).map((item) => `<tr><td>${item.nome}</td><td>${currencyFormatter.format(item.faturamento)}</td><td>${item.atendimentos}</td></tr>`).join('')}</tbody>
            </table>
          </section>
          <section class="section">
            <h2>Clientes</h2>
            <table>
              <thead><tr><th>Cliente</th><th>Visitas</th><th>Gasto</th></tr></thead>
              <tbody>${input.data.clientes.topClientes.slice(0, 5).map((item) => `<tr><td>${item.nome}</td><td>${item.visitas}</td><td>${currencyFormatter.format(item.gastoTotal)}</td></tr>`).join('')}</tbody>
            </table>
          </section>
          <section class="section">
            <h2>Agenda e estoque</h2>
            <ul>
              <li>Ocupação: <strong>${input.data.agenda.ocupacaoPercentual}%</strong></li>
              <li>Cancelamentos: <strong>${input.data.agenda.status.cancelado}</strong></li>
              <li>Produtos com baixo estoque: <strong>${input.data.produtos.baixoEstoque}</strong></li>
              <li>Receita prevista em 30 dias: <strong>${currencyFormatter.format(input.data.previsao.receita30Dias)}</strong></li>
            </ul>
          </section>
        </div>
        <footer>Gerado por BW Barber • Relatório confidencial</footer>
      </main>
      <script>window.addEventListener('load',function(){setTimeout(function(){window.focus();window.print();},250);});</script>
    </body>
  </html>`
}

function insightToneClass(tone: ExecutiveInsight['tone']) {
  if (tone === 'good') return 'border-emerald-400/20 bg-emerald-400/8 text-emerald-100'
  if (tone === 'warning') return 'border-amber-400/20 bg-amber-400/8 text-amber-100'
  if (tone === 'danger') return 'border-red-400/20 bg-red-400/8 text-red-100'
  return 'border-[var(--bf-border)] bg-[var(--bf-surface-muted)] text-[var(--bf-text-secondary)]'
}

export default function RelatorioExecutivosPage() {
  const { profile } = useAuth()
  const empresaId = profile?.empresa_id
  const [periodo, setPeriodo] = useState<Periodo>('mensal')
  const [activeTab, setActiveTab] = useState<Tab>('visao-geral')
  const [pendingInicio, setPendingInicio] = useState(monthStartInputValue())
  const [pendingFim, setPendingFim] = useState(todayInputValue())
  const [appliedFilters, setAppliedFilters] = useState({
    dataFim: todayInputValue(),
    dataInicio: monthStartInputValue(),
  })

  const reportQuery = useQuery({
    enabled: Boolean(empresaId),
    queryFn: () =>
      getExecutiveRelatorioData(
        empresaId ?? '',
        appliedFilters.dataInicio,
        appliedFilters.dataFim,
      ),
    queryKey: [
      'relatorios-executivos',
      empresaId,
      appliedFilters.dataInicio,
      appliedFilters.dataFim,
    ],
  })

  const data = reportQuery.data
  const metrics = data ? getExecutiveMetrics(data) : null
  const insights = data ? buildInsights(data) : []
  const fileBaseName = useMemo(
    () =>
      `BW-Barber-Relatorio-Executivo-${normalizeFilePart(tabLabels[activeTab])}-${appliedFilters.dataInicio}-a-${appliedFilters.dataFim}`,
    [activeTab, appliedFilters.dataFim, appliedFilters.dataInicio],
  )

  function setQuickPeriodo(nextPeriodo: Periodo) {
    setPeriodo(nextPeriodo)

    if (nextPeriodo === 'personalizado') return

    const range = rangeForPeriodo(nextPeriodo)
    setPendingInicio(range.dataInicio)
    setPendingFim(range.dataFim)
    setAppliedFilters(range)
  }

  function applyFilters() {
    if (pendingInicio > pendingFim) {
      window.alert('A data inicial não pode ser maior que a data final.')
      return
    }

    setPeriodo('personalizado')
    setAppliedFilters({ dataFim: pendingFim, dataInicio: pendingInicio })
  }

  function exportPdf() {
    if (!data) return

    try {
      exportHtmlReport({
        filename: `${fileBaseName}.html`,
        html: buildExecutiveHtml({
          data,
          dataFim: appliedFilters.dataFim,
          dataInicio: appliedFilters.dataInicio,
        }),
        previewFeatures: 'width=1120,height=1200',
      })
    } catch {
      window.alert('Não foi possível exportar o relatório executivo agora.')
    }
  }

  function exportCsv() {
    if (!data) return

    downloadCsv(`${fileBaseName}.csv`, buildExecutiveRows(data, activeTab))
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--bf-background)] p-3 text-[var(--bf-text-primary)] sm:p-4 md:p-6">
      <div className="mx-auto w-full max-w-6xl space-y-4 md:space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-cyan-300">
              Relatórios Executivos
            </p>
            <h1 className="text-2xl font-black leading-tight text-[var(--bf-text-primary)] md:text-3xl">
              Panorama do Negócio
            </h1>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-[var(--bf-text-secondary)]">
              Visão gerencial premium com score, indicadores, alertas e recomendações.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap">
            <Button data-subscription-premium="true" disabled={!data} leftIcon={<Download size={16} />} onClick={exportPdf}>
              Exportar PDF
            </Button>
            <Button data-subscription-premium="true" disabled={!data} leftIcon={<FileSpreadsheet size={16} />} onClick={exportCsv}>
              Exportar Excel
            </Button>
          </div>
        </div>

        <section className="rounded-2xl border border-[var(--bf-border)] bg-[var(--bf-surface)] p-3 sm:p-4">
          <div className="flex max-w-full flex-wrap gap-2 overflow-hidden pb-1">
            {(Object.keys(periodoLabels) as Periodo[]).map((item) => (
              <button
                className={[
                  'min-h-10 shrink-0 rounded-full border px-4 text-sm font-bold transition-colors',
                  periodo === item
                    ? 'border-cyan-300 bg-cyan-500 text-slate-950'
                    : 'border-[var(--bf-border)] bg-transparent text-[var(--bf-text-secondary)] hover:border-slate-400/50',
                ].join(' ')}
                key={item}
                onClick={() => setQuickPeriodo(item)}
                type="button"
              >
                {periodoLabels[item]}
              </button>
            ))}
          </div>

          <div className="mt-4 grid min-w-0 max-w-full gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <DateInput
              label="Data inicial"
              onChange={setPendingInicio}
              value={pendingInicio}
            />
            <DateInput
              label="Data final"
              onChange={setPendingFim}
              value={pendingFim}
            />
            <Button className="w-full min-w-0 md:w-auto" onClick={applyFilters} variant="secondary">
              Aplicar período
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-bold text-cyan-300">
              {formatDate(appliedFilters.dataInicio)} até {formatDate(appliedFilters.dataFim)}
            </span>
            <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-300">
              BW Pro e superior
            </span>
          </div>
        </section>

        {reportQuery.error && (
          <div className="rounded-xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">
            Não foi possível carregar o relatório executivo: {reportQuery.error.message}
          </div>
        )}

        {reportQuery.isLoading ? (
          <div className="rounded-xl border border-[var(--bf-border)] bg-[var(--bf-surface)] p-4 text-sm text-[var(--bf-text-secondary)]">
            Carregando relatório executivo...
          </div>
        ) : data && metrics ? (
          <>
            <section className="grid gap-3 md:grid-cols-[0.8fr_1.2fr]">
              <div className="rounded-2xl border border-[var(--bf-border)] bg-[var(--bf-surface)] p-4 md:p-5">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--bf-text-secondary)]">
                  Score da operação
                </p>
                <div className="mt-4 flex items-end gap-2">
                  <span className="text-5xl font-black leading-none text-[var(--bf-text-primary)]">{data.score.value}</span>
                  <span className="pb-1 text-lg font-bold text-[var(--bf-text-secondary)]">/100</span>
                </div>
                <p className="mt-3 text-base font-black text-[var(--bf-text-primary)]">{data.score.label}</p>
                <p className="mt-2 text-sm leading-relaxed text-[var(--bf-text-secondary)]">
                  Score baseado em receita, margem, ocupação, cancelamentos e ritmo do período.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 md:gap-3">
                {[
                  ['Receita', currencyFormatter.format(metrics.receita)],
                  ['Lucro líquido', currencyFormatter.format(metrics.lucro)],
                  ['Margem', formatPercent(metrics.margem)],
                  ['Ticket médio', currencyFormatter.format(metrics.ticketMedio)],
                  ['Atendimentos', metrics.atendimentos],
                  ['Crescimento', `${metrics.crescimento.toFixed(1)}%`],
                  ['Comissões', currencyFormatter.format(data.summary.comissoes)],
                  ['Produtos vendidos', data.produtos.maisVendidos.reduce((total, product) => total + product.quantidade, 0)],
                ].map(([label, value]) => (
                  <div className="rounded-xl border border-[var(--bf-border)] bg-[var(--bf-surface)] p-3 md:p-4" key={label}>
                    <p className="text-xs text-[var(--bf-text-secondary)]">{label}</p>
                    <p className="mt-1 break-words text-lg font-black leading-tight text-[var(--bf-text-primary)] md:text-2xl">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-[var(--bf-border)] bg-[var(--bf-surface)] p-3 sm:p-4">
              <div className="flex max-w-full flex-wrap gap-2 overflow-hidden pb-1">
                {(Object.keys(tabLabels) as Tab[]).map((item) => (
                  <button
                    className={[
                      'min-h-10 shrink-0 rounded-full border px-4 text-sm font-bold transition-colors',
                      activeTab === item
                        ? 'border-cyan-300 bg-cyan-500 text-slate-950'
                        : 'border-[var(--bf-border)] bg-transparent text-[var(--bf-text-secondary)] hover:border-slate-400/50',
                    ].join(' ')}
                    key={item}
                    onClick={() => setActiveTab(item)}
                    type="button"
                  >
                    {tabLabels[item]}
                  </button>
                ))}
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {activeTab === 'visao-geral' && (
                  <>
                    {insights.map((insight) => (
                      <article className={`rounded-xl border p-3 ${insightToneClass(insight.tone)}`} key={insight.title}>
                        <h3 className="text-sm font-black">{insight.title}</h3>
                        <p className="mt-1 text-sm leading-relaxed opacity-80">{insight.text}</p>
                      </article>
                    ))}
                  </>
                )}

                {activeTab === 'equipe' &&
                  data.equipe.slice(0, 6).map((barber, index) => (
                    <article className="rounded-xl border border-[var(--bf-border)] bg-[var(--bf-surface-muted)] p-3" key={barber.nome}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="text-xs font-bold text-cyan-300">#{index + 1}</span>
                          <h3 className="text-sm font-black text-[var(--bf-text-primary)]">{barber.nome}</h3>
                          <p className="mt-1 text-xs text-[var(--bf-text-secondary)]">
                            {barber.atendimentos} atendimentos • Ticket {currencyFormatter.format(barber.ticketMedio)}
                          </p>
                        </div>
                        <strong className="text-sm text-cyan-300">{currencyFormatter.format(barber.faturamento)}</strong>
                      </div>
                    </article>
                  ))}

                {activeTab === 'clientes' &&
                  data.clientes.topClientes.slice(0, 6).map((client) => (
                    <article className="rounded-xl border border-[var(--bf-border)] bg-[var(--bf-surface-muted)] p-3" key={client.nome}>
                      <h3 className="text-sm font-black text-[var(--bf-text-primary)]">{client.nome}</h3>
                      <p className="mt-1 text-xs text-[var(--bf-text-secondary)]">
                        {client.visitas} visitas • {currencyFormatter.format(client.gastoTotal)}
                      </p>
                    </article>
                  ))}

                {activeTab === 'agenda' &&
                  [
                    ['Ocupação', `${data.agenda.ocupacaoPercentual}%`],
                    ['Ociosidade', `${data.agenda.ociosidadePercentual}%`],
                    ['Concluídos', data.agenda.status.concluido],
                    ['Cancelados', data.agenda.status.cancelado],
                    ['Remarcados', data.agenda.status.remarcado],
                    ['Em atendimento', data.agenda.status.emAtendimento],
                  ].map(([label, value]) => (
                    <article className="rounded-xl border border-[var(--bf-border)] bg-[var(--bf-surface-muted)] p-3" key={label}>
                      <p className="text-xs text-[var(--bf-text-secondary)]">{label}</p>
                      <p className="mt-1 text-xl font-black text-[var(--bf-text-primary)]">{value}</p>
                    </article>
                  ))}

                {activeTab === 'inteligencia' &&
                  [
                    ['Receita prevista 30 dias', currencyFormatter.format(data.previsao.receita30Dias)],
                    ['Lucro previsto 30 dias', currencyFormatter.format(data.previsao.lucro30Dias)],
                    ['Receita prevista 90 dias', currencyFormatter.format(data.previsao.receita90Dias)],
                    ['Receita prevista 12 meses', currencyFormatter.format(data.previsao.receita12Meses)],
                    ['Produtos baixo estoque', data.produtos.baixoEstoque],
                    ['Clientes previstos 30 dias', data.previsao.clientes30Dias],
                  ].map(([label, value]) => (
                    <article className="rounded-xl border border-[var(--bf-border)] bg-[var(--bf-surface-muted)] p-3" key={label}>
                      <p className="text-xs text-[var(--bf-text-secondary)]">{label}</p>
                      <p className="mt-1 break-words text-lg font-black text-[var(--bf-text-primary)]">{value}</p>
                    </article>
                  ))}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  )
}
