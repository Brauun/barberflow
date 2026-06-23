import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  BarChart3,
  CalendarDays,
  Crown,
  Download,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Badge, Button, Card, CardContent, CardHeader, Skeleton } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { useFeatureAccess } from '../hooks/useSubscription'
import { resolveAssetUrl } from '../services/assetsService'
import {
  getExecutiveRelatorioData,
  type ExecutiveReportData,
} from '../services/relatoriosService'
import { cn } from '../utils/cn'
import { exportHtmlReport } from '../utils/mobileExport'

type ExecutiveTab =
  | 'visao-geral'
  | 'equipe'
  | 'clientes'
  | 'agenda'
  | 'inteligencia'

type QuickFilter = 'hoje' | '7d' | '30d' | 'mensal' | 'anual' | 'custom'

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  currency: 'BRL',
  style: 'currency',
})

const numberFormatter = new Intl.NumberFormat('pt-BR')

const tabs: Array<{ icon: typeof BarChart3; label: string; value: ExecutiveTab }> = [
  { icon: BarChart3, label: 'Visão Geral', value: 'visao-geral' },
  { icon: Crown, label: 'Equipe', value: 'equipe' },
  { icon: Users, label: 'Clientes', value: 'clientes' },
  { icon: CalendarDays, label: 'Agenda', value: 'agenda' },
  { icon: Sparkles, label: 'Inteligência', value: 'inteligencia' },
]

const quickFilters: Array<{ label: string; value: QuickFilter }> = [
  { label: 'Hoje', value: 'hoje' },
  { label: '7 dias', value: '7d' },
  { label: '30 dias', value: '30d' },
  { label: 'Mensal', value: 'mensal' },
  { label: 'Anual', value: 'anual' },
  { label: 'Personalizado', value: 'custom' },
]

const dateInputClass =
  'h-12 w-full min-w-0 max-w-full rounded-2xl border border-slate-200 bg-white px-3 pr-3 text-[16px] leading-none text-slate-950 outline-none transition [color-scheme:light] focus:border-brand-300 focus:ring-4 focus:ring-brand-100 sm:px-4 sm:pr-4 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:[color-scheme:dark] dark:focus:ring-brand-400/10'

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
    return current > 0 ?100 : 0
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

function initialsFromName(value: string) {
  const initials = value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  return initials || 'BW'
}

function buildExecutivePdfHtml(input: {
  data: ExecutiveReportData
  dataFim: string
  dataInicio: string
  empresaNome: string
  logoFallback: string
  logoUrl: string
}) {
  const { data, dataFim, dataInicio, empresaNome, logoFallback, logoUrl } = input
  const entradas = data.summary.receitaServicos + data.summary.receitaProdutos
  const previousEntradas =
    data.periodoAnterior.summary.receitaServicos +
    data.periodoAnterior.summary.receitaProdutos
  const crescimento = growth(entradas, previousEntradas)
  const emittedAt = new Date().toLocaleString('pt-BR')
  const ticketMedio =
    data.agenda.status.concluido > 0
      ?data.summary.receitaServicos / data.agenda.status.concluido
      : 0
  const cancelamentos =
    data.agenda.status.cancelado + data.agenda.status.remarcado
  const scoreTone =
    data.score.value >= 80 ?'good' : data.score.value >= 60 ?'warn' : 'danger'
  const scoreLabel =
    data.score.value >= 80
      ?'Operação saudável'
      : data.score.value >= 60
        ?'Operação em atenção'
        : 'Operação crítica'
  const marginTone =
    data.margemPercentual >= 20
      ?'good'
      : data.margemPercentual >= 8
        ?'warn'
        : 'danger'
  const topBarber = data.equipe[0]
  const topProduct = data.produtos.maisVendidos[0]
  const executiveSummary = `No período, a barbearia gerou ${currencyFormatter.format(entradas)} em entradas, com margem líquida de ${percent(data.margemPercentual)} e ${numberFormatter.format(data.agenda.status.concluido)} atendimentos concluídos.`
  const kpis = [
    ['Receita', currencyFormatter.format(entradas), 'positive'],
    ['Lucro líquido', currencyFormatter.format(data.summary.lucroLiquido), marginTone],
    ['Margem', percent(data.margemPercentual), marginTone],
    ['Ticket médio', currencyFormatter.format(ticketMedio), 'neutral'],
    ['Atendimentos', numberFormatter.format(data.agenda.status.concluido), 'neutral'],
    ['Cancelamentos', numberFormatter.format(cancelamentos), cancelamentos > 0 ?'warn' : 'good'],
  ]
  const financeCards = [
    ['Receita bruta', currencyFormatter.format(entradas), 'Serviços + produtos', 'positive'],
    ['Receita líquida', currencyFormatter.format(data.summary.lucroLiquido), 'Ap?s despesas e comissões', marginTone],
    ['Despesas', currencyFormatter.format(data.summary.despesas), 'Saídas do período', data.summary.despesas > 0 ?'warn' : 'neutral'],
    ['Comissões', currencyFormatter.format(data.summary.comissoes), 'Equipe no período', 'neutral'],
    ['Lucro', currencyFormatter.format(data.summary.lucroLiquido), 'Resultado operacional', marginTone],
    ['Margem', percent(data.margemPercentual), 'Lucro / entradas', marginTone],
  ]
  const teamCards = data.equipe
    .slice(0, 5)
    .map(
      (barber, index) => `
        <div class="ranking-card">
          <span class="rank">${index + 1}</span>
          <div>
            <strong>${escapeHtml(barber.nome)}</strong>
            <small>${numberFormatter.format(barber.atendimentos)} atendimentos · Ticket ${currencyFormatter.format(barber.ticketMedio)}</small>
          </div>
          <div class="right">
            <b>${currencyFormatter.format(barber.faturamento)}</b>
            <small>${currencyFormatter.format(barber.comissao)} comissão</small>
          </div>
        </div>
      `,
    )
    .join('')
  const clientCards = data.clientes.topClientes
    .slice(0, 5)
    .map(
      (client) => `
        <div class="list-card">
          <div>
            <strong>${escapeHtml(client.nome)}</strong>
            <small>${numberFormatter.format(client.visitas)} visitas ? última visita ${client.ultimaVisita ?new Date(client.ultimaVisita).toLocaleDateString('pt-BR') : '-'}</small>
          </div>
          <b>${currencyFormatter.format(client.gastoTotal)}</b>
        </div>
      `,
    )
    .join('')
  const productCards = data.produtos.maisVendidos
    .slice(0, 5)
    .map(
      (product) => `
        <div class="list-card">
          <div>
            <strong>${escapeHtml(product.nome)}</strong>
            <small>${numberFormatter.format(product.quantidade)} unidades vendidas</small>
          </div>
          <b>${currencyFormatter.format(product.valorTotal)}</b>
        </div>
      `,
    )
    .join('')
  const insightItems = [
    crescimento >= 0
      ?`Receita cresceu ${percent(crescimento)} em relação ao período anterior.`
      : `Receita caiu ${percent(Math.abs(crescimento))} em relação ao período anterior.`,
    cancelamentos > 0
      ?`Cancelamentos exigem atenção: ${numberFormatter.format(cancelamentos)} ocorrência(s) no período.`
      : 'Agenda sem cancelamentos relevantes no período.',
    topBarber
      ?`${topBarber.nome} liderou a equipe com ${currencyFormatter.format(topBarber.faturamento)} em faturamento.`
      : 'Ainda não h? barbeiro com faturamento conclu?do no período.',
    topProduct
      ?`${topProduct.nome} foi o item de maior giro no período.`
      : 'Sem vendas de produtos registradas no período.',
  ]

  return `<!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>BW-Barber-Relatório-Executivo-${escapeHtml(dataInicio)}-${escapeHtml(dataFim)}</title>
        <style>
          @page { size: A4; margin: 0; }
          * { box-sizing: border-box; }
          body {
            background: #eef4f8;
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
            padding: 12mm;
            page-break-after: always;
            position: relative;
            width: 210mm;
          }
          .cover { background: linear-gradient(180deg, #ffffff 0%, #f6fbff 100%); color: #071426; }
          .header { align-items: center; display: flex; justify-content: space-between; min-height: 54px; }
          .brand { align-items: center; display: flex; gap: 13px; }
          .logo {
            align-items: center;
            background: #071426;
            border: 1px solid #dbe8f0;
            border-radius: 18px;
            display: flex;
            height: 52px;
            justify-content: center;
            overflow: hidden;
            width: 52px;
          }
          .logo img { height: 44px; max-width: 44px; object-fit: contain; }
          .logo span { color: #12c6f3; display: none; font-size: 15px; font-weight: 950; letter-spacing: -.04em; }
          .eyebrow { color: #0891b2; font-size: 8.5px; font-weight: 900; letter-spacing: .22em; text-transform: uppercase; }
          h1 { color: #071426; font-size: 34px; letter-spacing: -.04em; line-height: 1.02; margin: 18px 0 10px; }
          h2 { color: #071426; font-size: 21px; letter-spacing: -.03em; margin: 2px 0 4px; }
          h3 { color: #071426; margin: 0; }
          p { color: #64748b; font-size: 10.5px; line-height: 1.58; margin: 0; }
          .cover p { color: #526176; max-width: 560px; }
          .period { background: #e8fbff; border: 1px solid #b9f1fb; border-radius: 999px; color: #03657d; display: inline-flex; font-size: 10px; font-weight: 900; padding: 8px 12px; }
          .badge-pro { background: #071426; border-radius: 999px; color: #fff; display: inline-flex; font-size: 9px; font-weight: 950; letter-spacing: .12em; padding: 7px 10px; text-transform: uppercase; }
          .hero { background: #071426; border-radius: 24px; color: #fff; display: grid; gap: 18px; grid-template-columns: 1.15fr .85fr; margin-top: 16px; padding: 20px; }
          .hero h1 { color: #fff; }
          .hero p { color: #c7d5ea; }
          .score-card { align-items: center; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.12); border-radius: 20px; display: flex; gap: 14px; padding: 16px; }
          .score-card strong { color: #fff; font-size: 40px; letter-spacing: -.04em; line-height: 1; }
          .score-card.good { border-color: rgba(16,185,129,.42); }
          .score-card.warn { border-color: rgba(245,158,11,.48); }
          .score-card.danger { border-color: rgba(239,68,68,.48); }
          .grid { display: grid; gap: 9px; grid-template-columns: repeat(3, 1fr); }
          .grid.two { grid-template-columns: 1fr 1fr; }
          .grid.four { grid-template-columns: repeat(4, 1fr); }
          .kpi { background: #fff; border: 1px solid #e1ebf2; border-radius: 14px; min-height: 68px; padding: 11px; }
          .kpi span { color: #64748b; display: block; font-size: 7.8px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
          .kpi strong { color: #071426; display: block; font-size: 14px; margin-top: 7px; }
          .kpi.positive strong, .kpi.good strong { color: #0891b2; }
          .kpi.warn strong { color: #b45309; }
          .kpi.danger strong { color: #dc2626; }
          .section-title { align-items: end; border-bottom: 1px solid #dbe7ef; display: flex; justify-content: space-between; margin-bottom: 12px; padding-bottom: 10px; }
          .section-title small { color: #64748b; font-size: 9px; font-weight: 800; }
          .two { display: grid; gap: 12px; grid-template-columns: 1fr 1fr; }
          .insight { background: #fff; border: 1px solid #e1ebf2; border-radius: 16px; padding: 14px; }
          .insight p { margin-top: 8px; }
          .callout { background: #071426; border-radius: 18px; color: #fff; padding: 16px; }
          .callout p { color: #c7d5ea; }
          .ranking-card, .list-card { align-items: center; background: #fff; border: 1px solid #e1ebf2; border-radius: 15px; display: flex; gap: 12px; justify-content: space-between; margin-top: 9px; padding: 11px; }
          .ranking-card .rank { align-items: center; background: #e8fbff; border-radius: 12px; color: #0891b2; display: flex; font-size: 15px; font-weight: 950; height: 34px; justify-content: center; width: 34px; }
          .ranking-card strong, .list-card strong { color: #071426; display: block; font-size: 11px; }
          .ranking-card small, .list-card small { color: #64748b; display: block; font-size: 8.6px; margin-top: 3px; }
          .right { margin-left: auto; text-align: right; }
          .right b, .list-card b { color: #0891b2; display: block; font-size: 11px; }
          .insight-list { display: grid; gap: 9px; }
          .insight-item { background: #fff; border: 1px solid #e1ebf2; border-left: 4px solid #12c6f3; border-radius: 14px; color: #334155; font-size: 10px; line-height: 1.45; padding: 11px 12px; }
          .accent { color: #12c6f3; font-weight: 900; }
          .footer { bottom: 8mm; color: #94a3b8; display: flex; font-size: 8.6px; justify-content: space-between; left: 12mm; position: absolute; right: 12mm; }
          @media print { body { background: #fff; } .page { margin: 0; } }
        </style>
      </head>
      <body>
        <section class="page cover">
          <header class="header">
            <div class="brand">
              <div class="logo">
                <img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(empresaNome)}" onerror="this.style.display='none';this.nextElementSibling.style.display='block';" />
                <span>${escapeHtml(logoFallback)}</span>
              </div>
              <div><div class="eyebrow">BW Barber</div><h3>${escapeHtml(empresaNome)}</h3></div>
            </div>
            <div style="text-align:right;"><span class="badge-pro">BW Pro</span><p style="margin-top:8px;font-size:9px;">Emitido em ${escapeHtml(emittedAt)}</p></div>
          </header>
          <div class="hero">
            <div>
              <div class="eyebrow">Relatório Executivo</div>
              <h1>Panorama do negócio</h1>
              <p>${escapeHtml(executiveSummary)}</p>
              <div style="margin-top:14px;"><span class="period">${formatDate(dataInicio)} até ${formatDate(dataFim)}</span></div>
            </div>
            <div class="score-card ${scoreTone}">
              <strong>${data.score.value}/100</strong>
              <div><div class="eyebrow">Score da Operação</div><h3 style="color:#fff;">${escapeHtml(scoreLabel)}</h3><p>Crescimento: <span class="accent">${percent(crescimento)}</span></p></div>
            </div>
          </div>
          <div class="grid" style="margin-top:13px;">
            ${kpis.map(([label, value, tone]) => `<div class="kpi ${tone}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('')}
          </div>
          <div class="callout" style="margin-top:13px;"><div class="eyebrow">Resumo do período</div><p>Receita de serviços: <span class="accent">${currencyFormatter.format(data.summary.receitaServicos)}</span>. Receita de produtos: <span class="accent">${currencyFormatter.format(data.summary.receitaProdutos)}</span>. Ocupação estimada da agenda: <span class="accent">${percent(data.agenda.ocupacaoPercentual)}</span>.</p></div>
          <footer class="footer"><span>BW Barber · Relatório confidencial</span><span>Página 1 de 4</span></footer>
        </section>
        <section class="page">
          <header class="section-title"><div><div class="eyebrow">Visão financeira</div><h2>Saúde financeira</h2><p>Entradas, saídas, margem e resultado líquido do período.</p></div><small>${formatDate(dataInicio)} até ${formatDate(dataFim)}</small></header>
          <div class="grid">${financeCards.map(([label, value, description, tone]) => `<div class="kpi ${tone}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><p style="margin-top:5px;font-size:8.5px;">${escapeHtml(description)}</p></div>`).join('')}</div>
          <div class="callout" style="margin-top:14px;"><div class="eyebrow">Leitura executiva</div><p>No período, a barbearia gerou <span class="accent">${currencyFormatter.format(entradas)}</span> em entradas, com lucro líquido de <span class="accent">${currencyFormatter.format(data.summary.lucroLiquido)}</span> e margem de <span class="accent">${percent(data.margemPercentual)}</span>.</p></div>
          <div class="two" style="margin-top:14px;"><div class="insight"><div class="eyebrow">Receita</div><h3>Composição</h3><p>Serviços representam <span class="accent">${entradas > 0 ?percent((data.summary.receitaServicos / entradas) * 100) : '0%'}</span> das entradas. Produtos representam <span class="accent">${entradas > 0 ?percent((data.summary.receitaProdutos / entradas) * 100) : '0%'}</span>.</p></div><div class="insight"><div class="eyebrow">Resultado</div><h3>Margem operacional</h3><p>A margem atual está em <span class="accent">${percent(data.margemPercentual)}</span>. Use este indicador para calibrar despesas, comissões e metas de faturamento.</p></div></div>
          <footer class="footer"><span>BW Barber · Relatório confidencial</span><span>Página 2 de 4</span></footer>
        </section>
        <section class="page">
          <header class="section-title"><div><div class="eyebrow">Equipe e Serviços</div><h2>Performance operacional</h2><p>Top 5 da equipe e serviços/itens com maior giro no período.</p></div><small>${escapeHtml(empresaNome)}</small></header>
          <div class="two"><div><div class="eyebrow">Equipe</div>${teamCards || '<div class="insight" style="margin-top:10px;"><p>Sem dados de equipe no período.</p></div>'}</div><div><div class="eyebrow">Serviços e produtos</div><div class="insight" style="margin-top:10px;"><h3>Receita de serviços</h3><p><span class="accent">${currencyFormatter.format(data.summary.receitaServicos)}</span> em serviços concluídos no período.</p></div>${productCards || '<div class="insight" style="margin-top:10px;"><p>Sem produtos vendidos no período.</p></div>'}</div></div>
          <footer class="footer"><span>BW Barber · Relatório confidencial</span><span>Página 3 de 4</span></footer>
        </section>
        <section class="page">
          <header class="section-title"><div><div class="eyebrow">Clientes, Agenda e Insights</div><h2>Relacionamento e ocupação</h2><p>Leitura rápida para decisões de retenção, agenda e próximos passos.</p></div><small>BW Pro</small></header>
          <div class="grid"><div class="kpi"><span>Clientes ativos</span><strong>${numberFormatter.format(data.clientes.ativos)}</strong></div><div class="kpi"><span>Clientes novos</span><strong>${numberFormatter.format(data.clientes.novos)}</strong></div><div class="kpi"><span>Retenção</span><strong>${percent(data.clientes.retencaoPercentual)}</strong></div><div class="kpi"><span>Ocupação</span><strong>${percent(data.agenda.ocupacaoPercentual)}</strong></div><div class="kpi warn"><span>Cancelamentos</span><strong>${numberFormatter.format(cancelamentos)}</strong></div><div class="kpi danger"><span>Não compareceu</span><strong>${numberFormatter.format(data.agenda.status.cancelado)}</strong></div></div>
          <div class="two" style="margin-top:14px;"><div><div class="eyebrow">Top clientes</div>${clientCards || '<div class="insight" style="margin-top:10px;"><p>Sem clientes com movimentação no período.</p></div>'}</div><div><div class="eyebrow">Insights do período</div><div class="insight-list" style="margin-top:10px;">${insightItems.map((item) => `<div class="insight-item">${escapeHtml(item)}</div>`).join('')}</div></div></div>
          <footer class="footer"><span>BW Barber · Relatório confidencial</span><span>Página 4 de 4</span></footer>
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
            'mt-1.5 text-xl font-black text-slate-950 md:mt-2 md:text-2xl dark:text-white',
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
  const width = max > 0 ?Math.max(4, (value / max) * 100) : 0

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
      <CardContent className="grid gap-5 p-4 md:gap-8 md:p-8 lg:grid-cols-[1fr_0.65fr] lg:p-10">
        <div>
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-brand-300">
            BW Pro
          </p>
          <h2 className="mt-3 max-w-2xl text-2xl font-black leading-tight text-white sm:text-4xl md:mt-4">
            Torne sua gestáo mais inteligente com os Relatórios Executivos BW Pro.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
            Acompanhe score da operação, previsões, performance da equipe,
            fideliza??o de clientes e PDF executivo pronto para decisão.
          </p>
          <Button
            className="mt-7 bg-brand-500 text-slate-950 hover:bg-brand-400"
            leftIcon={<Sparkles size={18} />}
            onClick={() => navigate('/app/assinatura')}
          >
            Conhecer BW Pro
          </Button>
        </div>
        <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4 md:p-5">
          {['Score 0-100', 'Insights automáticos', 'PDF premium', 'Previs?es'].map(
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
  const [activeTab, setActiveTab] = useState<ExecutiveTab>('visao-geral')
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('mensal')
  const [pendingInicio, setPendingInicio] = useState(monthStartInputValue())
  const [pendingFim, setPendingFim] = useState(todayInputValue())
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
    staleTime: 1000 * 60 * 5,
  })

  const companyLogoQuery = useQuery({
    enabled: Boolean(profile?.empresa?.logo_url),
    queryFn: () => resolveAssetUrl('company-assets', profile?.empresa?.logo_url),
    queryKey: ['relatorios-executivos-logo', empresaId, profile?.empresa?.logo_url],
    staleTime: 1000 * 60 * 50,
  })

  const data = reportQuery.data
  const periodLabel = `${formatDate(appliedFilters.dataInicio)} até ${formatDate(appliedFilters.dataFim)}`
  const entradas = data ?data.summary.receitaServicos + data.summary.receitaProdutos : 0
  const previousEntradas = data
    ?data.periodoAnterior.summary.receitaServicos +
      data.periodoAnterior.summary.receitaProdutos
    : 0
  const crescimento = data ?growth(entradas, previousEntradas) : 0
  const ticketMedio =
    data && data.agenda.status.concluido
      ?data.summary.receitaServicos / data.agenda.status.concluido
      : 0
  const maxSeries = Math.max(...(data?.series.map((point) => point.receita) ?? [0]))

  function setQuickRange(filter: QuickFilter) {
    setQuickFilter(filter)

    if (filter === 'custom') {
      return
    }

    const range = getQuickFilterRange(filter)
    setPendingInicio(range.dataInicio)
    setPendingFim(range.dataFim)
    setAppliedFilters(range)
  }

  function applyFilters() {
    setQuickFilter('custom')
    setAppliedFilters({ dataFim: pendingFim, dataInicio: pendingInicio })
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
      logoFallback: initialsFromName(profile?.empresa?.nome ?? 'BW Barber'),
      logoUrl: companyLogoQuery.data ?? absoluteAssetUrl('/brand/bw-barber-login-logo.png'),
    })
    exportHtmlReport({
      filename: `BW-Barber-Relatório-Executivo-${appliedFilters.dataInicio}-${appliedFilters.dataFim}.html`,
      html,
      previewFeatures: 'width=920,height=1200',
    })
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
        ?`Receita aumentou ${percent(crescimento)} em relação ao período anterior.`
        : `Receita caiu ${percent(Math.abs(crescimento))} em relação ao período anterior.`,
      topBarber
        ?`${topBarber.nome} gerou ${percent(entradas ?(topBarber.faturamento / entradas) * 100 : 0)} do faturamento.`
        : 'Ainda não h? barbeiro com faturamento conclu?do no período.',
      data.margemPercentual >= 15
        ?'Nível financeiro saudável para o período analisado.'
        : 'Diminua despesas ou revise preços para recuperar margem.',
      topProduct
        ?`${topProduct.nome} lidera produtos, com ${numberFormatter.format(topProduct.quantidade)} venda(s).`
        : 'Produtos ainda não tiveram venda registrada no período.',
      topClient
        ?`${topClient.nome} é o cliente de maior valor no período.`
        : 'Ainda não h? ranking de clientes para este período.',
    ]
  }, [crescimento, data, entradas])

  if (!empresaId) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-slate-500">
            Complete o vínculo do usuário com uma empresa para visualizar os relatérios.
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
    <div className="space-y-5 md:space-y-8">
      <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-brand-600 dark:text-brand-400">
            Relatórios Executivos
          </p>
          <h2 className="mt-2 text-xl font-black tracking-normal text-slate-950 md:mt-3 md:text-3xl dark:text-white">
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
                    ?'border-brand-300 bg-brand-500 text-slate-950 shadow-[0_12px_28px_rgb(18_198_243/0.22)]'
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

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
            <label className="space-y-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              Data inicial
              <input
                className={dateInputClass}
                onChange={(event) => setPendingInicio(event.target.value)}
                type="date"
                value={pendingInicio}
              />
            </label>
            <label className="space-y-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              Data final
              <input
                className={dateInputClass}
                onChange={(event) => setPendingFim(event.target.value)}
                type="date"
                value={pendingFim}
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

      {reportQuery.isLoading ?(
        <div className="space-y-4">
          <Skeleton className="h-60" />
          <div className="grid gap-4 md:grid-cols-4">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
        </div>
      ) : data ?(
        <>
          <section className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
            <Card className="overflow-hidden bg-slate-950 text-white dark:bg-slate-900">
              <CardContent className="relative p-4 md:p-7">
                <div className="absolute right-[-3rem] top-[-3rem] h-40 w-40 rounded-full border border-brand-400/20" />
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-brand-300">
                  Score da operação
                </p>
                <div className="mt-5 flex items-end gap-4">
                  <span className="text-3xl font-black tracking-tight md:text-6xl">
                    {data.score.value}
                  </span>
                  <span className="pb-2 text-lg font-black text-slate-400">/100</span>
                </div>
                <p className="mt-2 text-base font-black text-white md:mt-3 md:text-xl">{data.score.label}</p>
                <p className="mt-2 max-w-md text-sm leading-6 text-slate-300">
                  Baseado em receita, margem, ocupação, cancelamentos e ritmo do
                  período.
                </p>
              </CardContent>
            </Card>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                label="Receita período"
                tone={crescimento >= 0 ?'good' : 'warn'}
                value={currencyFormatter.format(entradas)}
              />
              <KpiCard
                label="Lucro líquido"
                tone={data.summary.lucroLiquido >= 0 ?'good' : 'warn'}
                value={currencyFormatter.format(data.summary.lucroLiquido)}
              />
              <KpiCard label="Margem" value={percent(data.margemPercentual)} />
              <KpiCard label="Ticket médio" value={currencyFormatter.format(ticketMedio)} />
              <KpiCard label="Comissões" value={currencyFormatter.format(data.summary.comissoes)} />
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
                          ?'border-slate-950 bg-slate-950 text-white dark:border-brand-400 dark:bg-brand-500 dark:text-slate-950'
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

          {activeTab === 'visao-geral' && (
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
                              height: `${maxSeries > 0 ?Math.max(6, (point.receita / maxSeries) * 100) : 6}%`,
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

          {activeTab === 'inteligencia' && (
            <section className="grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <h3 className="text-lg font-black text-slate-950 dark:text-white">
                    Saude Financeira
                  </h3>
                </CardHeader>
                <CardContent className="space-y-4">
                  <MiniBar label="Receita de serviços" max={entradas} value={data.summary.receitaServicos} />
                  <MiniBar label="Receita de produtos" max={entradas} value={data.summary.receitaProdutos} />
                  <MiniBar label="Despesas" max={entradas} value={data.summary.despesas} />
                  <MiniBar label="Comissões" max={entradas} value={data.summary.comissoes} />
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
                {data.equipe.length === 0 ?(
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
                      <Badge variant={barber.cancelamentos ?'danger' : 'success'}>
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
                  {data.clientes.topClientes.length === 0 ?(
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
                <KpiCard label="Concluídos" value={numberFormatter.format(data.agenda.status.concluido)} />
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
                  {data.agenda.heatmap.length === 0 ?(
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
                        <p className="mt-1.5 text-xl font-black text-slate-950 md:mt-2 md:text-2xl dark:text-white">
                          {item.total} horário(s)
                        </p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </section>
          )}

          {activeTab === 'inteligencia' && (
            <section className="grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <h3 className="text-lg font-black text-slate-950 dark:text-white">
                    Estoque Inteligente
                  </h3>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.produtos.alertas.length === 0 ?(
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
                        <Badge variant={product.status === 'baixo' ?'danger' : 'warning'}>
                          {product.status === 'baixo' ?'Reposição' : 'Excesso'}
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
                  {data.produtos.maisVendidos.length === 0 ?(
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

          {activeTab === 'inteligencia' && (
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
                  <Target className="h-5 w-5 text-brand-500 md:h-7 md:w-7" />
                  <h3 className="mt-3 text-base font-black text-slate-950 md:mt-4 md:text-xl dark:text-white">
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

