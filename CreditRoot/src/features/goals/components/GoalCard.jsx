// src/features/goals/components/GoalCard.jsx
//
// Tarjeta de meta de ahorro — seleccionable.
// Muestra nombre, progreso, ahorro mensual y meta objetivo.

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatCurrencyMxn } from '../../../utils/formatters'

export function GoalCard({ meta, saldoMxn = 0, seleccionada = false, onSeleccionar, onEditar, onEliminar, puedeEliminar = false }) {
  const { t } = useTranslation()
  const progresoPct = meta.monto_objetivo_mxn > 0
    ? Math.min((saldoMxn / meta.monto_objetivo_mxn) * 100, 100)
    : 0

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSeleccionar?.()
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={seleccionada}
      onClick={onSeleccionar}
      onKeyDown={handleKeyDown}
      className={`relative bg-white dark:bg-white/5 border-2 rounded-2xl p-4 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md ${
        seleccionada
          ? 'border-brand shadow-brand/20 shadow-md'
          : 'border-ink/8 dark:border-white/8 hover:border-ink/20 dark:hover:border-white/20'
      }`}>

      {/* Badge principal */}
      {meta.es_principal && (
        <span className="absolute -top-2 left-4 bg-brand text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
          {t('goalCard.principal')}
        </span>
      )}

      {/* Acciones */}
      <div className="absolute top-3 right-3 flex gap-1">
        <button
          onClick={e => { e.stopPropagation(); onEditar?.() }}
          className="w-7 h-7 rounded-lg bg-ink/5 dark:bg-white/5 hover:bg-brand/10 hover:text-brand flex items-center justify-center text-ink/40 dark:text-white/40 transition-all cursor-pointer"
          aria-label={t('goalCard.editarMeta')}>
          <span aria-hidden="true">✏️</span>
        </button>
        {puedeEliminar && (
          <button
            onClick={e => { e.stopPropagation(); onEliminar?.() }}
            className="w-7 h-7 rounded-lg bg-ink/5 dark:bg-white/5 hover:bg-red-500/10 hover:text-red-500 flex items-center justify-center text-ink/40 dark:text-white/40 transition-all cursor-pointer"
            aria-label={t('goalCard.eliminarMeta')}>
            <span aria-hidden="true">🗑️</span>
          </button>
        )}
      </div>

      {/* Nombre */}
      <p className="font-display font-black text-ink dark:text-white text-base mb-1 pr-16">
        {meta.nombre}
      </p>

      {/* Saldo actual */}
      <p className="text-xs text-ink/40 dark:text-white/40 mb-3">
        {t('goalCard.saldo')} <span className="font-semibold text-green-600">{formatCurrencyMxn(saldoMxn)}</span>
        {saldoMxn === 0 && <span className="ml-1 text-ink/25">{t('goalCard.recienCreada')}</span>}
      </p>

      {/* Barra de progreso */}
      <div
        role="progressbar"
        aria-valuenow={Math.round(progresoPct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t('goalCard.progresoAria', { pct: Math.round(progresoPct) })}
        className="h-1.5 bg-ink/5 dark:bg-white/5 rounded-full overflow-hidden mb-2">
        <div
          className="h-full bg-gradient-to-r from-brand-dark to-brand rounded-full transition-all duration-700"
          style={{ width: `${progresoPct}%` }}
        />
      </div>

      {/* Datos */}
      <div className="flex justify-between text-xs text-ink/40 dark:text-white/40">
        <span>{t('goalCard.ahorro')} <strong className="text-ink dark:text-white">{formatCurrencyMxn(meta.ahorro_mensual_mxn)}{t('goalCard.porMes')}</strong></span>
        <span>{t('goalCard.meta')} <strong className="text-ink dark:text-white">{formatCurrencyMxn(meta.monto_objetivo_mxn)}</strong></span>
      </div>
    </div>
  )
}

// ─── Modal de edición ─────────────────────────────────────────────────────────

export function GoalEditModal({ meta, usuarioId, onGuardado, onCerrar }) {
  const { t } = useTranslation()
  const [nombre, setNombre] = useState(meta.nombre)
  const [ahorroMensual, setAhorroMensual] = useState(meta.ahorro_mensual_mxn)
  const [montoObjetivo, setMontoObjetivo] = useState(meta.monto_objetivo_mxn)
  const [anos, setAnos] = useState(meta.anos_al_retiro)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleGuardar() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/metas?id=${meta.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuarioId,
          nombre,
          monto_objetivo_mxn: montoObjetivo,
          ahorro_mensual_mxn: ahorroMensual,
          anos_al_retiro: anos,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('goalCard.errorActualizar'))
      onGuardado(data.meta)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const inputClass = "w-full border border-ink/10 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-ink dark:text-white bg-white dark:bg-white/5 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-all"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="goal-edit-title"
        className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-md shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h5 id="goal-edit-title" className="font-display font-black text-ink dark:text-white text-lg">{t('goalCard.editarMeta')}</h5>
          <button onClick={onCerrar} aria-label={t('goalCard.cerrar')} className="text-ink/30 hover:text-ink dark:text-white/30 dark:hover:text-white text-xl cursor-pointer">✕</button>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs text-ink/50 dark:text-white/50 font-medium mb-1.5 block">{t('goalCard.nombreLabel')}</label>
            <input type="text" className={inputClass} value={nombre} onChange={e => setNombre(e.target.value)} maxLength={60} />
          </div>
          <div>
            <label className="text-xs text-ink/50 dark:text-white/50 font-medium mb-1.5 block">{t('goalCard.ahorroMensualLabel')}</label>
            <input type="number" className={inputClass} min={40} max={100000} step={50} value={ahorroMensual} onChange={e => setAhorroMensual(Number(e.target.value))} />
          </div>
          <div>
            <label className="text-xs text-ink/50 dark:text-white/50 font-medium mb-1.5 block">{t('goalCard.montoObjetivoLabel')}</label>
            <input type="number" className={inputClass} min={1000} max={50000000} step={1000} value={montoObjetivo} onChange={e => setMontoObjetivo(Number(e.target.value))} />
          </div>
          <div>
            <div className="flex justify-between mb-1.5">
              <label className="text-xs text-ink/50 dark:text-white/50 font-medium">{t('goalCard.aniosRetiroLabel')}</label>
              <span className="text-xs font-bold text-ink dark:text-white">{anos} {t('goalSetup.aniosSufijo')}</span>
            </div>
            <input type="range" min="1" max="40" step="1" value={anos} onChange={e => setAnos(Number(e.target.value))} className="w-full accent-brand" />
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mt-4">
            <p className="text-sm text-red-500">⚠️ {error}</p>
          </div>
        )}

        <div className="flex gap-3 mt-5">
          <button onClick={onCerrar} className="flex-1 border border-ink/15 dark:border-white/15 text-ink dark:text-white font-semibold py-2.5 rounded-xl hover:bg-ink/5 transition-all cursor-pointer text-sm">
            {t('goalCard.cancelar')}
          </button>
          <button onClick={handleGuardar} disabled={loading} className="flex-1 bg-brand hover:bg-brand-dark text-white font-semibold py-2.5 rounded-xl transition-all cursor-pointer disabled:opacity-50 text-sm">
            {loading ? t('goalCard.guardando') : t('goalCard.guardarCambios')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Botón para agregar nueva meta ────────────────────────────────────────────

export function AddGoalButton({ usuarioId, onMetaCreada }) {
  const { t } = useTranslation()
  const [abierto, setAbierto] = useState(false)
  const [nombre, setNombre] = useState('')
  const [ahorroMensual, setAhorroMensual] = useState(500)
  const [anos, setAnos] = useState(20)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleCrear() {
    if (!nombre.trim()) { setError(t('goalCard.errorNombreRequerido')); return }
    if (ahorroMensual < 40) { setError(t('goalSetup.minimoInline', { min: 40 })); return }
    setLoading(true)
    setError(null)
    try {
      // Proyección simple para monto objetivo
      const tasaMensual = 0.0459 / 12
      const meses = anos * 12
      const montoObjetivo = ahorroMensual * ((Math.pow(1 + tasaMensual, meses) - 1) / tasaMensual)

      const res = await fetch('/api/metas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuarioId,
          nombre: nombre.trim(),
          monto_objetivo_mxn: Math.round(montoObjetivo),
          ahorro_mensual_mxn: ahorroMensual,
          anos_al_retiro: anos,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('goalCard.errorCrear'))
      onMetaCreada(data.meta)
      setAbierto(false)
      setNombre('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="flex items-center justify-center w-full h-full min-h-[120px] border-2 border-dashed border-ink/15 dark:border-white/15 rounded-2xl text-ink/30 dark:text-white/30 hover:border-brand/40 hover:text-brand transition-all cursor-pointer gap-2 text-sm font-medium">
        <span className="text-2xl">+</span>
        {t('goalCard.nuevaMeta')}
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setAbierto(false)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-goal-title"
        className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-sm shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h5 id="add-goal-title" className="font-display font-black text-ink dark:text-white text-lg">{t('goalCard.nuevaMeta')}</h5>
          <button onClick={() => setAbierto(false)} aria-label={t('goalCard.cerrar')} className="text-ink/30 hover:text-ink dark:text-white/30 dark:hover:text-white text-xl cursor-pointer">✕</button>
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs text-ink/50 dark:text-white/50 font-medium mb-1.5 block">{t('goalCard.nombreMetaLabel')}</label>
            <input
              type="text"
              placeholder={t('goalCard.nombrePlaceholder')}
              className="w-full border border-ink/10 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-ink dark:text-white bg-white dark:bg-white/5 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-all"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              maxLength={60}
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs text-ink/50 dark:text-white/50 font-medium mb-1.5 block">{t('goalCard.ahorroMensualLabel')}</label>
            <input
              type="number"
              min={40} max={100000} step={50}
              className="w-full border border-ink/10 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-ink dark:text-white bg-white dark:bg-white/5 outline-none focus:border-brand transition-all"
              value={ahorroMensual}
              onChange={e => setAhorroMensual(Number(e.target.value))}
            />
          </div>
          <div>
            <div className="flex justify-between mb-1.5">
              <label className="text-xs text-ink/50 dark:text-white/50 font-medium">{t('goalCard.aniosRetiroLabel')}</label>
              <span className="text-xs font-bold text-ink dark:text-white">{anos} {t('goalSetup.aniosSufijo')}</span>
            </div>
            <input type="range" min="1" max="40" step="1" value={anos} onChange={e => setAnos(Number(e.target.value))} className="w-full accent-brand" />
          </div>
        </div>
        {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mt-3 text-sm text-red-500">⚠️ {error}</div>}
        <div className="flex gap-3 mt-5">
          <button onClick={() => setAbierto(false)} className="flex-1 border border-ink/15 dark:border-white/15 text-ink dark:text-white font-semibold py-2.5 rounded-xl hover:bg-ink/5 transition-all cursor-pointer text-sm">{t('goalCard.cancelar')}</button>
          <button onClick={handleCrear} disabled={loading} className="flex-1 bg-brand hover:bg-brand-dark text-white font-semibold py-2.5 rounded-xl transition-all cursor-pointer disabled:opacity-50 text-sm">
            {loading ? t('goalCard.creando') : t('goalCard.crearMeta')}
          </button>
        </div>
      </div>
    </div>
  )
}