import type { InputHTMLAttributes } from 'react'

import { cn } from '../../utils/cn'

type DateInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'onChange' | 'type' | 'value'
> & {
  label?: string
  onChange: (value: string) => void
  value: string
}

function formatDateValue(value: string) {
  const [year, month, day] = value.split('-')

  if (!year || !month || !day) {
    return 'Selecionar data'
  }

  return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString(
    'pt-BR',
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    },
  )
}

export function DateInput({
  className,
  id,
  label,
  onChange,
  value,
  ...props
}: DateInputProps) {
  const inputId = id ?? props.name

  return (
    <label className={cn('block min-w-0 max-w-full', className)} htmlFor={inputId}>
      {label && (
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          {label}
        </span>
      )}
      <span className="relative mt-2 block min-w-0 max-w-full overflow-hidden">
        <span className="flex h-11 w-full min-w-0 max-w-full items-center overflow-hidden rounded-xl border border-slate-200 bg-white px-3 text-base text-slate-950 outline-none transition dark:border-[var(--bf-border)] dark:bg-[var(--bf-surface-muted)] dark:text-slate-50 sm:text-sm">
          <span className="block min-w-0 max-w-full truncate">
            {formatDateValue(value)}
          </span>
        </span>
        <input
          {...props}
          className="absolute inset-0 h-full w-full min-w-0 max-w-full cursor-pointer opacity-0"
          id={inputId}
          onChange={(event) => onChange(event.target.value)}
          type="date"
          value={value}
        />
      </span>
    </label>
  )
}
