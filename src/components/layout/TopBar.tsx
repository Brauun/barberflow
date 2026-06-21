import { Bell, Menu, Moon, Sun } from 'lucide-react'
import { useRef, useState, type MouseEvent } from 'react'

import { Button } from '../ui'
import { PWAInstallButton } from '../pwa/PWAInstallButton'
import { useTheme } from '../../hooks/useTheme'
import { useClickOutside } from '../../hooks/useClickOutside'
import { cn } from '../../utils/cn'
import { GlobalSearch } from './GlobalSearch'
import { NotificationsPanel } from './NotificationsPanel'
import type { NavigationItem } from './navigation'
import type { InternalNotification } from '../../services/notificationsService'

type TopBarProps = {
  currentItem: NavigationItem
  empresaId: string | undefined
  isMarkingAllNotificationsRead: boolean
  isMobileMenuOpen: boolean
  isNotificationsOpen: boolean
  notifications: InternalNotification[]
  notificationsLoading: boolean
  onMarkAllNotificationsRead: () => void
  onCloseNotifications: () => void
  onOpenMobileMenu: () => void
  onOpenNotification: (
    notification: InternalNotification,
    event?: MouseEvent<HTMLButtonElement>,
  ) => void
  onSelectAtendimento: () => void
  onSelectCliente: (clienteId: string) => void
  onSelectSearchItem: (item: NavigationItem) => void
  onToggleNotifications: () => void
  searchItems: NavigationItem[]
  unreadCount: number
}

export function TopBar({
  currentItem,
  empresaId,
  isMarkingAllNotificationsRead,
  isMobileMenuOpen,
  isNotificationsOpen,
  notifications,
  notificationsLoading,
  onMarkAllNotificationsRead,
  onCloseNotifications,
  onOpenMobileMenu,
  onOpenNotification,
  onSelectAtendimento,
  onSelectCliente,
  onSelectSearchItem,
  onToggleNotifications,
  searchItems,
  unreadCount,
}: TopBarProps) {
  const { resolvedTheme, setTheme } = useTheme()
  const notificationsRef = useRef<HTMLDivElement | null>(null)
  // FIX: rastreia se o dropdown da busca mobile está aberto
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false)

  // FIX: eleva o z-index do header acima do overlay da sidebar (z-40)
  // apenas quando a busca mobile está ativa e o menu não está aberto
  useClickOutside(notificationsRef, onCloseNotifications, {
    enabled: isNotificationsOpen,
  })

  const headerZClass =
    isMobileSearchOpen && !isMobileMenuOpen ? 'z-50' : 'z-30'

  return (
    <header
      className={cn(
        'sticky top-0 border-b border-slate-200 bg-white/82 pt-[env(safe-area-inset-top)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/82',
        headerZClass,
      )}
    >
      <div className="flex min-h-16 flex-col justify-center gap-3 px-4 py-3 sm:min-h-20 sm:px-6 md:px-8 lg:px-10 xl:px-12">
        <div className="flex items-center gap-3">
          <Button
            aria-label="Abrir menu"
            className="lg:hidden"
            onClick={onOpenMobileMenu}
            size="icon-md"
            variant="ghost"
          >
            <Menu size={20} />
          </Button>

          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600 dark:text-brand-300">
              {currentItem.label}
            </p>
            <h1 className="truncate text-lg font-black tracking-normal text-slate-950 sm:text-xl dark:text-white">
              BW Barber
            </h1>
          </div>

          <GlobalSearch
            className="hidden max-w-xs md:block"
            empresaId={empresaId}
            items={searchItems}
            onSelect={onSelectSearchItem}
            onSelectAtendimento={onSelectAtendimento}
            onSelectCliente={onSelectCliente}
          />

          <div
            aria-label="Alternar tema"
            className="flex h-11 items-center rounded-2xl border border-slate-200 bg-slate-50 p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            role="group"
          >
            <button
              aria-label="Usar tema claro"
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition duration-200 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white',
                resolvedTheme === 'light' &&
                  'bg-white text-brand-600 shadow-sm dark:bg-slate-950 dark:text-brand-300',
              )}
              onClick={() => setTheme('light')}
              title="Tema claro"
              type="button"
            >
              <Sun size={17} />
            </button>
            <button
              aria-label="Usar tema escuro"
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition duration-200 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white',
                resolvedTheme === 'dark' &&
                  'bg-white text-brand-600 shadow-sm dark:bg-slate-950 dark:text-brand-300',
              )}
              onClick={() => setTheme('dark')}
              title="Tema escuro"
              type="button"
            >
              <Moon size={16} />
            </button>
          </div>

          <PWAInstallButton className="hidden lg:block" compact variant="secondary" />
          <PWAInstallButton className="lg:hidden" iconOnly variant="ghost" />

          <div className="relative" ref={notificationsRef}>
            <Button
              aria-expanded={isNotificationsOpen}
              aria-label="Notificações"
              onClick={onToggleNotifications}
              size="icon-md"
              tooltipPosition="bottom"
              variant="ghost"
            >
              <Bell size={16} />
            </Button>
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-500 px-1.5 text-[0.65rem] font-black text-white ring-2 ring-white dark:ring-slate-950">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}

            {isNotificationsOpen && (
              <NotificationsPanel
                isLoading={notificationsLoading}
                isMarkingAllRead={isMarkingAllNotificationsRead}
                notifications={notifications}
                onMarkAllRead={onMarkAllNotificationsRead}
                onOpenNotification={onOpenNotification}
                unreadCount={unreadCount}
              />
            )}
          </div>
        </div>

        {/* FIX: busca mobile com callback onOpenChange para controlar z-index do header */}
        <GlobalSearch
          className={cn('md:hidden', searchItems.length === 0 && 'hidden')}
          empresaId={empresaId}
          items={searchItems}
          onOpenChange={setIsMobileSearchOpen}
          onSelect={onSelectSearchItem}
          onSelectAtendimento={onSelectAtendimento}
          onSelectCliente={onSelectCliente}
        />
      </div>
    </header>
  )
}
