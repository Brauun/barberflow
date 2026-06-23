import { useQuery } from '@tanstack/react-query'
import { Download, FileSpreadsheet, RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { getRelatorioData, type ReportData } from '../services/relatoriosService'
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

const reportTypeLabels: Record<ReportType, string> = {
  agenda: 'Agenda',
  anual: 'Anual',
  barbeiros: 'Barbeiros',
  clientes: 'Clientes',
  diario: 'Diário',
  financeiro: 'Financeiro',
  mensal: 'Mensal',
  produtos: 'Produtos',
}

const reportTypes = Object.entries(reportTypeLabels) as Array<[ReportType, string]>

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  currency: 'BRL',
  style: 'currency',
})

function todayInputValue() {
  return new Date().toISOString().slice(0, 10)
}

function monthStartInputValue() {
  const today = new Date()
  return new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)
}

function yearStartInputValue() {
  const today = new Date()
  return new Date(today.getFullYear(), 0, 1).toISOString().slice(0, 10)
}

function dateRangeForType(type: ReportType) {
  const today = todayInputValue()

  if (type === 'diario') {
    return { dataFim: today, dataInicio: today }
  }

  if (type === 'anual') {
    return { dataFim: today, dataInicio: yearStartInputValue() }
  }

  return { dataFim: today, dataInicio: monthStartInputValue() }
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR')
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

function buildRows(type: ReportType, data: ReportData) {
  if (type === 'barbeiros') {
    return [
      ['Barbeiro', 'Atendimentos', 'Faturamento', 'Comissão', 'Ticket médio', 'Cancelamentos'],
      ...data.topBarbers.map((item) => [
        item.nome,
        item.atendimentos,
        item.faturamento,
        item.comissao,
        item.ticketMedio,
        item.cancelamentos,
      ]),
    ]
  }

  if (type === 'produtos') {
    return [
      ['Produto', 'Quantidade', 'Receita', 'Estoque'],
      ...data.topProducts.map((item) => [
        item.nome,
        item.quantidade,
        item.valorTotal,
        item.estoqueAtual ?? '',
      ]),
    ]
  }

  if (type === 'clientes') {
    return [
      ['Cliente', 'Visitas', 'Total gasto', 'Última visita', 'Novo', 'Recorrente'],
      ...data.clients.map((item) => [
        item.nome,
        item.visitas,
        item.gastoTotal,
        item.ultimaVisita ? new Date(item.ultimaVisita).toLocaleDateString('pt-BR') : '',
        item.novo ? 'Sim' : 'Não',
        item.recorrente ? 'Sim' : 'Não',
      ]),
    ]
  }

  if (type === 'agenda') {
    return [
      ['Horário', 'Cliente', 'Barbeiro', 'Serviço', 'Status', 'Valor'],
      ...data.agendaItems.map((item) => [
        new Date(item.horario).toLocaleString('pt-BR'),
        item.cliente,
        item.barbeiro,
        item.servico,
        item.status,
        item.valor,
      ]),
    ]
  }

  return [
    ['Indicador', 'Valor'],
    ['Receita de serviços', data.summary.receitaServicos],
    ['Receita de produtos', data.summary.receitaProdutos],
    ['Despesas', data.summary.despesas],
    ['Lucro líquido', data.summary.lucroLiquido],
    ['Comissões', data.summary.comissoes],
  ]
}

function buildReportHtml(input: {
  data: ReportData
  dataFim: string
  dataInicio: string
  reportType: ReportType
}) {
  const rows = buildRows(input.reportType, input.data)
  const title = `Relatório ${reportTypeLabels[input.reportType]}`

  return `<!doctype html>
  <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <title>${title}</title>
      <style>
        * { box-sizing: border-box; }
        body { margin: 0; background: #f7fafc; color: #071426; font-family: Inter, Arial, sans-serif; }
        main { padding: 32px; }
        header { border-radius: 24px; background: #071426; color: white; padding: 28px; margin-bottom: 20px; }
        .eyebrow { color: #12c6f3; font-size: 11px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; }
        h1 { margin: 8px 0 6px; font-size: 30px; }
        .period { color: #b8c7dc; font-size: 13px; }
        .kpis { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 18px; }
        .kpi { background: white; border: 1px solid #dce6f2; border-radius: 16px; padding: 14px; }
        .kpi span { display: block; color: #64748b; font-size: 10px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
        .kpi strong { display: block; margin-top: 7px; font-size: 18px; }
        table { width: 100%; border-collapse: collapse; overflow: hidden; border-radius: 16px; background: white; }
        th, td { border-bottom: 1px solid #e2e8f0; padding: 11px 12px; text-align: left; font-size: 12px; }
        th { background: #edf6fb; color: #0f5f76; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; }
        tr:last-child td { border-bottom: 0; }
        @media print { body { background: white; } main { padding: 18mm; } }
      </style>
    </head>
    <body>
      <main>
        <header>
          <div class="eyebrow">BW Barber</div>
          <h1>${title}</h1>
          <div class="period">${formatDate(input.dataInicio)} até ${formatDate(input.dataFim)}</div>
        </header>
        <section class="kpis">
          <div class="kpi"><span>Serviços</span><strong>${currencyFormatter.format(input.data.summary.receitaServicos)}</strong></div>
          <div class="kpi"><span>Produtos</span><strong>${currencyFormatter.format(input.data.summary.receitaProdutos)}</strong></div>
          <div class="kpi"><span>Despesas</span><strong>${currencyFormatter.format(input.data.summary.despesas)}</strong></div>
          <div class="kpi"><span>Lucro</span><strong>${currencyFormatter.format(input.data.summary.lucroLiquido)}</strong></div>
          <div class="kpi"><span>Comissões</span><strong>${currencyFormatter.format(input.data.summary.comissoes)}</strong></div>
        </section>
        <table>
          <thead><tr>${rows[0].map((cell) => `<th>${cell}</th>`).join('')}</tr></thead>
          <tbody>
            ${rows
              .slice(1)
              .map((row) => `<tr>${row.map((cell) => `<td>${cell ?? ''}</td>`).join('')}</tr>`)
              .join('')}
          </tbody>
        </table>
      </main>
      <script>window.addEventListener('load',function(){setTimeout(function(){window.focus();window.print();},250);});</script>
    </body>
  </html>`
}

export default function RelatoriosPage() {
  const { profile } = useAuth()
  const empresaId = profile?.empresa_id
  const [reportType, setReportType] = useState<ReportType>('mensal')
  const [pendingInicio, setPendingInicio] = useState(monthStartInputValue())
  const [pendingFim, setPendingFim] = useState(todayInputValue())
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

  const fileBaseName = useMemo(
    () =>
      `BW-Barber-Relatorio-${normalizeFilePart(reportTypeLabels[reportType])}-${appliedFilters.dataInicio}-a-${appliedFilters.dataFim}`,
    [appliedFilters.dataFim, appliedFilters.dataInicio, reportType],
  )

  function selectReportType(type: ReportType) {
    setReportType(type)

    if (type === 'diario' || type === 'mensal' || type === 'anual') {
      const range = dateRangeForType(type)
      setPendingInicio(range.dataInicio)
      setPendingFim(range.dataFim)
      setAppliedFilters(range)
    }
  }

  function applyFilters() {
    if (pendingInicio > pendingFim) {
      window.alert('A data inicial não pode ser maior que a data final.')
      return
    }

    setAppliedFilters({ dataFim: pendingFim, dataInicio: pendingInicio })
  }

  function clearFilters() {
    const range = dateRangeForType(reportType)
    setPendingInicio(range.dataInicio)
    setPendingFim(range.dataFim)
    setAppliedFilters(range)
  }

  function exportPdf() {
    if (!reportQuery.data) return

    exportHtmlReport({
      filename: `${fileBaseName}.html`,
      html: buildReportHtml({
        data: reportQuery.data,
        dataFim: appliedFilters.dataFim,
        dataInicio: appliedFilters.dataInicio,
        reportType,
      }),
      previewFeatures: 'width=1024,height=1200',
    })
  }

  function exportCsv() {
    if (!reportQuery.data) return

    downloadCsv(`${fileBaseName}.csv`, buildRows(reportType, reportQuery.data))
  }

  const data = reportQuery.data
  const recordCount =
    reportType === 'barbeiros'
      ? data?.topBarbers.length ?? 0
      : reportType === 'produtos'
        ? data?.topProducts.length ?? 0
        : reportType === 'clientes'
          ? data?.clients.length ?? 0
          : reportType === 'agenda'
            ? data?.agendaItems.length ?? 0
            : data
              ? 5
              : 0

  return (
    <div className="min-h-screen bg-[#0f1117] p-4 text-white md:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-400">
            Relatórios
          </p>
          <h1 className="mt-1 text-[26px] font-bold leading-tight text-white">
            Análises do BW Barber
          </h1>
          <p className="mt-1 text-[13px] text-white/55">
            Escolha o tipo, aplique o período e exporte o relatório filtrado.
          </p>
        </div>

        <section className="rounded-2xl border border-white/10 bg-[#161b27] p-4">
          <p className="mb-3 text-[13px] font-bold text-white">Tipo de relatório</p>
          <div className="flex flex-wrap gap-2">
            {reportTypes.map(([value, label]) => (
              <button
                className={[
                  'min-h-10 rounded-full border px-4 text-[13px] font-bold transition-colors',
                  reportType === value
                    ? 'border-cyan-300 bg-cyan-500 text-slate-950'
                    : 'border-white/15 bg-transparent text-white/65 hover:border-white/30',
                ].join(' ')}
                key={value}
                onClick={() => selectReportType(value)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_auto_auto_auto_auto] md:items-end">
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
              Aplicar filtros
            </Button>
            <Button leftIcon={<RotateCcw size={16} />} onClick={clearFilters} variant="ghost">
              Limpar
            </Button>
            <Button disabled={!data} leftIcon={<Download size={16} />} onClick={exportPdf}>
              Exportar PDF
            </Button>
            <Button disabled={!data} leftIcon={<FileSpreadsheet size={16} />} onClick={exportCsv}>
              Exportar Excel
            </Button>
          </div>
        </section>

        <section>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-black md:text-2xl">
                Relatório {reportTypeLabels[reportType]}
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
                {recordCount} registros
              </span>
            </div>
          </div>

          {reportQuery.error && (
            <div className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">
              Não foi possível carregar o relatório: {reportQuery.error.message}
            </div>
          )}

          {reportQuery.isLoading ? (
            <div className="mt-4 rounded-xl border border-white/10 bg-[#161b27] p-5 text-sm text-white/60">
              Carregando relatório...
            </div>
          ) : data ? (
            <>
              <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
                {[
                  ['Receita serviços', data.summary.receitaServicos],
                  ['Receita produtos', data.summary.receitaProdutos],
                  ['Despesas', data.summary.despesas],
                  ['Lucro líquido', data.summary.lucroLiquido],
                  ['Comissões', data.summary.comissoes],
                ].map(([label, value]) => (
                  <div className="rounded-xl border border-white/10 bg-[#161b27] p-4" key={label}>
                    <p className="text-[11px] text-white/45">{label}</p>
                    <p className="mt-2 text-lg font-black">{currencyFormatter.format(Number(value))}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-[#161b27]">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="bg-white/5 text-xs uppercase tracking-[0.08em] text-white/45">
                      <tr>
                        {buildRows(reportType, data)[0].map((cell) => (
                          <th className="px-4 py-3" key={cell}>
                            {cell}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/8">
                      {buildRows(reportType, data).slice(1).map((row, index) => (
                        <tr key={`${reportType}-${index}`}>
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
              </div>
            </>
          ) : null}
        </section>
      </div>
    </div>
  )
}
