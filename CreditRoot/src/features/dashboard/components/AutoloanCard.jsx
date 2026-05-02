import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
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

export function AutoloanCard({ lockedBalance = 0, walletAddress = null }) {
  const { userRate } = useEtherfuseRate()
  const { t } = useTranslation()
  const maxLoan = lockedBalance * MANANA_SEGURO_RATES.loanMaxPct
  const [requested, setRequested] = useState(Math.max(10, Math.min(250, Math.floor(maxLoan))))
  const [showSchedule, setShowSchedule] = useState(false)
  const [fase, setFase] = useState(() => walletAddress ? 'loading' : 'form')
  const [txHash, setTxHash] = useState(null)
  const [errorMsg, setErrorMsg] = useState(null)
  const [saldoPendienteReal, setSaldoPendienteReal] = useState(0)
  const [mesesPagadosReal, setMesesPagadosReal] = useState(0)
  const [mesesImpago, setMesesImpago] = useState(0)

  const loan = calculateLoan(lockedBalance, requested)
  const enoughBalance = requested >= 10 && requested <= maxLoan && lockedBalance > 0
  const penalizacion = mesesImpago * MANANA_SEGURO_RATES.loanPenaltyPerMonth
  const tasaEfectiva = Math.max(MANANA_SEGURO_RATES.loanMinUserRate, userRate - penalizacion)
  const capitalRindiendo = lockedBalance - saldoPendienteReal
  const mesesRestantes = MANANA_SEGURO_RATES.loanMaxMonths - mesesPagadosReal
  const progresoPago = (mesesPagadosReal / MANANA_SEGURO_RATES.loanMaxMonths) * 100
  const liquidado = mesesPagadosReal >= MANANA_SEGURO_RATES.loanMaxMonths || saldoPendienteReal <= 0

  useEffect(() => {
    if (!walletAddress) return
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
        /* contrato sin datos aún — mostramos formulario */
        setFase('form')
      }
    }
    cargarPrestamo()
  }, [walletAddress])

  async function handleConfirmar() {
    if (!walletAddress) { setErrorMsg('Wallet no conectada'); setFase('error'); return }
    setFase('procesando')
    setErrorMsg(null)
    try {
      const tx = await solicitarPrestamo(walletAddress, requested)
      const signedXdr = await firmarTransaccion(tx.toXDR())
      const hash = await enviarTransaccion(signedXdr)
      setTxHash(hash)
      setSaldoPendienteReal(requested)
      setMesesPagadosReal(0)
      setFase('activo')
    } catch (err) {
      setErrorMsg(err.message ?? 'Error al solicitar el préstamo')
      setFase('error')
    }
  }

  async function handlePagarMes() {
    if (!walletAddress) return
    setFase('procesando')
    setErrorMsg(null)
    try {
      const tx = await pagarPrestamo(walletAddress)
      const signedXdr = await firmarTransaccion(tx.toXDR())
      const hash = await enviarTransaccion(signedXdr)
      setTxHash(hash)
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
    <div className="p-6 rounded-2xl bg-white dark:bg-white/5 border border-ink/8 dark:border-white/8 text-center">
      <svg className="animate-spin mx-auto mb-3 text-yellow-500" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
      <p className="text-sm text-ink/50 dark:text-white/50">{t('autoloan.cargando')}</p>
    </div>
  )

  return (
    <div className="flex flex-col gap-4">

      {/* ── Header ── */}
      <div className="bg-white dark:bg-white/5 border border-ink/8 dark:border-white/8 rounded-2xl p-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">🚨</span>
              <h5 className="font-display font-black text-ink dark:text-white text-lg mb-0">
                {t('autoloan.titulo')}
              </h5>
            </div>
            <p className="text-sm text-ink/50 dark:text-white/50">
              {t('autoloan.desc')}
            </p>
          </div>
          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-yellow-400/10 text-yellow-500 border border-yellow-400/20">
            {MANANA_SEGURO_RATES.loanMonthlyFee}% {t('autoloan.mensual')}
          </span>
        </div>
      </div>

      {/* ── Sin saldo bloqueado ── */}
      {lockedBalance === 0 && fase === 'form' && (
        <div className="bg-white dark:bg-white/5 border border-dashed border-ink/10 dark:border-white/10 rounded-2xl p-6 text-center">
          <div className="text-4xl mb-3">🔒</div>
          <p className="text-sm text-ink/50 dark:text-white/50">
            {t('autoloan.sinSaldo')}{' '}
            <strong className="text-yellow-500">{t('autoloan.sinSaldoDeposito')}</strong>{' '}
            {t('autoloan.sinSaldoFin')}
          </p>
        </div>
      )}

      {/* ── FASE: Formulario ── */}
      {fase === 'form' && lockedBalance > 0 && (
        <div className="bg-white dark:bg-white/5 border border-ink/8 dark:border-white/8 rounded-2xl p-6 flex flex-col gap-4">

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: t('autoloan.saldoBloqueado'), val: formatCurrencyUsd(lockedBalance), color: 'text-ink dark:text-white' },
              { label: t('autoloan.maxDisponible'), val: formatCurrencyUsd(maxLoan), color: 'text-yellow-500' },
              { label: t('autoloan.tasaMensual'), val: `${MANANA_SEGURO_RATES.loanMonthlyFee}%`, color: 'text-yellow-500' },
              { label: t('autoloan.plazoMax'), val: t('autoloan.plazoMeses', { meses: MANANA_SEGURO_RATES.loanMaxMonths }), color: 'text-ink dark:text-white' },
            ].map(item => (
              <div key={item.label} className="bg-ink/3 dark:bg-white/3 border border-ink/6 dark:border-white/6 rounded-xl p-3">
                <p className="text-xs text-ink/40 dark:text-white/40 mb-1">{item.label}</p>
                <p className={`text-sm font-bold ${item.color}`}>{item.val}</p>
              </div>
            ))}
          </div>

          {/* Slider */}
          <div>
            <div className="flex justify-between mb-2">
              <label id="loan-amount-label" className="text-xs text-ink/40 dark:text-white/40">
                {t('autoloan.montoSolicitar')}
              </label>
              <span className="text-sm font-bold text-yellow-500">{formatCurrencyUsd(requested)}</span>
            </div>
            <input type="range"
              aria-labelledby="loan-amount-label"
              className="w-full mb-1"
              min={10} max={Math.max(10, Math.floor(maxLoan))} step={5}
              value={requested}
              onChange={e => setRequested(Number(e.target.value))}
              style={{ accentColor: '#fbbf24' }}
            />
            <div className="flex justify-between">
              <span className="text-xs text-ink/35 dark:text-white/35">$10 USDC</span>
              <span className="text-xs text-ink/35 dark:text-white/35">{formatCurrencyUsd(maxLoan)} máx.</span>
            </div>
          </div>

          {/* Resumen */}
          {enoughBalance && (
            <div className="bg-ink/2 dark:bg-white/2 border border-ink/6 dark:border-white/6 rounded-xl p-4 flex flex-col gap-2">
              <h6 className="font-semibold text-ink dark:text-white mb-1">{t('autoloan.resumen')}</h6>
              {[
                { label: t('autoloan.montoPrestado'), val: formatCurrencyUsd(loan.amount), color: 'text-ink dark:text-white' },
                { label: t('autoloan.pagoMensual'), val: formatCurrencyUsd(loan.monthlyPayment), color: 'text-yellow-500' },
                { label: t('autoloan.totalIntereses'), val: formatCurrencyUsd(loan.totalFees), color: 'text-red-400' },
                { label: t('autoloan.totalRepagar'), val: formatCurrencyUsd(loan.totalRepaid), color: 'text-ink dark:text-white' },
                { label: t('autoloan.capitalRindiendo'), val: formatCurrencyUsd(lockedBalance - loan.amount), color: 'text-green-500' },
              ].map(item => (
                <div key={item.label} className="flex justify-between py-1 border-b border-ink/4 dark:border-white/4 last:border-0">
                  <span className="text-xs text-ink/40 dark:text-white/40">{item.label}</span>
                  <span className={`text-xs font-bold ${item.color}`}>{item.val}</span>
                </div>
              ))}
              <div className="bg-red-500/5 border border-dashed border-red-500/25 rounded-lg p-3 mt-1">
                <p className="text-xs text-red-400">
                  ⚠ {t('autoloan.advertenciaPenalty')} <strong>−{MANANA_SEGURO_RATES.loanPenaltyPerMonth}%</strong> {t('autoloan.advertenciaPenaltySufijo')}
                </p>
              </div>
            </div>
          )}

          {/* Toggle tabla */}
          {enoughBalance && (
            <button
              className="w-full text-xs font-medium py-2.5 rounded-xl border border-ink/10 dark:border-white/10 text-ink/40 dark:text-white/40 hover:text-ink dark:hover:text-white hover:border-ink/20 dark:hover:border-white/20 transition-all"
              onClick={() => setShowSchedule(!showSchedule)}
              aria-expanded={showSchedule}
              aria-controls="payment-schedule">
              {showSchedule ? t('autoloan.ocultarTabla') : t('autoloan.verTabla')}
            </button>
          )}

          {/* Tabla de pagos */}
          {showSchedule && (
            <div id="payment-schedule" className="overflow-y-auto rounded-xl border border-ink/6 dark:border-white/6" style={{ maxHeight: 200 }}>
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white dark:bg-[#0f0e0d]">
                  <tr className="text-ink/40 dark:text-white/40 border-b border-ink/6 dark:border-white/6">
                    <th className="text-left px-3 py-2 font-medium">{t('autoloan.tablaMes')}</th>
                    <th className="text-left px-3 py-2 font-medium">{t('autoloan.tablaCapital')}</th>
                    <th className="text-left px-3 py-2 font-medium">{t('autoloan.tablaInteres')}</th>
                    <th className="text-left px-3 py-2 font-medium">{t('autoloan.tablaPago')}</th>
                    <th className="text-left px-3 py-2 font-medium">{t('autoloan.tablaPendiente')}</th>
                  </tr>
                </thead>
                <tbody>
                  {loan.schedule.map(row => (
                    <tr key={row.month} className="border-b border-ink/4 dark:border-white/4 last:border-0">
                      <td className="px-3 py-2 text-ink/60 dark:text-white/60">{row.month}</td>
                      <td className="px-3 py-2 text-ink dark:text-white">{formatCurrencyUsd(row.principal)}</td>
                      <td className="px-3 py-2 text-yellow-500 font-medium">{formatCurrencyUsd(row.fee)}</td>
                      <td className="px-3 py-2 font-bold text-ink dark:text-white">{formatCurrencyUsd(row.payment)}</td>
                      <td className="px-3 py-2 text-ink/40 dark:text-white/40">{formatCurrencyUsd(row.remaining)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Botón solicitar */}
          <button
            className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all ${enoughBalance
              ? 'bg-gradient-to-r from-yellow-600 to-yellow-400 text-black hover:-translate-y-px hover:shadow-lg hover:shadow-yellow-500/20 cursor-pointer'
              : 'bg-ink/5 dark:bg-white/5 text-ink/20 dark:text-white/20 cursor-not-allowed'
              }`}
            onClick={() => enoughBalance && setFase('confirmando')}
            disabled={!enoughBalance}
            aria-label={enoughBalance ? `Solicitar préstamo de ${formatCurrencyUsd(loan.amount)}` : 'Solicitar préstamo'}>
            {enoughBalance ? t('autoloan.solicitar', { monto: formatCurrencyUsd(loan.amount) }) : t('autoloan.solicitarVacio')}
          </button>
        </div>
      )}

      {/* ── FASE: Confirmando ── */}
      {fase === 'confirmando' && (
        <div className="bg-white dark:bg-white/5 border border-ink/8 dark:border-white/8 rounded-2xl p-6 text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h6 className="font-display font-black text-ink dark:text-white text-lg mb-2">
            {t('autoloan.confirmarTitulo')}
          </h6>
          <p className="text-sm text-ink/50 dark:text-white/50 mb-2">
            {t('autoloan.confirmarDesc', { monto: formatCurrencyUsd(loan.amount), pago: formatCurrencyUsd(loan.monthlyPayment) })}
          </p>
          <p className="text-xs text-green-500 mb-6">{t('autoloan.confirmarFreighter')}</p>
          <div className="flex gap-3 justify-center">
            <button
              className="px-5 py-2.5 rounded-xl text-sm font-medium border border-ink/10 dark:border-white/10 text-ink/50 dark:text-white/50 hover:text-ink dark:hover:text-white transition-all cursor-pointer"
              onClick={() => setFase('form')}
              aria-label="Cancelar solicitud de préstamo">
              {t('autoloan.cancelar')}
            </button>
            <button
              className="px-5 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-yellow-600 to-yellow-400 text-black hover:-translate-y-px transition-all cursor-pointer"
              onClick={handleConfirmar}
              aria-label="Confirmar y firmar préstamo">
              {t('autoloan.confirmarFirmar')}
            </button>
          </div>
        </div>
      )}

      {/* ── FASE: Procesando ── */}
      {fase === 'procesando' && (
        <div className="bg-white dark:bg-white/5 border border-ink/8 dark:border-white/8 rounded-2xl p-6 text-center">
          <svg className="animate-spin mx-auto mb-3 text-yellow-500" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <p className="text-sm text-ink/50 dark:text-white/50">{t('autoloan.procesando')}</p>
        </div>
      )}

      {/* ── FASE: Error ── */}
      {fase === 'error' && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6 text-center">
          <div className="text-4xl mb-3">❌</div>
          <p className="text-sm text-red-400 mb-4">{errorMsg}</p>
          <button
            className="px-5 py-2.5 rounded-xl text-sm font-medium border border-ink/10 dark:border-white/10 text-ink/50 dark:text-white/50 hover:text-ink dark:hover:text-white transition-all cursor-pointer"
            onClick={handleReset}
            aria-label="Intentar de nuevo">
            {t('autoloan.intentarDeNuevo')}
          </button>
        </div>
      )}

      {/* ── FASE: Activo ── */}
      {fase === 'activo' && (
        <div className="bg-white dark:bg-white/5 border border-ink/8 dark:border-white/8 rounded-2xl p-6 flex flex-col gap-4">

          {/* TX confirmada */}
          {txHash && (
            <div className="bg-green-500/8 border border-green-500/20 rounded-xl p-3">
              <p className="text-xs text-green-500">
                {t('autoloan.txConfirmada')}{' '}
                <a href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-yellow-500 hover:underline">
                  {txHash.slice(0, 16)}... →
                </a>
              </p>
            </div>
          )}

          {/* Estado del préstamo */}
          <div className={`rounded-xl p-4 border ${liquidado
            ? 'bg-green-500/8 border-green-500/20'
            : 'bg-yellow-400/5 border-yellow-400/20'
            }`}>
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className={`font-bold text-sm ${liquidado ? 'text-green-500' : 'text-yellow-500'}`}>
                  {liquidado ? t('autoloan.prestamoliquidado') : t('autoloan.prestamoActivo')}
                </p>
                <p className="text-xs text-ink/40 dark:text-white/40 mt-0.5">
                  {liquidado
                    ? t('autoloan.rendimientoVolvio')
                    : t('autoloan.mesesPagados', { meses: mesesPagadosReal })}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold text-base text-yellow-500">{formatCurrencyUsd(saldoPendienteReal)}</p>
                <p className="text-xs text-ink/40 dark:text-white/40">{t('autoloan.pendienteContrato')}</p>
              </div>
            </div>
            {/* Barra de progreso */}
            <div className="w-full h-2 rounded-full bg-ink/5 dark:bg-white/5 mb-2 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${progresoPago}%`,
                  background: liquidado ? '#22c55e' : 'linear-gradient(90deg, #d97706, #fbbf24)'
                }}
              />
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-ink/35 dark:text-white/35">
                {t('autoloan.mesesPagadosLabel', { meses: mesesPagadosReal })}
              </span>
              <span className="text-xs text-ink/35 dark:text-white/35">
                {t('autoloan.mesesRestantes', { meses: mesesRestantes })}
              </span>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: t('autoloan.rendimientoActual'), val: `${tasaEfectiva.toFixed(2)}% APY`, color: tasaEfectiva < userRate ? 'text-red-400' : 'text-green-500' },
              { label: t('autoloan.capitalRindiendoLabel'), val: formatCurrencyUsd(capitalRindiendo), color: 'text-green-500' },
              { label: t('autoloan.mesesImpagoLabel'), val: mesesImpago, color: mesesImpago > 0 ? 'text-red-400' : 'text-green-500' },
              { label: t('autoloan.penalizacionLabel'), val: `−${penalizacion.toFixed(2)}%`, color: penalizacion > 0 ? 'text-red-400' : 'text-ink/30 dark:text-white/30' },
            ].map(item => (
              <div key={item.label} className="bg-ink/3 dark:bg-white/3 border border-ink/6 dark:border-white/6 rounded-xl p-3">
                <p className="text-xs text-ink/40 dark:text-white/40 mb-1">{item.label}</p>
                <p className={`text-sm font-bold ${item.color}`}>{item.val}</p>
              </div>
            ))}
          </div>

          {/* Botones pagar / fallar */}
          {!liquidado && (
            <div className="flex gap-2">
              <button
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-green-500/10 border border-green-500/25 text-green-500 hover:bg-green-500/20 transition-all cursor-pointer"
                onClick={handlePagarMes}
                aria-label={`Pagar mes ${mesesPagadosReal + 1} del préstamo`}>
                {t('autoloan.pagarMes', { mes: mesesPagadosReal + 1 })}
              </button>
              <button
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-red-500/8 border border-red-500/25 text-red-400 hover:bg-red-500/15 transition-all cursor-pointer"
                onClick={() => setMesesImpago(i => i + 1)}
                aria-label="Fallar mes de pago (demo)">
                {t('autoloan.fallarMes')}
              </button>
            </div>
          )}

          {/* Alerta impago */}
          {mesesImpago > 0 && (
            <div className="bg-red-500/5 border border-dashed border-red-500/25 rounded-xl p-3">
              <p className="text-xs text-red-400">
                {mesesImpago === 1
                  ? t('autoloan.impagoUno', { n: mesesImpago })
                  : t('autoloan.impagoVarios', { n: mesesImpago })}{' '}
                <strong>{tasaEfectiva.toFixed(2)}%</strong>.
              </p>
            </div>
          )}

          {/* Liquidado */}
          {liquidado && (
            <div className="bg-green-500/8 border border-green-500/20 rounded-xl p-4 text-center">
              <p className="font-bold text-green-500 mb-1">{t('autoloan.prestamoCompletado')}</p>
              <p className="text-xs text-ink/40 dark:text-white/40">
                {t('autoloan.rendimientoCompleto', { rate: userRate })}
              </p>
            </div>
          )}

          {/* Nueva solicitud */}
          <button
            className="w-full py-2.5 rounded-xl text-sm font-medium border border-ink/10 dark:border-white/10 text-ink/40 dark:text-white/40 hover:text-ink dark:hover:text-white hover:border-ink/20 dark:hover:border-white/20 transition-all cursor-pointer"
            onClick={handleReset}
            aria-label="Crear nueva solicitud de préstamo">
            {t('autoloan.nuevaSolicitud')}
          </button>

        </div>
      )}
    </div>
  )
}