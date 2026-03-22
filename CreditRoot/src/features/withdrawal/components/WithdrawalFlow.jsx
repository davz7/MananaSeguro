import { useState, useEffect } from 'react'
import { retirarFondos, enviarTransaccion, verBalanceContrato, verFechaRetiro } from '../../../lib/stellar'
import { firmarTransaccion } from '../../../lib/wallet'
import { useEtherfuseRate } from '../../../hooks/useEtherfuseRate'
import { MANANA_SEGURO_RATES } from '../../../data/retirementContent'
import { formatCurrencyUsd, formatCurrencyMxn } from '../../../utils/formatters'
import freighterApi from '@stellar/freighter-api'

/**
 * WithdrawalFlow — Flujo completo de retiro
 *
 * Usa datos REALES del contrato Soroban:
 * - verBalanceContrato → saldo bloqueado real
 * - verFechaRetiro     → fecha real de bloqueo
 * - retirarFondos      → transacción Soroban real
 *
 * Estados: verificando → no_alcanzada | alcanzada → procesando → exitoso | error
 */
export function WithdrawalFlow({ meta = 10000 }) {
  const { userRate, cetesRate } = useEtherfuseRate()
  const [fase, setFase] = useState('verificando')
  const [address, setAddress] = useState(null)
  const [saldoContrato, setSaldoContrato] = useState(0)
  const [fechaRetiro, setFechaRetiro] = useState(null)
  const [txHash, setTxHash] = useState(null)
  const [errorMsg, setErrorMsg] = useState(null)
  const [resumenFinal, setResumenFinal] = useState(null)

  useEffect(() => { verificarEstado() }, [])

  async function verificarEstado() {
    setFase('verificando')
    setErrorMsg(null)
    try {
      const { address: addr } = await freighterApi.getAddress()
      if (!addr) throw new Error('Wallet no conectada — abre Freighter y vuelve a intentar')
      setAddress(addr)

      // ── Saldo real del contrato Soroban ──────────────────────────────────────
      // verBalanceContrato ya devuelve el valor en USDC (ajustado de stroops)
      const saldo = await verBalanceContrato(addr)
      setSaldoContrato(Number(saldo))

      // ── Fecha de retiro real ─────────────────────────────────────────────────
      try {
        const fecha = await verFechaRetiro(addr)
        setFechaRetiro(fecha)
      } catch {
        setFechaRetiro('Pendiente de primer depósito')
      }

      setFase(Number(saldo) >= meta ? 'alcanzada' : 'no_alcanzada')
    } catch (err) {
      setErrorMsg(err.message ?? 'No se pudo conectar con el contrato')
      setFase('error')
    }
  }

  async function handleRetirar() {
    setFase('procesando')
    try {
      const tx = await retirarFondos(address)
      const signedXdr = await firmarTransaccion(tx.toXDR())
      const hash = await enviarTransaccion(signedXdr)
      setTxHash(hash)

      // Resumen estimado: el contrato ya transfirió saldo - 1% comisión
      const comision = saldoContrato * (MANANA_SEGURO_RATES.platformRate / 100)
      const totalRecibido = saldoContrato - comision
      const rendimientoEst = saldoContrato * 0.30
      const aportadoEst = saldoContrato - rendimientoEst
      setResumenFinal({
        totalAportado: aportadoEst,
        rendimiento: rendimientoEst,
        comision,
        total: totalRecibido,
      })
      setFase('exitoso')
    } catch (err) {
      setErrorMsg(err.message ?? 'Error al procesar el retiro en el contrato')
      setFase('error')
    }
  }

  const cardStyle = { backgroundColor: '#0c0c0c', border: '1px solid rgba(255,255,255,0.06)' }
  const falta = Math.max(0, meta - saldoContrato)
  const progresoPct = Math.min((saldoContrato / meta) * 100, 100)

  return (
    <div style={{ color: '#fff', fontFamily: "'Inter', sans-serif" }}>

      {/* ── Verificando ── */}
      {fase === 'verificando' && (
        <div className="p-5 rounded-4 text-center" style={cardStyle}>
          <div className="spinner-border text-primary mb-3" role="status" />
          <div className="fw-bold mb-1">Verificando tu meta de retiro</div>
          <div className="small text-white-50">Consultando saldo real en el contrato Soroban...</div>
        </div>
      )}

      {/* ── Meta no alcanzada ── */}
      {fase === 'no_alcanzada' && (
        <div className="d-flex flex-column gap-4">
          <div className="p-4 rounded-4" style={cardStyle}>
            <div className="d-flex align-items-center gap-2 mb-4">
              <span style={{ fontSize: 28 }}>⏳</span>
              <div>
                <h5 className="fw-bold mb-0">Aún no alcanzas tu meta</h5>
                <p className="text-white-50 small mb-0">Sigue aportando — vas muy bien.</p>
              </div>
            </div>

            <div className="mb-4">
              <div className="d-flex justify-content-between mb-2">
                <span className="small fw-bold">Progreso hacia la meta</span>
                <span className="small" style={{ color: '#3b82f6' }}>{progresoPct.toFixed(1)}%</span>
              </div>
              <div className="progress rounded-pill mb-2" style={{ height: 12, backgroundColor: 'rgba(255,255,255,0.05)' }}>
                <div className="progress-bar rounded-pill"
                  style={{ width: `${progresoPct}%`, background: 'linear-gradient(90deg, #2563eb, #3b82f6)' }} />
              </div>
              <div className="d-flex justify-content-between">
                <span className="small text-white-50">{formatCurrencyUsd(saldoContrato)} bloqueados on-chain</span>
                <span className="small text-white-50">Meta: {formatCurrencyUsd(meta)}</span>
              </div>
            </div>

            <div className="row g-3">
              {[
                { label: 'Saldo en contrato', val: formatCurrencyUsd(saldoContrato), color: '#3b82f6' },
                { label: 'Falta para la meta', val: formatCurrencyUsd(falta), color: '#f87171' },
                { label: 'Fecha de retiro', val: fechaRetiro ?? '—', color: '#fbbf24' },
                { label: 'Rendimiento activo', val: `${userRate}% APY`, color: '#22c55e' },
              ].map(item => (
                <div className="col-sm-6" key={item.label}>
                  <div className="p-3 rounded-4"
                    style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="small text-white-50 mb-1">{item.label}</div>
                    <div className="fw-bold" style={{ color: item.color }}>{item.val}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {saldoContrato > 0 && (
            <div className="p-4 rounded-4"
              style={{ backgroundColor: 'rgba(251,191,36,0.05)', border: '1px dashed rgba(251,191,36,0.3)' }}>
              <div className="d-flex align-items-start gap-3">
                <span style={{ fontSize: 24 }}>🚨</span>
                <div>
                  <div className="fw-bold mb-1">¿Tienes una emergencia?</div>
                  <div className="small text-white-50 mb-3">
                    Puedes solicitar hasta {formatCurrencyUsd(saldoContrato * MANANA_SEGURO_RATES.loanMaxPct)} USDC
                    ({MANANA_SEGURO_RATES.loanMaxPct * 100}% de tu saldo) sin perder el bloqueo.
                  </div>
                  <span className="badge rounded-pill px-3 py-2"
                    style={{ backgroundColor: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)', fontSize: 12, cursor: 'default' }}>
                    Ve a la pestaña Autopréstamo →
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Meta alcanzada ── */}
      {fase === 'alcanzada' && (
        <div className="d-flex flex-column gap-4">
          <div className="p-5 rounded-4 text-center"
            style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.1), rgba(59,130,246,0.08))', border: '1px solid rgba(34,197,94,0.3)' }}>
            <div style={{ fontSize: 56 }} className="mb-3">🎉</div>
            <h4 className="fw-bold mb-2" style={{ letterSpacing: '-1px' }}>
              ¡Alcanzaste tu meta de retiro!
            </h4>
            <div className="fw-bold mb-1" style={{ fontSize: 36, color: '#22c55e', letterSpacing: '-2px' }}>
              {formatCurrencyUsd(saldoContrato)} USDC
            </div>
            <div className="text-white-50 small">
              ≈ {formatCurrencyMxn(saldoContrato * 17)} pesos · tipo de cambio $17
            </div>
          </div>

          <div className="p-4 rounded-4" style={cardStyle}>
            <h6 className="fw-bold mb-3">Resumen de tu ahorro</h6>
            <div className="d-flex flex-column gap-2 mb-4">
              {[
                { label: 'Saldo bloqueado total', val: formatCurrencyUsd(saldoContrato), color: '#fff' },
                { label: 'Tasa Etherfuse aplicada', val: `${userRate}% APY`, color: '#22c55e' },
                { label: 'Tasa bruta CETES', val: `${cetesRate}%`, color: 'rgba(255,255,255,0.5)' },
                { label: 'Comisión plataforma (1%)', val: formatCurrencyUsd(saldoContrato * 0.01), color: '#f87171' },
                { label: 'Fecha de retiro', val: fechaRetiro ?? '—', color: '#3b82f6' },
              ].map(item => (
                <div key={item.label} className="d-flex justify-content-between py-2"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span className="small text-white-50">{item.label}</span>
                  <span className="small fw-bold" style={{ color: item.color }}>{item.val}</span>
                </div>
              ))}
            </div>

            <div className="p-3 rounded-3 mb-4"
              style={{ backgroundColor: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)' }}>
              <div className="small" style={{ color: '#93c5fd' }}>
                ℹ Al confirmar, el contrato Soroban ejecuta la transferencia directamente a tu
                wallet Freighter. Sin intermediarios. La operación quedará registrada on-chain.
              </div>
            </div>

            <button
              className="btn btn-lg w-100 py-3 rounded-4 fw-bold"
              style={{ background: 'linear-gradient(45deg, #16a34a, #22c55e)', border: 'none', color: '#000' }}
              onClick={handleRetirar}>
              🏆 Retirar {formatCurrencyUsd(saldoContrato)} USDC a mi wallet
            </button>
          </div>
        </div>
      )}

      {/* ── Procesando ── */}
      {fase === 'procesando' && (
        <div className="p-5 rounded-4 text-center" style={cardStyle}>
          <div className="spinner-border mb-3" style={{ color: '#22c55e', width: 48, height: 48 }} role="status" />
          <div className="fw-bold fs-5 mb-1">Procesando tu retiro</div>
          <div className="text-white-50 small mb-3">Firma la transacción en Freighter...</div>
          <div className="d-flex flex-column gap-2">
            {[
              'Verificando elegibilidad en el contrato',
              'Calculando comisión de plataforma (1%)',
              'Preparando transferencia a tu wallet',
            ].map((step, i) => (
              <div key={step} className="d-flex align-items-center gap-2 justify-content-center small text-white-50">
                <span className="spinner-border spinner-border-sm"
                  style={{ width: 10, height: 10, animationDelay: `${i * 0.2}s` }} />
                {step}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Retiro exitoso ── */}
      {fase === 'exitoso' && resumenFinal && (
        <div className="d-flex flex-column gap-4">
          <div className="p-5 rounded-4 text-center"
            style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(59,130,246,0.1))', border: '1px solid rgba(34,197,94,0.4)' }}>
            <div style={{ fontSize: 64 }} className="mb-3">🏆</div>
            <h4 className="fw-bold mb-2">¡Retiro completado!</h4>
            <div className="fw-bold mb-1" style={{ fontSize: 40, color: '#22c55e', letterSpacing: '-2px' }}>
              {formatCurrencyUsd(resumenFinal.total)}
            </div>
            <div className="text-white-50">transferidos a tu wallet Freighter</div>
          </div>

          <div className="p-4 rounded-4" style={cardStyle}>
            <h6 className="fw-bold mb-3">Resumen de tu retiro</h6>
            <div className="row g-3 mb-4">
              {[
                { label: 'Aportado estimado', val: formatCurrencyUsd(resumenFinal.totalAportado), color: '#3b82f6' },
                { label: 'Rendimiento Etherfuse', val: formatCurrencyUsd(resumenFinal.rendimiento), color: '#22c55e' },
                { label: 'Comisión plataforma (1%)', val: `−${formatCurrencyUsd(resumenFinal.comision)}`, color: '#f87171' },
                { label: 'Total recibido', val: formatCurrencyUsd(resumenFinal.total), color: '#fff', bold: true },
              ].map(item => (
                <div className="col-sm-6" key={item.label}>
                  <div className="p-3 rounded-4 h-100"
                    style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="small text-white-50 mb-1">{item.label}</div>
                    <div className={item.bold ? 'fw-bold fs-5' : 'fw-bold'} style={{ color: item.color }}>
                      {item.val}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 rounded-4 text-center mb-4"
              style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.08), rgba(59,130,246,0.08))', border: '1px solid rgba(34,197,94,0.2)' }}>
              <div className="small text-white-50 mb-1">En pesos mexicanos</div>
              <div className="fw-bold" style={{ fontSize: 28, color: '#22c55e', letterSpacing: '-1px' }}>
                {formatCurrencyMxn(resumenFinal.total * 17)}
              </div>
            </div>

            {/* TX hash real en Stellar Expert */}
            {txHash && (
              <div className="p-3 rounded-4"
                style={{ backgroundColor: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)' }}>
                <div className="small fw-bold mb-1" style={{ color: '#22c55e' }}>✅ Transacción confirmada en Stellar</div>
                <a href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
                  target="_blank" rel="noreferrer"
                  className="small font-monospace" style={{ color: '#3b82f6' }}>
                  Ver en Stellar Expert → {txHash.slice(0, 20)}...
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {fase === 'error' && (
        <div className="p-4 rounded-4" style={cardStyle}>
          <div className="text-center mb-4">
            <div style={{ fontSize: 40 }}>⚠️</div>
            <div className="fw-bold mt-2 mb-1">Algo salió mal</div>
            <div className="small text-white-50">{errorMsg}</div>
          </div>
          <button
            className="btn w-100 rounded-3 fw-bold"
            style={{ border: '1px solid rgba(255,255,255,0.15)', color: '#fff', backgroundColor: 'transparent' }}
            onClick={verificarEstado}>
            Reintentar
          </button>
        </div>
      )}

    </div>
  )
}
