import { useQuery } from '@tanstack/react-query'
import { Download, FileSpreadsheet } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import {
  getExecutiveRelatorioData,
  type ExecutiveReportData,
} from '../services/relatoriosService'
import { exportHtmlReport } from '../utils/mobileExport'

type Periodo = 'hoje' | '7dias' | '30dias' | 'mensal' | 'anual' | 'personalizado'
type Tab = 'visao-geral' | 'equipe' | 'clientes' | 'agenda' | 'inteligencia'

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

function buildExecutiveRows(data: ExecutiveReportData, tab: Tab) {
  if (tab === 'equipe') {
    return [
      ['Barbeiro', 'Atendimentos', 'Faturamento', 'Comissão', 'Ticket médio', 'Cancelamentos'],
      ...data.equipe.map((item) => [
        item.nome,
        item.atendimentos,
        item.faturamento,
        item.comissao,
        item.ticketMedio,
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
        item.gastoTotal,
        item.ultimaVisita ? new Date(item.ultimaVisita).toLocaleDateString('pt-BR') : '',
      ]),
    ]
  }

  if (tab === 'agenda') {
    return [
      ['Status', 'Total'],
      ['Agendado', data.agenda.status.agendado],
      ['Confirmado', data.agenda.status.confirmado],
      ['Concluído', data.agenda.status.concluido],
      ['Cancelado', data.agenda.status.cancelado],
      ['Remarcado', data.agenda.status.remarcado],
      ['Em atendimento', data.agenda.status.emAtendimento],
      ['Ocupação', `${data.agenda.ocupacaoPercentual}%`],
      ['Ociosidade', `${data.agenda.ociosidadePercentual}%`],
    ]
  }

  if (tab === 'inteligencia') {
    return [
      ['Indicador', 'Valor'],
      ['Receita prevista 30 dias', data.previsao.receita30Dias],
      ['Lucro previsto 30 dias', data.previsao.lucro30Dias],
      ['Receita prevista 90 dias', data.previsao.receita90Dias],
      ['Receita prevista 12 meses', data.previsao.receita12Meses],
      ['Produtos com baixo estoque', data.produtos.baixoEstoque],
    ]
  }

  return [
    ['Indicador', 'Valor'],
    ['Score da operação', `${data.score.value}/100`],
    ['Receita período', data.summary.receitaServicos + data.summary.receitaProdutos],
    ['Lucro líquido', data.summary.lucroLiquido],
    ['Margem', `${data.margemPercentual}%`],
    ['Comissões', data.summary.comissoes],
    ['Clientes ativos', data.clientes.ativos],
    ['Atendimentos', data.agenda.status.concluido],
  ]
}

function buildExecutiveHtml(input: {
  data: ExecutiveReportData
  dataFim: string
  dataInicio: string
  tab: Tab
}) {
  const entradas = input.data.summary.receitaServicos + input.data.summary.receitaProdutos
  const rows = buildExecutiveRows(input.data, input.tab)

  return `<!doctype html>
  <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <title>Relatório Executivo BW Barber</title>
      <style>
        * { box-sizing: border-box; }
        body { margin: 0; background: #f5f8fb; color: #071426; font-family: Inter, Arial, sans-serif; }
        main { padding: 30px; }
        header { display: grid; grid-template-columns: 1fr 220px; gap: 18px; border-radius: 26px; background: #071426; color: white; padding: 28px; margin-bottom: 18px; }
        .eyebrow { color: #12c6f3; font-size: 11px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; }
        h1 { margin: 8px 0 6px; font-size: 31px; }
        .period { color: #b8c7dc; font-size: 13px; }
        .score { border: 1px solid rgba(18,198,243,.35); border-radius: 20px; padding: 18px; background: rgba(255,255,255,.05); }
        .score strong { display: block; font-size: 42px; }
        .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 18px; }
        .kpi { background: white; border: 1px solid #dce6f2; border-radius: 16px; padding: 14px; }
        .kpi span { display: block; color: #64748b; font-size: 10px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
        .kpi strong { display: block; margin-top: 7px; font-size: 18px; }
        section { background: white; border: 1px solid #dce6f2; border-radius: 18px; padding: 18px; }
        h2 { margin: 0 0 12px; font-size: 18px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border-bottom: 1px solid #e2e8f0; padding: 11px 12px; text-align: left; font-size: 12px; }
        th { color: #0f5f76; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; }
        tr:last-child td { border-bottom: 0; }
        @media print { body { background: white; } main { padding: 18mm; } }
      </style>
    </head>
    <body>
      <main>
        <header>
          <div>
            <div class="eyebrow">BW Barber · Relatório Executivo</div>
            <h1>Panorama do Negócio</h1>
            <div class="period">${formatDate(input.dataInicio)} até ${formatDate(input.dataFim)}</div>
          </div>
          <div class="score">
            <span class="eyebrow">Score</span>
            <strong>${input.data.score.value}/100</strong>
            <span>${input.data.score.label}</span>
          </div>
        </header>
        <div class="kpis">
          <div class="kpi"><span>Receita</span><strong>${currencyFormatter.format(entradas)}</strong></div>
          <div class="kpi"><span>Lucro</span><strong>${currencyFormatter.format(input.data.summary.lucroLiquido)}</strong></div>
          <div class="kpi"><span>Margem</span><strong>${formatPercent(input.data.margemPercentual)}</strong></div>
          <div class="kpi"><span>Comissões</span><strong>${currencyFormatter.format(input.data.summary.comissoes)}</strong></div>
        </div>
        <section>
          <h2>${tabLabels[input.tab]}</h2>
          <table>
            <thead><tr>${rows[0].map((cell) => `<th>${cell}</th>`).join('')}</tr></thead>
            <tbody>${rows.slice(1).map((row) => `<tr>${row.map((cell) => `<td>${cell ?? ''}</td>`).join('')}</tr>`).join('')}</tbody>
          </table>
        </section>
      </main>
      <script>window.addEventListener('load',function(){setTimeout(function(){window.focus();window.print();},250);});</script>
    </body>
  </html>`
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
  const entradas = data ? data.summary.receitaServicos + data.summary.receitaProdutos : 0
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

    exportHtmlReport({
      filename: `${fileBaseName}.html`,
      html: buildExecutiveHtml({
        data,
        dataFim: appliedFilters.dataFim,
        dataInicio: appliedFilters.dataInicio,
        tab: activeTab,
      }),
      previewFeatures: 'width=1024,height=1200',
    })
  }

  function exportCsv() {
    if (!data) return

    downloadCsv(`${fileBaseName}.csv`, buildExecutiveRows(data, activeTab))
  }

  return (
    <div className="min-h-screen bg-[#0f1117] p-4 text-white md:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-blue-400">
              Relatórios Executivos
            </p>
            <h1 className="text-[28px] font-bold leading-tight text-white">
              Panorama do Negócio
            </h1>
            <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-white/55">
              Análise gerencial por período, equipe, clientes, agenda e inteligência.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={!data} leftIcon={<Download size={16} />} onClick={exportPdf}>
              Exportar PDF premium
            </Button>
            <Button disabled={!data} leftIcon={<FileSpreadsheet size={16} />} onClick={exportCsv}>
              Exportar Excel
            </Button>
          </div>
        </div>

        <section className="rounded-2xl border border-white/10 bg-[#161b27] p-4">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(periodoLabels) as Periodo[]).map((item) => (
              <button
                className={[
                  'min-h-10 rounded-full border px-4 text-[13px] font-bold transition-colors',
                  periodo === item
                    ? 'border-cyan-300 bg-cyan-500 text-slate-950'
                    : 'border-white/15 bg-transparent text-white/65 hover:border-white/30',
                ].join(' ')}
                key={item}
                onClick={() => setQuickPeriodo(item)}
                type="button"
              >
                {periodoLabels[item]}
              </button>
            ))}
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <label className="space-y-2 text-sm font-semibold text-white/75">
              Data inicial
              <input
                className="h-11 w-full rounded-xl border border-white/10 bg-[#101827] px-4 text-base text-white outline-none focus:border-cyan-300 md:text-sm"
                onChange={(event) => setPendingInicio(event.target.value)}
                type="date"
                value={pendingInicio}
              />
            </label>
            <label className="space-y-2 text-sm font-semibold text-white/75">
              Data final
              <input
                className="h-11 w-full rounded-xl border border-white/10 bg-[#101827] px-4 text-base text-white outline-none focus:border-cyan-300 md:text-sm"
                onChange={(event) => setPendingFim(event.target.value)}
                type="date"
                value={pendingFim}
              />
            </label>
            <Button onClick={applyFilters} variant="secondary">
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
            <span className="rounded-full bg-white/8 px-3 py-1 text-xs font-bold text-white/60">
              PDF executivo
            </span>
          </div>
        </section>

        {reportQuery.error && (
          <div className="rounded-xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">
            Não foi possível carregar o relatório executivo: {reportQuery.error.message}
          </div>
        )}

        {reportQuery.isLoading ? (
          <div className="rounded-xl border border-white/10 bg-[#161b27] p-5 text-sm text-white/60">
            Carregando relatório executivo...
          </div>
        ) : data ? (
          <>
            <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="flex min-h-[180px] flex-col justify-between rounded-xl border border-white/8 bg-[#161b27] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40">
                  Score da operação
                </p>
                <div>
                  <span className="text-[48px] font-bold leading-none text-white">
                    {data.score.value}
                  </span>
                  <span className="text-[20px] text-white/40"> /100</span>
                </div>
                <div>
                  <p className="text-[15px] font-bold text-white">{data.score.label}</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-white/45">
                    Baseado em receita, margem, ocupação, cancelamentos e ritmo do período.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Receita período', currencyFormatter.format(entradas)],
                  ['Lucro líquido', currencyFormatter.format(data.summary.lucroLiquido)],
                  ['Margem', formatPercent(data.margemPercentual)],
                  ['Ticket médio', currencyFormatter.format(data.topBarbers[0]?.ticketMedio ?? 0)],
                  ['Clientes ativos', data.clientes.ativos],
                  ['Atendimentos', data.agenda.status.concluido],
                ].map(([label, value]) => (
                  <div className="rounded-xl border border-white/8 bg-[#161b27] p-4" key={label}>
                    <p className="text-[12px] text-white/50">{label}</p>
                    <p className="mt-1 text-[22px] font-bold leading-tight text-white">{value}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-white/10 bg-[#161b27] p-4">
              <div className="flex flex-wrap gap-2">
                {(Object.keys(tabLabels) as Tab[]).map((item) => (
                  <button
                    className={[
                      'rounded-full border px-4 py-2 text-[13px] font-bold transition-colors',
                      activeTab === item
                        ? 'border-cyan-300 bg-cyan-500 text-slate-950'
                        : 'border-white/15 bg-transparent text-white/65 hover:border-white/30',
                    ].join(' ')}
                    key={item}
                    onClick={() => setActiveTab(item)}
                    type="button"
                  >
                    {tabLabels[item]}
                  </button>
                ))}
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-white/5 text-xs uppercase tracking-[0.08em] text-white/45">
                    <tr>
                      {buildExecutiveRows(data, activeTab)[0].map((cell) => (
                        <th className="px-4 py-3" key={cell}>
                          {cell}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/8">
                    {buildExecutiveRows(data, activeTab).slice(1).map((row, index) => (
                      <tr key={`${activeTab}-${index}`}>
                        {row.map((cell, cellIndex) => (
                          <td className="px-4 py-3 text-white/75" key={`${index}-${cellIndex}`}>
                            {typeof cell === 'number' && cellIndex > 1
                              ? currencyFormatter.format(cell)
                              : cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  )
}
