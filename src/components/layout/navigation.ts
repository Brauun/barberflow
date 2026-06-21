import {
  BarChart3,
  CalendarDays,
  CreditCard,
  DollarSign,
  FileText,
  Gift,
  LayoutDashboard,
  Package,
  Receipt,
  Scissors,
  Settings,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import {
  canManageAppointments,
  canManageClients,
  canManageEmployees,
  canManageFinance,
  canManageServices,
  canManageSettings,
  canViewFinance,
  canViewReports,
} from '../../auth/permissions'
import type { UserRole } from '../../types/database'

type AppRole = UserRole | 'cliente' | null | undefined

export type NavigationItem = {
  canAccess?: (role: AppRole) => boolean
  icon: LucideIcon
  label: string
  path: string
}

export function canAccessNavigationItem(item: NavigationItem, role: AppRole) {
  return item.canAccess ? item.canAccess(role) : true
}

export const navigationItems: NavigationItem[] = [
  {
    canAccess: (role) => role === 'administrador',
    icon: LayoutDashboard,
    label: 'Dashboard',
    path: '/app/dashboard',
  },
]

export const navigationGroups: Array<{ label: string; items: NavigationItem[] }> = [
  {
    label: 'Operação',
    items: [
      {
        canAccess: canManageClients,
        icon: UsersRound,
        label: 'Clientes',
        path: '/app/clientes',
      },
      {
        canAccess: canManageEmployees,
        icon: Scissors,
        label: 'Barbeiros',
        path: '/app/barbeiros',
      },
      {
        canAccess: canManageServices,
        icon: Sparkles,
        label: 'Serviços',
        path: '/app/servicos',
      },
      {
        canAccess: canManageAppointments,
        icon: CalendarDays,
        label: 'Atendimentos',
        path: '/app/atendimentos',
      },
    ],
  },
  {
    label: 'Gestão',
    items: [
      {
        canAccess: canManageFinance,
        icon: Package,
        label: 'Produtos',
        path: '/app/produtos',
      },
      {
        canAccess: canManageFinance,
        icon: Gift,
        label: 'Planos e Fidelidade',
        path: '/app/planos-fidelidade',
      },
      {
        canAccess: canViewFinance,
        icon: DollarSign,
        label: 'Fluxo de Caixa',
        path: '/app/fluxo-de-caixa',
      },
      {
        canAccess: canManageFinance,
        icon: CreditCard,
        label: 'Contas a Pagar',
        path: '/app/contas-a-pagar',
      },
    ],
  },
  {
    label: 'Inteligência',
    items: [
      {
        canAccess: canViewReports,
        icon: BarChart3,
        label: 'Relatórios',
        path: '/app/relatorios',
      },
      {
        canAccess: canViewReports,
        icon: FileText,
        label: 'Relatórios Executivos',
        path: '/app/relatorios-executivos',
      },
    ],
  },
]

export const settingsItems: NavigationItem[] = [
  {
    canAccess: canManageSettings,
    icon: Receipt,
    label: 'Assinatura',
    path: '/app/assinatura',
  },
  {
    canAccess: canManageSettings,
    icon: Settings,
    label: 'Configurações',
    path: '/app/configuracoes',
  },
  {
    icon: ShieldCheck,
    label: 'Perfil',
    path: '/app/perfil',
  },
]
