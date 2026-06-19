import { CalendarDays, Loader2, Search, UserRound } from 'lucide-react'
import { useRef, useState } from 'react'

import { cn } from '../../utils/cn'
import { useGlobalSearch } from '../../hooks/useGlobalSearch'
import { useClickOutside } from '../../hooks/useClickOutside'
import type { NavigationItem } from './Sidebar'

type GlobalSearchProps = {
  className?: string
  empresaId: string | undefined
  items: NavigationItem[]
  onOpenChange?: (isOpen: boolean) => void
  onSelect: (item: NavigationItem) => void
  onSelectCliente: (clienteId: string) => void
  onSelectAtendimento: () => void
}

function formatSearchDate(value: string) {
  return new Date(value).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })
}

export function GlobalSearch({
  className,
  empresaId,
  items,
  onOpenChange,
  onSelect,
  onSelectAtendimento,
  onSelectCliente,
}: GlobalSearchProps) {
  const searchRef = useRef<HTMLDivElement | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [term, setTerm] = useState('')

  const { atendimentos, clientes, hasResults, isSearching, navResults } =
    useGlobalSearch(items, empresaId, term)

  function setOpenState(value: boolean) {
    setIsOpen(value)
    onOpenChange?.(value)
  }

  useClickOutside(searchRef, () => setOpenState(false), { enabled: isOpen })

  function handleSelectNav(item: NavigationItem) {
    setTerm('')
    setOpenState(false)
    onSelect(item)
  }

  function handleSelectCliente(id: string) {
    setTerm('')
    setOpenState(false)
    onSelectCliente(id)
  }

  function handleSelectAtendimento() {
    setTerm('')
    setOpenState(false)
    onSelectAtendimento()
  }

  return (
    <div className={cn('relative w-full', className)} ref={searchRef}>
      <div className="flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 transition focus-within:border-brand-200 focus-within:bg-white focus-within:ring-4 focus-within:ring-brand-100/70 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:focus-within:border-brand-400/40 dark:focus-within:bg-slate-950 dark:focus-within:ring-brand-400/10">
        {isSearching ? (
          <Loader2 className="shrink-0 animate-spin text-brand-500" size={16} />
        ) : (
          <Search size={16} />
        )}
        <input
          aria-label="Buscar no BW Barber"
          className="h-full w-full min-w-0 bg-transparent text-base font-medium text-slate-700 outline-none placeholder:text-slate-500 sm:text-sm dark:text-slate-100 dark:placeholder:text-slate-400"
          aria-expanded={isOpen}
          onChange={(event) => {
            setTerm(event.target.value)
            setOpenState(true)
          }}
          onFocus={() => setOpenState(true)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && navResults[0]) {
              handleSelectNav(navResults[0])
            }
            if (event.key === 'Escape') {
              setOpenState(false)
              setTerm('')
            }
          }}
          placeholder="Buscar páginas, clientes, atendimentos..."
          type="search"
          value={term}
        />
      </div>

      {isOpen && (
        <div className="absolute right-0 top-12 z-50 w-full overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white p-2 shadow-[0_24px_80px_rgb(15_23_42/0.16)] dark:border-slate-800 dark:bg-slate-950">

          {/* Páginas / Navegação */}
          {navResults.length > 0 && (
            <div className="mb-1">
              {term.trim() && (
                <p className="px-3 pb-1 pt-2 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                  Páginas
                </p>
              )}
              {navResults.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-semibold text-slate-600 transition hover:bg-brand-50 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-brand-400/10 dark:hover:text-white"
                    key={item.path}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelectNav(item)}
                    type="button"
                  >
                    <Icon className="shrink-0 text-brand-600 dark:text-brand-300" size={16} />
                    <span className="min-w-0 truncate">{item.label}</span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Clientes */}
          {clientes.length > 0 && (
            <div className="mb-1">
              <p className="px-3 pb-1 pt-2 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                Clientes
              </p>
              {clientes.map((cliente) => (
                <button
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-semibold text-slate-600 transition hover:bg-brand-50 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-brand-400/10 dark:hover:text-white"
                  key={cliente.id}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelectCliente(cliente.id)}
                  type="button"
                >
                  <UserRound className="shrink-0 text-brand-600 dark:text-brand-300" size={16} />
                  <span className="min-w-0">
                    <span className="block truncate">{cliente.nome}</span>
                    {cliente.telefone && (
                      <span className="block truncate text-xs font-normal text-slate-400 dark:text-slate-500">
                        {cliente.telefone}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Atendimentos */}
          {atendimentos.length > 0 && (
            <div className="mb-1">
              <p className="px-3 pb-1 pt-2 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                Atendimentos
              </p>
              {atendimentos.map((atendimento) => (
                <button
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-semibold text-slate-600 transition hover:bg-brand-50 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-brand-400/10 dark:hover:text-white"
                  key={atendimento.id}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleSelectAtendimento}
                  type="button"
                >
                  <CalendarDays className="shrink-0 text-brand-600 dark:text-brand-300" size={16} />
                  <span className="min-w-0">
                    <span className="block truncate">{atendimento.cliente}</span>
                    <span className="block truncate text-xs font-normal text-slate-400 dark:text-slate-500">
                      {atendimento.servico} · {formatSearchDate(atendimento.data)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Sem resultados */}
          {!isSearching && term.trim() && !hasResults && (
            <p className="px-3 py-4 text-center text-sm font-medium text-slate-500 dark:text-slate-400">
              Nenhum resultado encontrado.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
