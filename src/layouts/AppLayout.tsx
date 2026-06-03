import {
  BarChart3,
  Bell,
  CalendarDays,
  ChevronRight,
  CreditCard,
  DollarSign,
  LayoutDashboard,
  Menu,
  Moon,
  Package,
  Scissors,
  Search,
  Settings,
  Sparkles,
  Sun,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

import { Button } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { cn } from '../utils/cn'

const navigationItems = [
  {
    label: 'Dashboard',
    path: '/app/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Clientes',
    path: '/app/clientes',
    icon: Users,
  },
  {
    label: 'Barbeiros',
    path: '/app/barbeiros',
    icon: Scissors,
  },
  {
    label: 'Serviços',
    path: '/app/servicos',
    icon: Sparkles,
  },
  {
    label: 'Atendimentos',
    path: '/app/atendimentos',
    icon: CalendarDays,
  },
  {
    label: 'Produtos',
    path: '/app/produtos',
    icon: Package,
  },
  {
    label: 'Fluxo de Caixa',
    path: '/app/fluxo-de-caixa',
    icon: DollarSign,
  },
  {
    label: 'Contas a Pagar',
    path: '/app/contas-a-pagar',
    icon: CreditCard,
  },
  {
    label: 'Relatórios',
    path: '/app/relatorios',
    icon: BarChart3,
  },
  {
    label: 'Configurações',
    path: '/app/configuracoes',
    icon: Settings,
  },
]

export function AppLayout() {
  const { profile, user } = useAuth()
  const location = useLocation()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const storedTheme = localStorage.getItem('barberflow-theme')

    if (storedTheme === 'dark') {
      return true
    }

    if (storedTheme === 'light') {
      return false
    }

    return document.documentElement.classList.contains('dark')
  })

  const currentItem = useMemo(
    () =>
      navigationItems.find((item) =>
        location.pathname.startsWith(item.path),
      ) ?? navigationItems[0],
    [location.pathname],
  )

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode)
    localStorage.setItem('barberflow-theme', isDarkMode ? 'dark' : 'light')
  }, [isDarkMode])

  const userName = profile?.nome ?? user?.user_metadata.nome ?? 'Usuário'
  const companyName = profile?.empresa?.nome ?? user?.user_metadata.empresa ?? 'BarberFlow'

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      {isMobileMenuOpen && (
        <button
          aria-label="Fechar menu"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
          type="button"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-zinc-200 bg-white transition-transform duration-200 dark:border-zinc-800 dark:bg-zinc-950 lg:translate-x-0',
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-zinc-200 px-5 dark:border-zinc-800">
          <NavLink className="flex items-center gap-3" to="/app/dashboard">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-charcoal text-brand-400 dark:bg-brand-400 dark:text-charcoal">
              <Scissors size={20} />
            </span>
            <span>
              <span className="block text-base font-bold tracking-normal">
                BarberFlow
              </span>
              <span className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                SaaS
              </span>
            </span>
          </NavLink>

          <Button
            aria-label="Fechar menu"
            className="h-9 w-9 px-0 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
            variant="ghost"
          >
            <X size={18} />
          </Button>
        </div>

        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <p className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
            Empresa
          </p>
          <p className="mt-1 truncate text-sm font-semibold">{companyName}</p>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navigationItems.map((item) => {
            const Icon = item.icon

            return (
              <NavLink
                className={({ isActive }) =>
                  cn(
                    'flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition',
                    isActive
                      ? 'bg-charcoal text-white shadow-sm dark:bg-brand-400 dark:text-charcoal'
                      : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-white',
                  )
                }
                key={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                to={item.path}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
          <div className="flex items-center gap-3 rounded-md bg-zinc-100 p-3 dark:bg-zinc-900">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-500 text-sm font-bold text-white dark:bg-brand-400 dark:text-charcoal">
              {String(userName).slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{userName}</p>
              <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                {profile?.papel ?? 'perfil'}
              </p>
            </div>
            <ChevronRight size={16} className="text-zinc-400" />
          </div>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <Button
              aria-label="Abrir menu"
              className="h-10 w-10 px-0 lg:hidden"
              onClick={() => setIsMobileMenuOpen(true)}
              variant="ghost"
            >
              <Menu size={20} />
            </Button>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase text-brand-600 dark:text-brand-400">
                {currentItem.label}
              </p>
              <h1 className="truncate text-lg font-semibold tracking-normal sm:text-xl">
                Painel BarberFlow
              </h1>
            </div>

            <div className="hidden h-10 w-full max-w-xs items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 md:flex">
              <Search size={16} />
              <span>Buscar</span>
            </div>

            <Button
              aria-label="Alternar tema"
              className="h-10 w-10 px-0"
              onClick={() => setIsDarkMode((current) => !current)}
              variant="ghost"
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </Button>

            <Button aria-label="Notificações" className="h-10 w-10 px-0" variant="ghost">
              <Bell size={18} />
            </Button>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
