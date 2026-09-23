import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle } from 'lucide-react'
import { useEtherfuseRate } from '../../hooks/useEtherfuseRate'
import { useAnimatedValue } from '../../hooks/useAnimatedValue'

const MIN_MXN = 40
const MAX_MXN = 10000

function CalculadoraHero({ onRegister, onLogin }) {
  const { userRate, cetesRate, isLive, loading } = useEtherfuseRate()
  const { t } = useTranslation()
  const apy = userRate > 0 ? userRate : (cetesRate - 1.0)
  const [cuota, setCuota] = useState(500)
  const [anios, setAnios] = useState(25)

  const total = (() => {
    const r = apy / 100 / 12
    const n = anios * 12
    if (r === 0) return cuota * n
    return cuota * ((Math.pow(1 + r, n) - 1) / r)
  })()

  const { display, key } = useAnimatedValue(Math.round(total))

  const cuotaFmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })

  return (
    <div className="bg-[#1a1814] border border-white/10 rounded-2xl p-6">

      {/* Pill de tasa */}
      <div className="flex items-center gap-2 mb-5">
        {loading ? (
          <span className="text-xs text-white/40">{t('calc.cargando')}</span>
        ) : (
          <>
            <CheckCircle size={15} className="text-brand shrink-0" aria-hidden="true" />
            <span className="text-sm text-white/70">
              {isLive
                ? t('calc.tasaVivo', { rate: cetesRate.toFixed(2) })
                : t('calc.tasaRef', { rate: cetesRate.toFixed(2) })}
            </span>
          </>
        )}
      </div>

      {/* Proyección */}
      <p className="text-xs text-white/40 mb-1">
        {t('calc.proyeccion', { anios })}
      </p>
      <div
        key={key}
        className="font-medium text-white leading-none mb-1 count-up"
        style={{ fontSize: 'clamp(2.4rem,6vw,3.4rem)', letterSpacing: '-2px' }}
      >
        {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(display)}
      </div>
      <p className="text-xs text-white/40 mb-6">
        {t('calc.apyMxn', { apy: apy.toFixed(2) })}
      </p>

      {/* Slider cuota */}
      <div className="mb-5">
        <div className="flex justify-between mb-2">
          <label id="cuota-label" className="text-xs text-white/50">
            {t('calc.aporteLabel')}
          </label>
          <span className="text-xs text-white/80 font-semibold">
            {cuotaFmt.format(cuota)}
          </span>
        </div>
        <input
          type="range"
          className="w-full accent-brand"
          min={MIN_MXN}
          max={MAX_MXN}
          step={10}
          value={cuota}
          onChange={e => setCuota(Number(e.target.value))}
          aria-labelledby="cuota-label"
        />
        <div className="flex justify-between mt-1">
          <span className="text-xs text-white/30">{cuotaFmt.format(MIN_MXN)}</span>
          <span className="text-xs text-white/30">{cuotaFmt.format(MAX_MXN)}</span>
        </div>
      </div>

      {/* Slider años */}
      <div className="mb-7">
        <div className="flex justify-between mb-2">
          <label id="anios-label" className="text-xs text-white/50">
            {t('calc.tiempoLabel')}
          </label>
          <span className="text-xs text-white/80 font-semibold">{anios} {t('calc.aniosSufijo')}</span>
        </div>
        <input
          type="range"
          className="w-full accent-brand"
          min={1}
          max={40}
          step={1}
          value={anios}
          onChange={e => setAnios(Number(e.target.value))}
          aria-labelledby="anios-label"
        />
        <div className="flex justify-between mt-1">
          <span className="text-xs text-white/30">{t('calc.min')}</span>
          <span className="text-xs text-white/30">{t('calc.max')}</span>
        </div>
      </div>

      {/* CTA */}
      <button
        className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-3.5 rounded-xl transition-all hover:-translate-y-px hover:shadow-lg hover:shadow-brand/30 cursor-pointer text-sm"
        onClick={onRegister}
      >
        {t('calc.empezar')}
      </button>

      {/* Link secundario */}
      {onLogin && (
        <p className="text-center text-xs text-white/40 mt-3">
          {t('calc.yaTienesCuenta')}{' '}
          <button
            onClick={onLogin}
            className="text-brand font-semibold hover:underline underline-offset-2 cursor-pointer"
          >
            {t('calc.iniciarSesion')}
          </button>
        </p>
      )}
    </div>
  )
}
export default CalculadoraHero
