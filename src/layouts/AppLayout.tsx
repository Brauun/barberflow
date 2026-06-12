import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  Activity,
  BarChart3,
  BadgeCheck,
  Bell,
  CalendarDays,
  CreditCard,
  DollarSign,
  Gift,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Scissors,
  Search,
  Settings,
  Sparkles,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import {
  canManageAppointments,
  canManageClients,
  canManageEmployees,
  canManageFinance,
  canManageSettings,
  canViewFinance,
  canViewReports,
} from '../auth/permissions'
import { Button } from '../components/ui'
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
import type { UserRole } from '../types/database'
import { cn } from '../utils/cn'

type NavigationItem = {
  canAccess?: (role: UserRole | undefined) => boolean
  icon: LucideIcon
  label: string
  path: string
}

const navigationItems: NavigationItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/app/dashboard' },
]

const navigationGroups: Array<{ label: string; items: NavigationItem[] }> = [
  {
    items: [
      { canAccess: canManageClients, icon: Users, label: 'Clientes', path: '/app/clientes' },
      { canAccess: canManageEmployees, icon: Scissors, label: 'Barbeiros', path: '/app/barbeiros' },
      { canAccess: canManageAppointments, icon: Sparkles, label: 'Serviços', path: '/app/servicos' },
      { canAccess: canManageAppointments, icon: CalendarDays, label: 'Atendimentos', path: '/app/atendimentos' },
    ],
    label: 'OPERAÇÃO',
  },
  {
    items: [
      { canAccess: canViewFinance, icon: Package, label: 'Produtos', path: '/app/produtos' },
      { canAccess: canManageFinance, icon: Gift, label: 'Planos e Fidelidade', path: '/app/planos-fidelidade' },
      { canAccess: canViewFinance, icon: DollarSign, label: 'Fluxo de Caixa', path: '/app/fluxo-de-caixa' },
      { canAccess: canManageFinance, icon: CreditCard, label: 'Contas a Pagar', path: '/app/contas-a-pagar' },
    ],
    label: 'GESTÃO',
  },
  {
    items: [
      { canAccess: canViewReports, icon: BarChart3, label: 'Relatórios', path: '/app/relatorios' },
      {
        canAccess: canViewReports,
        icon: Activity,
        label: 'Relatórios Executivos',
        path: '/app/relatorios-executivos',
      },
    ],
    label: 'INTELIGÊNCIA',
  },
]
const settingsItem: NavigationItem[] = [
  { canAccess: canManageFinance, icon: BadgeCheck, label: 'Assinatura', path: '/app/assinatura' },
  { canAccess: canManageSettings, icon: Settings, label: 'Configurações', path: '/app/configuracoes' },
]

function canAccessNavigationItem(item: NavigationItem, role: UserRole | undefined) {
  return !item.canAccess || item.canAccess(role)
}

const roleLabels: Record<string, string> = {
  administrador: 'Administrador',
  barbeiro: 'Barbeiro',
  gerente: 'Gerente',
  recepcao: 'Recepção',
}

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
    () => settingsItem.filter((item) => canAccessNavigationItem(item, userRole)),
    [userRole],
  )
  const allVisibleNavigationItems = useMemo(
    () => [
      ...visibleNavigationItems,
      ...visibleNavigationGroups.flatMap((group) => group.items),
    ],
    [visibleNavigationGroups, visibleNavigationItems],
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
      visibleNavigationItems.find((item) =>
        location.pathname.startsWith(item.path),
      ) ??
      allVisibleNavigationItems.find((item) =>
        location.pathname.startsWith(item.path),
      ) ??
      visibleSettingsItems.find((item) => location.pathname.startsWith(item.path)) ??
      visibleNavigationItems[0] ??
      navigationItems[0],
    [allVisibleNavigationItems, location.pathname, visibleNavigationItems, visibleSettingsItems],
  )

  const companyName = profile?.empresa?.nome ?? user?.user_metadata.empresa ?? 'BW Barber'
  const userName = profile?.nome ?? user?.user_metadata.nome ?? 'Usuário'
  const sidebarWidthClass = isSidebarExpanded ? 'lg:w-[13.75rem]' : 'lg:w-[4.75rem]'
  const contentPaddingClass = isSidebarExpanded ? 'lg:pl-[13.75rem]' : 'lg:pl-[4.75rem]'
  const subscriptionQuery = useSubscription()
  const isSubscriptionExpired = subscriptionQuery.isExpired
  const trialDaysRemaining = subscriptionQuery.daysRemaining
  const allowedExpiredPaths = [
    '/app/dashboard',
    '/app/assinatura',
    '/app/configuracoes',
    '/app/perfil',
  ]

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

  function notificationTime(value: string) {
    const date = new Date(value)

    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      month: '2-digit',
    })
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

  function renderNavItem(item: NavigationItem) {
    const Icon = item.icon

    return (
      <NavLink
        aria-label={item.label}
        className={({ isActive }) =>
          cn(
            'group relative flex h-11 w-full items-center rounded-2xl text-slate-600 transition duration-[180ms] hover:translate-x-1 hover:bg-slate-50 hover:text-slate-950 dark:text-slate-200 dark:hover:bg-slate-800/80 dark:hover:text-white',
            isSidebarExpanded ? 'justify-start gap-3 px-3.5' : 'justify-center px-0',
            isActive &&
              'bg-brand-50/70 text-brand-600 shadow-[0_10px_28px_rgb(6_182_212/0.10)] ring-1 ring-brand-100/80 dark:bg-brand-400/15 dark:text-white dark:ring-brand-400/25',
          )
        }
        key={item.path}
        onClick={() => setIsMobileMenuOpen(false)}
        title={item.label}
        to={item.path}
      >
        {({ isActive }) => (
          <>
            <span
              className={cn(
                'absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full transition duration-[180ms]',
                isActive ? 'bg-brand-400 opacity-100' : 'bg-transparent opacity-0',
              )}
            />
            <Icon
              className={cn(
                'shrink-0 transition duration-[180ms]',
                isActive
                  ? 'text-brand-600 dark:text-brand-300'
                  : 'text-slate-500 group-hover:text-slate-900 dark:text-slate-300 dark:group-hover:text-white',
              )}
              size={19}
            />
            <span
              className={cn(
                'min-w-0 truncate text-sm font-semibold transition duration-[180ms]',
                isSidebarExpanded ? 'opacity-100' : 'hidden opacity-0',
              )}
            >
              {item.label}
            </span>
            {!isSidebarExpanded && (
              <span className="pointer-events-none absolute left-14 rounded-lg bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition duration-[180ms] group-hover:translate-x-1 group-hover:opacity-100">
                {item.label}
              </span>
            )}
          </>
        )}
      </NavLink>
    )
  }

  return (
    <div className="min-h-screen bg-surface text-slate-950">
      {isMobileMenuOpen && (
        <button
          aria-label="Fechar menu"
          className="fixed inset-0 z-40 bg-slate-950/20 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
          type="button"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[13.75rem] flex-col border-r border-slate-200 bg-white transition-[width,transform] duration-300 dark:border-slate-800 dark:bg-slate-950 lg:translate-x-0',
          sidebarWidthClass,
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div
          className={cn(
            'flex min-h-24 w-full items-center border-b border-slate-100 px-4 py-4 dark:border-slate-800',
            isSidebarExpanded ? 'justify-between' : 'justify-center',
          )}
        >
          <NavLink
            aria-label="BW Barber"
            className={cn(
              'flex min-w-0 items-center',
              isSidebarExpanded ? 'gap-3.5' : 'gap-0',
            )}
            to="/app/dashboard"
          >
            <span
              className={cn(
                'flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-50 font-black text-slate-950 ring-1 ring-brand-100 shadow-[0_12px_30px_rgb(15_23_42/0.08)] dark:bg-brand-400/12 dark:text-white dark:ring-brand-400/30',
                isSidebarExpanded ? 'h-[3.25rem] w-[3.25rem] text-base' : 'h-11 w-11 text-sm',
              )}
            >
              {companyLogoSrc ? (
                <img
                  alt={String(companyName)}
                  className="h-full w-full object-cover"
                  src={companyLogoSrc}
                />
              ) : (
                companyInitials
              )}
            </span>
            <span
              className={cn(
                'min-w-0 transition duration-[180ms]',
                isSidebarExpanded ? 'block opacity-100' : 'hidden opacity-0',
              )}
            >
              <span className="line-clamp-2 block text-sm font-black leading-tight text-slate-950 dark:text-white">
                {companyName}
              </span>
              <span className="mt-1 block truncate text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-300">
                BW Barber
              </span>
            </span>
          </NavLink>

          <button
            aria-label={isSidebarExpanded ? 'Compactar sidebar' : 'Expandir sidebar'}
            className={cn(
              'hidden h-8 w-8 items-center justify-center rounded-xl text-slate-500 transition duration-[180ms] hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white lg:flex',
              !isSidebarExpanded && 'lg:hidden',
            )}
            onClick={toggleSidebar}
            type="button"
          >
            {isSidebarExpanded ? (
              <PanelLeftClose size={17} />
            ) : (
              <PanelLeftOpen size={17} />
            )}
          </button>
        </div>

        <nav
          className={cn(
            'bw-sidebar-scroll flex flex-1 flex-col gap-2 overflow-y-auto py-7',
            isSidebarExpanded ? 'px-3' : 'items-center px-3',
          )}
        >
          <div className="mb-5 w-full space-y-2">
            {visibleNavigationItems.map(renderNavItem)}
          </div>
          {visibleNavigationGroups.map((group) => (
            <div className="w-full space-y-2" key={group.label}>
              <p
                className={cn(
                  'px-3.5 text-[0.63rem] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300',
                  !isSidebarExpanded && 'sr-only',
                )}
              >
                {group.label}
              </p>
              <div className="space-y-2">{group.items.map(renderNavItem)}</div>
            </div>
          ))}
        </nav>

        {!isSidebarExpanded && (
          <button
            aria-label="Expandir sidebar"
            className="mx-auto mb-3 hidden h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition duration-[180ms] hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white lg:flex"
            onClick={toggleSidebar}
            type="button"
          >
            <PanelLeftOpen size={17} />
          </button>
        )}

        <div
          className={cn(
            'w-full border-t border-slate-100 py-4 dark:border-slate-800',
            isSidebarExpanded ? 'px-3' : 'px-3',
          )}
        >
          <p
            className={cn(
              'mb-2 px-3.5 text-[0.63rem] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300',
              !isSidebarExpanded && 'sr-only',
            )}
          >
            SISTEMA
          </p>
          {visibleSettingsItems.map(renderNavItem)}
        </div>

        <div
          className={cn(
            'flex w-full items-center gap-3 border-t border-slate-100 py-5 dark:border-slate-800',
            isSidebarExpanded ? 'px-4' : 'justify-center px-3',
          )}
        >
          <div
            className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-sm font-black text-slate-700 ring-1 ring-slate-200 dark:bg-brand-400/12 dark:text-brand-100 dark:ring-brand-400/20"
            title={String(userName)}
          >
            {avatarSrc ? (
              <img
                alt={String(userName)}
                className="h-full w-full object-cover"
                src={avatarSrc}
              />
            ) : (
              <UserRound size={18} />
            )}
          </div>
          <div
            className={cn(
              'min-w-0 transition duration-[180ms]',
              isSidebarExpanded ? 'block opacity-100' : 'hidden opacity-0',
            )}
          >
            <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">
              {userName}
            </p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-300">
              {profile?.papel ? roleLabels[profile.papel] ?? profile.papel : 'Perfil'}
            </p>
          </div>
          <NavLink
            aria-label="Sair"
            className={cn(
              'ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-slate-500 transition duration-[180ms] hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white',
              !isSidebarExpanded && 'absolute bottom-5 right-3',
            )}
            title="Sair"
            to="/logout"
          >
            <LogOut size={17} />
          </NavLink>
        </div>
      </aside>

      <div className={cn('transition-[padding] duration-300', contentPaddingClass)}>
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/82 backdrop-blur-xl">
          <div className="flex h-16 items-center gap-3 px-4 sm:h-20 sm:px-6 md:px-8 lg:px-10 xl:px-12">
            <Button
              aria-label="Abrir menu"
              className="lg:hidden"
              onClick={() => setIsMobileMenuOpen(true)}
              size="icon-md"
              variant="ghost"
            >
              <Menu size={20} />
            </Button>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">
                {currentItem.label}
              </p>
              <h1 className="truncate text-lg font-black tracking-normal text-slate-950 sm:text-xl">
                BW Barber
              </h1>
            </div>

            <div className="hidden h-11 w-full max-w-xs items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 md:flex">
              <Search size={16} />
              <span>Buscar</span>
            </div>

            <div className="relative">
              <Button
                aria-label="Notificacoes"
                onClick={() => setIsNotificationsOpen((current) => !current)}
                size="icon-md"
                tooltipPosition="bottom"
                variant="ghost"
              >
                <Bell size={16} />
              </Button>
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-500 px-1.5 text-[0.65rem] font-black text-slate-950 ring-2 ring-white dark:ring-slate-950">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}

              {isNotificationsOpen && (
                <div className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-[1.35rem] border border-slate-200 bg-white shadow-[0_24px_80px_rgb(15_23_42/0.18)] dark:border-slate-800 dark:bg-slate-950">
                  <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                    <div>
                      <p className="text-sm font-black text-slate-950 dark:text-white">
                        Notificacoes
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {unreadCount} nao lida{unreadCount === 1 ? '' : 's'}
                      </p>
                    </div>
                    <button
                      className="rounded-full px-3 py-1.5 text-xs font-bold text-brand-600 transition hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-400/10"
                      disabled={markAllReadMutation.isPending || unreadCount === 0}
                      onClick={() => {
                        if (!profile?.empresa_id || !profile?.papel) {
                          return
                        }

                        markAllReadMutation.mutate({
                          empresaId: profile.empresa_id,
                          papel: profile.papel,
                          usuarioId: profile.id,
                        })
                      }}
                      type="button"
                    >
                      Marcar todas
                    </button>
                  </div>

                  <div className="max-h-[28rem] overflow-y-auto p-2">
                    {notificationsQuery.isLoading ? (
                      <p className="px-3 py-6 text-center text-sm text-slate-500">
                        Carregando notificacoes...
                      </p>
                    ) : notifications.length === 0 ? (
                      <p className="px-3 py-6 text-center text-sm text-slate-500">
                        Nenhuma notificacao por enquanto.
                      </p>
                    ) : (
                      notifications.map((notification) => (
                        <button
                          className={cn(
                            'w-full rounded-2xl px-3 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-900',
                            !notification.read_at &&
                              'bg-brand-50/70 dark:bg-brand-400/10',
                          )}
                          key={notification.id}
                          onClick={() => openNotification(notification)}
                          type="button"
                        >
                          <div className="flex items-start gap-3">
                            <span
                              className={cn(
                                'mt-1 h-2.5 w-2.5 shrink-0 rounded-full',
                                notification.read_at
                                  ? 'bg-slate-300 dark:bg-slate-700'
                                  : 'bg-brand-500',
                              )}
                            />
                            <span className="min-w-0">
                              <span className="block text-sm font-black text-slate-950 dark:text-white">
                                {notification.title}
                              </span>
                              <span className="mt-1 block text-sm leading-5 text-slate-600 dark:text-slate-300">
                                {notification.message}
                              </span>
                              <span className="mt-2 block text-xs font-semibold text-slate-400">
                                {notificationTime(notification.created_at)}
                              </span>
                            </span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <Button
              aria-label="Fechar menu"
              className="lg:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
              size="icon-md"
              variant="ghost"
            >
              <X size={16} />
            </Button>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 sm:py-8 md:px-8 lg:px-10 lg:py-9 xl:px-12">
          {subscriptionQuery.subscription?.status === 'TRIAL' && (
            <div className="mb-6 rounded-[1.35rem] border border-brand-100 bg-brand-50/80 px-5 py-4 text-sm font-semibold text-slate-700 dark:border-brand-400/20 dark:bg-brand-400/10 dark:text-brand-100">
              Seu teste gratis termina em {trialDaysRemaining ?? 0} dias.
            </div>
          )}
          {isSubscriptionExpired && (
            <div className="mb-6 rounded-[1.35rem] border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-200">
              Seu periodo de teste terminou. Escolha um plano para continuar
              usando o BW Barber.
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  )
}

