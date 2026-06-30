import { useNavigate } from 'react-router-dom'

import type { SubscriptionAccessState } from '../../services/subscriptionsService'
import { Button } from '../ui'

type SubscriptionBannerProps = {
  graceDaysRemaining: number | null | undefined
  state: SubscriptionAccessState | null
  trialDaysRemaining: number | null | undefined
}

export function SubscriptionBanner({
  graceDaysRemaining,
  state,
  trialDaysRemaining,
}: SubscriptionBannerProps) {
  const navigate = useNavigate()

  if (!state || state === 'ACTIVE' || state === 'TRIAL_ACTIVE') {
    return null
  }

  const isBlocked = state === 'BLOCKED'
  const isGrace = state === 'TRIAL_EXPIRED_GRACE'
  const title = isBlocked
    ? 'Seu acesso está limitado.'
    : isGrace
      ? `Seu período de tolerância termina em ${graceDaysRemaining ?? 0} dias.`
      : `Seu teste grátis termina em ${trialDaysRemaining ?? 0} dias.`
  const description = isBlocked
    ? 'Assine para continuar criando agendamentos, clientes e serviços.'
    : isGrace
      ? 'Assine para continuar usando todos os recursos.'
      : 'Escolha um plano para continuar usando todos os recursos.'

  return (
    <div
      className={`mb-3 flex min-w-0 flex-col gap-2 rounded-xl border px-3 py-2.5 text-xs leading-5 sm:mb-5 sm:flex-row sm:items-center sm:gap-3 sm:px-4 sm:py-3 sm:text-sm ${
        isBlocked
          ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/8 dark:text-red-300'
          : isGrace
            ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/8 dark:text-amber-200'
            : 'border-brand-100 bg-brand-50/60 text-slate-600 dark:border-brand-400/15 dark:bg-brand-400/8 dark:text-brand-200'
      }`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-2">
        <span className="shrink-0">{isBlocked || isGrace ? '⚠' : '⌛'}</span>
        <span className="min-w-0">
          <span className="block font-semibold">{title}</span>
          <span className="block">{description}</span>
        </span>
      </div>
      <Button
        className="h-9 min-h-9 w-full shrink-0 px-3 text-xs sm:w-auto"
        onClick={() => navigate('/app/assinatura')}
        size="sm"
        variant="secondary"
      >
        Ver planos
      </Button>
    </div>
  )
}
