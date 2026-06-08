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
  { label: 'Diario', value: 'diario' },
  { label: 'Mensal', value: 'mensal' },
  { label: 'Anual', value: 'anual' },
  { label: 'Por barbeiro', value: 'barbeiro' },
  { label: 'Financeiro', value: 'financeiro' },
  { label: 'Produtos', value: 'produtos' },
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
    anual: 'Relatorio Anual',
    barbeiro: 'Relatorio por Barbeiro',
    diario: 'Relatorio Diario',
    financeiro: 'Relatorio Financeiro',
    mensal: 'Relatorio Mensal',
    produtos: 'Relatorio de Produtos',
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
    ['Receita de servicos', currencyFormatter.format(data.summary.receitaServicos)],
    ['Receita de produtos', currencyFormatter.format(data.summary.receitaProdutos)],
    ['Despesas', currencyFormatter.format(data.summary.despesas)],
    ['Lucro liquido', currencyFormatter.format(data.summary.lucroLiquido)],
    ['Comissoes', currencyFormatter.format(data.summary.comissoes)],
    ['Atendimentos', numberFormatter.format(atendimentos)],
    ['Ticket medio', currencyFormatter.format(ticketMedio)],
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
            <div class="eyebrow">Relatorio Executivo</div>
            <h1>${escapeHtml(title)}</h1>
            <p>Resumo consolidado do periodo para acompanhamento de performance operacional e financeira.</p>
            <span class="period">${formatDate(dataInicio)} ate ${formatDate(dataFim)}</span>
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
              <div class="eyebrow">Leitura do periodo</div>
              <h3>Resumo executivo</h3>
              <p>O periodo consolidou <span class="accent">${currencyFormatter.format(entradas)}</span> em entradas, com lucro liquido de <span class="accent">${currencyFormatter.format(data.summary.lucroLiquido)}</span> e margem de <span class="accent">${margem.toFixed(1).replace('.', ',')}%</span>.</p>
            </div>
            <div class="summary-card">
              <div class="eyebrow">Destaques</div>
              <div class="mini-list">
                <div class="mini-item"><span>Melhor barbeiro</span><strong>${topBarber ? escapeHtml(topBarber.nome) : 'Sem dados'}</strong></div>
                <div class="mini-item"><span>Produto destaque</span><strong>${topProduct ? escapeHtml(topProduct.nome) : 'Sem dados'}</strong></div>
                <div class="mini-item"><span>Ticket medio</span><strong>${currencyFormatter.format(ticketMedio)}</strong></div>
              </div>
            </div>
          </div>
          <footer class="footer"><span>BW Barber</span><span>Pagina 1 de 4</span></footer>
        </section>

        <section class="page">
          <header class="header">
            <div><div class="eyebrow">Operacional</div><h2>Detalhamento operacional</h2></div>
            <div class="meta">${formatDate(dataInicio)} ate ${formatDate(dataFim)}</div>
          </header>
          <div class="two-col">
            <div class="panel">
              <div class="panel-head"><h3>Produtos mais vendidos</h3></div>
              <table><thead><tr><th>Produto</th><th>Qtd.</th><th>Valor</th></tr></thead><tbody>${productRows || '<tr><td colspan="3">Sem vendas no periodo.</td></tr>'}</tbody></table>
            </div>
            <div class="panel">
              <div class="panel-head"><h3>Atendimentos por barbeiro</h3></div>
              <table><thead><tr><th>Barbeiro</th><th>Atend.</th><th>Faturamento</th></tr></thead><tbody>${barberRows || '<tr><td colspan="3">Sem atendimentos concluidos.</td></tr>'}</tbody></table>
            </div>
          </div>
          <footer class="footer"><span>BW Barber</span><span>Pagina 2 de 4</span></footer>
        </section>

        <section class="page">
          <header class="header">
            <div><div class="eyebrow">Financeiro</div><h2>Analise financeira</h2></div>
            <div class="meta">${escapeHtml(empresaNome)}</div>
          </header>
          <div class="kpi-grid">
            <div class="kpi"><span>Entradas</span><strong>${currencyFormatter.format(entradas)}</strong></div>
            <div class="kpi"><span>Saidas</span><strong>${currencyFormatter.format(data.summary.despesas)}</strong></div>
            <div class="kpi"><span>Comissoes</span><strong>${currencyFormatter.format(data.summary.comissoes)}</strong></div>
            <div class="kpi"><span>Lucro liquido</span><strong>${currencyFormatter.format(data.summary.lucroLiquido)}</strong></div>
          </div>
          <div class="panel">
            <div class="panel-head"><h3>Comparativo bruto x liquido</h3></div>
            <table>
              <thead><tr><th>Indicador</th><th>Valor</th><th>Observacao</th></tr></thead>
              <tbody>
                <tr><td>Receita bruta</td><td>${currencyFormatter.format(entradas)}</td><td>Servicos + produtos</td></tr>
                <tr><td>Receita liquida estimada</td><td>${currencyFormatter.format(data.summary.lucroLiquido)}</td><td>Apos despesas e comissoes</td></tr>
                <tr><td>Margem liquida</td><td>${margem.toFixed(1).replace('.', ',')}%</td><td>Lucro liquido / entradas</td></tr>
                <tr><td>Ticket medio</td><td>${currencyFormatter.format(ticketMedio)}</td><td>Receita de servicos / atendimentos</td></tr>
              </tbody>
            </table>
          </div>
          <footer class="footer"><span>BW Barber</span><span>Pagina 3 de 4</span></footer>
        </section>

        <section class="page">
          <header class="header">
            <div><div class="eyebrow">Insights</div><h2>Resumo e oportunidades</h2></div>
            <div class="meta">${escapeHtml(title)}</div>
          </header>
          <div class="insight">
            <p>O periodo gerou <span class="accent">${currencyFormatter.format(entradas)}</span> em entradas e lucro liquido de <span class="accent">${currencyFormatter.format(data.summary.lucroLiquido)}</span>.</p>
            <p>O ticket medio estimado foi de <span class="accent">${currencyFormatter.format(ticketMedio)}</span>, com <span class="accent">${numberFormatter.format(atendimentos)}</span> atendimentos concluidos registrados.</p>
          </div>
          <div class="two-col" style="margin-top: 14px;">
            <div class="insight">
              <h3>Melhor desempenho</h3>
              <p style="margin-top: 10px;">${topBarber ? `${escapeHtml(topBarber.nome)} liderou em faturamento com ${currencyFormatter.format(topBarber.faturamento)}.` : 'Nao houve barbeiro com atendimento concluido no periodo.'}</p>
            </div>
            <div class="insight">
              <h3>Produto destaque</h3>
              <p style="margin-top: 10px;">${topProduct ? `${escapeHtml(topProduct.nome)} foi o produto mais vendido, com ${numberFormatter.format(topProduct.quantidade)} unidade(s).` : 'Nao houve venda de produtos no periodo.'}</p>
            </div>
          </div>
          <div class="insight" style="margin-top: 14px;">
            <h3>Observacoes</h3>
            <p style="margin-top: 10px;">Relatorio gerado a partir dos filtros atuais do BW Barber. Use este documento para conversas com socios, contabilidade e acompanhamento gerencial.</p>
          </div>
          <footer class="footer"><span>BW Barber</span><span>Pagina 4 de 4</span></footer>
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
      'relatorios',
      empresaId,
      appliedFilters.dataInicio,
      appliedFilters.dataFim,
      appliedFilters.tipo,
    ],
  })

  const title = reportTitle(appliedFilters.tipo)
  const periodLabel = `${formatDate(appliedFilters.dataInicio)} ate ${formatDate(appliedFilters.dataFim)}`
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
      link.download = `BW-Barber-Relatorio-${appliedFilters.tipo}-${appliedFilters.dataInicio}-${appliedFilters.dataFim}.html`
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
      ['Relatorio', title],
      ['Periodo', periodLabel],
      [],
      ['Indicador', 'Valor'],
      ['Receita de servicos', data.summary.receitaServicos],
      ['Receita de produtos', data.summary.receitaProdutos],
      ['Despesas', data.summary.despesas],
      ['Lucro liquido', data.summary.lucroLiquido],
      ['Comissoes', data.summary.comissoes],
      ['Atendimentos', atendimentos],
      ['Ticket medio', ticketMedio],
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
    link.download = `BW-Barber-Relatorio-${appliedFilters.tipo}-${appliedFilters.dataInicio}-${appliedFilters.dataFim}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (!empresaId) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Complete o vinculo do usuario com uma empresa para visualizar
            relatorios.
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
            Relatorios
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-normal text-zinc-950 dark:text-zinc-50">
            Analises do BW Barber
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Escolha o tipo, ajuste o periodo e gere um PDF executivo pronto para
            enviar.
          </p>
        </div>
      </section>

      <Card className="overflow-hidden">
        <CardContent className="space-y-6">
          <div>
            <p className="text-sm font-bold text-zinc-950 dark:text-zinc-50">
              Tipo de relatorio
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
            <p className="rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm font-semibold text-slate-700">
              Exportacoes executivas e relatorios avancados exigem upgrade de
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
              <h3 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
                {title}
              </h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {periodLabel}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="warning">Periodo filtrado</Badge>
              <Badge variant="info">{numberFormatter.format(registros)} registros</Badge>
              <Badge>{reportTypes.find((item) => item.value === appliedFilters.tipo)?.label}</Badge>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            {[
              ['Receita de servicos', currencyFormatter.format(data.summary.receitaServicos)],
              ['Receita de produtos', currencyFormatter.format(data.summary.receitaProdutos)],
              ['Despesas', currencyFormatter.format(data.summary.despesas)],
              ['Lucro liquido', currencyFormatter.format(data.summary.lucroLiquido)],
              ['Comissoes', currencyFormatter.format(data.summary.comissoes)],
              ['Ticket medio', currencyFormatter.format(ticketMedio)],
            ].map(([label, value]) => (
              <Card key={label}>
                <CardContent>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
                  <p className="mt-2 text-xl font-black text-zinc-950 dark:text-zinc-50">
                    {value}
                  </p>
                </CardContent>
              </Card>
            ))}
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                  Produtos mais vendidos
                </h3>
              </CardHeader>
              <CardContent className="p-0">
                {data.topProducts.length === 0 ? (
                  <div className="p-5 text-sm text-zinc-500 dark:text-zinc-400">
                    Nenhuma venda de produto no periodo.
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
                          <TableCell className="font-medium text-zinc-950 dark:text-zinc-50">
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
                <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                  Barbeiros com maior faturamento
                </h3>
              </CardHeader>
              <CardContent className="p-0">
                {data.topBarbers.length === 0 ? (
                  <div className="p-5 text-sm text-zinc-500 dark:text-zinc-400">
                    Nenhum atendimento concluido no periodo.
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
                          <TableCell className="font-medium text-zinc-950 dark:text-zinc-50">
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
