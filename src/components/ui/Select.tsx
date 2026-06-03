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
    <label className="block" htmlFor={selectId}>
      {label && (
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {label}
        </span>
      )}
      <select
        className={cn(
          'mt-2 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-brand-400 dark:focus:ring-brand-500/20',
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
