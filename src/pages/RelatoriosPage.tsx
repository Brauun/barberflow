import { useQuery } from '@tanstack/react-query'
import { CalendarDays, FileSpreadsheet, FileText, RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Input,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { useFeatureAccess } from '../hooks/useSubscription'
import { getRelatorioData, type ReportData } from '../services/relatoriosService'
import type { RelatorioTipo } from '../types/relatorios'
import { cn } from '../utils/cn'

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  currency: 'BRL',
  style: 'currency',
})

const numberFormatter = new Intl.NumberFormat('pt-BR')

const reportTypes: Array<{ label: string; value: RelatorioTipo }> = [
  { label: 'Diário', value: 'diario' },
  { label: 'Mensal', value: 'mensal' },
  { label: 'Anual', value: 'anual' },
  { label: 'Financeiro', value: 'financeiro' },
  { label: 'Barbeiros', value: 'barbeiro' },
  { label: 'Produtos', value: 'produtos' },
  { label: 'Clientes', value: 'clientes' },
  { label: 'Agenda', value: 'agenda' },
]

function todayInputValue() {
  return new Date().toISOString().slice(0, 10)
}

function monthStartInputValue() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10)
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR')
}

function reportTitle(tipo: RelatorioTipo) {
  const labels: Record<RelatorioTipo, string> = {
    agenda: 'Relatório de Agenda',
    anual: 'Relatório Anual',
    barbeiro: 'Relatório de Barbeiros',
    clientes: 'Relatório de Clientes',
    diario: 'Relatório Diário',
    financeiro: 'Relatório Financeiro',
    mensal: 'Relatório Mensal',
    produtos: 'Relatório de Produtos',
  }

  return labels[tipo]
}

function escapeCsv(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`
}

function escapeHtml(value: string | number) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function fileSafeDate(value: string) {
  return value.slice(0, 7)
}

function absoluteAssetUrl(value: string) {
  if (value.startsWith('http') || value.startsWith('data:')) {
    return value
  }

  return new URL(value, window.location.origin).toString()
}

function buildPdfHtml(input: {
  data: ReportData
  dataFim: string
  dataInicio: string
  empresaNome: string
  logoUrl: string
  tipo: RelatorioTipo
}) {
  const { data, dataFim, dataInicio, empresaNome, logoUrl, tipo } = input
  const title = reportTitle(tipo)
  const atendimentos = data.topBarbers.reduce(
    (total, barber) => total + barber.atendimentos,
    0,
  )
  const entradas = data.summary.receitaServicos + data.summary.receitaProdutos
  const ticketMedio = atendimentos > 0 ? data.summary.receitaServicos / atendimentos : 0
  const margem = entradas > 0 ? (data.summary.lucroLiquido / entradas) * 100 : 0
  const topBarber = data.topBarbers[0]
  const topProduct = data.topProducts[0]
  const emittedAt = new Date().toLocaleString('pt-BR')

  const kpis = [
    ['Receita de serviços', currencyFormatter.format(data.summary.receitaServicos)],
    ['Receita de produtos', currencyFormatter.format(data.summary.receitaProdutos)],
    ['Despesas', currencyFormatter.format(data.summary.despesas)],
    ['Lucro líquido', currencyFormatter.format(data.summary.lucroLiquido)],
    ['Comissões', currencyFormatter.format(data.summary.comissoes)],
    ['Atendimentos', numberFormatter.format(atendimentos)],
    ['Ticket médio', currencyFormatter.format(ticketMedio)],
    ['Margem', `${margem.toFixed(1).replace('.', ',')}%`],
  ]

  const productRows = data.topProducts
    .slice(0, 8)
    .map(
      (product) => `
        <tr>
          <td>${escapeHtml(product.nome)}</td>
          <td>${numberFormatter.format(product.quantidade)}</td>
          <td>${currencyFormatter.format(product.valorTotal)}</td>
        </tr>
      `,
    )
    .join('')
  const barberRows = data.topBarbers
    .slice(0, 8)
    .map(
      (barber) => `
        <tr>
          <td>${escapeHtml(barber.nome)}</td>
          <td>${numberFormatter.format(barber.atendimentos)}</td>
          <td>${currencyFormatter.format(barber.faturamento)}</td>
        </tr>
      `,
    )
    .join('')

  return `<!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>BW-Barber-${escapeHtml(title)}-${fileSafeDate(dataInicio)}</title>
        <style>
          @page { size: A4; margin: 0; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            background: #e5edf3;
            color: #0f172a;
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .page {
            background: #ffffff;
            box-shadow: 0 18px 70px rgba(15, 23, 42, .12);
            margin: 18px auto;
            min-height: 297mm;
            overflow: hidden;
            padding: 15mm 14mm 13mm;
            page-break-after: always;
            position: relative;
            width: 210mm;
          }
          .page:last-child { page-break-after: auto; }
          .header {
            align-items: center;
            border-bottom: 1px solid #dbe7ef;
            display: flex;
            justify-content: space-between;
            min-height: 58px;
            padding-bottom: 12px;
          }
          .brand { align-items: center; display: flex; gap: 14px; }
          .logo-box {
            align-items: center;
            background: #071426;
            border-radius: 14px;
            display: flex;
            height: 44px;
            justify-content: center;
            overflow: hidden;
            width: 44px;
          }
          .logo-box img {
            display: block;
            height: 38px;
            max-width: 38px;
            object-fit: contain;
          }
          .logo-box span {
            color: #12c6f3;
            display: none;
            font-size: 14px;
            font-weight: 900;
          }
          .eyebrow {
            color: #0891b2;
            font-size: 8.5px;
            font-weight: 800;
            letter-spacing: 0.18em;
            text-transform: uppercase;
          }
          h1 {
            color: #071426;
            font-size: 24px;
            letter-spacing: -0.02em;
            line-height: 1.08;
            margin: 14px 0 6px;
          }
          h2 {
            color: #071426;
            font-size: 17px;
            margin: 18px 0 10px;
          }
          h3 { color: #071426; font-size: 12.5px; margin: 0; }
          p { color: #526176; font-size: 10.5px; line-height: 1.55; margin: 0; }
          .meta { color: #526176; font-size: 9.5px; line-height: 1.45; text-align: right; }
          .hero {
            background: linear-gradient(135deg, #071426, #0e1d32);
            border-radius: 18px;
            color: #fff;
            margin-top: 16px;
            overflow: hidden;
            padding: 18px 20px;
            position: relative;
          }
          .hero:after {
            border: 1px solid rgba(18,198,243,.18);
            border-radius: 999px;
            content: "";
            height: 128px;
            position: absolute;
            right: -46px;
            top: -58px;
            width: 128px;
          }
          .hero h1 { color: #fff; margin-top: 6px; }
          .hero p { color: #b7c8dd; max-width: 430px; }
          .period {
            background: rgba(18,198,243,.12);
            border: 1px solid rgba(18,198,243,.24);
            border-radius: 999px;
            color: #bff4ff;
            display: inline-block;
            font-size: 9.5px;
            font-weight: 800;
            margin-top: 12px;
            padding: 6px 10px;
          }
          .kpi-grid {
            display: grid;
            gap: 8px;
            grid-template-columns: repeat(4, 1fr);
            margin-top: 14px;
          }
          .kpi {
            background: #f8fbfd;
            border: 1px solid #e4edf3;
            border-radius: 12px;
            min-height: 66px;
            padding: 10px;
          }
          .kpi span {
            color: #64748b;
            display: block;
            font-size: 7.8px;
            font-weight: 800;
            letter-spacing: .08em;
            text-transform: uppercase;
          }
          .kpi strong {
            color: #071426;
            display: block;
            font-size: 13.5px;
            margin-top: 5px;
          }
          .panel {
            border: 1px solid #e4edf3;
            border-radius: 14px;
            margin-top: 12px;
            overflow: hidden;
          }
          .panel-head {
            background: #f8fbfd;
            border-bottom: 1px solid #e4edf3;
            padding: 10px 12px;
          }
          table { border-collapse: collapse; width: 100%; }
          th {
            color: #64748b;
            font-size: 8.4px;
            letter-spacing: .08em;
            padding: 9px 12px;
            text-align: left;
            text-transform: uppercase;
          }
          td {
            border-top: 1px solid #edf3f7;
            color: #172033;
            font-size: 10.2px;
            padding: 9px 12px;
          }
          .two-col { display: grid; gap: 12px; grid-template-columns: 1fr 1fr; }
          .insight {
            background: #f8fbfd;
            border: 1px solid #e4edf3;
            border-radius: 14px;
            padding: 14px;
          }
          .summary-strip {
            display: grid;
            gap: 10px;
            grid-template-columns: 1.1fr .9fr;
            margin-top: 14px;
          }
          .summary-card {
            background: #ffffff;
            border: 1px solid #e4edf3;
            border-radius: 14px;
            padding: 13px;
          }
          .summary-card p { margin-top: 8px; }
          .mini-list {
            display: grid;
            gap: 7px;
            margin-top: 9px;
          }
          .mini-item {
            align-items: center;
            background: #f8fbfd;
            border: 1px solid #edf3f7;
            border-radius: 11px;
            display: flex;
            justify-content: space-between;
            padding: 8px 10px;
          }
          .mini-item span {
            color: #64748b;
            font-size: 9.5px;
            font-weight: 700;
          }
          .mini-item strong {
            color: #071426;
            font-size: 10.5px;
          }
          .accent { color: #0891b2; font-weight: 900; }
          .footer {
            bottom: 7mm;
            color: #94a3b8;
            display: flex;
            font-size: 8.6px;
            justify-content: space-between;
            left: 14mm;
            position: absolute;
            right: 14mm;
          }
          @media print {
            body { background: #ffffff; }
            .page {
              box-shadow: none;
              margin: 0;
              min-height: 297mm;
              width: 210mm;
            }
          }
        </style>
      </head>
      <body>
        <section class="page">
          <header class="header">
            <div class="brand">
              <div class="logo-box">
                <img src="${escapeHtml(logoUrl)}" alt="BW Barber" onerror="this.style.display='none';this.nextElementSibling.style.display='block';" />
                <span>BW</span>
              </div>
              <div>
                <div class="eyebrow">BW Barber</div>
                <h3>${escapeHtml(empresaNome)}</h3>
              </div>
            </div>
            <div class="meta">
              ${escapeHtml(title)}<br />
              Emitido em ${escapeHtml(emittedAt)}
            </div>
          </header>
          <div class="hero">
            <div class="eyebrow">Relatório Executivo</div>
            <h1>${escapeHtml(title)}</h1>
            <p>Resumo consolidado do período para acompanhamento de performance operacional e financeira.</p>
            <span class="period">${formatDate(dataInicio)} até ${formatDate(dataFim)}</span>
          </div>
          <div class="kpi-grid">
            ${kpis
              .map(
                ([label, value]) => `
                  <div class="kpi">
                    <span>${escapeHtml(label)}</span>
                    <strong>${escapeHtml(value)}</strong>
                  </div>
                `,
              )
              .join('')}
          </div>
          <div class="summary-strip">
            <div class="summary-card">
              <div class="eyebrow">Leitura do período</div>
              <h3>Resumo operacional</h3>
              <p>O período consolidou <span class="accent">${currencyFormatter.format(entradas)}</span> em entradas, com lucro líquido de <span class="accent">${currencyFormatter.format(data.summary.lucroLiquido)}</span> e margem de <span class="accent">${margem.toFixed(1).replace('.', ',')}%</span>.</p>
            </div>
            <div class="summary-card">
              <div class="eyebrow">Destaques</div>
              <div class="mini-list">
                <div class="mini-item"><span>Melhor barbeiro</span><strong>${topBarber ? escapeHtml(topBarber.nome) : 'Sem dados'}</strong></div>
                <div class="mini-item"><span>Produto destaque</span><strong>${topProduct ? escapeHtml(topProduct.nome) : 'Sem dados'}</strong></div>
                <div class="mini-item"><span>Ticket médio</span><strong>${currencyFormatter.format(ticketMedio)}</strong></div>
              </div>
            </div>
          </div>
          <footer class="footer"><span>BW Barber</span><span>Página 1 de 3</span></footer>
        </section>

        <section class="page">
          <header class="header">
            <div><div class="eyebrow">Operacional</div><h2>Detalhamento operacional</h2></div>
            <div class="meta">${formatDate(dataInicio)} até ${formatDate(dataFim)}</div>
          </header>
          <div class="two-col">
            <div class="panel">
              <div class="panel-head"><h3>Produtos mais vendidos</h3></div>
              <table><thead><tr><th>Produto</th><th>Qtd.</th><th>Valor</th></tr></thead><tbody>${productRows || '<tr><td colspan="3">Sem vendas no período.</td></tr>'}</tbody></table>
            </div>
            <div class="panel">
              <div class="panel-head"><h3>Atendimentos por barbeiro</h3></div>
              <table><thead><tr><th>Barbeiro</th><th>Atend.</th><th>Faturamento</th></tr></thead><tbody>${barberRows || '<tr><td colspan="3">Sem atendimentos concluídos.</td></tr>'}</tbody></table>
            </div>
          </div>
          <footer class="footer"><span>BW Barber</span><span>Página 2 de 3</span></footer>
        </section>

        <section class="page">
          <header class="header">
            <div><div class="eyebrow">Financeiro</div><h2>Análise financeira</h2></div>
            <div class="meta">${escapeHtml(empresaNome)}</div>
          </header>
          <div class="kpi-grid">
            <div class="kpi"><span>Entradas</span><strong>${currencyFormatter.format(entradas)}</strong></div>
            <div class="kpi"><span>Saidas</span><strong>${currencyFormatter.format(data.summary.despesas)}</strong></div>
            <div class="kpi"><span>Comissões</span><strong>${currencyFormatter.format(data.summary.comissoes)}</strong></div>
            <div class="kpi"><span>Lucro líquido</span><strong>${currencyFormatter.format(data.summary.lucroLiquido)}</strong></div>
          </div>
          <div class="panel">
            <div class="panel-head"><h3>Comparativo bruto x líquido</h3></div>
            <table>
              <thead><tr><th>Indicador</th><th>Valor</th><th>Observação</th></tr></thead>
              <tbody>
                <tr><td>Receita bruta</td><td>${currencyFormatter.format(entradas)}</td><td>Serviços + produtos</td></tr>
                <tr><td>Receita líquida estimada</td><td>${currencyFormatter.format(data.summary.lucroLiquido)}</td><td>Após despesas e comissões</td></tr>
                <tr><td>Margem líquida</td><td>${margem.toFixed(1).replace('.', ',')}%</td><td>Lucro líquido / entradas</td></tr>
                <tr><td>Ticket médio</td><td>${currencyFormatter.format(ticketMedio)}</td><td>Receita de serviços / atendimentos</td></tr>
              </tbody>
            </table>
          </div>
          <footer class="footer"><span>BW Barber</span><span>Página 3 de 3</span></footer>
        </section>
        <script>
          window.addEventListener('load', function () {
            setTimeout(function () {
              window.focus();
              window.print();
            }, 250);
          });
        </script>
      </body>
    </html>`
}

export function RelatoriosPage() {
  const { profile } = useAuth()
  const empresaId = profile?.empresa_id
  const advancedReportsAccess = useFeatureAccess('HAS_ADVANCED_REPORTS')
  const [tipo, setTipo] = useState<RelatorioTipo>('mensal')
  const [dataInicio, setDataInicio] = useState(monthStartInputValue())
  const [dataFim, setDataFim] = useState(todayInputValue())
  const [appliedFilters, setAppliedFilters] = useState({
    dataFim: todayInputValue(),
    dataInicio: monthStartInputValue(),
    tipo: 'mensal' as RelatorioTipo,
  })

  const { data, error, isLoading, refetch } = useQuery({
    enabled: Boolean(empresaId),
    queryFn: () =>
      getRelatorioData(
        empresaId as string,
        appliedFilters.dataInicio,
        appliedFilters.dataFim,
      ),
    queryKey: [
      'relatórios',
      empresaId,
      appliedFilters.dataInicio,
      appliedFilters.dataFim,
    ],
  })

  const title = reportTitle(appliedFilters.tipo)
  const periodLabel = `${formatDate(appliedFilters.dataInicio)} até ${formatDate(appliedFilters.dataFim)}`
  const atendimentos = useMemo(
    () =>
      data?.topBarbers.reduce((total, barber) => total + barber.atendimentos, 0) ??
      0,
    [data?.topBarbers],
  )
  const ticketMedio =
    data && atendimentos > 0 ? data.summary.receitaServicos / atendimentos : 0
  const registros =
    (data?.topProducts.length ?? 0) + (data?.topBarbers.length ?? 0) + atendimentos

  function applyFilters() {
    setAppliedFilters({ dataFim, dataInicio, tipo })
    void refetch()
  }

  function clearFilters() {
    const nextStart = monthStartInputValue()
    const nextEnd = todayInputValue()
    setTipo('mensal')
    setDataInicio(nextStart)
    setDataFim(nextEnd)
    setAppliedFilters({ dataFim: nextEnd, dataInicio: nextStart, tipo: 'mensal' })
  }

  function exportPdf() {
    if (!data) {
      return
    }

    const html = buildPdfHtml({
      data,
      dataFim: appliedFilters.dataFim,
      dataInicio: appliedFilters.dataInicio,
      empresaNome: profile?.empresa?.nome ?? 'BW Barber',
      logoUrl: absoluteAssetUrl(
        profile?.empresa?.logo_url || '/brand/bw-barber-login-logo.png',
      ),
      tipo: appliedFilters.tipo,
    })
    const printWindow = window.open('', '_blank', 'width=900,height=1200')

    if (!printWindow) {
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `BW-Barber-Relatório-${appliedFilters.tipo}-${appliedFilters.dataInicio}-${appliedFilters.dataFim}.html`
      link.click()
      URL.revokeObjectURL(url)
      return
    }

    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
  }

  function exportExcel() {
    if (!data) {
      return
    }

    const rows = [
      ['Relatório', title],
      ['Período', periodLabel],
      [],
      ['Indicador', 'Valor'],
      ['Receita de serviços', data.summary.receitaServicos],
      ['Receita de produtos', data.summary.receitaProdutos],
      ['Despesas', data.summary.despesas],
      ['Lucro líquido', data.summary.lucroLiquido],
      ['Comissões', data.summary.comissoes],
      ['Atendimentos', atendimentos],
      ['Ticket médio', ticketMedio],
      [],
      ['Produtos mais vendidos'],
      ['Produto', 'Quantidade', 'Valor total'],
      ...data.topProducts.map((product) => [
        product.nome,
        product.quantidade,
        product.valorTotal,
      ]),
      [],
      ['Barbeiros com maior faturamento'],
      ['Barbeiro', 'Atendimentos', 'Faturamento'],
      ...data.topBarbers.map((barber) => [
        barber.nome,
        barber.atendimentos,
        barber.faturamento,
      ]),
    ]

    const csv = rows
      .map((row) => row.map((cell) => escapeCsv(cell ?? '')).join(';'))
      .join('\n')
    const blob = new Blob([`\uFEFF${csv}`], {
      type: 'text/csv;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `BW-Barber-Relatório-${appliedFilters.tipo}-${appliedFilters.dataInicio}-${appliedFilters.dataFim}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (!empresaId) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Complete o vínculo do usuário com uma empresa para visualizar
            relatórios.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-brand-600 dark:text-brand-400">
            Relatórios
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-normal text-slate-950 dark:text-white">
            Análises do BW Barber
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
            Escolha o tipo, ajuste o período e gere um PDF operacional pronto para
            enviar.
          </p>
        </div>
      </section>

      <Card className="overflow-hidden">
        <CardContent className="space-y-6">
          <div>
            <p className="text-sm font-bold text-slate-950 dark:text-white">
              Tipo de relatório
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {reportTypes.map((item) => {
                const isActive = tipo === item.value

                return (
                  <button
                    className={cn(
                      'min-h-11 rounded-full border px-4 text-sm font-black transition duration-200',
                      isActive
                        ? 'border-brand-300 bg-brand-500 text-slate-950 shadow-[0_12px_28px_rgb(18_198_243/0.22)]'
                        : 'border-slate-200 bg-white text-slate-600 hover:-translate-y-0.5 hover:border-brand-200 hover:bg-brand-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-brand-800 dark:hover:bg-brand-950/40',
                    )}
                    key={item.value}
                    onClick={() => setTipo(item.value)}
                    type="button"
                  >
                    {item.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto_auto_auto_auto] lg:items-end">
            <div className="relative">
              <Input
                label="Data inicial"
                onChange={(event) => setDataInicio(event.target.value)}
                placeholder="DD/MM/AAAA"
                type="date"
                value={dataInicio}
              />
              <CalendarDays
                className="pointer-events-none absolute bottom-3 right-3 text-slate-400"
                size={17}
              />
            </div>
            <div className="relative">
              <Input
                label="Data final"
                onChange={(event) => setDataFim(event.target.value)}
                placeholder="DD/MM/AAAA"
                type="date"
                value={dataFim}
              />
              <CalendarDays
                className="pointer-events-none absolute bottom-3 right-3 text-slate-400"
                size={17}
              />
            </div>
            <Button onClick={applyFilters} type="button" variant="secondary">
              Aplicar filtros
            </Button>
            <Button
              leftIcon={<RotateCcw size={16} />}
              onClick={clearFilters}
              type="button"
              variant="ghost"
            >
              Limpar
            </Button>
            <Button
              disabled={!data || !advancedReportsAccess.canUse}
              leftIcon={<FileText size={18} />}
              onClick={exportPdf}
              type="button"
            >
              Exportar PDF
            </Button>
            <Button
              disabled={!data || !advancedReportsAccess.canUse}
              leftIcon={<FileSpreadsheet size={18} />}
              onClick={exportExcel}
              type="button"
            >
              Exportar Excel
            </Button>
          </div>
          {!advancedReportsAccess.isLoading && !advancedReportsAccess.canUse && (
            <p className="rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm font-semibold text-slate-700 dark:border-brand-800 dark:bg-brand-950/40 dark:text-slate-200">
              Exportações em PDF e Excel exigem upgrade de
              plano.
            </p>
          )}
        </CardContent>
      </Card>

      {error && (
        <Card>
          <CardContent>
            <p className="text-sm text-red-600">{error.message}</p>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-28" />
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        </div>
      ) : data ? (
        <div className="space-y-6">
          <section className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-slate-950 dark:text-white">
                {title}
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {periodLabel}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="warning">Período filtrado</Badge>
              <Badge variant="info">{numberFormatter.format(registros)} registros</Badge>
              <Badge>{reportTypes.find((item) => item.value === appliedFilters.tipo)?.label}</Badge>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            {[
              ['Receita de serviços', currencyFormatter.format(data.summary.receitaServicos)],
              ['Receita de produtos', currencyFormatter.format(data.summary.receitaProdutos)],
              ['Despesas', currencyFormatter.format(data.summary.despesas)],
              ['Lucro líquido', currencyFormatter.format(data.summary.lucroLiquido)],
              ['Comissões', currencyFormatter.format(data.summary.comissoes)],
              ['Ticket médio', currencyFormatter.format(ticketMedio)],
            ].map(([label, value]) => (
              <Card key={label}>
                <CardContent>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
                  <p className="mt-2 text-xl font-black text-slate-950 dark:text-white">
                    {value}
                  </p>
                </CardContent>
              </Card>
            ))}
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <h3 className="text-base font-semibold text-slate-950 dark:text-white">
                  Produtos mais vendidos
                </h3>
              </CardHeader>
              <CardContent className="p-0">
                {data.topProducts.length === 0 ? (
                  <div className="p-5 text-sm text-slate-500 dark:text-slate-400">
                    Nenhuma venda de produto no período.
                  </div>
                ) : (
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableHeaderCell>Produto</TableHeaderCell>
                        <TableHeaderCell>Quantidade</TableHeaderCell>
                        <TableHeaderCell>Valor total</TableHeaderCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.topProducts.map((product) => (
                        <TableRow key={product.nome}>
                          <TableCell className="font-medium text-slate-950 dark:text-white">
                            {product.nome}
                          </TableCell>
                          <TableCell>{product.quantidade}</TableCell>
                          <TableCell>
                            {currencyFormatter.format(product.valorTotal)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h3 className="text-base font-semibold text-slate-950 dark:text-white">
                  Barbeiros com maior faturamento
                </h3>
              </CardHeader>
              <CardContent className="p-0">
                {data.topBarbers.length === 0 ? (
                  <div className="p-5 text-sm text-slate-500 dark:text-slate-400">
                    Nenhum atendimento concluído no período.
                  </div>
                ) : (
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableHeaderCell>Barbeiro</TableHeaderCell>
                        <TableHeaderCell>Atendimentos</TableHeaderCell>
                        <TableHeaderCell>Faturamento</TableHeaderCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.topBarbers.map((barber) => (
                        <TableRow key={barber.nome}>
                          <TableCell className="font-medium text-slate-950 dark:text-white">
                            {barber.nome}
                          </TableCell>
                          <TableCell>{barber.atendimentos}</TableCell>
                          <TableCell>
                            {currencyFormatter.format(barber.faturamento)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </section>

        </div>
      ) : null}
    </div>
  )
}
