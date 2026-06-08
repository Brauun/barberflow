import type { ReactNode } from 'react'

type EmptyStateProps = {
  description: string
  icon: ReactNode
  title: string
}

export function EmptyState({ description, icon, title }: EmptyStateProps) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center px-6 py-12 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-lg border border-brand-200/70 bg-brand-50 text-brand-600 shadow-[0_18px_50px_rgb(199_154_53/0.12)] dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-400">
        {icon}
      </span>
      <p className="mt-5 text-base font-semibold text-zinc-950 dark:text-zinc-50">
        {title}
      </p>
      <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-500 dark:text-zinc-400">
        {description}
      </p>
    </div>
  )
}
