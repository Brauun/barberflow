import type { HTMLAttributes } from 'react'

import { cn } from '../../utils/cn'

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-zinc-200/70 dark:bg-white/[0.08]',
        className,
      )}
      {...props}
    />
  )
}
