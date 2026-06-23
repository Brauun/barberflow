import type { SelectHTMLAttributes } from 'react'

import { cn } from '../../utils/cn'

type SelectOption = {
  label: string
  value: string
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  error?: string
  label?: string
  options: SelectOption[]
}

export function Select({
  className,
  error,
  id,
  label,
  options,
  ...props
}: SelectProps) {
  const selectId = id ?? props.name

  return (
    <label className="block min-w-0 max-w-full" htmlFor={selectId}>
      {label && (
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {label}
        </span>
      )}
      <select
        className={cn(
          'mt-2 h-11 w-full max-w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 text-base text-slate-950 outline-none transition duration-200 focus:border-brand-300 focus:ring-4 focus:ring-brand-100/80 sm:text-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50 dark:focus:border-brand-400 dark:focus:ring-brand-400/20',
          error && 'border-red-400 focus:border-red-500 focus:ring-red-100',
          className,
        )}
        id={selectId}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <span className="mt-1 block text-sm text-red-600">{error}</span>}
    </label>
  )
}
