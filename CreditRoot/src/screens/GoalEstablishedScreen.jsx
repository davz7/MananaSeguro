import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LandingNavbar from './components/LandingNavbar'
import Footer from './components/Footer'

const GOALS = [5, 10, 15, 20]

const formatMXN = (amount) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(amount)

/* Gráfica (placeholder)  */
// TODO: reemplazar por la gráfica real con datos de proyección
function GrowthChart({ label }) {
  return (
    <svg
      viewBox="0 0 300 120"
      preserveAspectRatio="none"
      className="w-full h-28 sm:h-36 lg:h-44"
      role="img"
      aria-label={label}
    >
      <path
        d="M0 95 C 40 80, 70 78, 110 88 S 180 102, 215 80 S 270 30, 300 5"
        fill="none"
        stroke="#4d7a35"
        strokeWidth={2.5}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

/*  Select reutilizable con flecha  */
function SelectField({ id, name, value, onChange, options = [], placeholder }) {
  return (
    <div className="relative w-full">
      <select
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        className="w-full appearance-none bg-card text-white text-sm border border-white/20 rounded-xl py-3 pl-4 pr-10 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/40 cursor-pointer"
      >
        {placeholder && <option value="" disabled>{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-card">{opt.label}</option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white"
        viewBox="0 0 12 8"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M0 0h12L6 8z" />
      </svg>
    </div>
  )
}

export function GoalEstablishedScreen({
  meta = 15,                 // años. TODO: vendrá del perfil del usuario
  totalEstimado = 1000000,   // TODO: vendrá del cálculo de proyección
  onCambiarMeta,
}) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [nuevaMeta, setNuevaMeta] = useState(10)
  const [aceptaTerminos, setAceptaTerminos] = useState(false)

  const goalOptions = GOALS.map((y) => ({
    value: y,
    label: t('metaEstablecida.anios', { count: y }),
  }))

  const puedeCambiar = nuevaMeta !== '' && aceptaTerminos

  const handleCambiarMeta = () => {
    if (!puedeCambiar) return
    // TODO: enviar cambio de meta al backend
    onCambiarMeta?.(nuevaMeta)
  }

  return (
    <div className="bg-bg min-h-screen flex flex-col text-white">
      <LandingNavbar soloVolver onVolver={() => navigate('/main')} />

      <div className="flex-1 py-10 px-4 sm:px-6 lg:px-12">
        <div className="w-full max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-start">

            {/* COLUMNA IZQUIERDA */}
            <div className="flex flex-col gap-6">

              {/* Título */}
              <h1
                className="font-display font-bold text-white tracking-tight leading-[1.05]"
                style={{ fontSize: 'clamp(3rem,6vw,5rem)' }}
              >
                <em className="text-brand not-italic block">{t('metaEstablecida.tituloParte1', 'Meta')}</em>
                {t('metaEstablecida.tituloParte2', 'establecida')}
              </h1>

              {/* Tarjeta cambiar meta */}
              <div className="lg:max-w-md w-full bg-card border border-white/10 rounded-2xl p-5 sm:p-6">
                <label htmlFor="nuevaMeta" className="block text-sm font-semibold text-white mb-3">
                  {t('metaEstablecida.cambiarMeta', 'Cambiar meta')}
                </label>
                <SelectField
                  id="nuevaMeta"
                  name="nuevaMeta"
                  value={nuevaMeta}
                  onChange={(e) => setNuevaMeta(Number(e.target.value))}
                  options={goalOptions}
                />
                <p className="text-xs text-white/60 mt-3 leading-relaxed">
                  {t('metaEstablecida.aviso', 'Recuerda que solo se puede cambiar la meta 1 vez al año*')}
                </p>
                <label className="flex items-center gap-3 mt-4 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={aceptaTerminos}
                    onChange={(e) => setAceptaTerminos(e.target.checked)}
                    className="peer sr-only"
                  />
                  <span className="w-6 h-6 shrink-0 rounded-md border-2 border-white/30 peer-checked:border-brand flex items-center justify-center transition-colors">
                    {aceptaTerminos && (
                      <svg className="w-4 h-4 text-brand" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  <span className="text-xs text-white/70">
                    {t('metaEstablecida.acepto', 'Acepto los')}{' '}
                    <a href="#" className="underline underline-offset-2 hover:text-white">
                      {t('metaEstablecida.terminos', 'términos y condiciones de uso')}
                    </a>
                  </span>
                </label>
              </div>
            </div>

            {/* COLUMNA DERECHA */}
            <div className="flex flex-col gap-6">

              {/* Tarjeta gráfica */}
              <div className="bg-card border border-white/10 rounded-3xl p-5 sm:p-8 flex flex-col">
                <p className="text-sm text-white/50">
                  {t('metaEstablecida.tuMeta', 'Tu meta es a:')}
                </p>
                <p className="font-display font-bold text-white tracking-tight mt-1" style={{ fontSize: 'clamp(2.5rem,5vw,4rem)' }}>
                  {t('metaEstablecida.anios', { count: meta })}
                </p>
                <p className="text-sm text-white/60 mt-2">
                  {t('metaEstablecida.totalFinal', 'Total estimado al final de la meta')}
                </p>
                <div className="flex-1 flex items-end my-4">
                  <GrowthChart label={t('metaEstablecida.graficaLabel', 'Proyección de crecimiento de tu ahorro')} />
                </div>
                <p className="text-sm text-white/50">
                  {t('metaEstablecida.totalEstimado', 'Total estimado:')}{' '}
                  <span className="font-bold text-brand">{formatMXN(totalEstimado)} MXN</span>
                </p>
              </div>

              {/* Botón cambiar meta */}
              <button
                type="button"
                disabled={!puedeCambiar}
                onClick={handleCambiarMeta}
                className="w-full bg-brand hover:bg-brand-dark active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-xl transition-all shadow-lg shadow-brand/20 text-base cursor-pointer"
              >
                {t('metaEstablecida.botonCambiar', 'Cambiar meta')}
              </button>
            </div>

          </div>
        </div>
      </div>

      <Footer dark />
    </div>
  )
}