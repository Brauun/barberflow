import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { cn } from '../../utils/cn'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon-sm' | 'icon-md'
type TooltipPosition = 'top' | 'bottom'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  tooltipPosition?: TooltipPosition
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-slate-950 text-white shadow-[0_12px_30px_rgb(15_23_42/0.14)] hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-[0_16px_40px_rgb(15_23_42/0.18)] dark:bg-brand-500 dark:text-slate-950 dark:hover:bg-brand-400',
  secondary:
    'border border-slate-200 bg-white text-slate-900 shadow-sm hover:-translate-y-0.5 hover:border-brand-200 hover:bg-brand-50/70 hover:text-slate-950 dark:border-slate-200 dark:bg-white dark:text-slate-900',
  ghost:
    'text-slate-600 hover:-translate-y-0.5 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-600 dark:hover:bg-slate-100 dark:hover:text-slate-950',
  danger:
    'bg-red-600 text-white shadow-sm shadow-red-900/10 hover:-translate-y-0.5 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600',
}

const sizeClasses: Record<ButtonSize, string> = {
  'icon-md': 'h-9 w-9 px-0 text-sm',
  'icon-sm': 'h-8 w-8 px-0 text-sm',
  sm: 'h-9 px-2.5 text-sm sm:px-3',
  md: 'h-10 px-3 text-sm sm:px-4',
  lg: 'h-11 px-4 text-sm sm:px-5 sm:text-base',
}

const tooltipPositionClasses: Record<TooltipPosition, string> = {
  bottom:
    'before:left-1/2 before:top-full before:mt-2 before:-translate-x-1/2 after:left-1/2 after:top-full after:mt-0.5 after:-translate-x-1/2',
  top:
    'before:bottom-full before:left-1/2 before:mb-2 before:-translate-x-1/2 after:bottom-full after:left-1/2 after:mb-0.5 after:-translate-x-1/2',
}

export function Button({
  children,
  className,
  disabled,
  leftIcon,
  rightIcon,
  size = 'md',
  tooltipPosition = 'top',
  type = 'button',
  variant = 'primary',
  ...props
}: ButtonProps) {
  const tooltip =
    typeof props['aria-label'] === 'string' && size.startsWith('icon')
      ? props['aria-label']
      : undefined

  return (
    <button
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl font-semibold transition duration-200 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60 sm:min-h-0',
        tooltip &&
          'relative overflow-visible before:pointer-events-none before:absolute before:z-50 before:whitespace-nowrap before:rounded-lg before:bg-slate-950 before:px-2.5 before:py-1.5 before:text-xs before:font-semibold before:text-white before:opacity-0 before:shadow-lg before:transition before:duration-150 before:content-[attr(data-tooltip)] after:pointer-events-none after:absolute after:z-50 after:h-2 after:w-2 after:rotate-45 after:bg-slate-950 after:opacity-0 after:transition after:duration-150 hover:before:opacity-100 hover:after:opacity-100 focus-visible:before:opacity-100 focus-visible:after:opacity-100 dark:before:bg-white dark:before:text-slate-950 dark:after:bg-white',
        tooltip && tooltipPositionClasses[tooltipPosition],
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      data-tooltip={tooltip}
      disabled={disabled}
      type={type}
      {...props}
    >
      {leftIcon}
      {children}
      {rightIcon}
    </button>
  )
}
