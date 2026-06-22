import type { ReactNode } from 'react'

type EmptyStateProps = {
  description: string
  icon: ReactNode
  title: string
}

export function EmptyState({ description, icon, title }: EmptyStateProps) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center px-4 py-8 text-center sm:min-h-56 sm:px-6 sm:py-12">
      <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-brand-200/70 bg-brand-50 text-brand-600 shadow-[0_12px_34px_rgb(199_154_53/0.10)] sm:h-14 sm:w-14 sm:shadow-[0_18px_50px_rgb(199_154_53/0.12)] dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-400">
        {icon}
      </span>
      <p className="mt-4 text-sm font-semibold text-zinc-950 sm:mt-5 sm:text-base dark:text-zinc-50">
        {title}
      </p>
      <p className="mt-1.5 max-w-sm text-xs leading-5 text-zinc-500 sm:mt-2 sm:text-sm sm:leading-6 dark:text-zinc-400">
        {description}
      </p>
    </div>
  )
}
