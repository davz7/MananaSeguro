import { useEtherfuseRate } from '../../hooks/useEtherfuseRate'
/**
 * RateBadge — muestra la tasa actual de Etherfuse con estado en vivo/fallback.
 * Úsalo en ContributionPlanner y RetirementSnapshot.
 *
 * Props:
 *   onRateLoaded(userRate) — callback opcional cuando la tasa está lista
 *   compact               — versión pequeña para inline
 */
export function RateBadge({ onRateLoaded, compact = false }) {
  const { cetesRate, userRate, platformRate, isLive, lastUpdated, loading, error } = useEtherfuseRate()

  // Notifica al padre cuando la tasa está lista
  if (onRateLoaded && !loading) {
    onRateLoaded(userRate)
  }

  if (loading) {
    return (
      <span className="d-inline-flex align-items-center gap-2"
        style={{ fontSize: compact ? 11 : 12, color: 'rgba(255,255,255,0.3)' }}>
        <span className="spinner-border" style={{ width: 10, height: 10, borderWidth: 1.5 }} />
        Consultando tasa Etherfuse...
      </span>
    )
  }

  if (compact) {
    return (
      <span className="d-inline-flex align-items-center gap-1"
        style={{
          backgroundColor: isLive ? 'rgba(34,197,94,0.1)' : 'rgba(251,191,36,0.1)',
          border: `1px solid ${isLive ? 'rgba(34,197,94,0.3)' : 'rgba(251,191,36,0.3)'}`,
          borderRadius: 99,
          padding: '2px 10px',
          fontSize: 11,
          fontWeight: 700,
          color: isLive ? '#22c55e' : '#fbbf24',
        }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'currentColor', display: 'inline-block' }} />
        {userRate.toFixed(2)}% APY
        {isLive ? ' · en vivo' : ' · referencial'}
      </span>
    )
  }

  return (
    <div className="p-3 rounded-4"
      style={{
        backgroundColor: isLive ? 'rgba(34,197,94,0.05)' : 'rgba(251,191,36,0.05)',
        border: `1px solid ${isLive ? 'rgba(34,197,94,0.15)' : 'rgba(251,191,36,0.2)'}`,
      }}>
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
        <div className="d-flex align-items-center gap-2">
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            backgroundColor: isLive ? '#22c55e' : '#fbbf24',
            display: 'inline-block',
            boxShadow: `0 0 6px ${isLive ? '#22c55e' : '#fbbf24'}`,
            animation: isLive ? 'pulse 2s infinite' : 'none',
          }} />
          <span className="small fw-bold" style={{ color: isLive ? '#22c55e' : '#fbbf24' }}>
            {isLive ? 'Tasa en vivo · Etherfuse' : 'Tasa referencial · Modelo de negocio'}
          </span>
        </div>
        {lastUpdated && (
          <span className="small text-white-50">
            Actualizado: {lastUpdated.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      <div className="row g-2">
        {[
          { label: 'Tasa bruta CETES', val: `${cetesRate.toFixed(2)}%`, color: '#fff' },
          { label: 'Comisión Mañana Seguro', val: `−${platformRate.toFixed(2)}%`, color: '#f87171' },
          { label: 'Rendimiento para ti', val: `${userRate.toFixed(2)}%`, color: '#22c55e', bold: true },
        ].map((item) => (
          <div className="col-4" key={item.label}>
            <div className="small text-white-50">{item.label}</div>
            <div className={`small ${item.bold ? 'fs-6' : ''}`}
              style={{ color: item.color, fontWeight: item.bold ? 700 : 500 }}>
              {item.val}
            </div>
          </div>
        ))}
      </div>

      {!isLive && error && (
        <div className="small mt-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
          ⚠ SDK no disponible: {error.includes('no instalado') ? 'ejecuta npm install @etherfuse/stablebond-sdk' : error}
        </div>
      )}

      {platformRate < 1 && (
        <div className="small mt-2 p-2 rounded-3"
          style={{ backgroundColor: 'rgba(251,191,36,0.08)', color: '#fbbf24' }}>
          ⚡ Tasa CETES bajo 4% — comisión reducida automáticamente a 0.5%
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
