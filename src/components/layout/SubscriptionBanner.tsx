type SubscriptionBannerProps = {
  isExpired: boolean
  isTrialing: boolean
  trialDaysRemaining: number | null | undefined
}

export function SubscriptionBanner({
  isExpired,
  isTrialing,
  trialDaysRemaining,
}: SubscriptionBannerProps) {
  if (isTrialing) {
    return (
      <div className="mb-3 flex items-start gap-2 rounded-xl border border-brand-100 bg-brand-50/60 px-3 py-2 text-xs leading-5 text-slate-600 sm:mb-5 sm:gap-2.5 sm:px-4 sm:py-3 sm:text-sm dark:border-brand-400/15 dark:bg-brand-400/8 dark:text-brand-200">
        <span className="shrink-0 text-brand-500 dark:text-brand-400">⏳</span>
        <span className="min-w-0">
          <span className="block">
            Seu teste grátis termina em{' '}
            <span className="font-semibold text-brand-600 dark:text-brand-300">
              {trialDaysRemaining ?? 0} dias
            </span>
          </span>
          <span className="block">Assine para continuar usando todos os recursos.</span>
        </span>
      </div>
    )
  }

  if (isExpired) {
    return (
      <div className="mb-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700 sm:mb-5 sm:gap-2.5 sm:px-4 sm:py-3 sm:text-sm dark:border-red-500/20 dark:bg-red-500/8 dark:text-red-300">
        <span className="shrink-0">⚠️</span>
        <span className="min-w-0">
          <span className="block font-semibold">Seu teste grátis expirou</span>
          <span className="block">Assine para continuar usando todos os recursos.</span>
        </span>
      </div>
    )
  }

  return null
}
