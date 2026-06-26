import { Bell, BellOff, BellRing, Loader2, Send } from 'lucide-react'

import { usePushNotifications } from '../../hooks/usePushNotifications'
import { cn } from '../../utils/cn'
import { Button } from '../ui/Button'

type PushNotificationControlProps = {
  className?: string
  compact?: boolean
}

export function PushNotificationControl({
  className,
  compact = false,
}: PushNotificationControlProps) {
  const {
    activate,
    canSendTest,
    disable,
    hasVapidKey,
    isActive,
    isIOSBrowser,
    isLoading,
    isSupported,
    message,
    permission,
    sendTest,
  } = usePushNotifications()

  const detail = !isSupported
    ? 'Seu navegador não suporta notificações push. Instale o app ou use um navegador compatível.'
    : isIOSBrowser
      ? 'No iPhone, instale e abra o BW Barber pela Tela de Início para ativar notificações.'
      : permission === 'denied'
        ? 'As notificações estão bloqueadas nas configurações do navegador.'
        : !hasVapidKey
          ? 'Notificações push aguardando configuração neste ambiente.'
          : isActive
            ? 'Este dispositivo recebe notificações do BW Barber.'
            : 'Receba alertas de agendamentos e atualizações importantes.'

  return (
    <div
      className={cn(
        'min-w-0 rounded-[1.1rem] border border-slate-200/70 bg-white p-3 shadow-[0_12px_44px_rgb(15_23_42/0.025)] sm:rounded-[1.35rem] sm:p-4 dark:border-slate-800 dark:bg-slate-950',
        compact && 'rounded-xl p-3 shadow-none',
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-400/10 dark:text-brand-300">
          {isActive ? <BellRing size={18} /> : <Bell size={18} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-slate-950 dark:text-white">
            Notificações push
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            {detail}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {isActive ? (
          <Button
            disabled={isLoading}
            leftIcon={isLoading ? <Loader2 className="animate-spin" size={16} /> : <BellOff size={16} />}
            onClick={() => void disable()}
            size="sm"
            variant="secondary"
          >
            Desativar notificações
          </Button>
        ) : (
          <Button
            disabled={isLoading}
            leftIcon={isLoading ? <Loader2 className="animate-spin" size={16} /> : <BellRing size={16} />}
            onClick={() => void activate()}
            size="sm"
          >
            Ativar notificações
          </Button>
        )}

        {isActive && canSendTest && (
          <Button
            disabled={isLoading}
            leftIcon={<Send size={16} />}
            onClick={() => void sendTest()}
            size="sm"
            variant="secondary"
          >
            Enviar teste
          </Button>
        )}
      </div>

      {message && (
        <p className="mt-3 text-xs font-medium text-brand-700 dark:text-brand-300">
          {message}
        </p>
      )}
    </div>
  )
}
