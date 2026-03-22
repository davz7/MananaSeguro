import { useState, useEffect } from 'react'
import { MANANA_SEGURO_RATES } from '../../../data/retirementContent'
import { formatCurrencyUsd } from '../../../utils/formatters'

/**
 * ContributionHistory — Historial de aportaciones
 *
 * - El resumen (total bloqueado, nº de depósitos) viene de datos REALES
 *   del contrato Soroban vía props (lockedBalance, depositCount).
 * - La lista individual de movimientos usa localStorage como cache local
 *   (leer eventos Soroban requiere un indexer externo no disponible en testnet básico).
 * - Cuando el usuario deposita desde ContributionPlanner, la historia local
 *   se actualiza automáticamente.
 */
export function ContributionHistory({ walletAddress = null, lockedBalance = 0, depositCount = 0 }) {
  const [history, setHistory] = useState(() => loadHistory(walletAddress))

  // Sincronizar historia local cuando cambia la wallet
  useEffect(() => {
    setHistory(loadHistory(walletAddress))
  }, [walletAddress])

  // Persistir cambios
  useEffect(() => {
    saveHistory(walletAddress, history)
  }, [history, walletAddress])

  // Usar los datos reales del contrato para el resumen
  // Si el contrato dice más depósitos de los que tenemos localmente, mostrar aviso
  const localDepositCount = history.filter(e => e.type === 'deposito').length
  const hasNewOnChain = depositCount > localDepositCount

  const cardStyle = { backgroundColor: '#0c0c0c', border: '1px solid rgba(255,255,255,0.06)' }

  return (
    <div className="d-flex flex-column gap-4">

      {/* ── Resumen real del contrato ── */}
      <div className="p-4 rounded-4" style={cardStyle}>
        <div className="d-flex align-items-center gap-2 mb-4">
          <h5 className="fw-bold mb-0">Historial de aportaciones</h5>
          <span className="badge rounded-pill px-2 py-1"
            style={{ backgroundColor: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)', fontSize: 10 }}>
            🔗 On-chain
          </span>
        </div>

        <div className="row g-3 mb-0">
          {[
            {
              label: 'USDC bloqueado en contrato',
              val: formatCurrencyUsd(lockedBalance),
              color: '#22c55e',
              sub: 'Dato real Soroban testnet',
            },
            {
              label: 'Total de depósitos',
              val: `${depositCount} depósito${depositCount !== 1 ? 's' : ''}`,
              color: '#3b82f6',
              sub: 'Contador on-chain',
            },
            {
              label: 'Rendimiento proyectado (1 año)',
              val: formatCurrencyUsd(lockedBalance * (MANANA_SEGURO_RATES.userRate / 100)),
              color: '#fbbf24',
              sub: `A ${MANANA_SEGURO_RATES.userRate}% APY`,
            },
          ].map(item => (
            <div className="col-sm-4" key={item.label}>
              <div className="p-3 rounded-4"
                style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="small text-white-50 mb-1">{item.label}</div>
                <div className="fw-bold" style={{ color: item.color }}>{item.val}</div>
                <div className="small text-white-50 mt-1" style={{ fontSize: 11 }}>{item.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Aviso si hay depósitos nuevos en cadena no reflejados localmente */}
      {hasNewOnChain && (
        <div className="p-3 rounded-4"
          style={{ backgroundColor: 'rgba(59,130,246,0.08)', border: '1px dashed rgba(59,130,246,0.3)' }}>
          <div className="small" style={{ color: '#93c5fd' }}>
            ℹ️ El contrato registra <strong>{depositCount}</strong> depósito{depositCount !== 1 ? 's' : ''} on-chain
            pero tu historial local tiene {localDepositCount}.
            Los nuevos depósitos aparecerán aquí automáticamente la próxima vez que deposites desde esta app.
          </div>
        </div>
      )}

      {/* ── Lista local de movimientos ── */}
      <div className="p-4 rounded-4" style={cardStyle}>
        <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
          <div>
            <h5 className="fw-bold mb-1">Movimientos registrados</h5>
            <p className="text-white-50 small mb-0">
              Historial local · Para depositar usa la sección{' '}
              <strong style={{ color: '#3b82f6' }}>Inicio → Depósito</strong>
            </p>
          </div>
        </div>

        {history.length === 0 ? (
          <div className="text-center py-5"
            style={{ borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: 32 }} className="mb-2">📭</div>
            <p className="text-white-50 small mb-0">
              Aún no hay depósitos registrados.<br />
              Realiza tu primer depósito desde la sección de inicio.
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-dark table-borderless mb-0" style={{ fontSize: 13 }}>
              <thead>
                <tr className="text-white-50">
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Monto</th>
                  <th>Rendimiento</th>
                  <th>Saldo acum.</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => (
                  <tr key={entry.id}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td className="text-white-50">{entry.date}</td>
                    <td>
                      <span className="badge rounded-pill"
                        style={{
                          backgroundColor: entry.type === 'deposito'
                            ? 'rgba(59,130,246,0.1)' : 'rgba(34,197,94,0.1)',
                          color: entry.type === 'deposito' ? '#3b82f6' : '#22c55e',
                          border: `1px solid ${entry.type === 'deposito' ? 'rgba(59,130,246,0.2)' : 'rgba(34,197,94,0.2)'}`,
                          fontSize: 10,
                        }}>
                        {entry.type === 'deposito' ? '↓ Depósito' : '↑ Rendimiento'}
                      </span>
                    </td>
                    <td className="fw-bold" style={{ color: '#3b82f6' }}>
                      +{formatCurrencyUsd(entry.amount)}
                    </td>
                    <td style={{ color: '#22c55e' }}>
                      +{formatCurrencyUsd(entry.yieldAccrued)}
                    </td>
                    <td className="fw-bold">{formatCurrencyUsd(entry.balanceAfter)}</td>
                    <td>
                      {entry.txHash ? (
                        <a href={`https://stellar.expert/explorer/testnet/tx/${entry.txHash}`}
                          target="_blank" rel="noopener noreferrer"
                          style={{ color: '#3b82f6', fontSize: 11 }}>
                          ✓ Ver tx →
                        </a>
                      ) : (
                        <span style={{ fontSize: 10, color: entry.confirmed ? '#22c55e' : '#fbbf24' }}>
                          {entry.confirmed ? '✓ Confirmado' : '⏳ Pendiente'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}

// ─── Helpers de persistencia ──────────────────────────────────────────────────

export function addHistoryEntry(wallet, entry) {
  const history = loadHistory(wallet)
  const updated = [entry, ...history]
  saveHistory(wallet, updated)
  return updated
}

export function buildHistoryEntry(amount, wallet) {
  const history = loadHistory(wallet)
  const prevBalance = history.length > 0 ? history[0].balanceAfter : 0
  const monthlyRate = MANANA_SEGURO_RATES.userRate / 100 / 12
  const yieldAccrued = parseFloat((prevBalance * monthlyRate).toFixed(4))
  return {
    id: Date.now(),
    date: new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' }),
    type: 'deposito',
    amount,
    yieldAccrued,
    balanceAfter: parseFloat((prevBalance + amount + yieldAccrued).toFixed(4)),
    confirmed: true,
    txHash: null,
  }
}

function loadHistory(wallet) {
  try {
    const key = `manana_seguro_history_${wallet ?? 'demo'}`
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw)
  } catch {}
  return []
}

function saveHistory(wallet, history) {
  try {
    const key = `manana_seguro_history_${wallet ?? 'demo'}`
    localStorage.setItem(key, JSON.stringify(history))
  } catch {}
}
