// src/components/ui/Button.jsx
//
// Botón universal — reutilizable en Landing, Auth, Home, Dashboard, Withdrawal.
// Un solo componente con variantes; no crear un botón nuevo por pantalla.
//
// Props:
//   variant  'primary' | 'secondary' | 'ghost' | 'link'
//   size     'sm' | 'md' | 'lg'
//   fullWidth  boolean
//   className  overrides puntuales
//   ...rest    se pasan al <button> nativo (onClick, disabled, type, etc.)

import { cn } from '../../utils/cn'

const variantClasses = {
  primary:
    'bg-brand hover:bg-brand-dark text-white font-semibold ' +
    'hover:-translate-y-px hover:shadow-lg hover:shadow-brand/30 ' +
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none',
  secondary:
    'border-[1.5px] border-ink/20 dark:border-white/20 text-ink dark:text-white font-semibold ' +
    'hover:bg-ink/5 dark:hover:bg-white/5 hover:border-ink/30 dark:hover:border-white/30 hover:-translate-y-px ' +
    'disabled:opacity-50 disabled:cursor-not-allowed',
  ghost:
    'text-ink/50 dark:text-white/50 font-medium ' +
    'hover:text-ink dark:hover:text-white hover:bg-ink/5 dark:hover:bg-white/5 ' +
    'disabled:opacity-50 disabled:cursor-not-allowed',
  link:
    'text-brand font-semibold underline-offset-2 hover:underline ' +
    'disabled:opacity-50 disabled:cursor-not-allowed',
}

const sizeClasses = {
  sm: 'px-4 py-2 text-sm rounded-lg',
  md: 'px-6 py-3.5 text-sm rounded-xl',
  lg: 'px-8 py-4 text-base rounded-xl',
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
  children,
  ...rest
}) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 transition-all cursor-pointer',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
