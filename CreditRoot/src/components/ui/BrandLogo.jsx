// src/components/ui/BrandLogo.jsx
//
// Contenedor del logo de Mañana Seguro.
// Un solo lugar para cambiar el radius, tamaño o color de fondo del ícono.
//
// Props:
//   size  'sm' | 'md' | 'lg'  (default: 'md')

import logoCompleto from '../../assets/LOGO_MS.png'
import { cn } from '../../utils/cn'

const sizeMap = {
  sm: { container: 'w-8 h-8',   img: 'w-7 h-7'  },
  md: { container: 'w-12 h-12', img: 'w-11 h-11' },
  lg: { container: 'w-16 h-16', img: 'w-15 h-15' },
}

export function BrandLogo({ size = 'md', className }) {
  const { container, img } = sizeMap[size]
  return (
    <div
      className={cn(
        'rounded-3xl bg-brand flex items-center justify-center shrink-0 overflow-hidden',
        container,
        className,
      )}
    >
      <img src={logoCompleto} alt="" aria-hidden="true" className={cn('object-contain', img)} />
    </div>
  )
}
