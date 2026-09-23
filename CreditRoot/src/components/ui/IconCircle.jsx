// src/components/ui/IconCircle.jsx
//
// Contenedor circular de ícono — reutilizable en TresPasos, Dashboard, Auth, etc.
// Acepta cualquier children (ícono lucide, emoji, SVG).
//
// Props:
//   size     'sm' | 'md' | 'lg'   (default: 'md')
//   variant  'brand' | 'ink' | 'green' | 'muted'  (default: 'brand')
//   className  overrides puntuales

import { cn } from '../../utils/cn'

const sizeClasses = {
  sm: 'w-9 h-9',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
}

const variantClasses = {
  brand: 'bg-brand/10 text-brand',
  ink:   'bg-ink dark:bg-white/10 text-white dark:text-white',
  green: 'bg-green-500/10 text-green-600',
  muted: 'bg-ink/5 dark:bg-white/5 text-ink/40 dark:text-white/40',
}

export function IconCircle({ size = 'md', variant = 'brand', className, children }) {
  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center shrink-0',
        sizeClasses[size],
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </div>
  )
}
