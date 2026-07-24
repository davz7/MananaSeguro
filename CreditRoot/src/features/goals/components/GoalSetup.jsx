// src/features/goals/components/GoalSetup.jsx
//
// Componente de configuración de primera meta.
// Se muestra cuando el usuario no tiene ninguna meta creada.
// Simplificado — solo ahorro mensual y años al retiro.

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useEtherfuseRate } from '../../../hooks/useEtherfuseRate'
import { formatCurrencyMxn } from '../../../utils/formatters'

const ANOS_OPTIONS = [5, 10, 15, 20, 25, 30, 35, 40]
const AHORRO_MIN = 40
const AHORRO_SUGERIDO = 500

// Proyección simple: aportación mensual × 12 × años × (1 + tasa)^años
function calcularProyeccion(ahorroMensual, anos, tasa) {
  const tasaAnual = tasa / 100
  // Valor futuro de anualidad
  if (tasaAnual === 0) return ahorroMensual * 12 * anos
  const tasaMensual = tasaAnual / 12
  const meses = anos * 12
  return ahorroMensual * ((Math.pow(1 + tasaMensual, meses) - 1) / tasaMensual)
}

export function GoalSetup({ usuario, onMetaCreada }) {
  const { t } = useTranslation()
  const { userRate } = useEtherfuseRate()

  const [ahorroMensual, setAhorroMensual] = useState(AHORRO_SUGERIDO)
  const [anos, setAnos] = useState(20)
  const nombre = t('goalSetup.nombreDefault')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const proyeccionTotal = calcularProyeccion(ahorroMensual, anos, userRate)
  const rendimientoTotal = proyeccionTotal - (ahorroMensual * 12 * anos)

  async function handleCrearMeta() {
    if (ahorroMensual < AHORRO_MIN) {
      setError(t('goalSetup.minimoError', { min: AHORRO_MIN }))
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/metas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuarioId: usuario.id,
          nombre,
          monto_objetivo_mxn: Math.round(proyeccionTotal),
          ahorro_mensual_mxn: ahorroMensual,
          anos_al_retiro: anos,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('goalSetup.errorCrear'))
      onMetaCreada(data.meta)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-5 mb-4">
      {/* Header de bienvenida */}
      <div>
        <h2 className="font-display font-black text-ink dark:text-white tracking-tight"
          style={{ fontSize: 'clamp(1.4rem,3vw,2rem)', lineHeight: 1.1 }}>
          {t('goalSetup.bienvenido', { nombre: usuario.nombre?.split(' ')[0] ?? t('goalSetup.amigoFallback') })}{' '}
          <span className="text-brand">{t('goalSetup.tituloAccent')}</span>{' '}
          {t('goalSetup.tituloSufijo')}
        </h2>
      </div>

      <div className="bg-white dark:bg-white/5 border border-ink/8 dark:border-white/8 rounded-2xl p-6">
        <h5 className="font-display font-black text-ink dark:text-white text-lg mb-5">
          {t('goalSetup.tituloPrimera')}
        </h5>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Lado izquierdo — configuración */}
          <div className="flex flex-col gap-5">

            {/* Ahorro mensual */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="goal-ahorro" className="text-sm text-ink/60 dark:text-white/60 font-medium">
                  {t('goalSetup.ahorroLabel')}
                </label>
                <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border bg-green-500/10 text-green-700 border-green-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  {t('rateBadge.apySuffix', { value: userRate })}
                </span>
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/40 dark:text-white/40 font-semibold text-sm">$</span>
                <input
                  id="goal-ahorro"
                  type="number"
                  min={AHORRO_MIN}
                  max={100000}
                  step={50}
                  value={ahorroMensual}
                  onChange={e => setAhorroMensual(Number(e.target.value))}
                  className="w-full pl-8 pr-16 py-3 border border-ink/10 dark:border-white/10 rounded-xl text-ink dark:text-white bg-white dark:bg-white/5 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-all font-semibold"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-ink/40 dark:text-white/40">MXN</span>
              </div>
              {ahorroMensual < AHORRO_MIN && (
                <p className="text-xs text-red-500 mt-1">{t('goalSetup.minimoInline', { min: AHORRO_MIN })}</p>
              )}
              {/* Sugerencias rápidas */}
              <div className="flex gap-2 mt-2 flex-wrap">
                {[200, 500, 1000, 2000].map(n => (
                  <button key={n} onClick={() => setAhorroMensual(n)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                      ahorroMensual === n
                        ? 'bg-brand/10 border-brand/30 text-brand font-semibold'
                        : 'bg-transparent border-ink/10 dark:border-white/10 text-ink/40 dark:text-white/40 hover:border-ink/20'
                    }`}>
                    ${n.toLocaleString('es-MX')}
                  </button>
                ))}
              </div>
            </div>

            {/* Años al retiro */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="goal-anos" className="text-sm text-ink/60 dark:text-white/60 font-medium">
                  {t('goalSetup.aniosLabel')}
                </label>
                <span className="text-sm font-bold text-ink dark:text-white">{anos} {t('goalSetup.aniosSufijo')}</span>
              </div>
              <input
                id="goal-anos"
                type="range"
                min="5" max="40" step="5"
                value={anos}
                onChange={e => setAnos(Number(e.target.value))}
                className="w-full accent-brand"
              />
              <div className="flex justify-between mt-1">
                <span className="text-xs text-ink/35 dark:text-white/35">5 {t('goalSetup.aniosSufijo')}</span>
                <span className="text-xs text-ink/35 dark:text-white/35">40 {t('goalSetup.aniosSufijo')}</span>
              </div>
            </div>

          </div>

          {/* Lado derecho — proyección */}
          <div className="flex flex-col gap-3">
            <div className="bg-brand/5 border border-brand/15 rounded-xl p-4">
              <p className="text-xs text-ink/40 dark:text-white/40 mb-1">{t('goalSetup.totalAcumularas')}</p>
              <p className="text-2xl font-black text-brand">{formatCurrencyMxn(proyeccionTotal)}</p>
              <p className="text-xs text-ink/40 dark:text-white/40 mt-1">{t('goalSetup.totalSub')}</p>
            </div>
            <div className="bg-green-500/5 border border-green-500/15 rounded-xl p-4">
              <p className="text-xs text-ink/40 dark:text-white/40 mb-1">{t('goalSetup.rendimientoProyectado')}</p>
              <p className="text-2xl font-black text-green-600">{formatCurrencyMxn(rendimientoTotal)}</p>
              <p className="text-xs text-ink/40 dark:text-white/40 mt-1">{t('goalSetup.rendimientoSub')}</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mt-4">
            <p className="text-sm text-red-500">⚠️ {error}</p>
          </div>
        )}

        <button
          onClick={handleCrearMeta}
          disabled={loading || ahorroMensual < AHORRO_MIN}
          className="w-full mt-5 bg-brand hover:bg-brand-dark text-white font-bold py-4 rounded-xl transition-all hover:-translate-y-px hover:shadow-lg hover:shadow-brand/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-sm">
          {loading ? t('goalSetup.btnCreando') : t('goalSetup.btnCrear')}
        </button>
      </div>
    </div>
  )
}