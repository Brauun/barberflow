import { Search } from 'lucide-react'
import type { InputHTMLAttributes } from 'react'

import { cn } from '../../utils/cn'

type SearchInputProps = InputHTMLAttributes<HTMLInputElement>

export function SearchInput({ className, ...props }: SearchInputProps) {
  return (
    <div className={cn('relative w-full', className)}>
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
        size={16}
      />
      <input
        className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 text-sm text-slate-950 outline-none transition duration-200 placeholder:text-slate-400 focus:border-brand-300 focus:ring-4 focus:ring-brand-100/80 dark:border-slate-200 dark:bg-white dark:text-slate-950"
        type="search"
        {...props}
      />
    </div>
  )
}
