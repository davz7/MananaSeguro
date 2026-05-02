import { useTranslation } from 'react-i18next'
import { useEtherfuseRate } from '../../hooks/useEtherfuseRate'

export function RateBadge({ onRateLoaded, compact = false }) {
  const { cetesRate, userRate, platformRate, isLive, lastUpdated, loading, error } = useEtherfuseRate()
  const { t } = useTranslation()

  if (onRateLoaded && !loading) {
    onRateLoaded(userRate)
  }

  if (loading) {
    return (
      <span className="inline-flex items-center gap-2 text-xs text-ink/30 dark:text-white/30">
        <svg className="animate-spin shrink-0" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
        {t('rateBadge.cargando')}
      </span>
    )
  }

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border ${isLive
        ? 'bg-green-500/10 text-green-600 border-green-500/20'
        : 'bg-yellow-400/10 text-yellow-600 border-yellow-400/20'
        }`}>
        <span className="w-1.5 h-1.5 rounded-full bg-current pulse-dot" />
        {userRate.toFixed(2)}% APY
        {isLive ? t('rateBadge.enVivo') : t('rateBadge.ref')}
      </span>
    )
  }

  return (
    <div className={`rounded-xl p-4 border ${isLive
      ? 'bg-green-500/5 dark:bg-green-500/5 border-green-500/15'
      : 'bg-yellow-400/5 dark:bg-yellow-400/5 border-yellow-400/20'
      }`}>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full pulse-dot ${isLive ? 'bg-green-500' : 'bg-yellow-400'}`}
            style={{ boxShadow: `0 0 6px ${isLive ? '#22c55e' : '#fbbf24'}` }} />
          <span className={`text-xs font-bold ${isLive ? 'text-green-600' : 'text-yellow-600'}`}>
            {isLive ? t('rateBadge.vivo') : t('rateBadge.referencial')}
          </span>
        </div>
        {lastUpdated && (
          <span className="text-xs text-ink/40 dark:text-white/30">
            {t('rateBadge.actualizado')} {lastUpdated.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* Tasas */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: t('rateBadge.tasaBruta'), val: `${cetesRate.toFixed(2)}%`, color: 'text-ink dark:text-white', bold: false },
          { label: t('rateBadge.comision'), val: `−${platformRate.toFixed(2)}%`, color: 'text-red-400', bold: false },
          { label: t('rateBadge.rendimiento'), val: `${userRate.toFixed(2)}%`, color: 'text-green-600', bold: true },
        ].map(item => (
          <div key={item.label}>
            <p className="text-xs text-ink/40 dark:text-white/40 mb-0.5">{item.label}</p>
            <p className={`text-sm ${item.bold ? 'font-bold text-base' : 'font-medium'} ${item.color}`}>
              {item.val}
            </p>
          </div>
        ))}
      </div>

      {/* Error SDK */}
      {!isLive && error && (
        <p className="text-xs text-ink/30 dark:text-white/30 mt-2">
          ⚠ SDK no disponible: {error.includes('no instalado') ? t('rateBadge.sdkError') : error}
        </p>
      )}

      {/* Tasa baja */}
      {platformRate < 1 && (
        <div className="mt-2 px-3 py-2 rounded-xl bg-yellow-400/8 text-yellow-600 text-xs font-medium">
          {t('rateBadge.tasaBaja')}
        </div>
      )}

    </div>
  )
}