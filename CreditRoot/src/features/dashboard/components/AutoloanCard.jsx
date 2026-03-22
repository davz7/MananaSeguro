import { useState, useEffect } from 'react'
import { MANANA_SEGURO_RATES } from '../../../data/retirementContent'
import { calculateLoan } from '../../../utils/projections'
import { formatCurrencyUsd } from '../../../utils/formatters'
import { useEtherfuseRate } from '../../../hooks/useEtherfuseRate'
import {
  solicitarPrestamo,
  pagarPrestamo,
  verPrestamo,
  enviarTransaccion,
} from '../../../lib/stellar'
import { firmarTransaccion } from '../../../lib/wallet'

/**
 * AutoloanCard — Autopréstamo de emergencia
 *
 * Conectado al contrato Soroban:
 * - Al montar: verifica si hay un préstamo activo en cadena (verPrestamo)
 * - Solicitar: llama solicitar_prestamo → firma con Freighter → envía a testnet
 * - Pagar mes: llama pagar_prestamo → firma con Freighter → envía a testnet
 */
export function AutoloanCard({ lockedBalance = 0, walletAddress = null }) {
  const { userRate } = useEtherfuseRate()
  const maxLoan = lockedBalance * MANANA_SEGURO_RATES.loanMaxPct
  const [requested, setRequested] = useState(Math.max(10, Math.min(250, Math.floor(maxLoan))))
  const [showSchedule, setShowSchedule] = useState(false)

  // ── Estado de la UI ──────────────────────────────────────────────────────────
  // 'cargando' | 'form' | 'confirmando' | 'procesando' | 'activo' | 'error'
  const [fase, setFase] = useState('cargando')
  const [txHash, setTxHash] = useState(null)
  const [errorMsg, setErrorMsg] = useState(null)

  // ── Estado real del préstamo desde el contrato ────────────────────────────────
  const [saldoPendienteReal, setSaldoPendienteReal] = useState(0)
  const [mesesPagadosReal, setMesesPagadosReal] = useState(0)

  // Penalización (solo UI, el contrato gestiona los fondos)
  const [mesesImpago, setMesesImpago] = useState(0)

  const loan = calculateLoan(lockedBalance, requested)
  const enoughBalance = requested >= 10 && requested <= maxLoan && lockedBalance > 0

  const penalizacion = mesesImpago * MANANA_SEGURO_RATES.loanPenaltyPerMonth
  const tasaEfectiva = Math.max(MANANA_SEGURO_RATES.loanMinUserRate, userRate - penalizacion)
  const capitalRindiendo = lockedBalance - saldoPendienteReal

  const mesesRestantes = MANANA_SEGURO_RATES.loanMaxMonths - mesesPagadosReal
  const progresoPago = (mesesPagadosReal / MANANA_SEGURO_RATES.loanMaxMonths) * 100
  const liquidado = mesesPagadosReal >= MANANA_SEGURO_RATES.loanMaxMonths || saldoPendienteReal <= 0

  const cardStyle = { backgroundColor: '#0c0c0c', border: '1px solid rgba(255,255,255,0.06)' }

  // ── Leer estado del préstamo desde el contrato al montar ──────────────────────
  useEffect(() => {
    if (!walletAddress) { setFase('form'); return }
    async function cargarPrestamo() {
      try {
        const { saldo, meses } = await verPrestamo(walletAddress)
        if (saldo > 0) {
          setSaldoPendienteReal(saldo)
          setMesesPagadosReal(meses)
          setFase('activo')
        } else {
          setFase('form')
        }
      } catch {
        // Si el contrato aún no tiene datos, mostramos el formulario
        setFase('form')
      }
    }
    cargarPrestamo()
  }, [walletAddress])

  // ── Solicitar préstamo en cadena ──────────────────────────────────────────────
  async function handleConfirmar() {
    if (!walletAddress) { setErrorMsg('Wallet no conectada'); setFase('error'); return }
    setFase('procesando')
    setErrorMsg(null)
    try {
      const tx = await solicitarPrestamo(walletAddress, requested)
      const signedXdr = await firmarTransaccion(tx.toXDR())
      const hash = await enviarTransaccion(signedXdr)
      setTxHash(hash)
      // Actualizar estado del préstamo
      setSaldoPendienteReal(requested)
      setMesesPagadosReal(0)
      setFase('activo')
    } catch (err) {
      setErrorMsg(err.message ?? 'Error al solicitar el préstamo')
      setFase('error')
    }
  }

  // ── Pagar cuota mensual en cadena ─────────────────────────────────────────────
  async function handlePagarMes() {
    if (!walletAddress) return
    setFase('procesando')
    setErrorMsg(null)
    try {
      const tx = await pagarPrestamo(walletAddress)
      const signedXdr = await firmarTransaccion(tx.toXDR())
      const hash = await enviarTransaccion(signedXdr)
      setTxHash(hash)
      // Re-leer estado actualizado del contrato
      const { saldo, meses } = await verPrestamo(walletAddress)
      setSaldoPendienteReal(saldo)
      setMesesPagadosReal(meses)
      if (mesesImpago > 0) setMesesImpago(i => Math.max(0, i - 1))
      setFase('activo')
    } catch (err) {
      setErrorMsg(err.message ?? 'Error al pagar la cuota')
      setFase('error')
    }
  }

  function handleReset() {
    setFase('form')
    setSaldoPendienteReal(0)
    setMesesPagadosReal(0)
    setMesesImpago(0)
    setTxHash(null)
    setErrorMsg(null)
    setRequested(Math.max(10, Math.min(250, Math.floor(maxLoan))))
  }

  // ── FASE: Cargando ────────────────────────────────────────────────────────────
  if (fase === 'cargando') return (
    <div className="p-4 rounded-4 text-center" style={cardStyle}>
      <div className="spinner-border spinner-border-sm text-warning mb-2" role="status" />
      <p className="text-white-50 small mb-0">Verificando préstamos activos en Soroban...</p>
    </div>
  )

  return (
    <div className="p-4 rounded-4" style={cardStyle}>

      {/* Header */}
      <div className="d-flex align-items-start justify-content-between mb-4 flex-wrap gap-2">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <span style={{ fontSize: 20 }}>🚨</span>
            <h5 className="fw-bold mb-0">Autopréstamo de emergencia</h5>
          </div>
          <p className="text-white-50 small mb-0">
            Hasta el 30% de tu saldo bloqueado. Tu capital sigue generando rendimiento.
          </p>
        </div>
        <span className="badge rounded-pill px-3 py-2"
          style={{ backgroundColor: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)', fontSize: 11 }}>
          {MANANA_SEGURO_RATES.loanMonthlyFee}% mensual
        </span>
      </div>

      {/* Sin saldo bloqueado */}
      {lockedBalance === 0 && fase === 'form' && (
        <div className="p-4 rounded-4 text-center"
          style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: 32 }} className="mb-2">🔒</div>
          <p className="text-white-50 small mb-0">
            Necesitas tener USDC bloqueado en el contrato para solicitar un autopréstamo.
            Ve a la sección <strong style={{ color: '#3b82f6' }}>Depósito</strong> para empezar.
          </p>
        </div>
      )}

      {/* ── FASE: Formulario ── */}
      {fase === 'form' && lockedBalance > 0 && (
        <>
          <div className="row g-2 mb-4">
            {[
              { label: 'Saldo bloqueado', val: formatCurrencyUsd(lockedBalance), color: '#fff' },
              { label: 'Máximo disponible (30%)', val: formatCurrencyUsd(maxLoan), color: '#fbbf24' },
              { label: 'Tasa mensual', val: `${MANANA_SEGURO_RATES.loanMonthlyFee}%`, color: '#fbbf24' },
              { label: 'Plazo máximo', val: `${MANANA_SEGURO_RATES.loanMaxMonths} meses`, color: '#fff' },
            ].map(item => (
              <div className="col-6" key={item.label}>
                <div className="p-3 rounded-4"
                  style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="small text-white-50">{item.label}</div>
                  <div className="fw-bold small" style={{ color: item.color }}>{item.val}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mb-4">
            <div className="d-flex justify-content-between mb-2">
              <label className="small text-white-50">Monto a solicitar</label>
              <span className="fw-bold" style={{ color: '#fbbf24' }}>{formatCurrencyUsd(requested)}</span>
            </div>
            <input type="range" className="form-range mb-1"
              min={10} max={Math.max(10, Math.floor(maxLoan))} step={5}
              value={requested}
              onChange={e => setRequested(Number(e.target.value))}
              style={{ accentColor: '#fbbf24' }}
            />
            <div className="d-flex justify-content-between">
              <span className="small text-white-50">$10 USDC</span>
              <span className="small text-white-50">{formatCurrencyUsd(maxLoan)} máx.</span>
            </div>
          </div>

          {enoughBalance && (
            <div className="p-4 rounded-4 mb-4"
              style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <h6 className="fw-bold mb-3">Resumen del préstamo</h6>
              <div className="d-flex flex-column gap-2 mb-3">
                {[
                  { label: 'Monto prestado', val: formatCurrencyUsd(loan.amount) },
                  { label: 'Pago mensual (mes 1)', val: formatCurrencyUsd(loan.monthlyPayment), color: '#fbbf24' },
                  { label: 'Total intereses (24 meses)', val: formatCurrencyUsd(loan.totalFees), color: '#f87171' },
                  { label: 'Total a repagar', val: formatCurrencyUsd(loan.totalRepaid) },
                  { label: 'Capital que sigue rindiendo', val: formatCurrencyUsd(lockedBalance - loan.amount), color: '#22c55e' },
                ].map(item => (
                  <div key={item.label} className="d-flex justify-content-between py-1"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <span className="small text-white-50">{item.label}</span>
                    <span className="small fw-bold" style={{ color: item.color ?? '#fff' }}>{item.val}</span>
                  </div>
                ))}
              </div>
              <div className="p-3 rounded-3"
                style={{ backgroundColor: 'rgba(239,68,68,0.06)', border: '1px dashed rgba(239,68,68,0.3)' }}>
                <div className="small" style={{ color: '#f87171' }}>
                  ⚠ Si no pagas un mes: tu rendimiento baja <strong>−{MANANA_SEGURO_RATES.loanPenaltyPerMonth}%</strong> por cada mes de retraso.
                </div>
              </div>
            </div>
          )}

          {enoughBalance && (
            <button className="btn btn-sm w-100 rounded-3 mb-4"
              style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', backgroundColor: 'transparent' }}
              onClick={() => setShowSchedule(!showSchedule)}>
              {showSchedule ? '▲ Ocultar tabla de pagos' : '▼ Ver tabla de pagos (24 meses)'}
            </button>
          )}

          {showSchedule && (
            <div className="mb-4" style={{ maxHeight: 200, overflowY: 'auto' }}>
              <table className="table table-dark table-borderless mb-0" style={{ fontSize: 12 }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: '#0c0c0c' }}>
                  <tr className="text-white-50">
                    <th>Mes</th><th>Capital</th><th>Interés</th><th>Pago</th><th>Pendiente</th>
                  </tr>
                </thead>
                <tbody>
                  {loan.schedule.map(row => (
                    <tr key={row.month}>
                      <td>{row.month}</td>
                      <td>{formatCurrencyUsd(row.principal)}</td>
                      <td style={{ color: '#fbbf24' }}>{formatCurrencyUsd(row.fee)}</td>
                      <td className="fw-bold">{formatCurrencyUsd(row.payment)}</td>
                      <td className="text-white-50">{formatCurrencyUsd(row.remaining)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <button className="btn btn-lg w-100 py-3 rounded-4 fw-bold"
            style={{
              background: enoughBalance ? 'linear-gradient(45deg, #d97706, #fbbf24)' : 'rgba(255,255,255,0.05)',
              border: 'none', color: enoughBalance ? '#000' : 'rgba(255,255,255,0.2)',
              cursor: enoughBalance ? 'pointer' : 'not-allowed',
            }}
            onClick={() => enoughBalance && setFase('confirmando')} disabled={!enoughBalance}>
            🚨 Solicitar {enoughBalance ? formatCurrencyUsd(loan.amount) : '—'} de emergencia
          </button>
        </>
      )}

      {/* ── FASE: Confirmando ── */}
      {fase === 'confirmando' && (
        <div className="text-center">
          <div style={{ fontSize: 40 }} className="mb-3">⚠️</div>
          <h6 className="fw-bold mb-2">¿Confirmas el autopréstamo?</h6>
          <p className="text-white-50 small mb-4">
            Recibirás <strong style={{ color: '#fbbf24' }}>{formatCurrencyUsd(loan.amount)}</strong> USDC en tu wallet.
            Pagarás <strong style={{ color: '#fff' }}>{formatCurrencyUsd(loan.monthlyPayment)}</strong>/mes durante 24 meses.
            <br /><span style={{ color: '#86efac', fontSize: 12 }}>Freighter firmará la transacción en Soroban testnet.</span>
          </p>
          <div className="d-flex gap-3 justify-content-center">
            <button className="btn btn-sm rounded-3 px-4"
              style={{ border: '1px solid rgba(255,255,255,0.15)', color: '#fff', backgroundColor: 'transparent' }}
              onClick={() => setFase('form')}>
              Cancelar
            </button>
            <button className="btn btn-sm rounded-3 px-4 fw-bold"
              style={{ background: 'linear-gradient(45deg, #d97706, #fbbf24)', border: 'none', color: '#000' }}
              onClick={handleConfirmar}>
              Confirmar y firmar
            </button>
          </div>
        </div>
      )}

      {/* ── FASE: Procesando ── */}
      {fase === 'procesando' && (
        <div className="text-center py-4">
          <div className="spinner-border text-warning mb-3" role="status" />
          <p className="text-white-50 small mb-0">Firmando con Freighter y enviando a Soroban testnet...</p>
        </div>
      )}

      {/* ── FASE: Error ── */}
      {fase === 'error' && (
        <div className="p-4 rounded-4 text-center"
          style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}>
          <div style={{ fontSize: 32 }} className="mb-2">❌</div>
          <p className="small mb-3" style={{ color: '#f87171' }}>{errorMsg}</p>
          <button className="btn btn-sm rounded-3 px-4"
            style={{ border: '1px solid rgba(255,255,255,0.15)', color: '#fff', backgroundColor: 'transparent' }}
            onClick={handleReset}>
            Intentar de nuevo
          </button>
        </div>
      )}

      {/* ── FASE: Préstamo activo ── */}
      {fase === 'activo' && (
        <>
          {txHash && (
            <div className="p-3 rounded-3 mb-4"
              style={{ backgroundColor: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
              <div className="small" style={{ color: '#22c55e' }}>
                ✅ Transacción confirmada ·{' '}
                <a href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ color: '#3b82f6' }}>
                  {txHash.slice(0, 16)}... →
                </a>
              </div>
            </div>
          )}

          <div className="p-4 rounded-4 mb-4"
            style={{
              backgroundColor: liquidado ? 'rgba(34,197,94,0.08)' : 'rgba(251,191,36,0.06)',
              border: `1px solid ${liquidado ? 'rgba(34,197,94,0.3)' : 'rgba(251,191,36,0.2)'}`,
            }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <div className="fw-bold" style={{ color: liquidado ? '#22c55e' : '#fbbf24' }}>
                  {liquidado ? '✅ Préstamo liquidado' : '🚨 Préstamo activo'}
                </div>
                <div className="small text-white-50">
                  {liquidado ? 'Tu rendimiento volvió a la tasa completa' : `${mesesPagadosReal} de 24 meses pagados`}
                </div>
              </div>
              <div className="text-end">
                <div className="fw-bold fs-5" style={{ color: '#fbbf24' }}>
                  {formatCurrencyUsd(saldoPendienteReal)}
                </div>
                <div className="small text-white-50">pendiente en contrato</div>
              </div>
            </div>
            <div className="progress rounded-pill mb-2" style={{ height: 8, backgroundColor: 'rgba(255,255,255,0.05)' }}>
              <div className="progress-bar rounded-pill"
                style={{ width: `${progresoPago}%`, background: liquidado ? '#22c55e' : 'linear-gradient(90deg, #d97706, #fbbf24)' }} />
            </div>
            <div className="d-flex justify-content-between">
              <span className="small text-white-50">{mesesPagadosReal} meses pagados</span>
              <span className="small text-white-50">{mesesRestantes} restantes</span>
            </div>
          </div>

          <div className="row g-2 mb-4">
            {[
              { label: 'Tu rendimiento actual', val: `${tasaEfectiva.toFixed(2)}% APY`, color: tasaEfectiva < userRate ? '#f87171' : '#22c55e' },
              { label: 'Capital rindiendo', val: formatCurrencyUsd(capitalRindiendo), color: '#22c55e' },
              { label: 'Meses de impago', val: mesesImpago, color: mesesImpago > 0 ? '#f87171' : '#22c55e' },
              { label: 'Penalización acumulada', val: `−${penalizacion.toFixed(2)}%`, color: penalizacion > 0 ? '#f87171' : 'rgba(255,255,255,0.4)' },
            ].map(item => (
              <div className="col-6" key={item.label}>
                <div className="p-3 rounded-4"
                  style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="small text-white-50">{item.label}</div>
                  <div className="fw-bold small" style={{ color: item.color }}>{item.val}</div>
                </div>
              </div>
            ))}
          </div>

          {!liquidado && (
            <div className="d-flex gap-2 mb-4">
              {/* Pagar mes → transacción real */}
              <button className="btn btn-sm flex-fill rounded-3 fw-bold"
                style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e' }}
                onClick={handlePagarMes}>
                ✓ Pagar mes {mesesPagadosReal + 1}
              </button>
              {/* Fallar mes → solo actualiza UI de penalización, no hay tx */}
              <button className="btn btn-sm flex-fill rounded-3 fw-bold"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}
                onClick={() => setMesesImpago(i => i + 1)}>
                ✗ Fallar mes (demo)
              </button>
            </div>
          )}

          {mesesImpago > 0 && (
            <div className="p-3 rounded-3 mb-4"
              style={{ backgroundColor: 'rgba(239,68,68,0.06)', border: '1px dashed rgba(239,68,68,0.3)' }}>
              <div className="small" style={{ color: '#f87171' }}>
                ⚠ {mesesImpago} {mesesImpago === 1 ? 'mes sin pagar' : 'meses sin pagar'} —
                tu rendimiento bajó a <strong>{tasaEfectiva.toFixed(2)}%</strong>.
              </div>
            </div>
          )}

          {liquidado && (
            <div className="p-3 rounded-4 mb-4 text-center"
              style={{ backgroundColor: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
              <div className="fw-bold" style={{ color: '#22c55e' }}>🎉 Préstamo completado</div>
              <div className="small text-white-50 mt-1">Tu rendimiento volvió a {userRate}% APY completo.</div>
            </div>
          )}

          <button className="btn btn-sm w-100 rounded-3"
            style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', backgroundColor: 'transparent' }}
            onClick={handleReset}>
            Nueva solicitud
          </button>
        </>
      )}

    </div>
  )
}
