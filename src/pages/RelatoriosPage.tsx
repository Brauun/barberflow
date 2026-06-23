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
  { label: 'Receita serviços', value: 'R$ 645', delta: '+12% vs mês ant.', deltaType: 'up' },
  { label: 'Receita produtos', value: 'R$ 330', delta: '+8% vs mês ant.', deltaType: 'up' },
  { label: 'Despesas', value: 'R$ 0', delta: 'Sem despesas no período', deltaType: 'neutral' },
  { label: 'Lucro líquido', value: 'R$ 588', delta: 'margem 61%', deltaType: 'up' },
  { label: 'Comissões', value: 'R$ 387', delta: '60% dos serviços', deltaType: 'neutral' },
  { label: 'Ticket médio', value: 'R$ 49,62', delta: '-3% vs mês ant.', deltaType: 'down' },
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
  { name: 'Pomada matte',        unidades: 2, total: 140 },
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
  if (type === 'up')   return <i className="ti ti-arrow-up-right text-[11px]" aria-hidden="true" />
  if (type === 'down') return <i className="ti ti-arrow-down-right text-[11px]" aria-hidden="true" />
  return null
}

function deltaClass(type: KpiCard['deltaType']) {
  if (type === 'up')   return 'text-[color:var(--color-text-success)]'
  if (type === 'down') return 'text-[color:var(--color-text-danger)]'
  return 'text-[color:var(--color-text-secondary)]'
}

// ─── componente principal ─────────────────────────────────────────────────────

export default function RelatoriosPage() {
  const [periodo, setPeriodo] = useState<Periodo>('mes')

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[20px] font-medium text-[color:var(--color-text-primary)]">Relatórios</h1>
        <p className="text-[13px] text-[color:var(--color-text-secondary)] mt-0.5">
          Visão consolidada da operação — escolha o período e o recorte
        </p>
      </div>

      {/* Barra de período */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {(Object.keys(PERIODO_LABELS) as Periodo[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriodo(p)}
            className={[
              'px-3.5 py-1.5 rounded-full text-[13px] border cursor-pointer transition-colors',
              periodo === p
                ? 'bg-[color:var(--color-background-info)] text-[color:var(--color-text-info)] border-[color:var(--color-border-info)] font-medium'
                : 'bg-[color:var(--color-background-primary)] text-[color:var(--color-text-secondary)] border-[color:var(--color-border-secondary)]',
            ].join(' ')}
          >
            {PERIODO_LABELS[p]}
          </button>
        ))}

        <div className="w-px h-5 bg-[color:var(--color-border-tertiary)] mx-1" aria-hidden="true" />

        <div className="flex items-center gap-1.5 text-[13px] text-[color:var(--color-text-secondary)] bg-[color:var(--color-background-secondary)] border border-[color:var(--color-border-tertiary)] px-2.5 py-1 rounded-lg">
          <i className="ti ti-calendar text-[14px]" aria-hidden="true" />
          <span>01/06/2026</span>
          <span className="text-[color:var(--color-text-tertiary)]">→</span>
          <span>22/06/2026</span>
        </div>

        <div className="flex gap-1.5 ml-auto">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[color:var(--color-border-secondary)] bg-[color:var(--color-background-primary)] text-[color:var(--color-text-primary)] text-[13px] cursor-pointer hover:bg-[color:var(--color-background-secondary)] transition-colors">
            <i className="ti ti-file-spreadsheet" aria-hidden="true" /> Excel
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a6ef5] text-white text-[13px] cursor-pointer hover:bg-[#1560d8] transition-colors border border-[#1a6ef5]">
            <i className="ti ti-file-download" aria-hidden="true" /> PDF
          </button>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-5">
        {KPI_CARDS.map((card) => (
          <div
            key={card.label}
            className="bg-[color:var(--color-background-secondary)] rounded-lg p-3"
          >
            <div className="text-[11px] uppercase tracking-[0.04em] text-[color:var(--color-text-secondary)] mb-1">
              {card.label}
            </div>
            <div className="text-[20px] font-medium text-[color:var(--color-text-primary)]">
              {card.value}
            </div>
            <div className={`text-[11px] mt-0.5 flex items-center gap-0.5 ${deltaClass(card.deltaType)}`}>
              <DeltaIcon type={card.deltaType} />
              {card.delta}
            </div>
          </div>
        ))}
      </div>

      {/* Gráfico diário */}
      <div className="bg-[color:var(--color-background-primary)] border border-[color:var(--color-border-tertiary)] rounded-xl p-4 mb-2.5">
        <div className="text-[13px] font-medium text-[color:var(--color-text-primary)] mb-3">
          Faturamento diário <span className="text-[11px] font-normal text-[color:var(--color-text-secondary)] ml-1.5">junho 2026</span>
        </div>
        <div className="flex items-end gap-1.5 h-[90px] pt-2" role="img" aria-label="Gráfico de faturamento diário de junho 2026">
          {DAILY_BARS.map(({ day, pct, highlight }) => (
            <div key={day} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex justify-center items-end" style={{ height: 65 }}>
                <div
                  className="w-[70%] rounded-t-[3px]"
                  style={{
                    height: `${pct}%`,
                    background: '#1a6ef5',
                    opacity: highlight ? 1 : 0.7,
                  }}
                />
              </div>
              <span className="text-[10px] text-[color:var(--color-text-secondary)]">{day}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Grid 2 colunas — barbeiros e produtos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mb-2.5">

        {/* Barbeiros por faturamento */}
        <div className="bg-[color:var(--color-background-primary)] border border-[color:var(--color-border-tertiary)] rounded-xl p-4">
          <div className="text-[13px] font-medium text-[color:var(--color-text-primary)] mb-3">
            Barbeiros <span className="text-[11px] font-normal text-[color:var(--color-text-secondary)] ml-1.5">por faturamento</span>
          </div>
          <div className="flex flex-col gap-2.5">
            {BARBERS.map((b) => (
              <div key={b.name} className="flex items-center gap-2">
                <span className="text-[12px] text-[color:var(--color-text-secondary)] w-[100px] shrink-0 truncate">
                  {b.name}
                </span>
                <div className="flex-1 h-1.5 bg-[color:var(--color-background-secondary)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(b.faturamento / b.faturamentoMax) * 100}%`,
                      background: '#1a6ef5',
                      opacity: b.top ? 1 : 0.6,
                    }}
                  />
                </div>
                <span className="text-[12px] text-[color:var(--color-text-primary)] w-[60px] text-right shrink-0">
                  R$ {b.faturamento}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Produtos mais vendidos */}
        <div className="bg-[color:var(--color-background-primary)] border border-[color:var(--color-border-tertiary)] rounded-xl p-4">
          <div className="text-[13px] font-medium text-[color:var(--color-text-primary)] mb-3">
            Produtos mais vendidos
          </div>
          <div className="flex flex-col">
            {PRODUTOS.map((p, i) => (
              <div
                key={p.name}
                className={`flex items-center justify-between py-[7px] ${i < PRODUTOS.length - 1 ? 'border-b border-[color:var(--color-border-tertiary)]' : ''}`}
              >
                <div>
                  <div className="text-[13px] text-[color:var(--color-text-primary)]">{p.name}</div>
                  <div className="text-[11px] text-[color:var(--color-text-secondary)]">{p.unidades} unidades</div>
                </div>
                <div className="text-[13px] font-medium text-[color:var(--color-text-primary)]">
                  R$ {p.total}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Grid 2 colunas — atendimentos e distribuição */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">

        {/* Atendimentos por barbeiro */}
        <div className="bg-[color:var(--color-background-primary)] border border-[color:var(--color-border-tertiary)] rounded-xl p-4">
          <div className="text-[13px] font-medium text-[color:var(--color-text-primary)] mb-3">
            Atendimentos <span className="text-[11px] font-normal text-[color:var(--color-text-secondary)] ml-1.5">por barbeiro</span>
          </div>
          <div className="flex flex-col">
            {BARBERS.map((b, i) => (
              <div
                key={b.name}
                className={`flex items-center justify-between py-[7px] ${i < BARBERS.length - 1 ? 'border-b border-[color:var(--color-border-tertiary)]' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-medium shrink-0"
                    style={{
                      background: b.top
                        ? 'var(--color-background-info)'
                        : 'var(--color-background-secondary)',
                      color: b.top
                        ? 'var(--color-text-info)'
                        : 'var(--color-text-secondary)',
                    }}
                  >
                    {b.initials}
                  </div>
                  <div>
                    <div className="text-[13px] text-[color:var(--color-text-primary)]">{b.name}</div>
                    <div className="text-[11px] text-[color:var(--color-text-secondary)]">
                      {b.atendimentos} atendimentos
                    </div>
                  </div>
                </div>
                {b.top ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[color:var(--color-background-success)] text-[color:var(--color-text-success)] font-medium">
                    Top
                  </span>
                ) : (
                  <span className="text-[13px] font-medium text-[color:var(--color-text-primary)]">
                    {b.atendimentos}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Distribuição da receita */}
        <div className="bg-[color:var(--color-background-primary)] border border-[color:var(--color-border-tertiary)] rounded-xl p-4">
          <div className="text-[13px] font-medium text-[color:var(--color-text-primary)] mb-3">
            Distribuição da receita
          </div>
          <div className="flex flex-col gap-2 mt-1">
            <div>
              <div className="flex justify-between text-[12px] text-[color:var(--color-text-secondary)] mb-1">
                <span>Serviços</span><span>66%</span>
              </div>
              <div className="h-2 bg-[color:var(--color-background-secondary)] rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: '66%', background: '#1a6ef5' }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[12px] text-[color:var(--color-text-secondary)] mb-1">
                <span>Produtos</span><span>34%</span>
              </div>
              <div className="h-2 bg-[color:var(--color-background-secondary)] rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: '34%', background: '#5DCAA5' }} />
              </div>
            </div>
            <div className="mt-1 pt-2 border-t border-[color:var(--color-border-tertiary)] flex justify-between">
              <span className="text-[12px] text-[color:var(--color-text-secondary)]">Total bruto</span>
              <span className="text-[13px] font-medium text-[color:var(--color-text-primary)]">R$ 975</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
