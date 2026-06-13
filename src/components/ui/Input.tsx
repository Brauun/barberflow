import type { InputHTMLAttributes } from 'react'

import { cn } from '../../utils/cn'

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  error?: string
  label?: string
}

export function Input({ className, error, id, label, ...props }: InputProps) {
  const inputId = id ?? props.name

  return (
    <label className="block" htmlFor={inputId}>
      {label && (
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {label}
        </span>
      )}
      <input
        className={cn(
          'mt-2 h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 text-base text-slate-950 outline-none transition duration-200 placeholder:text-slate-400 focus:border-brand-300 focus:ring-4 focus:ring-brand-100/80 sm:text-sm dark:border-slate-200 dark:bg-white dark:text-slate-950',
          error && 'border-red-400 focus:border-red-500 focus:ring-red-100',
          className,
        )}
        id={inputId}
        {...props}
      />
      {error && <span className="mt-1 block text-sm text-red-600">{error}</span>}
    </label>
  )
}
