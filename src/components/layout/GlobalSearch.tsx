import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'

import { cn } from '../../utils/cn'
import type { NavigationItem } from './Sidebar'

type GlobalSearchProps = {
  className?: string
  items: NavigationItem[]
  onSelect: (item: NavigationItem) => void
}

export function GlobalSearch({ className, items, onSelect }: GlobalSearchProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [term, setTerm] = useState('')

  const results = useMemo(() => {
    const normalizedTerm = term.trim().toLocaleLowerCase('pt-BR')

    if (!normalizedTerm) {
      return items.slice(0, 6)
    }

    return items
      .filter((item) => item.label.toLocaleLowerCase('pt-BR').includes(normalizedTerm))
      .slice(0, 6)
  }, [items, term])

  function selectItem(item: NavigationItem) {
    setTerm('')
    setIsOpen(false)
    onSelect(item)
  }

  return (
    <div className={cn('relative w-full', className)}>
      <div className="flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 transition focus-within:border-brand-200 focus-within:bg-white focus-within:ring-4 focus-within:ring-brand-100/70 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:focus-within:border-brand-400/40 dark:focus-within:bg-slate-950 dark:focus-within:ring-brand-400/10">
        <Search size={16} />
        <input
          aria-label="Buscar no BW Barber"
          className="h-full w-full min-w-0 bg-transparent text-base font-medium text-slate-700 outline-none placeholder:text-slate-500 sm:text-sm dark:text-slate-100 dark:placeholder:text-slate-400"
          onBlur={() => {
            window.setTimeout(() => setIsOpen(false), 120)
          }}
          onChange={(event) => {
            setTerm(event.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && results[0]) {
              selectItem(results[0])
            }

            if (event.key === 'Escape') {
              setIsOpen(false)
              setTerm('')
            }
          }}
          placeholder="Buscar"
          type="search"
          value={term}
        />
      </div>

      {isOpen && (
        <div className="absolute right-0 top-12 z-50 w-full overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white p-2 shadow-[0_24px_80px_rgb(15_23_42/0.16)] dark:border-slate-800 dark:bg-slate-950">
          {results.length > 0 ? (
            results.map((item) => {
              const Icon = item.icon

              return (
                <button
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-semibold text-slate-600 transition hover:bg-brand-50 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-brand-400/10 dark:hover:text-white"
                  key={item.path}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectItem(item)}
                  type="button"
                >
                  <Icon className="shrink-0 text-brand-600 dark:text-brand-300" size={16} />
                  <span className="min-w-0 truncate">{item.label}</span>
                </button>
              )
            })
          ) : (
            <p className="px-3 py-4 text-center text-sm font-medium text-slate-500 dark:text-slate-400">
              Nenhum resultado encontrado.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
