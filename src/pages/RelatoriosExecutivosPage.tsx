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
  { label: 'Receita período', value: 'R$ 975',   sub: '+100% vs anterior', trend: 'up' },
  { label: 'Lucro líquido',   value: 'R$ 588',   sub: 'margem 60,3%',      trend: 'up' },
  { label: 'Comissões',       value: 'R$ 387',   sub: '60% dos serviços',  trend: 'neutral' },
  { label: 'Ticket médio',    value: 'R$ 49,62', sub: '-3% vs anterior',   trend: 'down' },
  { label: 'Clientes ativos', value: '3',        sub: 'no período',        trend: 'neutral' },
  { label: 'Atendimentos',    value: '13',       sub: '+2 vs anterior',    trend: 'up' },
]

const INSIGHTS: InsightItem[] = [
  { type: 'success', icon: 'ti-trending-up', text: 'Receita 100% acima do período anterior.', detail: 'Melhor mês desde o início.' },
  { type: 'info',    icon: 'ti-user',        text: 'Braian Braun gerou 54,4% do faturamento.', detail: 'R$ 530 de R$ 975 totais.' },
  { type: 'warning', icon: 'ti-package',     text: 'Cerveja Heineken lidera produtos com 4 vendas.', detail: 'Estoque: revisar antes da próxima semana.' },
  { type: 'danger',  icon: 'ti-clock',       text: 'Ticket médio caiu 3% — revisar mix de serviços.', detail: 'Meta sugerida: R$ 52,00.' },
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
      <span className="flex items-center gap-1 text-[13px] text-emerald-400 mt-1">
        <i className="ti ti-arrow-up-right text-[12px]" aria-hidden="true" />
        {sub}
      </span>
    )
  if (trend === 'down')
    return (
      <span className="flex items-center gap-1 text-[13px] text-red-400 mt-1">
        <i className="ti ti-arrow-down-right text-[12px]" aria-hidden="true" />
        {sub}
      </span>
    )
  return <span className="text-[13px] text-white/40 mt-1 block">{sub}</span>
}

const INSIGHT_ICON_STYLE: Record<InsightItem['type'], string> = {
  success: 'bg-emerald-500/20 text-emerald-400',
  info:    'bg-blue-500/20 text-blue-400',
  warning: 'bg-amber-500/20 text-amber-400',
  danger:  'bg-red-500/20 text-red-400',
}

// ─── componente ───────────────────────────────────────────────────────────────

export default function RelatorioExecutivosPage() {
  const [periodo, setPeriodo] = useState<Periodo>('mensal')
  const metaPct = Math.round((META_ATUAL / META_TOTAL) * 100)

  return (
    <div className="min-h-screen bg-[#0f1117] text-white p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-semibold tracking-widest text-blue-400 uppercase mb-1">
              Relatórios executivos
            </p>
            <h1 className="text-[28px] font-bold text-white leading-tight">Panorama do negócio</h1>
            <p className="text-[13px] text-white/50 mt-1 max-w-sm leading-relaxed">
              Análise gerencial para decidir preço, equipe, agenda, estoque e previsão de receita.
            </p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 transition-colors text-white text-[13px] font-semibold shrink-0">
            <i className="ti ti-download" aria-hidden="true" />
            Exportar PDF premium
          </button>
        </div>

        {/* Abas de período */}
        <div className="flex flex-wrap gap-2">
          {(Object.keys(PERIODO_LABELS) as Periodo[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className={[
                'px-4 py-1.5 rounded-full text-[13px] font-medium border transition-colors cursor-pointer',
                periodo === p
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-transparent text-white/60 border-white/15 hover:border-white/30',
              ].join(' ')}
            >
              {PERIODO_LABELS[p]}
            </button>
          ))}
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-2">
          <span className="text-[12px] px-3 py-1 rounded-full font-medium border border-blue-500/40 text-blue-300 bg-blue-500/10">
            01/06/2026 até 23/06/2026
          </span>
          <span className="text-[12px] px-3 py-1 rounded-full font-medium border border-emerald-500/40 text-emerald-300 bg-emerald-500/10">
            BW Pro e superior
          </span>
          <span className="text-[12px] px-3 py-1 rounded-full font-medium border border-white/10 text-white/40 bg-white/5">
            PDF executivo
          </span>
        </div>

        {/* Hero — Score + KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

          {/* Score */}
          <div className="bg-[#161b27] border border-white/8 rounded-xl p-5 flex flex-col justify-between min-h-[200px]">
            <p className="text-[11px] font-semibold tracking-widest text-white/40 uppercase">
              Score da operação
            </p>
            <div className="mt-3">
              <span className="text-[56px] font-bold text-white leading-none">77</span>
              <span className="text-[22px] text-white/40"> /100</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden my-4">
              <div className="h-full rounded-full bg-blue-500" style={{ width: '77%' }} />
            </div>
            <div>
              <p className="text-[15px] font-bold text-white">Operação saudável</p>
              <p className="text-[12px] text-white/40 mt-1 leading-relaxed">
                Baseado em receita, margem, ocupação, cancelamentos e ritmo do período.
              </p>
            </div>
          </div>

          {/* KPI grid */}
          <div className="grid grid-cols-2 gap-3">
            {KPI_ITEMS.map((k) => (
              <div
                key={k.label}
                className="bg-[#161b27] border border-white/8 rounded-xl p-4 flex flex-col"
              >
                <p className="text-[12px] text-white/50">{k.label}</p>
                <p className="text-[24px] font-bold text-white mt-1 leading-tight">{k.value}</p>
                <TrendBadge trend={k.trend} sub={k.sub} />
              </div>
            ))}
          </div>
        </div>

        {/* Alerta previsão */}
        <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-3">
          <i className="ti ti-alert-triangle text-amber-400 text-[18px] shrink-0" aria-hidden="true" />
          <p className="text-[13px] text-amber-200">
            <span className="font-semibold">Previsão de fechamento:</span> R$ {PREVISAO.toLocaleString('pt-BR')} até 30/06 se o ritmo atual se mantiver — R$ {(PREVISAO - META_TOTAL).toLocaleString('pt-BR')} acima da meta mensal.
          </p>
        </div>

        {/* Fluxo de receita + Insights */}
        <div className="grid grid-cols-1 md:grid-cols-[1.6fr_1fr] gap-3">

          {/* Gráfico de barras */}
          <div className="bg-[#161b27] border border-white/8 rounded-xl p-5">
            <div className="flex justify-between items-baseline mb-4">
              <p className="text-[14px] font-semibold text-white">Fluxo de receita</p>
              <p className="text-[12px] text-white/40">junho 2026</p>
            </div>
            <div
              className="flex items-end gap-2"
              style={{ height: 110 }}
              role="img"
              aria-label="Gráfico de faturamento diário de junho 2026"
            >
              {DAILY_BARS.map((b) => (
                <div key={b.label} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="w-full flex justify-center items-end" style={{ height: 82 }}>
                    <div
                      className="w-full rounded-t-[3px]"
                      style={{
                        height: `${b.pct}%`,
                        background: b.pct === 100 ? '#3b82f6' : 'rgba(59,130,246,0.45)',
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-white/35 whitespace-nowrap">{b.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Insights */}
          <div className="bg-[#161b27] border border-white/8 rounded-xl p-5">
            <p className="text-[14px] font-semibold text-white mb-4">Insights automáticos</p>
            <div className="flex flex-col gap-3">
              {INSIGHTS.map((ins) => (
                <div key={ins.text} className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${INSIGHT_ICON_STYLE[ins.type]}`}>
                    <i className={`ti ${ins.icon} text-[15px]`} aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-white leading-snug">{ins.text}</p>
                    <p className="text-[11px] text-white/40 mt-0.5">{ins.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Barbeiros + Horários de pico */}
        <div className="grid grid-cols-1 md:grid-cols-[1.6fr_1fr] gap-3">

          {/* Barbeiros */}
          <div className="bg-[#161b27] border border-white/8 rounded-xl p-5">
            <div className="flex justify-between items-baseline mb-4">
              <p className="text-[14px] font-semibold text-white">Desempenho por barbeiro</p>
              <p className="text-[12px] text-white/40">faturamento e atendimentos</p>
            </div>
            <div className="flex flex-col divide-y divide-white/8">
              {BARBERS.map((b) => (
                <div key={b.name} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0"
                    style={{
                      background: b.top ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.07)',
                      color: b.top ? '#60a5fa' : 'rgba(255,255,255,0.4)',
                    }}
                  >
                    {b.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-white">{b.name}</p>
                    <p className="text-[11px] text-white/40 mt-0.5">
                      {b.atendimentos} atendimentos · comissão R$ {b.comissao}
                    </p>
                    <div className="h-1 bg-white/10 rounded-full overflow-hidden mt-2">
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{
                          width: `${(b.faturamento / b.faturamentoMax) * 100}%`,
                          opacity: b.top ? 1 : 0.5,
                        }}
                      />
                    </div>
                  </div>
                  <p className="text-[14px] font-bold text-white shrink-0">R$ {b.faturamento}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Horários de pico */}
          <div className="bg-[#161b27] border border-white/8 rounded-xl p-5">
            <div className="flex justify-between items-baseline mb-4">
              <p className="text-[14px] font-semibold text-white">Horários de pico</p>
              <p className="text-[12px] text-white/40">por hora</p>
            </div>
            <div className="flex flex-col gap-2.5">
              {HOUR_PEAKS.map((h) => (
                <div key={h.hour} className="flex items-center gap-3">
                  <span className="text-[12px] text-white/40 w-9 shrink-0">{h.hour}</span>
                  <div className="flex-1 h-5 bg-white/8 rounded overflow-hidden">
                    <div
                      className="h-full rounded"
                      style={{
                        width: `${(h.count / h.max) * 100}%`,
                        background: h.count === h.max ? '#3b82f6' : 'rgba(59,130,246,0.45)',
                      }}
                    />
                  </div>
                  <span className="text-[12px] text-white/40 w-5 text-right shrink-0">{h.count}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-white/8 text-[12px] text-white/40 flex items-center gap-1.5">
              <i className="ti ti-bulb text-amber-400 text-[14px]" aria-hidden="true" />
              Pico às 14h — considere reforço de agenda.
            </div>
          </div>
        </div>

        {/* Meta + Previsão + Dias sem receita */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

          <div className="bg-[#161b27] border border-white/8 rounded-xl p-4">
            <p className="text-[12px] text-white/50 mb-1">Meta do mês</p>
            <p className="text-[22px] font-bold text-white">
              R$ {META_ATUAL.toLocaleString('pt-BR')}
              <span className="text-[14px] font-normal text-white/35 ml-1">
                / R$ {META_TOTAL.toLocaleString('pt-BR')}
              </span>
            </p>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden my-2.5">
              <div className="h-full rounded-full bg-blue-500" style={{ width: `${metaPct}%` }} />
            </div>
            <p className="text-[12px] text-white/40">
              {metaPct}% atingido · faltam R$ {(META_TOTAL - META_ATUAL).toLocaleString('pt-BR')}
            </p>
          </div>

          <div className="bg-[#161b27] border border-white/8 rounded-xl p-4">
            <p className="text-[12px] text-white/50 mb-1">Previsão de fechamento</p>
            <p className="text-[22px] font-bold text-emerald-400">
              R$ {PREVISAO.toLocaleString('pt-BR')}
            </p>
            <p className="text-[12px] text-white/40 mt-2">
              +R$ {(PREVISAO - META_TOTAL).toLocaleString('pt-BR')} acima da meta se ritmo mantido
            </p>
          </div>

          <div className="bg-[#161b27] border border-white/8 rounded-xl p-4">
            <p className="text-[12px] text-white/50 mb-1">Dias sem receita</p>
            <p className="text-[22px] font-bold text-white">{DIAS_SEM_RECEITA}</p>
            <p className="text-[12px] text-white/40 mt-2">dias sem atendimento em junho</p>
          </div>

        </div>
      </div>
    </div>
  )
}
