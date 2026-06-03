import type { HTMLAttributes, ReactNode, ThHTMLAttributes, TdHTMLAttributes } from 'react'

import { cn } from '../../utils/cn'

type TableProps = HTMLAttributes<HTMLTableElement> & {
  children: ReactNode
}

export function Table({ children, className, ...props }: TableProps) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full min-w-[640px] text-left text-sm', className)} {...props}>
        {children}
      </table>
    </div>
  )
}

export function TableHead({ children, className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={cn('bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400', className)} {...props}>
      {children}
    </thead>
  )
}

export function TableBody({ children, className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={cn('divide-y divide-zinc-200 dark:divide-zinc-800', className)} {...props}>
      {children}
    </tbody>
  )
}

export function TableRow({ children, className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={cn('transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50', className)} {...props}>
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
    <td className={cn('px-4 py-3 text-zinc-700 dark:text-zinc-300', className)} {...props}>
      {children}
    </td>
  )
}
