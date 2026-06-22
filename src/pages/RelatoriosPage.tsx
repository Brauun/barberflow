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
import { exportHtmlReport } from '../utils/mobileExport'

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

function fileSafeReportName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function absoluteAssetUrl(value: string) {
  if (value.startsWith('http') || value.startsWith('data:')) {
    return value
  }

  return new URL(value, window.location.origin).toString()
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return '-'
  }

  return new Date(value).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function formatStatus(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function buildReportTables(
  data: ReportData,
  tipo: RelatorioTipo,
  atendimentos: number,
  ticketMedio: number,
) {
  const financeiroRows = [
    ['Entradas', currencyFormatter.format(data.summary.receitaServicos + data.summary.receitaProdutos)],
    ['Receita de serviços', currencyFormatter.format(data.summary.receitaServicos)],
    ['Receita de produtos', currencyFormatter.format(data.summary.receitaProdutos)],
    ['Saídas', currencyFormatter.format(data.summary.despesas)],
    ['Comissões', currencyFormatter.format(data.summary.comissoes)],
    ['Lucro líquido', currencyFormatter.format(data.summary.lucroLiquido)],
    ['Ticket médio', currencyFormatter.format(ticketMedio)],
  ]

  if (tipo === 'barbeiro') {
    return [
      {
        empty: 'Nenhum barbeiro com atendimento no período.',
        headers: ['Barbeiro', 'Atendimentos', 'Faturamento', 'Comissão', 'Ticket médio', 'Cancelamentos'],
        rows: data.topBarbers.map((barber) => [
          barber.nome,
          numberFormatter.format(barber.atendimentos),
          currencyFormatter.format(barber.faturamento),
          currencyFormatter.format(barber.comissao),
          currencyFormatter.format(barber.ticketMedio),
          numberFormatter.format(barber.cancelamentos),
        ]),
        title: 'Desempenho por barbeiro',
      },
    ]
  }

  if (tipo === 'clientes') {
    return [
      {
        empty: 'Nenhum cliente com movimentação no período.',
        headers: ['Cliente', 'Perfil', 'Visitas', 'Total gasto', 'Última visita'],
        rows: data.clients.map((client) => [
          client.nome,
          client.novo ? 'Novo' : client.recorrente ? 'Recorrente' : 'Cliente',
          numberFormatter.format(client.visitas),
          currencyFormatter.format(client.gastoTotal),
          formatDateTime(client.ultimaVisita),
        ]),
        title: 'Clientes no período',
      },
    ]
  }

  if (tipo === 'produtos') {
    return [
      {
        empty: 'Nenhuma venda de produto no período.',
        headers: ['Produto', 'Quantidade', 'Receita', 'Estoque'],
        rows: data.topProducts.map((product) => [
          product.nome,
          numberFormatter.format(product.quantidade),
          currencyFormatter.format(product.valorTotal),
          product.estoqueAtual == null ? '-' : numberFormatter.format(product.estoqueAtual),
        ]),
        title: 'Produtos vendidos',
      },
    ]
  }

  if (tipo === 'financeiro') {
    return [
      {
        empty: 'Nenhuma movimentação financeira no período.',
        headers: ['Indicador', 'Valor'],
        rows: financeiroRows,
        title: 'Resumo financeiro',
      },
    ]
  }

  if (tipo === 'agenda') {
    return [
      {
        empty: 'Nenhum atendimento na agenda do período.',
        headers: ['Horário', 'Cliente', 'Barbeiro', 'Serviço', 'Status', 'Valor'],
        rows: data.agendaItems.map((appointment) => [
          formatDateTime(appointment.horario),
          appointment.cliente,
          appointment.barbeiro,
          appointment.servico,
          formatStatus(appointment.status),
          currencyFormatter.format(appointment.valor),
        ]),
        title: 'Agenda do período',
      },
    ]
  }

  return [
    {
      empty: 'Nenhum atendimento concluído no período.',
      headers: ['Barbeiro', 'Atendimentos', 'Faturamento'],
      rows: data.topBarbers.map((barber) => [
        barber.nome,
        numberFormatter.format(barber.atendimentos),
        currencyFormatter.format(barber.faturamento),
      ]),
      title: 'Atendimentos por barbeiro',
    },
    {
      empty: 'Nenhuma venda de produto no período.',
      headers: ['Produto', 'Quantidade', 'Valor total'],
      rows: data.topProducts.map((product) => [
        product.nome,
        numberFormatter.format(product.quantidade),
        currencyFormatter.format(product.valorTotal),
      ]),
      title: 'Produtos mais vendidos',
    },
    {
      empty: 'Nenhum dado financeiro no período.',
      headers: ['Indicador', 'Valor'],
      rows: [
        ...financeiroRows,
        ['Atendimentos', numberFormatter.format(atendimentos)],
      ],
      title: 'Resumo financeiro',
    },
  ]
}

function buildExcelRows(input: {
  data: ReportData
  periodo: string
  tipo: RelatorioTipo
  title: string
  atendimentos: number
  ticketMedio: number
}) {
  const tables = buildReportTables(
    input.data,
    input.tipo,
    input.atendimentos,
    input.ticketMedio,
  )

  return [
    ['Relatório', input.title],
    ['Período', input.periodo],
    [],
    ...tables.flatMap((table) => [
      [table.title],
      table.headers,
      ...(table.rows.length > 0 ? table.rows : [[table.empty]]),
      [],
    ]),
  ]
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

  // For barbeiro reports: build a detailed per-barber table for page 1
  const barberTableRows = tipo === 'barbeiro'
    ? data.topBarbers.map((b) => `
        <tr>
          <td><strong>${escapeHtml(b.nome)}</strong></td>
          <td>${numberFormatter.format(b.atendimentos)}</td>
          <td>${currencyFormatter.format(b.faturamento)}</td>
          <td>${currencyFormatter.format(b.comissao)}</td>
          <td>${currencyFormatter.format(b.ticketMedio)}</td>
          <td>${numberFormatter.format(b.cancelamentos)}</td>
        </tr>
      `).join('')
    : ''

  const reportTables =
    tipo === 'barbeiro' ? [] : buildReportTables(data, tipo, atendimentos, ticketMedio)
  const tablePanels = reportTables
    .map((table) => {
      const colSpan = Math.max(1, table.headers.length)
      const rows = table.rows
        .slice(0, 18)
        .map(
          (row) => `
            <tr>
              ${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}
            </tr>
          `,
        )
        .join('')

      return `
        <div class="panel">
          <div class="panel-head"><h3>${escapeHtml(table.title)}</h3></div>
          <table>
            <thead>
              <tr>${table.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${rows || `<tr><td colspan="${colSpan}">${escapeHtml(table.empty)}</td></tr>`}
            </tbody>
          </table>
        </div>
      `
    })
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
            <div class="eyebrow">Relatório Operacional</div>
            <h1>${escapeHtml(title)}</h1>
            <p>${
              tipo === 'barbeiro'   ? 'Desempenho individual de cada barbeiro no período: atendimentos, faturamento, comissões, ticket médio e cancelamentos.' :
              tipo === 'financeiro' ? 'Visão completa das finanças do período: entradas, saídas, comissões e lucro líquido da barbearia.' :
              tipo === 'produtos'   ? 'Produtos mais vendidos no período com quantidade, receita gerada e estoque atual.' :
              tipo === 'clientes'   ? 'Comportamento dos clientes no período: visitas, gasto total e perfil (novo ou recorrente).' :
              tipo === 'agenda'     ? 'Registro completo dos atendimentos agendados no período com status e valores.' :
              'Resumo consolidado do período para acompanhamento de performance operacional e financeira.'
            }</p>
            <span class="period">${formatDate(dataInicio)} até ${formatDate(dataFim)}</span>
          </div>

          ${tipo === 'barbeiro' ? `
            <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-top:14px;">
              <div class="kpi"><span>Receita de serviços</span><strong>${currencyFormatter.format(data.summary.receitaServicos)}</strong></div>
              <div class="kpi"><span>Receita de produtos</span><strong>${currencyFormatter.format(data.summary.receitaProdutos)}</strong></div>
              <div class="kpi"><span>Total de atendimentos</span><strong>${numberFormatter.format(atendimentos)}</strong></div>
              <div class="kpi"><span>Ticket médio</span><strong>${currencyFormatter.format(ticketMedio)}</strong></div>
              <div class="kpi"><span>Comissões</span><strong>${currencyFormatter.format(data.summary.comissoes)}</strong></div>
              <div class="kpi"><span>Despesas</span><strong>${currencyFormatter.format(data.summary.despesas)}</strong></div>
              <div class="kpi"><span>Lucro líquido</span><strong>${currencyFormatter.format(data.summary.lucroLiquido)}</strong></div>
              <div class="kpi"><span>Margem</span><strong>${margem.toFixed(1).replace('.', ',')}%</strong></div>
            </div>
            <div class="panel" style="margin-top:16px;">
              <div class="panel-head"><h3>Desempenho por barbeiro</h3></div>
              <table>
                <thead><tr><th>Barbeiro</th><th>Atendimentos</th><th>Faturamento</th><th>Comissão</th><th>Ticket médio</th><th>Cancelamentos</th></tr></thead>
                <tbody>${barberTableRows || `<tr><td colspan="6">Nenhum barbeiro com atendimento no período.</td></tr>`}</tbody>
              </table>
            </div>

          ` : tipo === 'financeiro' ? `
            <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-top:14px;">
              <div class="kpi"><span>Entradas totais</span><strong>${currencyFormatter.format(entradas)}</strong></div>
              <div class="kpi"><span>Receita de serviços</span><strong>${currencyFormatter.format(data.summary.receitaServicos)}</strong></div>
              <div class="kpi"><span>Receita de produtos</span><strong>${currencyFormatter.format(data.summary.receitaProdutos)}</strong></div>
              <div class="kpi"><span>Despesas</span><strong>${currencyFormatter.format(data.summary.despesas)}</strong></div>
              <div class="kpi"><span>Comissões</span><strong>${currencyFormatter.format(data.summary.comissoes)}</strong></div>
              <div class="kpi"><span>Lucro líquido</span><strong>${currencyFormatter.format(data.summary.lucroLiquido)}</strong></div>
              <div class="kpi"><span>Atendimentos</span><strong>${numberFormatter.format(atendimentos)}</strong></div>
              <div class="kpi"><span>Margem</span><strong>${margem.toFixed(1).replace('.', ',')}%</strong></div>
            </div>
            <div class="summary-strip" style="margin-top:14px;">
              <div class="summary-card">
                <div class="eyebrow">Análise do período</div>
                <h3>Resultado financeiro</h3>
                <p>O período gerou <span class="accent">${currencyFormatter.format(entradas)}</span> em entradas totais. Após despesas de <span class="accent">${currencyFormatter.format(data.summary.despesas)}</span> e comissões de <span class="accent">${currencyFormatter.format(data.summary.comissoes)}</span>, o lucro líquido foi de <span class="accent">${currencyFormatter.format(data.summary.lucroLiquido)}</span> com margem de <span class="accent">${margem.toFixed(1).replace('.', ',')}%</span>.</p>
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

          ` : tipo === 'produtos' ? `
            <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-top:14px;">
              <div class="kpi"><span>Receita de produtos</span><strong>${currencyFormatter.format(data.summary.receitaProdutos)}</strong></div>
              <div class="kpi"><span>Produtos distintos</span><strong>${numberFormatter.format(data.topProducts.length)}</strong></div>
              <div class="kpi"><span>Produto destaque</span><strong>${topProduct ? escapeHtml(topProduct.nome) : 'Sem dados'}</strong></div>
            </div>
            <div class="panel" style="margin-top:16px;">
              <div class="panel-head"><h3>Produtos vendidos no período</h3></div>
              <table>
                <thead><tr><th>Produto</th><th>Quantidade</th><th>Receita</th><th>Estoque atual</th></tr></thead>
                <tbody>
                  ${data.topProducts.length > 0
                    ? data.topProducts.slice(0, 20).map((p) => `
                        <tr>
                          <td><strong>${escapeHtml(p.nome)}</strong></td>
                          <td>${numberFormatter.format(p.quantidade)}</td>
                          <td>${currencyFormatter.format(p.valorTotal)}</td>
                          <td>${p.estoqueAtual == null ? '-' : numberFormatter.format(p.estoqueAtual)}</td>
                        </tr>`).join('')
                    : `<tr><td colspan="4">Nenhuma venda de produto no período.</td></tr>`}
                </tbody>
              </table>
            </div>

          ` : tipo === 'clientes' ? `
            <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-top:14px;">
              <div class="kpi"><span>Total de clientes</span><strong>${numberFormatter.format(data.clients.length)}</strong></div>
              <div class="kpi"><span>Clientes novos</span><strong>${numberFormatter.format(data.clients.filter((c) => c.novo).length)}</strong></div>
              <div class="kpi"><span>Recorrentes</span><strong>${numberFormatter.format(data.clients.filter((c) => c.recorrente).length)}</strong></div>
              <div class="kpi"><span>Receita de serviços</span><strong>${currencyFormatter.format(data.summary.receitaServicos)}</strong></div>
            </div>
            <div class="panel" style="margin-top:16px;">
              <div class="panel-head"><h3>Clientes no período</h3></div>
              <table>
                <thead><tr><th>Cliente</th><th>Perfil</th><th>Visitas</th><th>Total gasto</th><th>Última visita</th></tr></thead>
                <tbody>
                  ${data.clients.length > 0
                    ? data.clients.slice(0, 18).map((c) => `
                        <tr>
                          <td><strong>${escapeHtml(c.nome)}</strong></td>
                          <td>${c.novo ? 'Novo' : c.recorrente ? 'Recorrente' : 'Cliente'}</td>
                          <td>${numberFormatter.format(c.visitas)}</td>
                          <td>${currencyFormatter.format(c.gastoTotal)}</td>
                          <td>${formatDateTime(c.ultimaVisita)}</td>
                        </tr>`).join('')
                    : `<tr><td colspan="5">Nenhum cliente com movimentação no período.</td></tr>`}
                </tbody>
              </table>
            </div>

          ` : tipo === 'agenda' ? `
            <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-top:14px;">
              <div class="kpi"><span>Total de agendamentos</span><strong>${numberFormatter.format(data.agendaItems.length)}</strong></div>
              <div class="kpi"><span>Concluídos</span><strong>${numberFormatter.format(data.agendaItems.filter((a) => a.status === 'concluido').length)}</strong></div>
              <div class="kpi"><span>Cancelados</span><strong>${numberFormatter.format(data.agendaItems.filter((a) => a.status === 'cancelado').length)}</strong></div>
              <div class="kpi"><span>Receita de serviços</span><strong>${currencyFormatter.format(data.summary.receitaServicos)}</strong></div>
            </div>
            <div class="panel" style="margin-top:16px;">
              <div class="panel-head"><h3>Agenda do período</h3></div>
              <table>
                <thead><tr><th>Horário</th><th>Cliente</th><th>Barbeiro</th><th>Serviço</th><th>Status</th><th>Valor</th></tr></thead>
                <tbody>
                  ${data.agendaItems.length > 0
                    ? data.agendaItems.slice(0, 18).map((a) => `
                        <tr>
                          <td>${formatDateTime(a.horario)}</td>
                          <td><strong>${escapeHtml(a.cliente)}</strong></td>
                          <td>${escapeHtml(a.barbeiro)}</td>
                          <td>${escapeHtml(a.servico)}</td>
                          <td>${formatStatus(a.status)}</td>
                          <td>${currencyFormatter.format(a.valor)}</td>
                        </tr>`).join('')
                    : `<tr><td colspan="6">Nenhum atendimento na agenda do período.</td></tr>`}
                </tbody>
              </table>
            </div>

          ` : `
            <div class="kpi-grid">
              ${kpis.map(([label, value]) => `
                <div class="kpi">
                  <span>${escapeHtml(label)}</span>
                  <strong>${escapeHtml(value)}</strong>
                </div>
              `).join('')}
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
          `}
          <footer class="footer"><span>BW Barber</span><span>Página 1 de 2</span></footer>
        </section>

        <section class="page">
          <header class="header">
            <div><div class="eyebrow">Detalhamento</div><h2>${escapeHtml(title)}</h2></div>
            <div class="meta">${formatDate(dataInicio)} até ${formatDate(dataFim)}</div>
          </header>
          ${tablePanels}
          <footer class="footer"><span>BW Barber</span><span>Página 2 de 2</span></footer>
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
      appliedFilters.tipo,
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
    exportHtmlReport({
      filename: `BW-Barber-${fileSafeReportName(title)}-${fileSafeDate(appliedFilters.dataInicio)}.html`,
      html,
      previewFeatures: 'width=900,height=1200',
    })
  }

  function exportExcel() {
    if (!data) {
      return
    }

    const rows = buildExcelRows({
      atendimentos,
      data,
      periodo: periodLabel,
      ticketMedio,
      tipo: appliedFilters.tipo,
      title,
    })

    const csv = rows
      .map((row) => row.map((cell) => escapeCsv(cell ?? '')).join(';'))
      .join('\n')
    const blob = new Blob([`\uFEFF${csv}`], {
      type: 'text/csv;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `BW-Barber-${fileSafeReportName(title)}-${fileSafeDate(appliedFilters.dataInicio)}.csv`
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
