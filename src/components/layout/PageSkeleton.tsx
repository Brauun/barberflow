import { Skeleton } from '../ui'

export function PageSkeleton() {
  return (
    <div
      aria-label="Carregando página"
      className="w-full min-w-0 space-y-4 sm:space-y-6"
      role="status"
    >
      <div className="space-y-3">
        <Skeleton className="h-4 w-24 rounded-full" />
        <Skeleton className="h-8 w-56 max-w-full rounded-2xl sm:h-9 sm:w-64" />
        <Skeleton className="h-4 w-[min(32rem,100%)] rounded-full" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-24 rounded-2xl sm:h-32 sm:rounded-[1.35rem]" />
        <Skeleton className="h-24 rounded-2xl sm:h-32 sm:rounded-[1.35rem]" />
        <Skeleton className="h-24 rounded-2xl sm:h-32 sm:rounded-[1.35rem]" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
        <Skeleton className="h-48 rounded-2xl sm:h-72 sm:rounded-[1.35rem]" />
        <Skeleton className="h-48 rounded-2xl sm:h-72 sm:rounded-[1.35rem]" />
      </div>
    </div>
  )
}
