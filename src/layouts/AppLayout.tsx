import { CalendarDays, LayoutDashboard, UserRound } from 'lucide-react'
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'

import { Sidebar } from '../components/layout/Sidebar'
import { TopBar } from '../components/layout/TopBar'
import { SubscriptionBanner } from '../components/layout/SubscriptionBanner'
import { allowedExpiredPaths, useAppLayout } from '../hooks/useAppLayout'
import { cn } from '../utils/cn'

const barberMobileNavigation = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/app/dashboard' },
  { icon: CalendarDays, label: 'Agenda', path: '/app/atendimentos' },
  { icon: UserRound, label: 'Perfil', path: '/app/perfil' },
]

export function AppLayout() {
  const location = useLocation()
  const {
    // Auth
    isLoading,
    profile,
    userType,
    canAccessCurrentAppRoute,
    defaultAppPath,

    // Subscription
    isSubscriptionExpired,
    trialDaysRemaining,
    subscriptionStatus,

    // Company / User
    avatarSrc,
    companyInitials,
    companyLogoSrc,
    companyName,
    empresaId,
    roleLabel,
    userName,

    // Layout
    contentPaddingClass,
    isMobileMenuOpen,
    isSidebarExpanded,
    setIsMobileMenuOpen,

    // Navigation
    currentItem,
    globalSearchItems,
    visibleNavigationGroups,
    visibleNavigationItems,
    visibleSettingsItems,

    // Notifications
    isMarkingAllNotificationsRead,
    isNotificationsOpen,
    notifications,
    notificationsLoading,
    setIsNotificationsOpen,
    unreadCount,

    // Handlers
    markAllNotificationsRead,
    navigateToAtendimentos,
    navigateToCliente,
    openGlobalSearchItem,
    openNotification,
    toggleSidebar,
  } = useAppLayout()

  if (!isLoading && userType === 'cliente') {
    return <Navigate replace to="/cliente" />
  }

  if (!isLoading && !canAccessCurrentAppRoute) {
    return <Navigate replace to={defaultAppPath} />
  }

  if (
    isSubscriptionExpired &&
    !allowedExpiredPaths.some((path) => location.pathname.startsWith(path))
  ) {
    return <Navigate replace to="/app/assinatura" />
  }

  return (
    <div className="bw-mobile-compact min-h-[100dvh] w-full max-w-full overflow-x-hidden bg-surface text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      {isMobileMenuOpen && (
        <button
          aria-label="Fechar menu"
          className="fixed inset-0 z-40 bg-slate-950/20 backdrop-blur-sm lg:hidden dark:bg-slate-950/60"
          onClick={() => setIsMobileMenuOpen(false)}
          type="button"
        />
      )}

      <Sidebar
        avatarSrc={avatarSrc}
        companyInitials={companyInitials}
        companyLogoSrc={companyLogoSrc}
        companyName={companyName}
        isExpanded={isSidebarExpanded}
        isMobileMenuOpen={isMobileMenuOpen}
        onCloseMobileMenu={() => setIsMobileMenuOpen(false)}
        onToggleExpanded={toggleSidebar}
        roleLabel={roleLabel}
        userName={userName}
        visibleGroups={visibleNavigationGroups}
        visibleItems={visibleNavigationItems}
        visibleSettingsItems={visibleSettingsItems}
      />

      <div
        className={cn(
          'min-h-[100dvh] min-w-0 overflow-x-hidden transition-[padding] duration-300',
          'w-full max-w-full',
          contentPaddingClass,
        )}
      >
        <TopBar
          currentItem={currentItem}
          empresaId={empresaId}
          isMarkingAllNotificationsRead={isMarkingAllNotificationsRead}
          isMobileMenuOpen={isMobileMenuOpen}
          isNotificationsOpen={isNotificationsOpen}
          notifications={notifications}
          notificationsLoading={notificationsLoading}
          onCloseNotifications={() => setIsNotificationsOpen(false)}
          onMarkAllNotificationsRead={markAllNotificationsRead}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          onOpenNotification={openNotification}
          onSelectAtendimento={navigateToAtendimentos}
          onSelectCliente={navigateToCliente}
          onSelectSearchItem={openGlobalSearchItem}
          onToggleNotifications={() => setIsNotificationsOpen((current) => !current)}
          searchItems={globalSearchItems}
          unreadCount={unreadCount}
        />

        <main
          className={cn(
            'w-full max-w-full min-w-0 overflow-x-hidden px-3 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:px-6 sm:py-8 sm:pb-[calc(env(safe-area-inset-bottom)+2rem)] md:px-8 lg:px-10 lg:py-9 xl:px-12',
            profile?.papel === 'barbeiro' &&
              'pb-[calc(env(safe-area-inset-bottom)+5.5rem)] md:pb-[calc(env(safe-area-inset-bottom)+2rem)]',
          )}
        >
          <SubscriptionBanner
            isExpired={isSubscriptionExpired}
            isTrialing={subscriptionStatus === 'TRIAL'}
            trialDaysRemaining={trialDaysRemaining}
          />
          <Outlet />
        </main>
      </div>

      {profile?.papel === 'barbeiro' && (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-slate-800 dark:bg-slate-950 md:hidden">
          <div className="mx-auto grid h-16 max-h-16 min-h-16 w-full max-w-[24rem] grid-cols-3 items-center gap-1 px-2">
            {barberMobileNavigation.map((item) => {
              const Icon = item.icon

              return (
                <NavLink
                  className={({ isActive }) =>
                    cn(
                      'flex h-[3.35rem] min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-center text-[0.65rem] font-semibold leading-none text-slate-500 transition dark:text-slate-300',
                      isActive &&
                        'bg-brand-50 text-brand-600 dark:bg-brand-400/15 dark:text-brand-100',
                    )
                  }
                  key={item.path}
                  to={item.path}
                >
                  <Icon className="shrink-0" size={19} />
                  <span className="block w-full max-w-full truncate whitespace-nowrap leading-none">
                    {item.label}
                  </span>
                </NavLink>
              )
            })}
          </div>
        </nav>
      )}
    </div>
  )
}
