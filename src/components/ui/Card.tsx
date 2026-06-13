import type { HTMLAttributes, ReactNode } from 'react'

import { cn } from '../../utils/cn'

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
}

export function Card({ children, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'w-full min-w-0 overflow-hidden rounded-[1.1rem] border border-slate-200/80 bg-white shadow-[0_16px_60px_rgb(15_23_42/0.035)] transition duration-300 hover:border-slate-300/80 hover:shadow-[0_24px_80px_rgb(15_23_42/0.055)] sm:rounded-[1.35rem] sm:hover:-translate-y-0.5 dark:border-slate-200/80 dark:bg-white dark:text-slate-950',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className, ...props }: CardProps) {
  return (
    <div className={cn('border-b border-slate-100 p-4 sm:p-5 md:p-6 lg:p-7 dark:border-slate-100', className)} {...props}>
      {children}
    </div>
  )
}

export function CardContent({ children, className, ...props }: CardProps) {
  return (
    <div className={cn('p-4 sm:p-5 md:p-6 lg:p-7', className)} {...props}>
      {children}
    </div>
  )
}
