import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'

import {
  canAccessNavigationItem,
  navigationGroups,
  navigationItems,
  settingsItems,
  Sidebar,
  type NavigationItem,
} from '../components/layout/Sidebar'
import { TopBar } from '../components/layout/TopBar'
import { useAuth } from '../hooks/useAuth'
import { useSubscription } from '../hooks/useSubscription'
import { queryKeys } from '../lib/queryKeys'
import { resolveAssetUrl } from '../services/assetsService'
import {
  listNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  type InternalNotification,
} from '../services/notificationsService'
import { cn } from '../utils/cn'

const roleLabels: Record<string, string> = {
  administrador: 'Administrador',
  barbeiro: 'Barbeiro',
  gerente: 'Gerente',
  recepcao: 'Recepção',
}

const allowedExpiredPaths = [
  '/app/dashboard',
  '/app/assinatura',
  '/app/configuracoes',
  '/app/perfil',
]

export function AppLayout() {
  const { isLoading, profile, user, userType } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [companyLogoSrc, setCompanyLogoSrc] = useState<string | null>(null)
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null)
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(() => {
    const storedState = localStorage.getItem('bw-barber-sidebar')

    return storedState !== 'compact'
  })

  const userRole = profile?.papel
  const subscriptionQuery = useSubscription()
  const isSubscriptionExpired = subscriptionQuery.isExpired
  const trialDaysRemaining = subscriptionQuery.daysRemaining
  const companyName = profile?.empresa?.nome ?? user?.user_metadata.empresa ?? 'BW Barber'
  const userName = profile?.nome ?? user?.user_metadata.nome ?? 'Usuário'
  const roleLabel = profile?.papel ? roleLabels[profile.papel] ?? profile.papel : 'Perfil'
  const contentPaddingClass = isSidebarExpanded ? 'lg:pl-[13.75rem]' : 'lg:pl-[4.75rem]'

  const visibleNavigationItems = useMemo(
    () => navigationItems.filter((item) => canAccessNavigationItem(item, userRole)),
    [userRole],
  )
  const visibleNavigationGroups = useMemo(
    () =>
      navigationGroups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => canAccessNavigationItem(item, userRole)),
        }))
        .filter((group) => group.items.length > 0),
    [userRole],
  )
  const visibleSettingsItems = useMemo(
    () => settingsItems.filter((item) => canAccessNavigationItem(item, userRole)),
    [userRole],
  )
  const allVisibleNavigationItems = useMemo(
    () => [
      ...visibleNavigationItems,
      ...visibleNavigationGroups.flatMap((group) => group.items),
    ],
    [visibleNavigationGroups, visibleNavigationItems],
  )
  const globalSearchItems = useMemo(
    () => [...allVisibleNavigationItems, ...visibleSettingsItems],
    [allVisibleNavigationItems, visibleSettingsItems],
  )
  const canAccessCurrentAppRoute = useMemo(() => {
    if (!location.pathname.startsWith('/app')) {
      return true
    }

    if (location.pathname === '/app' || location.pathname.startsWith('/app/perfil')) {
      return true
    }

    return [...allVisibleNavigationItems, ...visibleSettingsItems].some((item) =>
      location.pathname.startsWith(item.path),
    )
  }, [allVisibleNavigationItems, location.pathname, visibleSettingsItems])

  const currentItem = useMemo(
    () =>
      visibleNavigationItems.find((item) => location.pathname.startsWith(item.path)) ??
      allVisibleNavigationItems.find((item) => location.pathname.startsWith(item.path)) ??
      visibleSettingsItems.find((item) => location.pathname.startsWith(item.path)) ??
      visibleNavigationItems[0] ??
      navigationItems[0],
    [allVisibleNavigationItems, location.pathname, visibleNavigationItems, visibleSettingsItems],
  )

  const companyInitials = useMemo(
    () =>
      String(companyName)
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase() || 'BW',
    [companyName],
  )

  const notificationsQuery = useQuery({
    enabled: Boolean(profile?.empresa_id && profile?.id && profile?.papel),
    queryFn: () =>
      listNotifications({
        empresaId: profile?.empresa_id as string,
        papel: profile?.papel as NonNullable<typeof profile>['papel'],
        usuarioId: profile?.id as string,
      }),
    queryKey: [
      ...queryKeys.notificacoes.all,
      profile?.empresa_id,
      profile?.id,
      profile?.papel,
    ],
    refetchInterval: 30000,
  })
  const notifications = notificationsQuery.data ?? []
  const unreadCount = notifications.filter((notification) => !notification.read_at).length

  const markReadMutation = useMutation({
    mutationFn: markNotificationAsRead,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.notificacoes.all })
    },
  })

  const markAllReadMutation = useMutation({
    mutationFn: markAllNotificationsAsRead,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.notificacoes.all })
    },
  })

  useEffect(() => {
    let active = true

    void resolveAssetUrl('company-assets', profile?.empresa?.logo_url).then((url) => {
      if (active) {
        setCompanyLogoSrc(url)
      }
    })

    return () => {
      active = false
    }
  }, [profile?.empresa?.logo_url])

  useEffect(() => {
    let active = true

    void resolveAssetUrl('user-avatars', profile?.avatar_url).then((url) => {
      if (active) {
        setAvatarSrc(url)
      }
    })

    return () => {
      active = false
    }
  }, [profile?.avatar_url])

  function toggleSidebar() {
    setIsSidebarExpanded((current) => {
      const nextState = !current
      localStorage.setItem('bw-barber-sidebar', nextState ? 'expanded' : 'compact')

      return nextState
    })
  }

  function openNotification(notification: InternalNotification) {
    if (!profile?.empresa_id) {
      return
    }

    if (!notification.read_at) {
      markReadMutation.mutate({
        empresaId: profile.empresa_id,
        notificationId: notification.id,
      })
    }

    setIsNotificationsOpen(false)

    if (
      [
        'appointment_created',
        'appointment_cancelled',
        'appointment_rescheduled',
        'appointment_upcoming',
      ].includes(notification.type)
    ) {
      navigate('/app/atendimentos')
      return
    }

    if (['waitlist_joined', 'waitlist_vacancy'].includes(notification.type)) {
      navigate('/app/atendimentos')
    }
  }

  function markAllNotificationsRead() {
    if (!profile?.empresa_id || !profile?.papel) {
      return
    }

    markAllReadMutation.mutate({
      empresaId: profile.empresa_id,
      papel: profile.papel,
      usuarioId: profile.id,
    })
  }

  function openGlobalSearchItem(item: NavigationItem) {
    navigate(item.path)
  }

  if (!isLoading && userType === 'cliente') {
    return <Navigate replace to="/cliente" />
  }

  if (!isLoading && profile && !canAccessCurrentAppRoute) {
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
        companyName={String(companyName)}
        isExpanded={isSidebarExpanded}
        isMobileMenuOpen={isMobileMenuOpen}
        onCloseMobileMenu={() => setIsMobileMenuOpen(false)}
        onToggleExpanded={toggleSidebar}
        roleLabel={roleLabel}
        userName={String(userName)}
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
          isMarkingAllNotificationsRead={markAllReadMutation.isPending}
          isNotificationsOpen={isNotificationsOpen}
          notifications={notifications}
          notificationsLoading={notificationsQuery.isLoading}
          onMarkAllNotificationsRead={markAllNotificationsRead}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          onOpenNotification={openNotification}
          onSelectSearchItem={openGlobalSearchItem}
          onToggleNotifications={() => setIsNotificationsOpen((current) => !current)}
          searchItems={globalSearchItems}
          unreadCount={unreadCount}
        />

        <main className="min-w-0 overflow-x-hidden px-4 py-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] sm:px-6 sm:py-8 sm:pb-[calc(env(safe-area-inset-bottom)+2rem)] md:px-8 lg:px-10 lg:py-9 xl:px-12">
          {subscriptionQuery.subscription?.status === 'TRIAL' && (
            <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-brand-100 bg-brand-50/60 px-4 py-3 text-sm text-slate-600 dark:border-brand-400/15 dark:bg-brand-400/8 dark:text-brand-200">
              <span className="shrink-0 text-brand-500 dark:text-brand-400">⏳</span>
              Seu teste grátis termina em{' '}
              <span className="font-semibold text-brand-600 dark:text-brand-300">
                {trialDaysRemaining ?? 0} dias
              </span>
              . Assine para continuar usando todos os recursos.
            </div>
          )}
          {isSubscriptionExpired && (
            <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/8 dark:text-red-300">
              <span className="shrink-0">⚠️</span>
              Seu período de teste terminou. Escolha um plano para continuar usando o BW Barber.
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  )
}
