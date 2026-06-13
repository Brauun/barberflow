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
      <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-brand-100 bg-brand-50/60 px-4 py-3 text-sm text-slate-600 dark:border-brand-400/15 dark:bg-brand-400/8 dark:text-brand-200">
        <span className="shrink-0 text-brand-500 dark:text-brand-400">⏳</span>
        Seu teste grátis termina em{' '}
        <span className="font-semibold text-brand-600 dark:text-brand-300">
          {trialDaysRemaining ?? 0} dias
        </span>
        . Assine para continuar usando todos os recursos.
      </div>
    )
  }

  if (isExpired) {
    return (
      <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/8 dark:text-red-300">
        <span className="shrink-0">⚠️</span>
        Seu período de teste terminou. Escolha um plano para continuar usando o BW Barber.
      </div>
    )
  }

  return null
}
