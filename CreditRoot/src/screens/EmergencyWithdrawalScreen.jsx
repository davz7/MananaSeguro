import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ExternalLink, TriangleAlert } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import LandingNavbar from './components/LandingNavbar'
import Footer from './components/Footer'
import { firmarIntencion, listarOrdenes, nuevaIdempotencyKey } from '../lib/endpoints'
import { useEtherfuseRate } from '../hooks/useEtherfuseRate'
import { useExchangeRate } from '../hooks/useExchangeRate'
import { formatUsdc, mxnToUsdc, usdcToMxn } from '../utils/currency'
import {
  PRESTAMO_INTERES_MENSUAL,
  PRESTAMO_MAX_PCT,
  PRESTAMO_MIN_USDC,
  PRESTAMO_PLAZO_MESES,
  disponiblePrestamo,
  primeraCuota,
  validarMontoPrestamo,
} from '../utils/loan'
import { explorerTxUrl } from '../config'
import { mensajeDeError } from '../lib/errores'

// Retiro de emergencia = autopréstamo del contrato (intent request_loan).
//
// Saldo: el backend todavía no expone el saldo on-chain (falta GET /api/cuenta),
// así que se usa la suma de depósitos COMPLETADOS de /api/etherfuse/order-status.
// Cuando exista /api/cuenta, basta con cambiar cargarSaldo().

const mxnFmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 })

export function EmergencyWithdrawalScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { userRate } = useEtherfuseRate()
  const { usdMxn } = useExchangeRate()

  //  Saldo
  const [saldoMxn, setSaldoMxn] = useState(null)
  const [cargandoSaldo, setCargandoSaldo] = useState(true)
  const [errorSaldo, setErrorSaldo] = useState(null)

  const cargarSaldo = useCallback(async () => {
    setCargandoSaldo(true)
    setErrorSaldo(null)
    try {
      const { totalMxn } = await listarOrdenes()
      setSaldoMxn(totalMxn)
    } catch (err) {
      setErrorSaldo(err)
    } finally {
      setCargandoSaldo(false)
    }
  }, [])

  useEffect(() => { cargarSaldo() }, [cargarSaldo])

  //  Formulario
  const [monto, setMonto] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const [resultado, setResultado] = useState(null) // { transactionHash, montoMxn, amountUsdc }

  // La misma clave se reusa si el usuario reintenta el MISMO monto (p. ej. tras
  // un TIMEOUT): así el backend no firma dos veces. Cambia si cambia el monto.
  const idempotencia = useRef({ monto: null, key: null })

  const disponibleMxn = disponiblePrestamo(saldoMxn)
  const amountUsdc = monto ? mxnToUsdc(monto, usdMxn) : null
  const errorMonto = monto === '' ? null : validarMontoPrestamo({ montoMxn: monto, disponibleMxn, amountUsdc })
  const minimoMxn = usdcToMxn(PRESTAMO_MIN_USDC, usdMxn)
  const cuotaMxn = !errorMonto && monto ? primeraCuota(monto) : null

  const mensajeError = (codigo) => t(`emergencyWithdrawal.amountErrors.${codigo}`, {
    min: mxnFmt.format(minimoMxn ?? 0),
    max: mxnFmt.format(disponibleMxn),
  })

  async function handleSubmit(event) {
    event.preventDefault()
    const invalido = validarMontoPrestamo({ montoMxn: monto, disponibleMxn, amountUsdc })
    if (invalido) {
      setError({ message: mensajeError(invalido) })
      return
    }
    if (!termsAccepted || amountUsdc === null) return

    if (idempotencia.current.monto !== monto) {
      idempotencia.current = { monto, key: nuevaIdempotencyKey() }
    }

    setEnviando(true)
    setError(null)
    try {
      const r = await firmarIntencion({ type: 'request_loan', amountUsdc }, idempotencia.current.key)
      setResultado({ transactionHash: r.transactionHash, montoMxn: Number(monto), amountUsdc })
      idempotencia.current = { monto: null, key: null }
      setMonto('')
      setTermsAccepted(false)
    } catch (err) {
      setError(err)
    } finally {
      setEnviando(false)
    }
  }

  const txUrl = resultado ? explorerTxUrl(resultado.transactionHash) : null

  return (
    <div className="bg-bg min-h-screen flex flex-col text-white">
      <LandingNavbar soloVolver onVolver={() => navigate('/main')} />

      <main className="flex-1 px-4 py-10 sm:px-6 lg:px-12">
        <div className="mx-auto w-full max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-start">

            {/* IZQUIERDA */}
            <div className="flex flex-col gap-5 lg:gap-8">
              <h1
                className="font-display font-bold text-white tracking-tight leading-[1.05]"
                style={{ fontSize: 'clamp(3rem,6vw,5rem)' }}
              >
                {t('emergencyWithdrawal.title')}
                <em className="text-brand not-italic block">{t('emergencyWithdrawal.titleAccent')}</em>
              </h1>
              <p className="text-sm text-white/60 leading-relaxed max-w-md">
                {t('emergencyWithdrawal.intro')}
              </p>
            </div>

            {/* DERECHA */}
            <div className="w-full">
              <div className="bg-card border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl shadow-black/80">
                <div className="mb-5 flex items-center justify-between gap-3 text-[#d8d0ca]">
                  <span className="text-[0.96rem] font-medium">{t('emergencyWithdrawal.accountLabel')}</span>
                  <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-semibold text-white/70">
                    {t('emergencyWithdrawal.availableLabel')}
                  </span>
                </div>

                {/* Saldo */}
                <div className="rounded-2xl bg-white/5 p-4">
                  <div className="text-sm font-medium text-white/50">{t('emergencyWithdrawal.balanceLabel')}</div>
                  <div className="mt-3 font-display font-bold text-white leading-none" style={{ fontSize: 'clamp(2rem,4vw,3rem)' }}>
                    {cargandoSaldo ? '…' : errorSaldo ? '—' : mxnFmt.format(saldoMxn ?? 0)}
                  </div>
                  {!cargandoSaldo && !errorSaldo && (
                    <div className="mt-1 text-xs text-white/40">≈ {formatUsdc(mxnToUsdc(saldoMxn ?? 0, usdMxn))}</div>
                  )}
                  <div className="mt-4 text-sm text-white/40">
                    {t('emergencyWithdrawal.rateLabel')} <span className="text-brand font-semibold">{userRate}%</span>
                  </div>
                  <div className="mt-2 text-[11px] text-white/30">{t('emergencyWithdrawal.balanceHint')}</div>
                  {errorSaldo && (
                    <div className="mt-3 flex items-center gap-3">
                      <p className="text-red-400 text-xs" role="alert">{mensajeDeError(errorSaldo, t)}</p>
                      <button type="button" onClick={cargarSaldo} className="text-white/60 hover:text-white text-xs underline cursor-pointer">
                        {t('emergencyWithdrawal.retry')}
                      </button>
                    </div>
                  )}
                </div>

                {/* Disponible (30%) */}
                <div className="mt-4 rounded-2xl border border-white/8 bg-white/3 p-4">
                  <div className="text-sm leading-relaxed text-white/50">
                    {t('emergencyWithdrawal.availableExplanation', { pct: Math.round(PRESTAMO_MAX_PCT * 100) })}
                  </div>
                  <div className="mt-5 font-display font-bold text-white leading-none" style={{ fontSize: 'clamp(1.8rem,3.5vw,2.6rem)' }}>
                    {cargandoSaldo ? '…' : mxnFmt.format(disponibleMxn)}
                  </div>
                </div>

                {!cargandoSaldo && !errorSaldo && disponibleMxn <= 0 ? (
                  <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70 flex flex-col gap-3">
                    <p>{t('emergencyWithdrawal.noBalance')}</p>
                    <button
                      type="button"
                      onClick={() => navigate('/deposits')}
                      className="self-start bg-brand hover:bg-brand-dark text-white text-xs font-semibold px-4 py-2 rounded-lg transition-all cursor-pointer"
                    >
                      {t('emergencyWithdrawal.goDeposit')}
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
                    <div>
                      <label htmlFor="monto-emergencia" className="mb-2 block text-[0.96rem] font-medium text-[#f1e9e3]">
                        {t('emergencyWithdrawal.stepOne')}
                      </label>
                      <div className="flex items-center overflow-hidden rounded-xl border border-white/15 bg-white/5">
                        <span className="flex items-center justify-center border-r border-white/15 bg-white/5 px-4 py-3.5 text-xl font-medium text-white/70">
                          $
                        </span>
                        <input
                          id="monto-emergencia"
                          type="number"
                          inputMode="decimal"
                          min="0"
                          max={disponibleMxn || undefined}
                          step="0.01"
                          value={monto}
                          onChange={(event) => { setMonto(event.target.value); setError(null); setResultado(null) }}
                          className="w-full bg-transparent px-4 py-3.5 text-lg text-white outline-none placeholder:text-white/30"
                          placeholder="0"
                          disabled={cargandoSaldo || Boolean(errorSaldo)}
                          aria-describedby="monto-emergencia-ayuda"
                        />
                        <span className="pr-4 text-sm text-white/50">MXN</span>
                      </div>
                      <div id="monto-emergencia-ayuda" className={`mt-3 text-sm ${errorMonto ? 'text-red-400' : 'text-white/40'}`}>
                        {errorMonto
                          ? mensajeError(errorMonto)
                          : amountUsdc !== null
                            ? t('emergencyWithdrawal.approxUsdc', { usdc: formatUsdc(amountUsdc) })
                            : t('emergencyWithdrawal.disposable', { amount: mxnFmt.format(disponibleMxn), pct: Math.round(PRESTAMO_MAX_PCT * 100) })}
                      </div>
                    </div>

                    {/* Condiciones del contrato (no son configurables) */}
                    <div>
                      <p className="mb-2 block text-[0.96rem] font-medium text-[#f1e9e3]">{t('emergencyWithdrawal.stepTwo')}</p>
                      <ul className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white/80 space-y-1.5">
                        <li>{t('emergencyWithdrawal.termMonths', { months: PRESTAMO_PLAZO_MESES })}</li>
                        <li>{t('emergencyWithdrawal.termInterest', { rate: PRESTAMO_INTERES_MENSUAL * 100 })}</li>
                        <li>{t('emergencyWithdrawal.termLock')}</li>
                        {cuotaMxn !== null && (
                          <li className="text-brand font-semibold">
                            {t('emergencyWithdrawal.firstPayment', { amount: mxnFmt.format(cuotaMxn) })}
                          </li>
                        )}
                      </ul>
                    </div>

                    <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white">
                      <input
                        type="checkbox"
                        checked={termsAccepted}
                        onChange={(event) => setTermsAccepted(event.target.checked)}
                        className="mt-0.5 h-4 w-4 accent-[#e4741d]"
                        aria-label={t('emergencyWithdrawal.terms')}
                      />
                      <span className="leading-relaxed text-white/80">{t('emergencyWithdrawal.terms')}</span>
                    </label>

                    {error && (
                      <div className="rounded-xl border border-dashed border-red-400/40 bg-red-500/8 px-3 py-3 text-sm text-red-400" role="alert">
                        <TriangleAlert size={15} className="inline shrink-0 mr-1" aria-hidden="true" />
                        {mensajeDeError(error, t)}
                        {error.requestId && <span className="block text-white/30 text-[11px] mt-1">ID: {error.requestId}</span>}
                      </div>
                    )}

                    <button
                      type="submit"
                      className="mt-1 w-full rounded-xl bg-brand hover:bg-brand-dark px-4 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand/30 transition hover:-translate-y-px active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={!monto || Boolean(errorMonto) || !termsAccepted || enviando || cargandoSaldo}
                    >
                      {enviando ? t('emergencyWithdrawal.submitting') : t('emergencyWithdrawal.submit')}
                    </button>
                  </form>
                )}

                {resultado && (
                  <div className="mt-5 rounded-xl border border-green-800/50 bg-green-950/40 px-3 py-3 text-sm text-green-300" role="status">
                    <div className="mb-1 flex items-center gap-2 font-semibold">
                      <Check size={16} />
                      {t('emergencyWithdrawal.statusLabel')}
                    </div>
                    <div className="text-green-300/70">
                      {t('emergencyWithdrawal.statusMessage', {
                        amount: mxnFmt.format(resultado.montoMxn),
                        usdc: formatUsdc(resultado.amountUsdc),
                      })}
                    </div>
                    {txUrl && (
                      <a href={txUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-green-300 underline underline-offset-2">
                        <ExternalLink size={12} /> {t('emergencyWithdrawal.viewTx')}
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </main>

      <Footer dark />
    </div>
  )
}
