import {
  CalendarCheck,
  Home,
  LogOut,
  MapPin,
  Scissors,
  UserRound,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'

import { useAuth } from '../hooks/useAuth'
import { resolveAssetUrl } from '../services/assetsService'
import { cn } from '../utils/cn'

const clientNavigation = [
  { icon: Home, label: 'Inicio', path: '/cliente' },
  { icon: CalendarCheck, label: 'Agendamentos', path: '/cliente/agendamentos' },
  { icon: Scissors, label: 'Minha Barbearia', path: '/cliente/minha-barbearia' },
  { icon: UserRound, label: 'Perfil', path: '/cliente/perfil' },
]

export function ClientLayout() {
  const { clientProfile } = useAuth()
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

  return (
    <div className="min-h-screen bg-surface text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/82 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-6xl items-center gap-4 px-5">
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
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">
              Cliente
            </p>
            <h1 className="truncate text-lg font-black text-slate-950">
              {clientProfile?.nome ?? 'BW Barber'}
            </h1>
          </div>
          <NavLink
            className="flex h-10 w-10 items-center justify-center rounded-2xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
            title="Sair"
            to="/logout"
          >
            <LogOut size={18} />
          </NavLink>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl gap-8 px-5 py-8 pb-28 xl:grid-cols-[14rem_minmax(0,1fr)]">
        <aside className="hidden self-start rounded-[1.5rem] border border-slate-200 bg-white p-3 shadow-[0_18px_70px_rgb(15_23_42/0.05)] xl:block">
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
                      isActive && 'bg-brand-50 text-brand-600',
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

        <div className="min-w-0">
          <Outlet />
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/88 px-3 py-3 backdrop-blur-xl md:hidden">
        <div className="grid grid-cols-4 gap-2">
          {clientNavigation.map((item) => {
            const Icon = item.icon

            return (
              <NavLink
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[0.68rem] font-semibold text-slate-500 transition',
                    isActive && 'bg-brand-50 text-brand-600',
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
