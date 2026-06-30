import { useCallback, useState, type ReactNode, type SyntheticEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button, Modal } from '../components/ui'
import {
  canUsePremiumFeature,
  canWriteData,
  type SubscriptionAccessState,
} from '../services/subscriptionsService'

type SubscriptionAccessBoundaryProps = {
  children: ReactNode
  state: SubscriptionAccessState | null
}

export function SubscriptionAccessBoundary({
  children,
  state,
}: SubscriptionAccessBoundaryProps) {
  const navigate = useNavigate()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const canWrite = state ? canWriteData(state) : true
  const canUsePremium = state ? canUsePremiumFeature(state) : true

  const interceptBlockedAction = useCallback(
    (event: SyntheticEvent<HTMLElement>) => {
      const target = event.target

      if (!(target instanceof Element)) {
        return
      }

      const writeAction = target.closest('[data-subscription-write="true"]')
      const premiumAction = target.closest('[data-subscription-premium="true"]')
      const shouldBlock =
        (writeAction && !canWrite) || (premiumAction && !canUsePremium)

      if (!shouldBlock) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      setIsModalOpen(true)
    },
    [canUsePremium, canWrite],
  )

  return (
    <>
      <div
        className="min-w-0"
        onChangeCapture={interceptBlockedAction}
        onClickCapture={interceptBlockedAction}
        onSubmitCapture={interceptBlockedAction}
      >
        {children}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Seu período de teste terminou"
      >
        <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
          Escolha um plano para continuar usando todos os recursos.
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={() => setIsModalOpen(false)} variant="secondary">
            Continuar visualizando
          </Button>
          <Button
            onClick={() => {
              setIsModalOpen(false)
              navigate('/app/assinatura')
            }}
          >
            Ver planos
          </Button>
        </div>
      </Modal>
    </>
  )
}
