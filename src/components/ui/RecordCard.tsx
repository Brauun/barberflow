import type { HTMLAttributes, ReactNode } from 'react'

import { cn } from '../../utils/cn'

type RecordCardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
}

type RecordAvatarProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
}

type RecordMetricProps = HTMLAttributes<HTMLDivElement> & {
  label: string
  value: ReactNode
  accent?: boolean
}

export function RecordCard({ children, className, ...props }: RecordCardProps) {
  return (
    <div
      className={cn(
        'group w-full max-w-full min-w-0 overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-3 shadow-[0_10px_34px_rgb(15_23_42/0.02)] transition duration-200 hover:border-slate-300/80 hover:shadow-[0_16px_48px_rgb(15_23_42/0.035)] sm:rounded-[1.4rem] sm:p-5 sm:hover:-translate-y-0.5 sm:hover:shadow-[0_22px_70px_rgb(15_23_42/0.045)]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function RecordAvatar({
  children,
  className,
  ...props
}: RecordAvatarProps) {
  return (
    <div
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand-100 bg-brand-50 text-xs font-black uppercase text-brand-600 shadow-[0_8px_20px_rgb(6_182_212/0.08)] sm:h-12 sm:w-12 sm:rounded-2xl sm:text-sm sm:shadow-[0_10px_26px_rgb(6_182_212/0.10)]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function RecordMetric({
  accent,
  className,
  label,
  value,
  ...props
}: RecordMetricProps) {
  return (
    <div className={cn('min-w-0 sm:min-w-[6rem]', className)} {...props}>
      <p className="text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-slate-400 sm:text-[0.68rem] sm:tracking-[0.14em]">
        {label}
      </p>
      <p
        className={cn(
          'mt-0.5 break-words text-sm font-bold text-slate-950 sm:mt-1',
          accent && 'text-brand-600',
        )}
      >
        {value}
      </p>
    </div>
  )
}
