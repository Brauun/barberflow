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
        'group rounded-[1.4rem] border border-slate-200/70 bg-white p-4 shadow-[0_14px_50px_rgb(15_23_42/0.025)] transition duration-200 hover:-translate-y-0.5 hover:border-slate-300/80 hover:shadow-[0_22px_70px_rgb(15_23_42/0.045)] sm:p-5',
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
        'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-brand-100 bg-brand-50 text-sm font-black uppercase text-brand-600 shadow-[0_10px_26px_rgb(6_182_212/0.10)]',
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
    <div className={cn('min-w-[6rem]', className)} {...props}>
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      <p
        className={cn(
          'mt-1 text-sm font-bold text-slate-950',
          accent && 'text-brand-600',
        )}
      >
        {value}
      </p>
    </div>
  )
}
