import {
  CalendarCheck,
  Home,
  LogOut,
  MapPin,
  Monitor,
  Moon,
  Scissors,
  Sun,
  UserRound,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Navigate, NavLink, Outlet } from 'react-router-dom'

import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import { resolveAssetUrl } from '../services/assetsService'
import { cn } from '../utils/cn'

const clientNavigation = [
  { icon: Home, label: 'Inicio', path: '/cliente' },
  { icon: CalendarCheck, label: 'Agendamentos', path: '/cliente/agendamentos' },
  { icon: Scissors, label: 'Minha Barbearia', path: '/cliente/minha-barbearia' },
  { icon: UserRound, label: 'Perfil', path: '/cliente/perfil' },
]

export function ClientLayout() {
  const { clientProfile, userType, isLoading, profileLoading } = useAuth()
  const { setTheme, theme } = useTheme()
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    void resolveAssetUrl('user-avatars', clientProfile?.avatar_url).then((url) => {
      if (active) {
        setAvatarSrc(url)
      }
    })

    return () => {
      active = false
    }
  }, [clientProfile?.avatar_url])

  if (isLoading || profileLoading) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-surface px-6">
        <p className="text-sm font-medium text-ink-700">Carregando...</p>
      </main>
    )
  }

  if (userType === 'barbearia') {
    return <Navigate replace to="/app/dashboard" />
  }

  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-surface text-slate-950 dark:text-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/82 pt-[env(safe-area-inset-top)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/88">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:h-20 sm:gap-4 sm:px-5">
          <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-brand-50 text-brand-600 ring-1 ring-brand-100 dark:bg-brand-400/12 dark:text-brand-100 dark:ring-brand-400/20">
            {avatarSrc ? (
              <img
                alt={clientProfile?.nome ?? 'Cliente'}
                className="h-full w-full object-cover"
                src={avatarSrc}
              />
            ) : (
              <UserRound size={19} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600 dark:text-brand-300">
              Cliente
            </p>
            <h1 className="truncate text-lg font-black text-slate-950 dark:text-white">
              {clientProfile?.nome ?? 'BW Barber'}
            </h1>
          </div>
          <div className="hidden items-center gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-900 sm:flex">
            {[
              { icon: Sun, label: 'Claro', value: 'light' as const },
              { icon: Moon, label: 'Escuro', value: 'dark' as const },
              { icon: Monitor, label: 'Sistema', value: 'system' as const },
            ].map((item) => {
              const Icon = item.icon

              return (
                <button
                  aria-label={`Tema ${item.label}`}
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-white hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white',
                    theme === item.value &&
                      'bg-white text-brand-600 shadow-sm dark:bg-brand-500 dark:text-slate-950',
                  )}
                  key={item.value}
                  onClick={() => setTheme(item.value)}
                  title={`Tema ${item.label}`}
                  type="button"
                >
                  <Icon size={16} />
                </button>
              )
            })}
          </div>
          <button
            aria-label="Alternar tema"
            className="flex h-10 w-10 items-center justify-center rounded-2xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white sm:hidden"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title="Alternar tema"
            type="button"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <NavLink
            className="flex h-10 w-10 items-center justify-center rounded-2xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            title="Sair"
            to="/logout"
          >
            <LogOut size={18} />
          </NavLink>
        </div>
      </header>

      <main className="mx-auto grid w-full min-w-0 max-w-7xl gap-6 overflow-x-hidden px-4 py-6 pb-[calc(env(safe-area-inset-bottom)+6.5rem)] sm:px-5 sm:py-8 xl:grid-cols-[14rem_minmax(0,1fr)]">
        <aside className="hidden self-start rounded-[1.5rem] border border-slate-200 bg-white p-3 shadow-[0_18px_70px_rgb(15_23_42/0.05)] dark:border-slate-800 dark:bg-slate-950 xl:block">
          <div className="mb-3 flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            <MapPin size={14} />
            Cliente
          </div>
          <div className="space-y-1">
            {clientNavigation.map((item) => {
              const Icon = item.icon

              return (
                <NavLink
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-950',
                      'dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white',
                      isActive &&
                        'bg-brand-50 text-brand-600 dark:bg-brand-400/15 dark:text-brand-100',
                    )
                  }
                  end={item.path === '/cliente'}
                  key={item.path}
                  to={item.path}
                >
                  <Icon size={17} />
                  {item.label}
                </NavLink>
              )
            })}
          </div>
        </aside>

        <div className="min-w-0 overflow-x-hidden">
          <Outlet />
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/88 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90 md:hidden">
        <div className="grid grid-cols-4 gap-2">
          {clientNavigation.map((item) => {
            const Icon = item.icon

            return (
              <NavLink
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[0.68rem] font-semibold text-slate-500 transition',
                    'dark:text-slate-300',
                    isActive &&
                      'bg-brand-50 text-brand-600 dark:bg-brand-400/15 dark:text-brand-100',
                  )
                }
                end={item.path === '/cliente'}
                key={item.path}
                to={item.path}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
