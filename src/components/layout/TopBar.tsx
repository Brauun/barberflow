import { Bell, Menu } from 'lucide-react'
import { useState } from 'react'

import { Button } from '../ui'
import { cn } from '../../utils/cn'
import { GlobalSearch } from './GlobalSearch'
import { NotificationsPanel } from './NotificationsPanel'
import type { NavigationItem } from './Sidebar'
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
  onOpenMobileMenu: () => void
  onOpenNotification: (notification: InternalNotification) => void
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
  onOpenMobileMenu,
  onOpenNotification,
  onSelectAtendimento,
  onSelectCliente,
  onSelectSearchItem,
  onToggleNotifications,
  searchItems,
  unreadCount,
}: TopBarProps) {
  // FIX: rastreia se o dropdown da busca mobile está aberto
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false)

  // FIX: eleva o z-index do header acima do overlay da sidebar (z-40)
  // apenas quando a busca mobile está ativa e o menu não está aberto
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

          <div className="relative">
            <Button
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
