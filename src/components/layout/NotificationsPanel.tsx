import type { MouseEvent } from 'react'

import { cn } from '../../utils/cn'
import type { InternalNotification } from '../../services/notificationsService'
import { PushNotificationControl } from '../pwa/PushNotificationControl'

type NotificationsPanelProps = {
  isLoading: boolean
  isMarkingAllRead: boolean
  notifications: InternalNotification[]
  onMarkAllRead: () => void
  onOpenNotification: (
    notification: InternalNotification,
    event?: MouseEvent<HTMLButtonElement>,
  ) => void
  unreadCount: number
}

function notificationTime(value: string) {
  const date = new Date(value)

  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
  })
}

export function NotificationsPanel({
  isLoading,
  isMarkingAllRead,
  notifications,
  onMarkAllRead,
  onOpenNotification,
  unreadCount,
}: NotificationsPanelProps) {
  return (
    <div
      className="absolute right-0 top-11 z-50 w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_54px_rgb(15_23_42/0.16)] sm:top-12 sm:w-[min(22rem,calc(100vw-2rem))] sm:rounded-[1.35rem] sm:shadow-[0_24px_80px_rgb(15_23_42/0.18)] dark:border-slate-800 dark:bg-slate-950"
      role="menu"
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-3.5 py-2.5 sm:px-4 sm:py-3 dark:border-slate-800">
        <div>
          <p className="text-sm font-black text-slate-950 dark:text-white">Notificações</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {unreadCount} não lida{unreadCount === 1 ? '' : 's'}
          </p>
        </div>
        <button
          className="rounded-full px-3 py-1.5 text-xs font-bold text-brand-600 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-brand-300 dark:hover:bg-brand-400/10"
          disabled={isMarkingAllRead || unreadCount === 0}
          onClick={onMarkAllRead}
          type="button"
        >
          Marcar todas
        </button>
      </div>

      <div className="max-h-[min(22rem,calc(100dvh-8rem))] overflow-y-auto p-2 sm:max-h-[28rem]">
        <div className="mb-2">
          <PushNotificationControl compact />
        </div>
        {isLoading ? (
          <p className="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
            Carregando notificações...
          </p>
        ) : notifications.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
            Nenhuma notificação por enquanto.
          </p>
        ) : (
          notifications.map((notification) => (
            <button
              aria-label={`Abrir notificação: ${notification.title}`}
              className={cn(
                'mb-1.5 w-full cursor-pointer rounded-xl px-3 py-2.5 text-left transition last:mb-0 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-300 sm:mb-2 sm:rounded-2xl sm:py-3 dark:hover:bg-slate-900',
                !notification.read_at && 'bg-brand-50/70 dark:bg-brand-400/10',
              )}
              key={notification.id}
              onClick={(event) => onOpenNotification(notification, event)}
              type="button"
            >
              <div className="flex items-start gap-2.5 sm:gap-3">
                <span
                  className={cn(
                    'mt-1 h-2.5 w-2.5 shrink-0 rounded-full',
                    notification.read_at ? 'bg-slate-300 dark:bg-slate-700' : 'bg-brand-500',
                  )}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-black leading-tight text-slate-950 dark:text-white">
                    {notification.title}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-slate-600 sm:text-sm dark:text-slate-300">
                    {notification.message}
                  </span>
                  <span className="mt-1.5 block text-[0.7rem] font-semibold text-slate-400 sm:mt-2 sm:text-xs dark:text-slate-500">
                    {notificationTime(notification.created_at)}
                  </span>
                </span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
