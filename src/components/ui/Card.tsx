import type { HTMLAttributes, ReactNode } from 'react'

import { cn } from '../../utils/cn'

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
}

export function Card({ children, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'w-full min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white text-slate-950 shadow-[0_10px_34px_rgb(15_23_42/0.026)] transition duration-300 hover:border-slate-300/80 hover:shadow-[0_16px_50px_rgb(15_23_42/0.04)] sm:rounded-[1.35rem] sm:shadow-[0_16px_60px_rgb(15_23_42/0.035)] sm:hover:-translate-y-0.5 sm:hover:shadow-[0_24px_80px_rgb(15_23_42/0.055)] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50 dark:hover:border-slate-700',
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
    <div
      className={cn(
        'border-b border-slate-100 p-3.5 sm:p-5 md:p-6 lg:p-7 dark:border-slate-800',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardContent({ children, className, ...props }: CardProps) {
  return (
    <div className={cn('p-3.5 sm:p-5 md:p-6 lg:p-7', className)} {...props}>
      {children}
    </div>
  )
}

export function CardTitle({ children, className, ...props }: CardProps) {
  return (
    <h3
      className={cn('text-[0.95rem] font-black text-slate-950 sm:text-base dark:text-slate-50', className)}
      {...props}
    >
      {children}
    </h3>
  )
}

export function CardDescription({ children, className, ...props }: CardProps) {
  return (
    <p
      className={cn('mt-1 text-xs leading-5 text-slate-500 sm:text-sm sm:leading-6 dark:text-slate-400', className)}
      {...props}
    >
      {children}
    </p>
  )
}

export function CardFooter({ children, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'border-t border-slate-100 p-3.5 sm:p-5 md:p-6 lg:p-7 dark:border-slate-800',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
