import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  BarChart3,
  CalendarDays,
  Crown,
  Download,
  LineChart,
  Package,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Badge, Button, Card, CardContent, CardHeader, Skeleton } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { useFeatureAccess } from '../hooks/useSubscription'
import {
  getExecutiveRelatorioData,
  type ExecutiveReportData,
} from '../services/relatoriosService'
import { cn } from '../utils/cn'

type ExecutiveTab =
  | 'resumo'
  | 'financeiro'
  | 'equipe'
  | 'clientes'
  | 'agenda'
  | 'produtos'
  | 'previsões'

type QuickFilter = 'hoje' | '7d' | '30d' | 'mensal' | 'anual' | 'custom'

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  currency: 'BRL',
  style: 'currency',
})

const numberFormatter = new Intl.NumberFormat('pt-BR')

const tabs: Array<{ icon: typeof BarChart3; label: string; value: ExecutiveTab }> = [
  { icon: BarChart3, label: 'Resumo Executivo', value: 'resumo' },
  { icon: Wallet, label: 'Financeiro', value: 'financeiro' },
  { icon: Crown, label: 'Equipe', value: 'equipe' },
  { icon: Users, label: 'Clientes', value: 'clientes' },
  { icon: CalendarDays, label: 'Agenda', value: 'agenda' },
  { icon: Package, label: 'Produtos', value: 'produtos' },
  { icon: LineChart, label: 'Previsões', value: 'previsões' },
]

const quickFilters: Array<{ label: string; value: QuickFilter }> = [
  { label: 'Hoje', value: 'hoje' },
  { label: '7 dias', value: '7d' },
  { label: '30 dias', value: '30d' },
  { label: 'Mensal', value: 'mensal' },
  { label: 'Anual', value: 'anual' },
  { label: 'Personalizado', value: 'custom' },
]

function dateInputValue(date: Date) {
  return date.toISOString().slice(0, 10)
}

function todayInputValue() {
  return dateInputValue(new Date())
}

function monthStartInputValue() {
  const now = new Date()
  return dateInputValue(new Date(now.getFullYear(), now.getMonth(), 1))
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR')
}

function getQuickFilterRange(filter: QuickFilter) {
  const now = new Date()
  const end = dateInputValue(now)
  const start = new Date(now)

  if (filter === 'hoje') {
    return { dataFim: end, dataInicio: end }
  }

  if (filter === '7d') {
    start.setDate(now.getDate() - 6)
    return { dataFim: end, dataInicio: dateInputValue(start) }
  }

  if (filter === '30d') {
    start.setDate(now.getDate() - 29)
    return { dataFim: end, dataInicio: dateInputValue(start) }
  }

  if (filter === 'anual') {
    return {
      dataFim: end,
      dataInicio: dateInputValue(new Date(now.getFullYear(), 0, 1)),
    }
  }

  return { dataFim: end, dataInicio: monthStartInputValue() }
}

function percent(value: number) {
  return `${value.toFixed(1).replace('.', ',')}%`
}

function growth(current: number, previous: number) {
  if (previous <= 0) {
    return current > 0 ? 100 : 0
  }

  return ((current - previous) / previous) * 100
}

function escapeHtml(value: string | number) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function absoluteAssetUrl(value: string) {
  if (value.startsWith('http') || value.startsWith('data:')) {
    return value
  }

  return new URL(value, window.location.origin).toString()
}

function buildExecutivePdfHtml(input: {
  data: ExecutiveReportData
  dataFim: string
  dataInicio: string
  empresaNome: string
  logoUrl: string
}) {
  const { data, dataFim, dataInicio, empresaNome, logoUrl } = input
  const entradas = data.summary.receitaServicos + data.summary.receitaProdutos
  const previousEntradas =
    data.periodoAnterior.summary.receitaServicos +
    data.periodoAnterior.summary.receitaProdutos
  const crescimento = growth(entradas, previousEntradas)
  const emittedAt = new Date().toLocaleString('pt-BR')
  const kpis = [
    ['Score', `${data.score.value}/100`],
    ['Receita', currencyFormatter.format(entradas)],
    ['Lucro líquido', currencyFormatter.format(data.summary.lucroLiquido)],
    ['Margem', percent(data.margemPercentual)],
    ['Comissões', currencyFormatter.format(data.summary.comissoes)],
    ['Atendimentos', numberFormatter.format(data.agenda.status.concluido)],
    ['Clientes ativos', numberFormatter.format(data.clientes.ativos)],
    ['Ticket médio', currencyFormatter.format(data.agenda.status.concluido ? data.summary.receitaServicos / data.agenda.status.concluido : 0)],
  ]
  const teamRows = data.equipe
    .slice(0, 8)
    .map(
      (barber, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(barber.nome)}</td>
          <td>${numberFormatter.format(barber.atendimentos)}</td>
          <td>${currencyFormatter.format(barber.faturamento)}</td>
          <td>${currencyFormatter.format(barber.comissao)}</td>
          <td>${numberFormatter.format(barber.cancelamentos)}</td>
        </tr>
      `,
    )
    .join('')
  const clientRows = data.clientes.topClientes
    .slice(0, 8)
    .map(
      (client) => `
        <tr>
          <td>${escapeHtml(client.nome)}</td>
          <td>${numberFormatter.format(client.visitas)}</td>
          <td>${currencyFormatter.format(client.gastoTotal)}</td>
          <td>${client.ultimaVisita ? new Date(client.ultimaVisita).toLocaleDateString('pt-BR') : '-'}</td>
        </tr>
      `,
    )
    .join('')
  const productRows = data.produtos.maisVendidos
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

  return `<!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>BW-Barber-Relatório-Executivo-${escapeHtml(dataInicio)}-${escapeHtml(dataFim)}</title>
        <style>
          @page { size: A4; margin: 0; }
          * { box-sizing: border-box; }
          body {
            background: #071426;
            color: #0f172a;
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            margin: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .page {
            background: #f8fbfd;
            margin: 0 auto;
            min-height: 297mm;
            overflow: hidden;
            padding: 14mm;
            page-break-after: always;
            position: relative;
            width: 210mm;
          }
          .cover {
            background:
              radial-gradient(circle at 88% 10%, rgba(18,198,243,.24), transparent 24%),
              linear-gradient(145deg, #071426 0%, #0e1d32 68%, #0b1728 100%);
            color: #fff;
          }
          .header {
            align-items: center;
            display: flex;
            justify-content: space-between;
            min-height: 54px;
          }
          .brand { align-items: center; display: flex; gap: 13px; }
          .logo {
            align-items: center;
            background: rgba(255,255,255,.06);
            border: 1px solid rgba(255,255,255,.12);
            border-radius: 18px;
            display: flex;
            height: 52px;
            justify-content: center;
            overflow: hidden;
            width: 52px;
          }
          .logo img { height: 44px; max-width: 44px; object-fit: contain; }
          .eyebrow {
            color: #12c6f3;
            font-size: 8.5px;
            font-weight: 900;
            letter-spacing: .22em;
            text-transform: uppercase;
          }
          h1 { font-size: 42px; letter-spacing: -.04em; line-height: .98; margin: 44px 0 14px; }
          h2 { color: #071426; font-size: 22px; letter-spacing: -.03em; margin: 18px 0 12px; }
          h3 { margin: 0; }
          p { color: #64748b; font-size: 10.5px; line-height: 1.58; margin: 0; }
          .cover p { color: #bfd3e6; max-width: 510px; }
          .period {
            background: rgba(18,198,243,.12);
            border: 1px solid rgba(18,198,243,.26);
            border-radius: 999px;
            color: #c9f7ff;
            display: inline-flex;
            font-size: 10px;
            font-weight: 900;
            margin-top: 18px;
            padding: 8px 12px;
          }
          .score {
            align-items: center;
            border: 1px solid rgba(18,198,243,.28);
            border-radius: 26px;
            bottom: 36mm;
            display: flex;
            gap: 18px;
            left: 14mm;
            padding: 18px;
            position: absolute;
            right: 14mm;
          }
          .score strong { color: #fff; font-size: 46px; letter-spacing: -.04em; }
          .grid { display: grid; gap: 9px; grid-template-columns: repeat(4, 1fr); }
          .kpi {
            background: #fff;
            border: 1px solid #e1ebf2;
            border-radius: 14px;
            min-height: 72px;
            padding: 11px;
          }
          .kpi span {
            color: #64748b;
            display: block;
            font-size: 7.8px;
            font-weight: 900;
            letter-spacing: .08em;
            text-transform: uppercase;
          }
          .kpi strong { color: #071426; display: block; font-size: 14px; margin-top: 7px; }
          .panel {
            background: #fff;
            border: 1px solid #e1ebf2;
            border-radius: 16px;
            margin-top: 12px;
            overflow: hidden;
          }
          .panel-head { border-bottom: 1px solid #e1ebf2; padding: 12px; }
          table { border-collapse: collapse; width: 100%; }
          th {
            color: #64748b;
            font-size: 8px;
            letter-spacing: .08em;
            padding: 8px 11px;
            text-align: left;
            text-transform: uppercase;
          }
          td { border-top: 1px solid #edf3f7; color: #172033; font-size: 9.8px; padding: 8px 11px; }
          .two { display: grid; gap: 12px; grid-template-columns: 1fr 1fr; }
          .insight {
            background: #fff;
            border: 1px solid #e1ebf2;
            border-radius: 16px;
            padding: 14px;
          }
          .insight p { margin-top: 8px; }
          .accent { color: #0891b2; font-weight: 900; }
          .footer {
            bottom: 8mm;
            color: #94a3b8;
            display: flex;
            font-size: 8.6px;
            justify-content: space-between;
            left: 14mm;
            position: absolute;
            right: 14mm;
          }
          .cover .footer { color: #90a9c6; }
          @media print {
            body { background: #fff; }
            .page { margin: 0; }
          }
        </style>
      </head>
      <body>
        <section class="page cover">
          <header class="header">
            <div class="brand">
              <div class="logo"><img src="${escapeHtml(logoUrl)}" alt="BW Barber" /></div>
              <div>
                <div class="eyebrow">BW Barber</div>
                <h3>${escapeHtml(empresaNome)}</h3>
              </div>
            </div>
            <div style="color:#9fb6d1;font-size:10px;text-align:right;">Emitido em ${escapeHtml(emittedAt)}<br />Relatório Executivo BW Pro</div>
          </header>
          <h1>Panorama<br />do Negócio</h1>
          <p>Relatório executivo para tomada de decisao, combinando financeiro, equipe, clientes, agenda, produtos e previsões operacionais.</p>
          <span class="period">${formatDate(dataInicio)} até ${formatDate(dataFim)}</span>
          <div class="score">
            <strong>${data.score.value}/100</strong>
            <div>
              <div class="eyebrow">Score da operação</div>
              <h3>${escapeHtml(data.score.label)}</h3>
              <p>Crescimento do período: <span class="accent">${percent(crescimento)}</span>. Margem operacional: <span class="accent">${percent(data.margemPercentual)}</span>.</p>
            </div>
          </div>
          <footer class="footer"><span>Gerado por BW Barber</span><span>Página 1 de 4</span></footer>
        </section>
        <section class="page">
          <header class="header"><div><div class="eyebrow">Resumo Executivo</div><h2>KPIs principais</h2></div><p>${formatDate(dataInicio)} até ${formatDate(dataFim)}</p></header>
          <div class="grid">${kpis.map(([label, value]) => `<div class="kpi"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('')}</div>
          <div class="two" style="margin-top:14px;">
            <div class="insight"><div class="eyebrow">Insight financeiro</div><p>Receita de <span class="accent">${currencyFormatter.format(entradas)}</span>, com lucro líquido de <span class="accent">${currencyFormatter.format(data.summary.lucroLiquido)}</span>.</p></div>
            <div class="insight"><div class="eyebrow">Insight operacional</div><p>Ocupação estimada de <span class="accent">${percent(data.agenda.ocupacaoPercentual)}</span> e <span class="accent">${numberFormatter.format(data.agenda.status.concluido)}</span> atendimentos concluídos.</p></div>
          </div>
          <div class="panel"><div class="panel-head"><h3>Equipe e comissões</h3></div><table><thead><tr><th>#</th><th>Barbeiro</th><th>Atend.</th><th>Faturamento</th><th>Comissão</th><th>Cancel.</th></tr></thead><tbody>${teamRows || '<tr><td colspan="6">Sem dados no período.</td></tr>'}</tbody></table></div>
          <footer class="footer"><span>Gerado por BW Barber</span><span>Página 2 de 4</span></footer>
        </section>
        <section class="page">
          <header class="header"><div><div class="eyebrow">Clientes e Produtos</div><h2>Fidelização e estoque</h2></div><p>${escapeHtml(empresaNome)}</p></header>
          <div class="two">
            <div class="panel" style="margin-top:0;"><div class="panel-head"><h3>Top clientes</h3></div><table><thead><tr><th>Cliente</th><th>Visitas</th><th>Total</th><th>Ultima visita</th></tr></thead><tbody>${clientRows || '<tr><td colspan="4">Sem clientes no período.</td></tr>'}</tbody></table></div>
            <div class="panel" style="margin-top:0;"><div class="panel-head"><h3>Produtos mais vendidos</h3></div><table><thead><tr><th>Produto</th><th>Qtd.</th><th>Valor</th></tr></thead><tbody>${productRows || '<tr><td colspan="3">Sem vendas no período.</td></tr>'}</tbody></table></div>
          </div>
          <div class="insight" style="margin-top:14px;"><div class="eyebrow">Alertas</div><p>${data.produtos.baixoEstoque} produto(s) em baixo estoque. Retenção estimada de clientes no período: <span class="accent">${percent(data.clientes.retencaoPercentual)}</span>.</p></div>
          <footer class="footer"><span>Gerado por BW Barber</span><span>Página 3 de 4</span></footer>
        </section>
        <section class="page">
          <header class="header"><div><div class="eyebrow">Previsões</div><h2>Projeção do negócio</h2></div><p>Baseada no ritmo do período</p></header>
          <div class="grid">
            <div class="kpi"><span>30 dias</span><strong>${currencyFormatter.format(data.previsao.receita30Dias)}</strong></div>
            <div class="kpi"><span>90 dias</span><strong>${currencyFormatter.format(data.previsao.receita90Dias)}</strong></div>
            <div class="kpi"><span>12 meses</span><strong>${currencyFormatter.format(data.previsao.receita12Meses)}</strong></div>
            <div class="kpi"><span>Lucro 30 dias</span><strong>${currencyFormatter.format(data.previsao.lucro30Dias)}</strong></div>
          </div>
          <div class="insight" style="margin-top:14px;"><div class="eyebrow">Leitura executiva</div><p>Se continuar nesse ritmo, a receita estimada para os próximos 30 dias é <span class="accent">${currencyFormatter.format(data.previsao.receita30Dias)}</span>. Use este número como referência de meta operacional, não como garantia de faturamento.</p></div>
          <footer class="footer"><span>Gerado por BW Barber</span><span>Página 4 de 4</span></footer>
        </section>
        <script>window.addEventListener('load',function(){setTimeout(function(){window.focus();window.print();},250);});</script>
      </body>
    </html>`
}

function KpiCard({
  label,
  tone = 'default',
  value,
}: {
  label: string
  tone?: 'default' | 'good' | 'warn'
  value: string
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent>
        <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
        <p
          className={cn(
            'mt-2 text-2xl font-black text-slate-950 dark:text-white',
            tone === 'good' && 'text-emerald-600 dark:text-emerald-300',
            tone === 'warn' && 'text-amber-600 dark:text-amber-300',
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  )
}

function MiniBar({ label, max, value }: { label: string; max: number; value: number }) {
  const width = max > 0 ? Math.max(4, (value / max) * 100) : 0

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold text-slate-700 dark:text-slate-200">{label}</span>
        <span className="text-slate-500 dark:text-slate-400">{currencyFormatter.format(value)}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className="h-2 rounded-full bg-brand-500 shadow-[0_8px_24px_rgb(18_198_243/0.26)]"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  )
}

function UpgradeState() {
  const navigate = useNavigate()

  return (
    <Card className="overflow-hidden border-brand-100 bg-gradient-to-br from-slate-950 to-slate-900 text-white dark:border-brand-400/20">
      <CardContent className="grid gap-8 p-8 lg:grid-cols-[1fr_0.65fr] lg:p-10">
        <div>
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-brand-300">
            BW Pro
          </p>
          <h2 className="mt-4 max-w-2xl text-3xl font-black leading-tight text-white sm:text-4xl">
            Torne sua gestao mais inteligente com os Relatórios Executivos BW Pro.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
            Acompanhe score da operação, previsões, performance da equipe,
            fidelização de clientes e PDF executivo pronto para decisao.
          </p>
          <Button
            className="mt-7 bg-brand-500 text-slate-950 hover:bg-brand-400"
            leftIcon={<Sparkles size={18} />}
            onClick={() => navigate('/app/assinatura')}
          >
            Conhecer BW Pro
          </Button>
        </div>
        <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
          {['Score 0-100', 'Insights automáticos', 'PDF premium', 'Previsões'].map(
            (item) => (
              <div
                className="flex items-center justify-between border-b border-white/10 py-3 text-sm font-bold last:border-0"
                key={item}
              >
                <span>{item}</span>
                <span className="text-brand-300">BW Pro</span>
              </div>
            ),
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function RelatoriosExecutivosPage() {
  const { profile } = useAuth()
  const empresaId = profile?.empresa_id
  const executiveAccess = useFeatureAccess('HAS_EXECUTIVE_REPORTS')
  const [activeTab, setActiveTab] = useState<ExecutiveTab>('resumo')
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('mensal')
  const [dataInicio, setDataInicio] = useState(monthStartInputValue())
  const [dataFim, setDataFim] = useState(todayInputValue())
  const [appliedFilters, setAppliedFilters] = useState({
    dataFim: todayInputValue(),
    dataInicio: monthStartInputValue(),
  })

  const reportQuery = useQuery({
    enabled: Boolean(empresaId && executiveAccess.canUse),
    queryFn: () =>
      getExecutiveRelatorioData(
        empresaId as string,
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
  const periodLabel = `${formatDate(appliedFilters.dataInicio)} até ${formatDate(appliedFilters.dataFim)}`
  const entradas = data ? data.summary.receitaServicos + data.summary.receitaProdutos : 0
  const previousEntradas = data
    ? data.periodoAnterior.summary.receitaServicos +
      data.periodoAnterior.summary.receitaProdutos
    : 0
  const crescimento = data ? growth(entradas, previousEntradas) : 0
  const ticketMedio =
    data && data.agenda.status.concluido
      ? data.summary.receitaServicos / data.agenda.status.concluido
      : 0
  const maxSeries = Math.max(...(data?.series.map((point) => point.receita) ?? [0]))

  function setQuickRange(filter: QuickFilter) {
    setQuickFilter(filter)

    if (filter === 'custom') {
      return
    }

    const range = getQuickFilterRange(filter)
    setDataInicio(range.dataInicio)
    setDataFim(range.dataFim)
    setAppliedFilters(range)
  }

  function applyFilters() {
    setQuickFilter('custom')
    setAppliedFilters({ dataFim, dataInicio })
  }

  function exportPdf() {
    if (!data) {
      return
    }

    const html = buildExecutivePdfHtml({
      data,
      dataFim: appliedFilters.dataFim,
      dataInicio: appliedFilters.dataInicio,
      empresaNome: profile?.empresa?.nome ?? 'BW Barber',
      logoUrl: absoluteAssetUrl(
        profile?.empresa?.logo_url || '/brand/bw-barber-login-logo.png',
      ),
    })
    const printWindow = window.open('', '_blank', 'width=920,height=1200')

    if (!printWindow) {
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `BW-Barber-Relatório-Executivo-${appliedFilters.dataInicio}-${appliedFilters.dataFim}.html`
      link.click()
      URL.revokeObjectURL(url)
      return
    }

    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
  }

  const insights = useMemo(() => {
    if (!data) {
      return []
    }

    const topBarber = data.equipe[0]
    const topProduct = data.produtos.maisVendidos[0]
    const topClient = data.clientes.topClientes[0]

    return [
      crescimento >= 0
        ? `Receita aumentou ${percent(crescimento)} em relação ao período anterior.`
        : `Receita caiu ${percent(Math.abs(crescimento))} em relação ao período anterior.`,
      topBarber
        ? `${topBarber.nome} gerou ${percent(entradas ? (topBarber.faturamento / entradas) * 100 : 0)} do faturamento.`
        : 'Ainda não ha barbeiro com faturamento concluído no período.',
      data.margemPercentual >= 15
        ? 'Nível financeiro saudável para o período analisado.'
        : 'Diminua despesas ou revise preços para recuperar margem.',
      topProduct
        ? `${topProduct.nome} lidera produtos, com ${numberFormatter.format(topProduct.quantidade)} venda(s).`
        : 'Produtos ainda não tiveram venda registrada no período.',
      topClient
        ? `${topClient.nome} e o cliente de maior valor no período.`
        : 'Ainda não ha ranking de clientes para este período.',
    ]
  }, [crescimento, data, entradas])

  if (!empresaId) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-slate-500">
            Complete o vínculo do usuário com uma empresa para visualizar os relatórios.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (executiveAccess.isLoading) {
    return <Skeleton className="h-72" />
  }

  if (!executiveAccess.canUse) {
    return <UpgradeState />
  }

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-brand-600 dark:text-brand-400">
            Relatórios Executivos
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-normal text-slate-950 dark:text-white">
            Panorama do Negócio
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
            Analise gerencial para decidir preço, equipe, agenda, estoque e previsão
            de receita com dados reais do BW Barber.
          </p>
        </div>
        <Button
          disabled={!data}
          leftIcon={<Download size={18} />}
          onClick={exportPdf}
        >
          Exportar PDF premium
        </Button>
      </section>

      <Card>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {quickFilters.map((filter) => (
              <button
                className={cn(
                  'min-h-11 rounded-full border px-4 text-sm font-black transition duration-200',
                  quickFilter === filter.value
                    ? 'border-brand-300 bg-brand-500 text-slate-950 shadow-[0_12px_28px_rgb(18_198_243/0.22)]'
                    : 'border-slate-200 bg-white text-slate-600 hover:-translate-y-0.5 hover:border-brand-200 hover:bg-brand-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-brand-700 dark:hover:bg-brand-950/40',
                )}
                key={filter.value}
                onClick={() => setQuickRange(filter.value)}
                type="button"
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <label className="space-y-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              Data inicial
              <input
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base text-slate-950 outline-none transition focus:border-brand-300 focus:ring-4 focus:ring-brand-100 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:focus:ring-brand-400/10"
                onChange={(event) => setDataInicio(event.target.value)}
                type="date"
                value={dataInicio}
              />
            </label>
            <label className="space-y-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              Data final
              <input
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base text-slate-950 outline-none transition focus:border-brand-300 focus:ring-4 focus:ring-brand-100 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:focus:ring-brand-400/10"
                onChange={(event) => setDataFim(event.target.value)}
                type="date"
                value={dataFim}
              />
            </label>
            <Button onClick={applyFilters} variant="secondary">
              Aplicar período
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">{periodLabel}</Badge>
            <Badge variant="success">BW Pro e superior</Badge>
            <Badge>PDF executivo</Badge>
          </div>
        </CardContent>
      </Card>

      {reportQuery.error && (
        <Card>
          <CardContent>
            <p className="text-sm text-red-600">{reportQuery.error.message}</p>
          </CardContent>
        </Card>
      )}

      {reportQuery.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-60" />
          <div className="grid gap-4 md:grid-cols-4">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
        </div>
      ) : data ? (
        <>
          <section className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
            <Card className="overflow-hidden bg-slate-950 text-white dark:bg-slate-900">
              <CardContent className="relative p-7">
                <div className="absolute right-[-3rem] top-[-3rem] h-40 w-40 rounded-full border border-brand-400/20" />
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-brand-300">
                  Score da operação
                </p>
                <div className="mt-5 flex items-end gap-4">
                  <span className="text-6xl font-black tracking-tight">
                    {data.score.value}
                  </span>
                  <span className="pb-2 text-lg font-black text-slate-400">/100</span>
                </div>
                <p className="mt-3 text-xl font-black text-white">{data.score.label}</p>
                <p className="mt-2 max-w-md text-sm leading-6 text-slate-300">
                  Baseado em receita, margem, ocupação, cancelamentos e ritmo do
                  período.
                </p>
              </CardContent>
            </Card>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                label="Receita período"
                tone={crescimento >= 0 ? 'good' : 'warn'}
                value={currencyFormatter.format(entradas)}
              />
              <KpiCard
                label="Lucro líquido"
                tone={data.summary.lucroLiquido >= 0 ? 'good' : 'warn'}
                value={currencyFormatter.format(data.summary.lucroLiquido)}
              />
              <KpiCard label="Margem" value={percent(data.margemPercentual)} />
              <KpiCard label="Ticket médio" value={currencyFormatter.format(ticketMedio)} />
              <KpiCard label="Comissoes" value={currencyFormatter.format(data.summary.comissoes)} />
              <KpiCard label="Clientes ativos" value={numberFormatter.format(data.clientes.ativos)} />
              <KpiCard label="Atendimentos" value={numberFormatter.format(data.agenda.status.concluido)} />
              <KpiCard label="Crescimento" value={percent(crescimento)} />
            </section>
          </section>

          <Card>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon
                  const isActive = activeTab === tab.value

                  return (
                    <button
                      className={cn(
                        'inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-black transition duration-200',
                        isActive
                          ? 'border-slate-950 bg-slate-950 text-white dark:border-brand-400 dark:bg-brand-500 dark:text-slate-950'
                          : 'border-slate-200 bg-white text-slate-600 hover:-translate-y-0.5 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900',
                      )}
                      key={tab.value}
                      onClick={() => setActiveTab(tab.value)}
                      type="button"
                    >
                      <Icon size={16} />
                      {tab.label}
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {activeTab === 'resumo' && (
            <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <Card>
                <CardHeader>
                  <h3 className="text-lg font-black text-slate-950 dark:text-white">
                    Fluxo de receita
                  </h3>
                </CardHeader>
                <CardContent>
                  <div className="flex h-72 items-end gap-3">
                    {data.series.map((point) => (
                      <div className="flex flex-1 flex-col items-center gap-3" key={point.label}>
                        <div className="flex h-52 w-full items-end rounded-full bg-slate-100 p-1 dark:bg-slate-800">
                          <div
                            className="w-full rounded-full bg-brand-500"
                            style={{
                              height: `${maxSeries > 0 ? Math.max(6, (point.receita / maxSeries) * 100) : 6}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs font-bold text-slate-500">{point.label}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <h3 className="text-lg font-black text-slate-950 dark:text-white">
                    Insights automáticos
                  </h3>
                </CardHeader>
                <CardContent className="space-y-3">
                  {insights.map((insight) => (
                    <div
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
                      key={insight}
                    >
                      {insight}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </section>
          )}

          {activeTab === 'financeiro' && (
            <section className="grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <h3 className="text-lg font-black text-slate-950 dark:text-white">
                    Saude Financeira
                  </h3>
                </CardHeader>
                <CardContent className="space-y-4">
                  <MiniBar label="Receita servicos" max={entradas} value={data.summary.receitaServicos} />
                  <MiniBar label="Receita produtos" max={entradas} value={data.summary.receitaProdutos} />
                  <MiniBar label="Despesas" max={entradas} value={data.summary.despesas} />
                  <MiniBar label="Comissoes" max={entradas} value={data.summary.comissoes} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <h3 className="text-lg font-black text-slate-950 dark:text-white">
                    Leitura executiva
                  </h3>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <KpiCard label="Saldo" value={currencyFormatter.format(data.summary.lucroLiquido)} />
                  <KpiCard label="Margem operacional" value={percent(data.margemPercentual)} />
                  <KpiCard label="Ocupação" value={percent(data.agenda.ocupacaoPercentual)} />
                  <KpiCard label="Ociosidade" value={percent(data.agenda.ociosidadePercentual)} />
                </CardContent>
              </Card>
            </section>
          )}

          {activeTab === 'equipe' && (
            <Card>
              <CardHeader>
                <h3 className="text-lg font-black text-slate-950 dark:text-white">
                  Equipe e Comissões
                </h3>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.equipe.length === 0 ? (
                  <p className="text-sm text-slate-500">Sem dados de equipe no período.</p>
                ) : (
                  data.equipe.map((barber, index) => (
                    <div
                      className="grid gap-4 rounded-[1.35rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 md:grid-cols-[auto_1fr_repeat(5,auto)] md:items-center"
                      key={barber.nome}
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-sm font-black text-brand-700 dark:bg-brand-400/10 dark:text-brand-200">
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-black text-slate-950 dark:text-white">{barber.nome}</p>
                        <p className="text-sm text-slate-500">Tempo médio {barber.tempoMedio}min</p>
                      </div>
                      <Badge>{barber.atendimentos} atend.</Badge>
                      <Badge variant="info">{currencyFormatter.format(barber.faturamento)}</Badge>
                      <Badge variant="success">{currencyFormatter.format(barber.comissao)}</Badge>
                      <Badge variant="warning">{currencyFormatter.format(barber.ticketMedio)} ticket</Badge>
                      <Badge variant={barber.cancelamentos ? 'danger' : 'success'}>
                        {barber.cancelamentos} cancel.
                      </Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === 'clientes' && (
            <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                <KpiCard label="Novos clientes" value={numberFormatter.format(data.clientes.novos)} />
                <KpiCard label="Retenção" value={percent(data.clientes.retencaoPercentual)} />
                <KpiCard label="Clientes inativos" value={numberFormatter.format(data.clientes.inativos)} />
              </div>
              <Card>
                <CardHeader>
                  <h3 className="text-lg font-black text-slate-950 dark:text-white">
                    Top clientes
                  </h3>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.clientes.topClientes.length === 0 ? (
                    <p className="text-sm text-slate-500">Sem clientes com visitas no período.</p>
                  ) : (
                    data.clientes.topClientes.map((client) => (
                      <div
                        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"
                        key={client.nome}
                      >
                        <div>
                          <p className="font-black text-slate-950 dark:text-white">{client.nome}</p>
                          <p className="text-sm text-slate-500">{client.visitas} visita(s)</p>
                        </div>
                        <p className="text-lg font-black text-brand-600">
                          {currencyFormatter.format(client.gastoTotal)}
                        </p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </section>
          )}

          {activeTab === 'agenda' && (
            <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                <KpiCard label="Concluidos" value={numberFormatter.format(data.agenda.status.concluido)} />
                <KpiCard label="Cancelados" value={numberFormatter.format(data.agenda.status.cancelado)} />
                <KpiCard label="Ocupação" value={percent(data.agenda.ocupacaoPercentual)} />
              </div>
              <Card>
                <CardHeader>
                  <h3 className="text-lg font-black text-slate-950 dark:text-white">
                    Heatmap de demanda
                  </h3>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  {data.agenda.heatmap.length === 0 ? (
                    <p className="text-sm text-slate-500">Sem horários registrados no período.</p>
                  ) : (
                    data.agenda.heatmap.map((item) => (
                      <div
                        className="rounded-2xl border border-brand-100 bg-brand-50 p-4 dark:border-brand-400/20 dark:bg-brand-400/10"
                        key={`${item.dia}-${item.hora}`}
                      >
                        <p className="text-sm font-bold text-slate-500 dark:text-slate-300">
                          {item.dia} as {item.hora}
                        </p>
                        <p className="mt-2 text-2xl font-black text-slate-950 dark:text-white">
                          {item.total} horário(s)
                        </p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </section>
          )}

          {activeTab === 'produtos' && (
            <section className="grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <h3 className="text-lg font-black text-slate-950 dark:text-white">
                    Estoque Inteligente
                  </h3>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.produtos.alertas.length === 0 ? (
                    <p className="text-sm text-slate-500">Sem alertas de estoque.</p>
                  ) : (
                    data.produtos.alertas.map((product) => (
                      <div
                        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"
                        key={product.nome}
                      >
                        <div>
                          <p className="font-black text-slate-950 dark:text-white">{product.nome}</p>
                          <p className="text-sm text-slate-500">
                            {product.categoria ?? 'Sem categoria'} · estoque {product.estoqueAtual}
                          </p>
                        </div>
                        <Badge variant={product.status === 'baixo' ? 'danger' : 'warning'}>
                          {product.status === 'baixo' ? 'Reposicao' : 'Excesso'}
                        </Badge>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <h3 className="text-lg font-black text-slate-950 dark:text-white">
                    Mais vendidos
                  </h3>
                </CardHeader>
                <CardContent className="space-y-4">
                  {data.produtos.maisVendidos.length === 0 ? (
                    <p className="text-sm text-slate-500">Sem vendas de produtos no período.</p>
                  ) : (
                    data.produtos.maisVendidos.slice(0, 6).map((product) => (
                      <MiniBar
                        key={product.nome}
                        label={product.nome}
                        max={Math.max(...data.produtos.maisVendidos.map((item) => item.valorTotal))}
                        value={product.valorTotal}
                      />
                    ))
                  )}
                </CardContent>
              </Card>
            </section>
          )}

          {activeTab === 'previsões' && (
            <section className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
              <Card>
                <CardHeader>
                  <h3 className="text-lg font-black text-slate-950 dark:text-white">
                    Projeção
                  </h3>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <KpiCard label="Receita prevista 30 dias" value={currencyFormatter.format(data.previsao.receita30Dias)} />
                  <KpiCard label="Receita prevista 90 dias" value={currencyFormatter.format(data.previsao.receita90Dias)} />
                  <KpiCard label="Receita prevista 12 meses" value={currencyFormatter.format(data.previsao.receita12Meses)} />
                  <KpiCard label="Lucro previsto 30 dias" value={currencyFormatter.format(data.previsao.lucro30Dias)} />
                </CardContent>
              </Card>
              <Card>
                <CardContent>
                  <Target className="text-brand-500" size={28} />
                  <h3 className="mt-4 text-xl font-black text-slate-950 dark:text-white">
                    Se continuar nesse ritmo
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
                    Receita estimada para 30 dias:{' '}
                    <span className="font-black text-brand-600">
                      {currencyFormatter.format(data.previsao.receita30Dias)}
                    </span>
                    . Use como referência para meta e escala da equipe.
                  </p>
                </CardContent>
              </Card>
            </section>
          )}
        </>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3">
            <TrendingUp className="text-emerald-500" size={22} />
            <div>
              <p className="font-black text-slate-950 dark:text-white">Crescimento</p>
              <p className="text-sm text-slate-500">Comparativo com período anterior.</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3">
            <TrendingDown className="text-amber-500" size={22} />
            <div>
              <p className="font-black text-slate-950 dark:text-white">Queda</p>
              <p className="text-sm text-slate-500">Sinaliza pontos de atenção.</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3">
            <Activity className="text-brand-500" size={22} />
            <div>
              <p className="font-black text-slate-950 dark:text-white">Meta atingida</p>
              <p className="text-sm text-slate-500">Score alto indica rotina saudável.</p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
