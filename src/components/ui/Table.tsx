import type { HTMLAttributes, ReactNode, ThHTMLAttributes, TdHTMLAttributes } from 'react'

import { cn } from '../../utils/cn'

type TableProps = HTMLAttributes<HTMLTableElement> & {
  children: ReactNode
}

export function Table({ children, className, ...props }: TableProps) {
  return (
    <div className="w-full min-w-0 overflow-x-auto p-2 sm:p-5">
      <table
        className={cn(
          'block w-full min-w-0 border-separate border-spacing-y-2 text-left text-sm sm:border-spacing-y-3',
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
    <tbody className={cn('block space-y-2 sm:space-y-3', className)} {...props}>
      {children}
    </tbody>
  )
}

export function TableRow({ children, className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-slate-200/70 bg-white px-3 py-2 shadow-[0_10px_34px_rgb(15_23_42/0.02)] transition duration-200 hover:border-slate-300/80 hover:shadow-[0_16px_48px_rgb(15_23_42/0.035)] dark:border-slate-800 dark:bg-slate-900 sm:grid sm:grid-flow-col sm:auto-cols-fr sm:gap-3 sm:rounded-[1.4rem] sm:px-5 sm:py-4 sm:hover:-translate-y-0.5 sm:hover:shadow-[0_22px_70px_rgb(15_23_42/0.045)]',
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
        'min-w-0 shrink-0 px-0 py-0 text-xs font-medium text-slate-500 first:w-full first:text-sm first:font-bold first:text-slate-950 dark:text-slate-400 dark:first:text-white sm:block sm:truncate sm:text-sm sm:first:text-base sm:first:font-black',
        className,
      )}
      {...props}
    >
      {children}
    </td>
  )
}
