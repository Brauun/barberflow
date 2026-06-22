import type { HTMLAttributes, ReactNode } from 'react'

import { cn } from '../../utils/cn'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info'

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode
  variant?: BadgeVariant
}

const badgeTextLabels: Record<string, string> = {
  aceito: 'Aceito',
  agendado: 'Agendado',
  aguardando: 'Aguardando',
  ativo: 'Ativo',
  cancelada: 'Cancelada',
  cancelado: 'Cancelado',
  concluido_automatico: 'Concluído automático',
  concluido: 'Concluído',
  confirmada: 'Confirmada',
  confirmado: 'Confirmado',
  em_atendimento: 'Em atendimento',
  expirado: 'Expirado',
  faltou: 'Faltou',
  inativo: 'Inativo',
  notificado: 'Notificado',
  nao_compareceu: 'Não compareceu',
  paga: 'Paga',
  pago: 'Pago',
  pendente: 'Pendente',
  remarcado: 'Remarcado',
  vencida: 'Vencida',
  vencido: 'Vencido',
}

const variantClasses: Record<BadgeVariant, string> = {
  default:
    'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-200 dark:bg-slate-100 dark:text-slate-700',
  success:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
  warning:
    'border-brand-100 bg-brand-50 text-brand-600 dark:border-brand-100 dark:bg-brand-50 dark:text-brand-600',
  danger:
    'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300',
  info:
    'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900 dark:bg-cyan-950 dark:text-cyan-300',
}

export function Badge({
  children,
  className,
  variant = 'default',
  ...props
}: BadgeProps) {
  const content =
    typeof children === 'string'
      ? badgeTextLabels[children.toLowerCase()] ?? children
      : children

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[0.68rem] font-semibold leading-4 sm:px-2.5 sm:py-1 sm:text-xs sm:leading-normal',
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {content}
    </span>
  )
}
