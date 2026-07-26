import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import ardilla from '../../assets/Ardilla_vector.png'
import { useEtherfuseRate } from '../../hooks/useEtherfuseRate'
import { useAnimatedValue } from '../../hooks/useAnimatedValue'

// Mínimo de depósito en pesos
const MIN_MXN = 40
const MAX_MXN = 10000

function CalculadoraHero({ onRegister }) {
  const { userRate, cetesRate, isLive, loading } = useEtherfuseRate()
  const { t } = useTranslation()
  const apy = userRate > 0 ? userRate : (cetesRate - 1.0)
  const [cuota, setCuota] = useState(500)   // pesos/mes por default
  const [anios, setAnios] = useState(20)

  const total = (() => {
    const r = apy / 100 / 12
    const n = anios * 12
    if (r === 0) return cuota * n
    return cuota * ((Math.pow(1 + r, n) - 1) / r)
  })()

  const { display, key } = useAnimatedValue(Math.round(total))

  return (
    <div className="relative">
      <img
        src={ardilla}
        alt={t('calc.mascotaAlt')}
        className="absolute -top-20 -right-4 h-40 object-contain z-10 hidden lg:block float-squirrel"
      />
      <div className="relative bg-surface dark:bg-white/5 rounded-3xl p-8 border border-ink/8 dark:border-white/8 overflow-hidden shadow-xl shadow-ink/5">

        {/* Tasa en vivo */}
        <div className="flex items-center gap-2 mb-6">
          <span className={`w-2 h-2 rounded-full shrink-0 pulse-dot ${isLive ? 'bg-green-400' : 'bg-yellow-400'}`} />
          <span className="text-xs text-gray dark:text-white/40 font-medium">
            {loading
              ? t('calc.cargando')
              : isLive
                ? t('calc.tasaVivo', { rate: cetesRate.toFixed(2) })
                : t('calc.tasaRef', { rate: cetesRate.toFixed(2) })}
          </span>
        </div>

        {/* Resultado en pesos */}
        <div className="bg-brand/20 dark:bg-brand/15 rounded-2xl px-6 py-5 mb-6">
          <p className="text-xs text-gray dark:text-white/40 uppercase tracking-widest mb-1">
            {t('calc.proyeccion', { anios })}
          </p>
          <div key={key} className="font-display font-black text-brand leading-none mb-1 count-up"
            style={{ fontSize: 'clamp(2.2rem,5vw,3rem)', letterSpacing: '-2px' }}>
            {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(display)}
          </div>
          <p className="text-xs text-gray dark:text-white/40 mt-1">
            {t('calc.apyMxn', { apy: apy.toFixed(2) })}
          </p>
        </div>

        {/* Slider cuota en pesos */}
        <div className="mb-5">
          <div className="flex justify-between mb-2">
            <label id="cuota-label" className="text-xs text-gray dark:text-white/40 font-medium">
              {t('calc.aporteLabel')}
            </label>
            <span className="text-xs font-bold text-ink dark:text-white">
              {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(cuota)}
            </span>
          </div>
          <input type="range" className="w-full accent-brand" min={MIN_MXN} max={MAX_MXN} step={10}
            value={cuota} onChange={e => setCuota(Number(e.target.value))}
            aria-labelledby="cuota-label" />
          <div className="flex justify-between mt-1">
            <span className="text-xs text-gray/70 dark:text-white/30">
              {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(MIN_MXN)}
            </span>
            <span className="text-xs text-gray/70 dark:text-white/30">
              {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(MAX_MXN)}
            </span>
          </div>
        </div>

        {/* Slider años */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            <label id="anios-label" className="text-xs text-gray dark:text-white/40 font-medium">
              {t('calc.tiempoLabel')}
            </label>
            <span className="text-xs font-bold text-ink dark:text-white">{anios} {t('calc.aniosSufijo')}</span>
          </div>
          <input type="range" className="w-full accent-brand" min={1} max={40} step={1}
            value={anios} onChange={e => setAnios(Number(e.target.value))}
            aria-labelledby="anios-label" />
          <div className="flex justify-between mt-1">
            <span className="text-xs text-gray/70 dark:text-white/30">{t('calc.min')}</span>
            <span className="text-xs text-gray/70 dark:text-white/30">{t('calc.max')}</span>
          </div>
        </div>

        <button
          className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-3.5 rounded-xl transition-all hover:-translate-y-px hover:shadow-lg hover:shadow-brand cursor-pointer"
          onClick={onRegister}>
          {t('calc.empezar')}
        </button>
      </div>
    </div>
  )
}
export default CalculadoraHero
