import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import {
  canAccessNavigationItem,
  navigationGroups,
  navigationItems,
  settingsItems,
  type NavigationItem,
} from '../components/layout/Sidebar'
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

const roleLabels: Record<string, string> = {
  administrador: 'Administrador',
  barbeiro: 'Barbeiro',
  gerente: 'Gerente',
  recepcao: 'Recepção',
}

export const allowedExpiredPaths = [
  '/app/dashboard',
  '/app/assinatura',
  '/app/configuracoes',
  '/app/perfil',
]

export function useAppLayout() {
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

  const empresaId = profile?.empresa_id
  const companyName = profile?.empresa?.nome ?? user?.user_metadata.empresa ?? 'BW Barber'
  const userName = profile?.nome ?? user?.user_metadata.nome ?? 'Usuário'
  const roleLabel = profile?.papel ? roleLabels[profile.papel] ?? profile.papel : 'Perfil'
  const contentPaddingClass = isSidebarExpanded ? 'lg:pl-[13.75rem]' : 'lg:pl-[4.75rem]'

  // --- Navigation visibility ---

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
    if (!location.pathname.startsWith('/app')) return true
    if (location.pathname === '/app' || location.pathname.startsWith('/app/perfil')) return true

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

  // --- Notifications ---

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
  const unreadCount = notifications.filter((n) => !n.read_at).length

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

  // --- Asset resolution ---

  useEffect(() => {
    let active = true
    void resolveAssetUrl('company-assets', profile?.empresa?.logo_url).then((url) => {
      if (active) setCompanyLogoSrc(url)
    })
    return () => { active = false }
  }, [profile?.empresa?.logo_url])

  useEffect(() => {
    let active = true
    void resolveAssetUrl('user-avatars', profile?.avatar_url).then((url) => {
      if (active) setAvatarSrc(url)
    })
    return () => { active = false }
  }, [profile?.avatar_url])

  // --- Handlers ---

  function toggleSidebar() {
    setIsSidebarExpanded((current) => {
      const nextState = !current
      localStorage.setItem('bw-barber-sidebar', nextState ? 'expanded' : 'compact')
      return nextState
    })
  }

  function openNotification(notification: InternalNotification) {
    if (!profile?.empresa_id) return

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
    if (!profile?.empresa_id || !profile?.papel) return

    markAllReadMutation.mutate({
      empresaId: profile.empresa_id,
      papel: profile.papel,
      usuarioId: profile.id,
    })
  }

  function openGlobalSearchItem(item: NavigationItem) {
    navigate(item.path)
  }

  function navigateToCliente(clienteId: string) {
    navigate(`/app/clientes?id=${clienteId}`)
  }

  function navigateToAtendimentos() {
    navigate('/app/atendimentos')
  }

  return {
    // Auth
    isLoading,
    profile,
    userType,
    canAccessCurrentAppRoute,

    // Subscription
    isSubscriptionExpired,
    trialDaysRemaining,
    subscriptionStatus: subscriptionQuery.subscription?.status,

    // Company / User
    avatarSrc,
    companyInitials,
    companyLogoSrc,
    companyName: String(companyName),
    empresaId,
    roleLabel,
    userName: String(userName),

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
    isNotificationsOpen,
    isMarkingAllNotificationsRead: markAllReadMutation.isPending,
    notifications,
    notificationsLoading: notificationsQuery.isLoading,
    setIsNotificationsOpen,
    unreadCount,

    // Handlers
    markAllNotificationsRead,
    navigateToAtendimentos,
    navigateToCliente,
    openGlobalSearchItem,
    openNotification,
    toggleSidebar,
  }
}
