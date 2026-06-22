import type { HTMLAttributes, ReactNode, ThHTMLAttributes, TdHTMLAttributes } from 'react'

import { cn } from '../../utils/cn'

type TableProps = HTMLAttributes<HTMLTableElement> & {
  children: ReactNode
}

export function Table({ children, className, ...props }: TableProps) {
  return (
    <div className="w-full min-w-0 overflow-x-auto p-3 sm:p-5">
      <table
        className={cn(
          'block w-full min-w-0 border-separate border-spacing-y-3 text-left text-sm',
          className,
        )}
        {...props}
      >
        {children}
      </table>
    </div>
  )
}

export function TableHead({ children, className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        'sr-only text-[0.68rem] uppercase tracking-[0.16em] text-slate-500',
        className,
      )}
      {...props}
    >
      {children}
    </thead>
  )
}

export function TableBody({ children, className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={cn('block space-y-3', className)} {...props}>
      {children}
    </tbody>
  )
}

export function TableRow({ children, className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        'grid gap-2.5 rounded-2xl border border-slate-200/70 bg-white p-3 shadow-[0_10px_34px_rgb(15_23_42/0.02)] transition duration-200 hover:border-slate-300/80 hover:shadow-[0_16px_48px_rgb(15_23_42/0.035)] sm:gap-3 sm:rounded-[1.4rem] sm:p-5 sm:hover:-translate-y-0.5 sm:hover:shadow-[0_22px_70px_rgb(15_23_42/0.045)] lg:grid-flow-col lg:auto-cols-fr lg:items-center',
        className,
      )}
      {...props}
    >
      {children}
    </tr>
  )
}

export function TableHeaderCell({ children, className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={cn('px-4 py-3 font-semibold', className)} {...props}>
      {children}
    </th>
  )
}

export function TableCell({ children, className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        'block min-w-0 px-0 py-0 text-xs font-medium text-slate-600 first:text-sm first:font-black first:text-slate-950 dark:text-slate-600 sm:text-sm sm:first:text-base',
        className,
      )}
      {...props}
    >
      {children}
    </td>
  )
}
