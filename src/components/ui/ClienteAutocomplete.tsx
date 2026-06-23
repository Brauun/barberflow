import { useQuery } from '@tanstack/react-query'
import { Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { useClickOutside } from '../../hooks/useClickOutside'
import {
  searchClientes,
  type ClienteSearchResult,
} from '../../services/clientesService'
import { cn } from '../../utils/cn'

type ClienteAutocompleteProps = {
  className?: string
  disabled?: boolean
  empresaId?: string | null
  error?: string
  label?: string
  limit?: number
  onChange: (clienteId: string, cliente: ClienteSearchResult | null) => void
  placeholder?: string
  selectedCliente?: ClienteSearchResult | null
  value: string
}

function clienteSubtitle(cliente: ClienteSearchResult) {
  return [cliente.telefone, cliente.email].filter(Boolean).join(' · ')
}

export function ClienteAutocomplete({
  className,
  disabled,
  empresaId,
  error,
  label = 'Buscar cliente',
  limit = 10,
  onChange,
  placeholder = 'Digite nome, telefone ou e-mail',
  selectedCliente,
  value,
}: ClienteAutocompleteProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const selectedLabel = selectedCliente?.nome ?? ''
  const [inputValue, setInputValue] = useState(selectedLabel)
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  useClickOutside(rootRef, () => setIsOpen(false), { enabled: isOpen })

  useEffect(() => {
    setInputValue(selectedLabel)
  }, [selectedLabel, value])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(inputValue.trim())
    }, 300)

    return () => window.clearTimeout(timeout)
  }, [inputValue])

  const canSearch = Boolean(
    empresaId && debouncedSearch.length >= 2 && !disabled,
  )

  const clientesQuery = useQuery({
    enabled: canSearch,
    queryFn: () => searchClientes(empresaId as string, debouncedSearch, limit),
    queryKey: ['clientes-autocomplete', empresaId, debouncedSearch, limit],
  })

  const clientes = clientesQuery.data ?? []
  const shouldShowHint = inputValue.trim().length > 0 && inputValue.trim().length < 2
  const shouldShowEmpty =
    canSearch && !clientesQuery.isLoading && !clientesQuery.isError && clientes.length === 0

  const helperText = useMemo(() => {
    if (shouldShowHint) {
      return 'Digite ao menos 2 caracteres.'
    }

    if (shouldShowEmpty) {
      return 'Cliente não encontrado.'
    }

    return null
  }, [shouldShowEmpty, shouldShowHint])

  function handleInputChange(nextValue: string) {
    setInputValue(nextValue)
    setIsOpen(true)

    if (value && nextValue !== selectedLabel) {
      onChange('', null)
    }
  }

  function selectCliente(cliente: ClienteSearchResult) {
    setInputValue(cliente.nome)
    setIsOpen(false)
    onChange(cliente.id, cliente)
  }

  function clearSelection() {
    setInputValue('')
    setDebouncedSearch('')
    setIsOpen(false)
    onChange('', null)
  }

  return (
    <div className={cn('relative min-w-0', className)} ref={rootRef}>
      {label && (
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {label}
        </span>
      )}
      <div className="relative mt-2">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        />
        <input
          autoComplete="off"
          className={cn(
            'h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-10 text-base text-slate-950 outline-none transition duration-200 placeholder:text-slate-400 focus:border-brand-300 focus:ring-4 focus:ring-brand-100/80 sm:text-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50 dark:placeholder:text-slate-500 dark:focus:border-brand-400 dark:focus:ring-brand-400/20',
            error && 'border-red-400 focus:border-red-500 focus:ring-red-100',
          )}
          disabled={disabled}
          onChange={(event) => handleInputChange(event.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          type="search"
          value={inputValue}
        />
        {(value || inputValue) && !disabled && (
          <button
            aria-label="Limpar cliente"
            className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            onClick={clearSelection}
            type="button"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {isOpen && (canSearch || helperText || clientesQuery.isLoading) && (
        <div className="absolute z-50 mt-2 max-h-64 w-full max-w-full overflow-y-auto overflow-x-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_18px_54px_rgb(15_23_42/0.14)] dark:border-slate-800 dark:bg-slate-950">
          {clientesQuery.isLoading ? (
            <p className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">
              Buscando clientes...
            </p>
          ) : clientes.length > 0 ? (
            clientes.map((cliente) => (
              <button
                className="flex w-full min-w-0 flex-col rounded-lg px-3 py-2 text-left transition hover:bg-brand-50 focus:bg-brand-50 focus:outline-none dark:hover:bg-brand-400/10 dark:focus:bg-brand-400/10"
                key={cliente.id}
                onClick={() => selectCliente(cliente)}
                type="button"
              >
                <span className="truncate text-sm font-semibold text-slate-950 dark:text-slate-50">
                  {cliente.nome}
                </span>
                {clienteSubtitle(cliente) && (
                  <span className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                    {clienteSubtitle(cliente)}
                  </span>
                )}
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">
              {helperText}
            </p>
          )}
        </div>
      )}

      {error && <span className="mt-1 block text-sm text-red-600">{error}</span>}
    </div>
  )
}
