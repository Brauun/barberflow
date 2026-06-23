import { useState } from 'react'

// ─── tipos ────────────────────────────────────────────────────────────────────

type Periodo = 'hoje' | 'semana' | 'mes' | 'ano'

interface KpiCard {
  label: string
  value: string
  delta: string
  deltaType: 'up' | 'down' | 'neutral'
}

interface BarberRow {
  initials: string
  name: string
  atendimentos: number
  faturamento: number
  faturamentoMax: number
  top?: boolean
}

interface ProdutoRow {
  name: string
  unidades: number
  total: number
}

interface DailyBar {
  day: number
  pct: number
  highlight?: boolean
}

// ─── dados mock ───────────────────────────────────────────────────────────────

const KPI_CARDS: KpiCard[] = [
  { label: 'Receita serviços', value: 'R$ 645',   delta: '+12% vs mês ant.', deltaType: 'up' },
  { label: 'Receita produtos', value: 'R$ 330',   delta: '+8% vs mês ant.',  deltaType: 'up' },
  { label: 'Despesas',         value: 'R$ 0',     delta: 'Sem despesas no período', deltaType: 'neutral' },
  { label: 'Lucro líquido',    value: 'R$ 588',   delta: 'margem 61%',       deltaType: 'up' },
  { label: 'Comissões',        value: 'R$ 387',   delta: '60% dos serviços', deltaType: 'neutral' },
  { label: 'Ticket médio',     value: 'R$ 49,62', delta: '-3% vs mês ant.',  deltaType: 'down' },
]

const DAILY_BARS: DailyBar[] = [
  { day: 1,  pct: 30 },
  { day: 5,  pct: 55 },
  { day: 8,  pct: 40 },
  { day: 12, pct: 80, highlight: true },
  { day: 15, pct: 60 },
  { day: 18, pct: 45 },
  { day: 20, pct: 100, highlight: true },
  { day: 22, pct: 50 },
]

const BARBERS: BarberRow[] = [
  { initials: 'BB', name: 'Braian Braun', atendimentos: 8, faturamento: 530, faturamentoMax: 530, top: true },
  { initials: 'TW', name: 'Thomas Wolf',  atendimentos: 5, faturamento: 115, faturamentoMax: 530 },
]

const PRODUTOS: ProdutoRow[] = [
  { name: 'Pomada matte',           unidades: 2, total: 140 },
  { name: 'Cerveja Heineken 330ml', unidades: 4, total: 40 },
]

// ─── helpers ──────────────────────────────────────────────────────────────────

const PERIODO_LABELS: Record<Periodo, string> = {
  hoje:   'Hoje',
  semana: 'Esta semana',
  mes:    'Este mês',
  ano:    'Este ano',
}

function DeltaIcon({ type }: { type: KpiCard['deltaType'] }) {
  if (type === 'up')   return <i className="ti ti-arrow-up-right text-[12px]" aria-hidden="true" />
  if (type === 'down') return <i className="ti ti-arrow-down-right text-[12px]" aria-hidden="true" />
  return null
}

function deltaClass(type: KpiCard['deltaType']) {
  if (type === 'up')   return 'text-emerald-400'
  if (type === 'down') return 'text-red-400'
  return 'text-white/40'
}

// ─── componente principal ─────────────────────────────────────────────────────

export default function RelatoriosPage() {
  const [periodo, setPeriodo] = useState<Periodo>('mes')

  return (
    <div className="min-h-screen bg-[#0f1117] text-white p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-4">

        {/* Header */}
        <div className="mb-2">
          <h1 className="text-[22px] font-bold text-white">Relatórios</h1>
          <p className="text-[13px] text-white/50 mt-0.5">
            Visão consolidada da operação — escolha o período e o recorte
          </p>
        </div>

        {/* Barra de período */}
        <div className="flex flex-wrap items-center gap-2">
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

          <div className="w-px h-5 bg-white/10 mx-1" aria-hidden="true" />

          <div className="flex items-center gap-1.5 text-[13px] text-white/50 bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg">
            <i className="ti ti-calendar text-[14px]" aria-hidden="true" />
            <span>01/06/2026</span>
            <span className="text-white/25">→</span>
            <span>22/06/2026</span>
          </div>

          <div className="flex gap-2 ml-auto">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/15 bg-transparent text-white/70 text-[13px] cursor-pointer hover:bg-white/5 transition-colors">
              <i className="ti ti-file-spreadsheet" aria-hidden="true" /> Excel
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[13px] font-semibold cursor-pointer transition-colors">
              <i className="ti ti-file-download" aria-hidden="true" /> PDF
            </button>
          </div>
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {KPI_CARDS.map((card) => (
            <div
              key={card.label}
              className="bg-[#161b27] border border-white/8 rounded-xl p-4"
            >
              <div className="text-[11px] uppercase tracking-[0.04em] text-white/40 mb-2">
                {card.label}
              </div>
              <div className="text-[22px] font-bold text-white leading-tight">
                {card.value}
              </div>
              <div className={`text-[12px] mt-1.5 flex items-center gap-0.5 ${deltaClass(card.deltaType)}`}>
                <DeltaIcon type={card.deltaType} />
                {card.delta}
              </div>
            </div>
          ))}
        </div>

        {/* Gráfico diário */}
        <div className="bg-[#161b27] border border-white/8 rounded-xl p-5">
          <div className="flex justify-between items-baseline mb-4">
            <span className="text-[14px] font-semibold text-white">Faturamento diário</span>
            <span className="text-[12px] text-white/40">junho 2026</span>
          </div>
          <div
            className="flex items-end gap-2 h-[90px]"
            role="img"
            aria-label="Gráfico de faturamento diário de junho 2026"
          >
            {DAILY_BARS.map(({ day, pct, highlight }) => (
              <div key={day} className="flex-1 flex flex-col items-center gap-1.5">
                <div className="w-full flex justify-center items-end" style={{ height: 68 }}>
                  <div
                    className="w-full rounded-t-[3px]"
                    style={{
                      height: `${pct}%`,
                      background: highlight ? '#3b82f6' : 'rgba(59,130,246,0.4)',
                    }}
                  />
                </div>
                <span className="text-[10px] text-white/35">{day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Barbeiros + Produtos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

          {/* Barbeiros por faturamento */}
          <div className="bg-[#161b27] border border-white/8 rounded-xl p-5">
            <div className="flex justify-between items-baseline mb-4">
              <span className="text-[14px] font-semibold text-white">Barbeiros</span>
              <span className="text-[12px] text-white/40">por faturamento</span>
            </div>
            <div className="flex flex-col gap-3">
              {BARBERS.map((b) => (
                <div key={b.name} className="flex items-center gap-3">
                  <span className="text-[13px] text-white/50 w-[110px] shrink-0 truncate">
                    {b.name}
                  </span>
                  <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{
                        width: `${(b.faturamento / b.faturamentoMax) * 100}%`,
                        opacity: b.top ? 1 : 0.5,
                      }}
                    />
                  </div>
                  <span className="text-[13px] font-semibold text-white w-[60px] text-right shrink-0">
                    R$ {b.faturamento}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Produtos mais vendidos */}
          <div className="bg-[#161b27] border border-white/8 rounded-xl p-5">
            <p className="text-[14px] font-semibold text-white mb-4">Produtos mais vendidos</p>
            <div className="flex flex-col divide-y divide-white/8">
              {PRODUTOS.map((p) => (
                <div key={p.name} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-[13px] text-white">{p.name}</p>
                    <p className="text-[11px] text-white/40 mt-0.5">{p.unidades} unidades</p>
                  </div>
                  <span className="text-[14px] font-bold text-white">R$ {p.total}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Atendimentos + Distribuição */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

          {/* Atendimentos por barbeiro */}
          <div className="bg-[#161b27] border border-white/8 rounded-xl p-5">
            <div className="flex justify-between items-baseline mb-4">
              <span className="text-[14px] font-semibold text-white">Atendimentos</span>
              <span className="text-[12px] text-white/40">por barbeiro</span>
            </div>
            <div className="flex flex-col divide-y divide-white/8">
              {BARBERS.map((b) => (
                <div key={b.name} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0"
                      style={{
                        background: b.top ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.07)',
                        color: b.top ? '#60a5fa' : 'rgba(255,255,255,0.4)',
                      }}
                    >
                      {b.initials}
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-white">{b.name}</p>
                      <p className="text-[11px] text-white/40 mt-0.5">{b.atendimentos} atendimentos</p>
                    </div>
                  </div>
                  {b.top ? (
                    <span className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 font-semibold">
                      Top
                    </span>
                  ) : (
                    <span className="text-[14px] font-bold text-white">{b.atendimentos}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Distribuição da receita */}
          <div className="bg-[#161b27] border border-white/8 rounded-xl p-5">
            <p className="text-[14px] font-semibold text-white mb-4">Distribuição da receita</p>
            <div className="flex flex-col gap-4">
              <div>
                <div className="flex justify-between text-[13px] mb-2">
                  <span className="text-white/50">Serviços</span>
                  <span className="text-white font-semibold">66%</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-blue-500" style={{ width: '66%' }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[13px] mb-2">
                  <span className="text-white/50">Produtos</span>
                  <span className="text-white font-semibold">34%</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-[#5DCAA5]" style={{ width: '34%' }} />
                </div>
              </div>
              <div className="pt-3 border-t border-white/8 flex justify-between items-center">
                <span className="text-[13px] text-white/50">Total bruto</span>
                <span className="text-[18px] font-bold text-white">R$ 975</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
