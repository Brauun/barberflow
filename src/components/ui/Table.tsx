import type { HTMLAttributes, ReactNode, ThHTMLAttributes, TdHTMLAttributes } from 'react'

import { cn } from '../../utils/cn'

type TableProps = HTMLAttributes<HTMLTableElement> & {
  children: ReactNode
}

export function Table({ children, className, ...props }: TableProps) {
  return (
    <div className="w-full min-w-0 overflow-x-auto p-4 sm:p-5">
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
        'grid gap-3 rounded-[1.4rem] border border-slate-200/70 bg-white p-4 shadow-[0_14px_50px_rgb(15_23_42/0.025)] transition duration-200 hover:-translate-y-0.5 hover:border-slate-300/80 hover:shadow-[0_22px_70px_rgb(15_23_42/0.045)] sm:p-5 lg:grid-flow-col lg:auto-cols-fr lg:items-center',
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
        'block min-w-0 px-0 py-0 text-sm font-medium text-slate-600 first:text-base first:font-black first:text-slate-950 dark:text-slate-600',
        className,
      )}
      {...props}
    >
      {children}
    </td>
  )
}
