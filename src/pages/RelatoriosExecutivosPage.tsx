import { useState } from 'react'

// ─── tipos ────────────────────────────────────────────────────────────────────

type Periodo = 'hoje' | '7dias' | '30dias' | 'mensal' | 'anual' | 'personalizado'

interface KpiItem {
  label: string
  value: string
  sub: string
  trend: 'up' | 'down' | 'neutral'
}

interface InsightItem {
  type: 'success' | 'info' | 'warning' | 'danger'
  icon: string
  text: string
  detail: string
}

interface BarberStat {
  initials: string
  name: string
  atendimentos: number
  comissao: number
  faturamento: number
  faturamentoMax: number
  top?: boolean
}

interface DailyBar {
  label: string
  pct: number
}

interface HourPeak {
  hour: string
  count: number
  max: number
}

// ─── dados mock ───────────────────────────────────────────────────────────────

const PERIODO_LABELS: Record<Periodo, string> = {
  hoje: 'Hoje',
  '7dias': '7 dias',
  '30dias': '30 dias',
  mensal: 'Mensal',
  anual: 'Anual',
  personalizado: 'Personalizado',
}

const KPI_ITEMS: KpiItem[] = [
  { label: 'Receita período',  value: 'R$ 975',    sub: '+100% vs anterior',  trend: 'up' },
  { label: 'Lucro líquido',    value: 'R$ 588',    sub: 'margem 60,3%',       trend: 'up' },
  { label: 'Comissões',        value: 'R$ 387',    sub: '60% dos serviços',   trend: 'neutral' },
  { label: 'Ticket médio',     value: 'R$ 49,62',  sub: '-3% vs anterior',    trend: 'down' },
  { label: 'Clientes ativos',  value: '3',         sub: 'no período',         trend: 'neutral' },
  { label: 'Atendimentos',     value: '13',        sub: '+2 vs anterior',     trend: 'up' },
]

const INSIGHTS: InsightItem[] = [
  {
    type: 'success',
    icon: 'ti-trending-up',
    text: 'Receita 100% acima do período anterior.',
    detail: 'Melhor mês desde o início.',
  },
  {
    type: 'info',
    icon: 'ti-user',
    text: 'Braian Braun gerou 54,4% do faturamento.',
    detail: 'R$ 530 de R$ 975 totais.',
  },
  {
    type: 'warning',
    icon: 'ti-package',
    text: 'Cerveja Heineken lidera produtos com 4 vendas.',
    detail: 'Estoque: revisar antes da próxima semana.',
  },
  {
    type: 'danger',
    icon: 'ti-clock',
    text: 'Ticket médio caiu 3% — considere revisar mix de serviços.',
    detail: 'Meta sugerida: R$ 52,00.',
  },
]

const BARBERS: BarberStat[] = [
  { initials: 'BB', name: 'Braian Braun', atendimentos: 8, comissao: 318, faturamento: 530, faturamentoMax: 530, top: true },
  { initials: 'TW', name: 'Thomas Wolf',  atendimentos: 5, comissao: 69,  faturamento: 115, faturamentoMax: 530 },
]

const DAILY_BARS: DailyBar[] = [
  { label: '31/05', pct: 20 },
  { label: '03/06', pct: 35 },
  { label: '07/06', pct: 50 },
  { label: '11/06', pct: 40 },
  { label: '14/06', pct: 65 },
  { label: '18/06', pct: 100 },
  { label: '22/06', pct: 55 },
]

const HOUR_PEAKS: HourPeak[] = [
  { hour: '09h', count: 3,  max: 10 },
  { hour: '10h', count: 5,  max: 10 },
  { hour: '14h', count: 10, max: 10 },
  { hour: '16h', count: 7,  max: 10 },
  { hour: '18h', count: 4,  max: 10 },
]

const META_ATUAL = 975
const META_TOTAL = 1200
const PREVISAO   = 1290
const DIAS_SEM_RECEITA = 3

// ─── helpers ──────────────────────────────────────────────────────────────────

function TrendBadge({ trend, sub }: { trend: KpiItem['trend']; sub: string }) {
  if (trend === 'up')
    return (
      <span className="text-[11px] text-[color:var(--color-text-success)] flex items-center gap-0.5 mt-0.5">
        <i className="ti ti-arrow-up-right text-[11px]" aria-hidden="true" /> {sub}
      </span>
    )
  if (trend === 'down')
    return (
      <span className="text-[11px] text-[color:var(--color-text-danger)] flex items-center gap-0.5 mt-0.5">
        <i className="ti ti-arrow-down-right text-[11px]" aria-hidden="true" /> {sub}
      </span>
    )
  return <span className="text-[11px] text-[color:var(--color-text-secondary)] mt-0.5">{sub}</span>
}

const INSIGHT_STYLES: Record<InsightItem['type'], { wrap: string; icon: string }> = {
  success: { wrap: 'bg-[#EAF3DE]', icon: 'text-[#3B6D11]' },
  info:    { wrap: 'bg-[#E6F1FB]', icon: 'text-[#185FA5]' },
  warning: { wrap: 'bg-[#FAEEDA]', icon: 'text-[#854F0B]' },
  danger:  { wrap: 'bg-[#FCEBEB]', icon: 'text-[#A32D2D]' },
}

// ─── componente principal ─────────────────────────────────────────────────────

export default function RelatorioExecutivoPage() {
  const [periodo, setPeriodo] = useState<Periodo>('mensal')

  const metaPct = Math.round((META_ATUAL / META_TOTAL) * 100)

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-[11px] tracking-[.08em] text-[#378ADD] font-medium mb-1 uppercase">
            Relatórios executivos
          </p>
          <h1 className="text-[22px] font-medium text-[color:var(--color-text-primary)]">
            Panorama do negócio
          </h1>
          <p className="text-[12px] text-[color:var(--color-text-secondary)] mt-1 max-w-sm leading-relaxed">
            Análise gerencial para decidir preço, equipe, agenda, estoque e previsão de receita.
          </p>
        </div>
        <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#1a6ef5] text-white text-[13px] font-medium shrink-0 hover:bg-[#1560d8] transition-colors border border-[#1a6ef5]">
          <i className="ti ti-download" aria-hidden="true" /> Exportar PDF premium
        </button>
      </div>

      {/* Abas de período */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {(Object.keys(PERIODO_LABELS) as Periodo[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriodo(p)}
            className={[
              'px-3.5 py-1.5 rounded-full text-[13px] border cursor-pointer transition-colors',
              periodo === p
                ? 'bg-[#1a6ef5] text-white border-[#1a6ef5] font-medium'
                : 'bg-[color:var(--color-background-primary)] text-[color:var(--color-text-secondary)] border-[color:var(--color-border-secondary)]',
            ].join(' ')}
          >
            {PERIODO_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5 mb-5">
        <span className="text-[11px] px-2.5 py-1 rounded-full font-medium bg-[#E6F1FB] text-[#0C447C]">
          01/06/2026 até 23/06/2026
        </span>
        <span className="text-[11px] px-2.5 py-1 rounded-full font-medium bg-[#E1F5EE] text-[#085041]">
          BW Pro e superior
        </span>
        <span className="text-[11px] px-2.5 py-1 rounded-full font-medium bg-[color:var(--color-background-secondary)] text-[color:var(--color-text-secondary)]">
          PDF executivo
        </span>
      </div>

      {/* Hero — Score + KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mb-2.5">

        {/* Score card */}
        <div className="bg-[color:var(--color-background-secondary)] rounded-xl p-5 flex flex-col justify-between">
          <p className="text-[11px] tracking-[.06em] text-[color:var(--color-text-secondary)] uppercase mb-3">
            Score da operação
          </p>
          <div>
            <span className="text-[48px] font-medium text-[color:var(--color-text-primary)] leading-none">77</span>
            <span className="text-[20px] text-[color:var(--color-text-secondary)]"> /100</span>
          </div>
          <div className="h-1.5 bg-[color:var(--color-border-tertiary)] rounded-full overflow-hidden my-3">
            <div className="h-full rounded-full bg-[#1a6ef5]" style={{ width: '77%' }} />
          </div>
          <p className="text-[14px] font-medium text-[color:var(--color-text-primary)] mb-1">Operação saudável</p>
          <p className="text-[12px] text-[color:var(--color-text-secondary)] leading-relaxed">
            Baseado em receita, margem, ocupação, cancelamentos e ritmo do período.
          </p>
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-2 gap-2.5">
          {KPI_ITEMS.map((k) => (
            <div key={k.label} className="bg-[color:var(--color-background-secondary)] rounded-lg p-3.5">
              <p className="text-[11px] text-[color:var(--color-text-secondary)] mb-1">{k.label}</p>
              <p className="text-[22px] font-medium text-[color:var(--color-text-primary)]">{k.value}</p>
              <TrendBadge trend={k.trend} sub={k.sub} />
            </div>
          ))}
        </div>
      </div>

      {/* Alerta de previsão */}
      <div className="flex items-center gap-2.5 bg-[color:var(--color-background-warning)] border border-[color:var(--color-border-warning)] rounded-lg px-3.5 py-2.5 mb-2.5">
        <i className="ti ti-alert-triangle text-[color:var(--color-text-warning)] text-[16px] shrink-0" aria-hidden="true" />
        <span className="text-[13px] text-[color:var(--color-text-warning)]">
          <strong className="font-medium">Previsão de fechamento:</strong> R$ {PREVISAO.toLocaleString('pt-BR')} até 30/06 se o ritmo atual se mantiver — R$ {(PREVISAO - META_TOTAL).toLocaleString('pt-BR')} acima da meta mensal.
        </span>
      </div>

      {/* Fluxo de receita + Insights */}
      <div className="grid grid-cols-1 md:grid-cols-[1.6fr_1fr] gap-2.5 mb-2.5">

        {/* Gráfico diário */}
        <div className="bg-[color:var(--color-background-primary)] border border-[color:var(--color-border-tertiary)] rounded-xl p-4">
          <div className="flex justify-between items-baseline mb-3">
            <span className="text-[13px] font-medium text-[color:var(--color-text-primary)]">Fluxo de receita</span>
            <span className="text-[11px] text-[color:var(--color-text-secondary)]">junho 2026</span>
          </div>
          <div
            className="flex items-end gap-1 h-[100px]"
            role="img"
            aria-label="Gráfico de faturamento diário de junho 2026"
          >
            {DAILY_BARS.map((b) => (
              <div key={b.label} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex justify-center items-end" style={{ height: 76 }}>
                  <div
                    className="w-[80%] rounded-t-[2px] bg-[#1a6ef5]"
                    style={{ height: `${b.pct}%`, opacity: b.pct === 100 ? 1 : 0.65 }}
                  />
                </div>
                <span className="text-[10px] text-[color:var(--color-text-secondary)]">{b.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Insights */}
        <div className="bg-[color:var(--color-background-primary)] border border-[color:var(--color-border-tertiary)] rounded-xl p-4">
          <p className="text-[13px] font-medium text-[color:var(--color-text-primary)] mb-3">Insights automáticos</p>
          <div className="flex flex-col gap-2">
            {INSIGHTS.map((ins) => {
              const s = INSIGHT_STYLES[ins.type]
              return (
                <div
                  key={ins.text}
                  className="flex items-start gap-2.5 p-2.5 bg-[color:var(--color-background-secondary)] rounded-lg"
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${s.wrap}`}>
                    <i className={`ti ${ins.icon} text-[14px] ${s.icon}`} aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-[12px] text-[color:var(--color-text-primary)] leading-relaxed">{ins.text}</p>
                    <p className="text-[11px] text-[color:var(--color-text-secondary)] mt-0.5">{ins.detail}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Barbeiros + Horários de pico */}
      <div className="grid grid-cols-1 md:grid-cols-[1.6fr_1fr] gap-2.5 mb-2.5">

        {/* Desempenho por barbeiro */}
        <div className="bg-[color:var(--color-background-primary)] border border-[color:var(--color-border-tertiary)] rounded-xl p-4">
          <div className="flex justify-between items-baseline mb-3">
            <span className="text-[13px] font-medium text-[color:var(--color-text-primary)]">Desempenho por barbeiro</span>
            <span className="text-[11px] text-[color:var(--color-text-secondary)]">faturamento e atendimentos</span>
          </div>
          <div className="flex flex-col">
            {BARBERS.map((b, i) => (
              <div
                key={b.name}
                className={`flex items-center gap-2.5 py-2.5 ${i < BARBERS.length - 1 ? 'border-b border-[color:var(--color-border-tertiary)]' : ''}`}
              >
                <div
                  className="w-[30px] h-[30px] rounded-full flex items-center justify-center text-[11px] font-medium shrink-0"
                  style={{
                    background: b.top ? '#E6F1FB' : 'var(--color-background-secondary)',
                    color: b.top ? '#0C447C' : 'var(--color-text-secondary)',
                  }}
                >
                  {b.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-[color:var(--color-text-primary)]">{b.name}</p>
                  <p className="text-[11px] text-[color:var(--color-text-secondary)]">
                    {b.atendimentos} atendimentos · comissão R$ {b.comissao}
                  </p>
                  <div className="h-1 bg-[color:var(--color-background-secondary)] rounded-full overflow-hidden mt-1.5">
                    <div
                      className="h-full rounded-full bg-[#1a6ef5]"
                      style={{
                        width: `${(b.faturamento / b.faturamentoMax) * 100}%`,
                        opacity: b.top ? 1 : 0.6,
                      }}
                    />
                  </div>
                </div>
                <span className="text-[13px] font-medium text-[color:var(--color-text-primary)] shrink-0">
                  R$ {b.faturamento}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Horários de pico */}
        <div className="bg-[color:var(--color-background-primary)] border border-[color:var(--color-border-tertiary)] rounded-xl p-4">
          <div className="flex justify-between items-baseline mb-3">
            <span className="text-[13px] font-medium text-[color:var(--color-text-primary)]">Horários de pico</span>
            <span className="text-[11px] text-[color:var(--color-text-secondary)]">atendimentos por hora</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {HOUR_PEAKS.map((h) => (
              <div key={h.hour} className="flex items-center gap-2">
                <span className="text-[11px] text-[color:var(--color-text-secondary)] w-9">{h.hour}</span>
                <div className="flex-1 h-5 bg-[color:var(--color-background-secondary)] rounded overflow-hidden">
                  <div
                    className="h-full rounded bg-[#1a6ef5]"
                    style={{
                      width: `${(h.count / h.max) * 100}%`,
                      opacity: h.count === h.max ? 1 : 0.5 + (h.count / h.max) * 0.35,
                    }}
                  />
                </div>
                <span className="text-[11px] text-[color:var(--color-text-secondary)] w-5 text-right">{h.count}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-2.5 border-t border-[color:var(--color-border-tertiary)] text-[12px] text-[color:var(--color-text-secondary)]">
            <i className="ti ti-bulb text-[13px] mr-1 align-[-2px]" aria-hidden="true" />
            Pico às 14h — considere reforço de agenda.
          </div>
        </div>
      </div>

      {/* Meta + Previsão + Dias sem receita */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">

        <div className="bg-[color:var(--color-background-secondary)] rounded-lg p-3.5">
          <p className="text-[11px] text-[color:var(--color-text-secondary)] mb-1">Meta do mês</p>
          <p className="text-[18px] font-medium text-[color:var(--color-text-primary)]">
            R$ {META_ATUAL.toLocaleString('pt-BR')}{' '}
            <span className="text-[13px] font-normal text-[color:var(--color-text-secondary)]">
              / R$ {META_TOTAL.toLocaleString('pt-BR')}
            </span>
          </p>
          <div className="h-1.5 bg-[color:var(--color-border-tertiary)] rounded-full overflow-hidden my-2">
            <div className="h-full rounded-full bg-[#1a6ef5]" style={{ width: `${metaPct}%` }} />
          </div>
          <p className="text-[11px] text-[color:var(--color-text-secondary)]">
            {metaPct}% atingido · faltam R$ {(META_TOTAL - META_ATUAL).toLocaleString('pt-BR')}
          </p>
        </div>

        <div className="bg-[color:var(--color-background-secondary)] rounded-lg p-3.5">
          <p className="text-[11px] text-[color:var(--color-text-secondary)] mb-1">Previsão de fechamento</p>
          <p className="text-[18px] font-medium text-[color:var(--color-text-success)]">
            R$ {PREVISAO.toLocaleString('pt-BR')}
          </p>
          <p className="text-[11px] text-[color:var(--color-text-secondary)] mt-1">
            +R$ {(PREVISAO - META_TOTAL).toLocaleString('pt-BR')} acima da meta se ritmo mantido
          </p>
        </div>

        <div className="bg-[color:var(--color-background-secondary)] rounded-lg p-3.5">
          <p className="text-[11px] text-[color:var(--color-text-secondary)] mb-1">Dias sem receita</p>
          <p className="text-[18px] font-medium text-[color:var(--color-text-primary)]">{DIAS_SEM_RECEITA}</p>
          <p className="text-[11px] text-[color:var(--color-text-secondary)] mt-1">
            dias sem atendimento em junho
          </p>
        </div>

      </div>
    </div>
  )
}
