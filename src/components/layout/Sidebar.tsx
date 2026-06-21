import {
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  UserRound,
  X,
} from 'lucide-react'
import { useRef } from 'react'
import { NavLink } from 'react-router-dom'

import { useClickOutside } from '../../hooks/useClickOutside'
import { cn } from '../../utils/cn'
import type { NavigationItem } from './navigation'

type SidebarProps = {
  avatarSrc: string | null
  companyInitials: string
  companyLogoSrc: string | null
  companyName: string
  isExpanded: boolean
  isMobileMenuOpen: boolean
  onCloseMobileMenu: () => void
  onToggleExpanded: () => void
  roleLabel: string
  userName: string
  visibleGroups: Array<{ label: string; items: NavigationItem[] }>
  visibleItems: NavigationItem[]
  visibleSettingsItems: NavigationItem[]
}

export function Sidebar({
  avatarSrc,
  companyInitials,
  companyLogoSrc,
  companyName,
  isExpanded,
  isMobileMenuOpen,
  onCloseMobileMenu,
  onToggleExpanded,
  roleLabel,
  userName,
  visibleGroups,
  visibleItems,
  visibleSettingsItems,
}: SidebarProps) {
  const sidebarRef = useRef<HTMLElement | null>(null)
  const sidebarWidthClass = isExpanded ? 'lg:w-[13.75rem]' : 'lg:w-[4.75rem]'

  useClickOutside(sidebarRef, onCloseMobileMenu, {
    enabled: isMobileMenuOpen,
  })

  function renderNavItem(item: NavigationItem) {
    const Icon = item.icon

    return (
      <NavLink
        aria-label={item.label}
        className={({ isActive }) =>
          cn(
            'group relative flex h-10 w-full items-center rounded-xl text-slate-500 transition duration-150 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-300 dark:hover:bg-slate-800/60 dark:hover:text-white',
            isExpanded ? 'justify-start gap-3 px-3.5' : 'justify-center px-0',
            isActive && 'bg-brand-50 text-brand-600 dark:bg-brand-400/12 dark:text-brand-300',
          )
        }
        key={item.path}
        onClick={onCloseMobileMenu}
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
                isExpanded ? 'opacity-100' : 'hidden opacity-0',
              )}
            >
              {item.label}
            </span>
            {!isExpanded && (
              <span className="pointer-events-none absolute left-14 rounded-lg bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition duration-[180ms] group-hover:translate-x-1 group-hover:opacity-100 dark:bg-white dark:text-slate-950">
                {item.label}
              </span>
            )}
          </>
        )}
      </NavLink>
    )
  }

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-50 flex h-[100dvh] max-h-[100dvh] w-[13.75rem] flex-col border-r border-slate-200 bg-white pt-[env(safe-area-inset-top)] transition-[width,transform] duration-300 dark:border-slate-800 dark:bg-slate-950 lg:translate-x-0',
        sidebarWidthClass,
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full',
      )}
      ref={sidebarRef}
    >
      <div
        className={cn(
          'flex min-h-24 w-full items-center border-b border-slate-100 px-4 py-4 dark:border-slate-800',
          isExpanded ? 'justify-between' : 'justify-center',
        )}
      >
        <NavLink
          aria-label="BW Barber"
          className={cn('flex min-w-0 items-center', isExpanded ? 'gap-3.5' : 'gap-0')}
          to="/app/dashboard"
        >
          <span
            className={cn(
              'flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-50 font-black text-slate-950 ring-1 ring-brand-100 shadow-[0_12px_30px_rgb(15_23_42/0.08)] dark:bg-brand-400/12 dark:text-white dark:ring-brand-400/30',
              isExpanded ? 'h-[3.25rem] w-[3.25rem] text-base' : 'h-11 w-11 text-sm',
            )}
          >
            {companyLogoSrc ? (
              <img alt={companyName} className="h-full w-full object-cover" src={companyLogoSrc} />
            ) : (
              companyInitials
            )}
          </span>
          <span
            className={cn(
              'min-w-0 transition duration-[180ms]',
              isExpanded ? 'block opacity-100' : 'hidden opacity-0',
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
          aria-label={isExpanded ? 'Compactar sidebar' : 'Expandir sidebar'}
          className={cn(
            'hidden h-8 w-8 items-center justify-center rounded-xl text-slate-500 transition duration-[180ms] hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white lg:flex',
            !isExpanded && 'lg:hidden',
          )}
          onClick={onToggleExpanded}
          type="button"
        >
          {isExpanded ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
        </button>

        <button
          aria-label="Fechar menu"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-slate-500 transition duration-[180ms] hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white lg:hidden"
          onClick={onCloseMobileMenu}
          type="button"
        >
          <X size={18} />
        </button>
      </div>

      <nav
        className={cn(
          'bw-sidebar-scroll flex flex-1 flex-col gap-2 overflow-y-auto py-7',
          isExpanded ? 'px-3' : 'items-center px-3',
        )}
      >
        <div className="mb-5 w-full space-y-2">{visibleItems.map(renderNavItem)}</div>
        {visibleGroups.map((group) => (
          <div className="w-full space-y-2" key={group.label}>
            <p
              className={cn(
                'px-3.5 text-[0.63rem] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300',
                !isExpanded && 'sr-only',
              )}
            >
              {group.label}
            </p>
            <div className="space-y-2">{group.items.map(renderNavItem)}</div>
          </div>
        ))}
      </nav>

      {!isExpanded && (
        <button
          aria-label="Expandir sidebar"
          className="mx-auto mb-3 hidden h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition duration-[180ms] hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white lg:flex"
          onClick={onToggleExpanded}
          type="button"
        >
          <PanelLeftOpen size={17} />
        </button>
      )}

      <div className="w-full border-t border-slate-100 px-3 py-4 dark:border-slate-800">
        <p
          className={cn(
            'mb-2 px-3.5 text-[0.63rem] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300',
            !isExpanded && 'sr-only',
          )}
        >
          SISTEMA
        </p>
        {visibleSettingsItems.map(renderNavItem)}
      </div>

      <div
        className={cn(
          'flex w-full items-center gap-3 border-t border-slate-100 py-5 dark:border-slate-800',
          isExpanded ? 'px-4' : 'justify-center px-3',
        )}
      >
        <div
          className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-sm font-black text-slate-700 ring-1 ring-slate-200 dark:bg-brand-400/12 dark:text-brand-100 dark:ring-brand-400/20"
          title={userName}
        >
          {avatarSrc ? (
            <img alt={userName} className="h-full w-full object-cover" src={avatarSrc} />
          ) : (
            <UserRound size={18} />
          )}
        </div>
        <div
          className={cn(
            'min-w-0 transition duration-[180ms]',
            isExpanded ? 'block opacity-100' : 'hidden opacity-0',
          )}
        >
          <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{userName}</p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-300">{roleLabel}</p>
        </div>
        <NavLink
          aria-label="Sair"
          className={cn(
            'ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-slate-500 transition duration-[180ms] hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white',
            !isExpanded && 'absolute bottom-5 right-3',
          )}
          title="Sair"
          to="/logout"
        >
          <LogOut size={17} />
        </NavLink>
      </div>
    </aside>
  )
}
