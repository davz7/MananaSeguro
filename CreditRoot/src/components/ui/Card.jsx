// src/components/ui/Card.jsx
//
// Card base universal — reutilizable en Landing, Auth, Home, Dashboard, Withdrawal.
// Variantes controladas por props; no duplicar estilos en cada pantalla.
//
// Props:
//   variant   'default' | 'flat' | 'ghost'
//             default → fondo blanco/dark, borde sutil, sombra ligera
//             flat    → fondo blanco/dark, borde sutil, sin sombra
//             ghost   → fondo transparente, sin borde
//   padding   'sm' | 'md' | 'lg'  (default: 'md')
//   rounded   'xl' | '2xl' | '3xl' (default: '2xl')
//   className  clases adicionales para overrides puntuales
//   as         elemento HTML raíz (default: 'div')

import { cn } from '../../utils/cn'

const variantClasses = {
  default: 'bg-white dark:bg-white/5 border border-ink/8 dark:border-white/8 shadow-sm shadow-ink/5',
  flat:    'bg-white dark:bg-white/5 border border-ink/8 dark:border-white/8',
  ghost:   'bg-transparent',
}

const paddingClasses = {
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-7 lg:p-8',
}

const roundedClasses = {
  xl:  'rounded-xl',
  '2xl': 'rounded-2xl',
  '3xl': 'rounded-3xl',
}

export function Card({
  variant = 'default',
  padding = 'md',
  rounded = '2xl',
  className,
  as: Tag = 'div',
  children,
  ...props
}) {
  return (
    <Tag
      className={cn(
        variantClasses[variant],
        paddingClasses[padding],
        roundedClasses[rounded],
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  )
}
