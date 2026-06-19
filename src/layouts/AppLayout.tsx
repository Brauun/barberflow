import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { Sidebar } from '../components/layout/Sidebar'
import { TopBar } from '../components/layout/TopBar'
import { SubscriptionBanner } from '../components/layout/SubscriptionBanner'
import { allowedExpiredPaths, useAppLayout } from '../hooks/useAppLayout'
import { cn } from '../utils/cn'

export function AppLayout() {
  const location = useLocation()
  const {
    // Auth
    isLoading,
    userType,
    canAccessCurrentAppRoute,

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
    return <Navigate replace to="/app/dashboard" />
  }

  if (
    isSubscriptionExpired &&
    !allowedExpiredPaths.some((path) => location.pathname.startsWith(path))
  ) {
    return <Navigate replace to="/app/assinatura" />
  }

  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-surface text-slate-950 dark:bg-slate-950 dark:text-slate-50">
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

        <main className="min-w-0 overflow-x-hidden px-4 py-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] sm:px-6 sm:py-8 sm:pb-[calc(env(safe-area-inset-bottom)+2rem)] md:px-8 lg:px-10 lg:py-9 xl:px-12">
          <SubscriptionBanner
            isExpired={isSubscriptionExpired}
            isTrialing={subscriptionStatus === 'TRIAL'}
            trialDaysRemaining={trialDaysRemaining}
          />
          <Outlet />
        </main>
      </div>
    </div>
  )
}
