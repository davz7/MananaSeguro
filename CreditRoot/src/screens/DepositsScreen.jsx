import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowUpRight, ShieldCheck, TriangleAlert } from 'lucide-react'
import LandingNavbar from './components/LandingNavbar'
import Footer from './components/Footer'
import { crearDeposito, listarOrdenes, obtenerOrden } from '../lib/endpoints'
import { esEstadoFinal, mapEstadoOrden } from '../lib/mappers'
import { mensajeDeError } from '../lib/errores'
import { useExchangeRate } from '../hooks/useExchangeRate'
import { useKyc } from '../hooks/useKyc'
import {
  DEPOSITO_MAX_MXN,
  DEPOSITO_MIN_MXN,
  formatUsdc,
  mxnToUsdc,
  validarMontoDeposito,
} from '../utils/currency'

// Cada depósito tiene su propia CLABE (la genera Etherfuse por orden).
// Flujo: monto → POST /api/etherfuse/deposit → CLABE + monto exacto →
// polling a order-status?orderId= hasta un estado final.

const POLL_MS = 10_000
const DEPOSITO_ACTIVO_KEY = 'ms_deposito_activo'

const mxnFmt = new Intl.NumberFormat('es-MX', {
  style: 'currency', currency: 'MXN',
  minimumFractionDigits: 2,
})

// 18 dígitos en grupos legibles: 3-3-11-1 (banco, plaza, cuenta, verificador)
function formatearClabe(clabe = '') {
  const d = String(clabe).replace(/\D/g, '')
  if (d.length !== 18) return clabe
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 17)} ${d.slice(17)}`
}

function leerDepositoActivo() {
  try {
    return JSON.parse(sessionStorage.getItem(DEPOSITO_ACTIVO_KEY) || 'null')
  } catch {
    return null
  }
}

function guardarDepositoActivo(deposito) {
  try {
    if (deposito) sessionStorage.setItem(DEPOSITO_ACTIVO_KEY, JSON.stringify(deposito))
    else sessionStorage.removeItem(DEPOSITO_ACTIVO_KEY)
  } catch { /* storage no disponible */ }
}

function EstadoOrden({ status }) {
  const { t } = useTranslation()
  const estado = mapEstadoOrden(status)
  return (
    <div className="flex items-center gap-2">
      <span className="text-white/80 text-sm">{t(`deposits.status.${estado.clave}`)}</span>
      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${estado.color}`} />
    </div>
  )
}

export function DepositsScreen({ usuario, onUsuarioActualizado }) {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const { usdMxn } = useExchangeRate()
  const kyc = useKyc({ onAprobado: onUsuarioActualizado })

  const [monto, setMonto] = useState('')
  const [creando, setCreando] = useState(false)
  const [error, setError] = useState(null) // ApiError | { message }
  const [deposito, setDeposito] = useState(leerDepositoActivo) // respuesta de deposit + status
  const [copiado, setCopiado] = useState(false)

  const [ordenes, setOrdenes] = useState([])
  const [cargandoOrdenes, setCargandoOrdenes] = useState(true)
  const [errorOrdenes, setErrorOrdenes] = useState(null)

  const kycPendiente = usuario?.kycStatus && usuario.kycStatus !== 'approved'
  const errorMonto = monto === '' ? null : validarMontoDeposito(monto)
  const montoUsdc = monto && !errorMonto ? mxnToUsdc(monto, usdMxn) : null

  const formatearFecha = useCallback((iso) => {
    if (!iso) return { fecha: '—', hora: '' }
    const d = new Date(iso)
    const locale = i18n.resolvedLanguage === 'en' ? 'en-US' : 'es-MX'
    return {
      fecha: d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }),
      hora: d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
    }
  }, [i18n.resolvedLanguage])

  //  Lista de órdenes
  const cargarOrdenes = useCallback(async () => {
    setErrorOrdenes(null)
    try {
      const { ordenes: lista } = await listarOrdenes()
      setOrdenes(lista)
    } catch (err) {
      setErrorOrdenes(err)
    } finally {
      setCargandoOrdenes(false)
    }
  }, [])

  useEffect(() => { cargarOrdenes() }, [cargarOrdenes])

  //  Polling de la orden activa
  const orderIdActivo = deposito?.orderId
  const statusActivo = deposito?.status

  useEffect(() => {
    if (!orderIdActivo || esEstadoFinal(statusActivo)) return
    let cancelado = false
    const id = setInterval(async () => {
      try {
        const orden = await obtenerOrden(orderIdActivo)
        if (cancelado || !orden?.status) return
        setDeposito((prev) => {
          if (!prev || prev.orderId !== orderIdActivo || prev.status === orden.status) return prev
          const siguiente = { ...prev, status: orden.status }
          guardarDepositoActivo(siguiente)
          return siguiente
        })
      } catch {
        // Error transitorio: se reintenta en el siguiente ciclo.
      }
    }, POLL_MS)
    return () => { cancelado = true; clearInterval(id) }
  }, [orderIdActivo, statusActivo])

  // Cuando la orden activa cambia de estado, refresca la tabla.
  useEffect(() => {
    if (statusActivo) cargarOrdenes()
  }, [statusActivo, cargarOrdenes])

  //  Acciones
  async function handleCrear(e) {
    e.preventDefault()
    const invalido = validarMontoDeposito(monto)
    if (invalido) {
      setError({ message: t(`deposits.amountErrors.${invalido}`, { min: DEPOSITO_MIN_MXN, max: DEPOSITO_MAX_MXN.toLocaleString('es-MX') }) })
      return
    }
    setCreando(true)
    setError(null)
    try {
      const data = await crearDeposito(Number(monto))
      const nuevo = {
        orderId: data.orderId,
        depositClabe: data.depositClabe,
        depositBankName: data.depositBankName,
        montoExactoMxn: Number(data.montoExactoMxn ?? monto),
        status: data.status ?? 'created',
      }
      guardarDepositoActivo(nuevo)
      setDeposito(nuevo)
      setMonto('')
      // La tabla se refresca sola: el efecto de statusActivo detecta la orden nueva.
    } catch (err) {
      setError(err)
    } finally {
      setCreando(false)
    }
  }

  function handleNuevoDeposito() {
    guardarDepositoActivo(null)
    setDeposito(null)
    setCopiado(false)
    setError(null)
  }

  const handleCopiar = () => {
    if (!deposito?.depositClabe) return
    navigator.clipboard?.writeText(String(deposito.depositClabe).replace(/\s/g, ''))
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  // 403 de deposit: KYC o cuenta bancaria pendientes
  const errorKyc = error?.status === 403 && error?.data?.kycStatus
  const errorCuentaBancaria = error?.status === 403 && error?.data?.bankAccountStatus

  return (
    <div className="bg-bg min-h-screen flex flex-col text-white">
      <LandingNavbar soloVolver onVolver={() => navigate('/main')} />

      <div className="container mx-auto px-4 py-8 max-w-5xl flex-1">

        {/* Fila 1: Hero + Card instrucciones */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

          {/* Hero izquierda */}
          <div className="flex flex-col justify-center gap-4">
            <h1
              className="font-display font-bold tracking-tight leading-[1.05]"
              style={{ fontSize: 'clamp(2.8rem,6vw,4.5rem)' }}
            >
              <em className="text-brand not-italic">{t('deposits.heroAccent')}</em>{' '}{t('deposits.heroMid')}<br />{t('deposits.heroEnd')}
            </h1>
          </div>

          {/* Card derecha */}
          <div className="bg-card border border-white/10 rounded-2xl p-6 flex flex-col gap-4">
            <h2 className="font-display font-bold text-white text-xl leading-snug">
              {t('deposits.cardTitle')}
            </h2>

            {/* Aviso KYC pendiente */}
            {(kycPendiente || errorKyc) && !deposito && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex flex-col gap-3">
                <p className="text-yellow-200 text-sm flex items-start gap-2">
                  <ShieldCheck size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
                  {t('deposits.kycRequired')}
                </p>
                <button
                  type="button"
                  onClick={kyc.iniciar}
                  disabled={kyc.cargando}
                  className="self-start bg-brand hover:bg-brand-dark disabled:opacity-60 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-all cursor-pointer"
                >
                  {kyc.cargando ? t('deposits.kycLoading') : t('deposits.kycCta')}
                </button>
                {kyc.error && <p className="text-red-400 text-xs" role="alert">{mensajeDeError(kyc.error, t)}</p>}
              </div>
            )}

            {!deposito ? (
              /*  Paso 1: monto  */
              <form onSubmit={handleCrear} className="flex flex-col gap-3" noValidate>
                <label htmlFor="monto-deposito" className="text-white/60 text-sm">
                  {t('deposits.step1Amount')}
                </label>
                <div className="flex items-center bg-[#1c1b1a] border border-white/15 rounded-xl overflow-hidden focus-within:border-brand transition">
                  <span className="pl-4 text-white/50 text-sm">$</span>
                  <input
                    id="monto-deposito"
                    type="number"
                    inputMode="decimal"
                    min={DEPOSITO_MIN_MXN}
                    max={DEPOSITO_MAX_MXN}
                    step="0.01"
                    value={monto}
                    onChange={(e) => { setMonto(e.target.value); setError(null) }}
                    placeholder="1000"
                    className="flex-1 bg-transparent px-2 py-3 text-white text-base outline-none"
                    aria-describedby="monto-ayuda"
                  />
                  <span className="pr-4 text-white/50 text-sm">MXN</span>
                </div>
                <p id="monto-ayuda" className={`text-xs ${errorMonto ? 'text-red-400' : 'text-white/45'}`}>
                  {errorMonto
                    ? t(`deposits.amountErrors.${errorMonto}`, { min: DEPOSITO_MIN_MXN, max: DEPOSITO_MAX_MXN.toLocaleString('es-MX') })
                    : montoUsdc !== null
                      ? t('deposits.approxUsdc', { usdc: formatUsdc(montoUsdc), rate: usdMxn.toFixed(2) })
                      : t('deposits.limits', { min: DEPOSITO_MIN_MXN, max: DEPOSITO_MAX_MXN.toLocaleString('es-MX') })}
                </p>

                {error && !errorKyc && (
                  <div className="bg-red-500/8 border border-dashed border-red-400/40 text-red-400 text-sm px-4 py-3 rounded-xl" role="alert">
                    <TriangleAlert size={15} className="inline shrink-0 mr-1" aria-hidden="true" />
                    {errorCuentaBancaria ? t('deposits.bankPending') : mensajeDeError(error, t)}
                    {error.requestId && <span className="block text-white/30 text-[11px] mt-1">ID: {error.requestId}</span>}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={creando || !monto || Boolean(errorMonto)}
                  className="bg-brand hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-3 rounded-xl transition-all cursor-pointer"
                >
                  {creando ? t('deposits.creating') : t('deposits.generate')}
                </button>
              </form>
            ) : (
              /*  Paso 2: CLABE de la orden  */
              <div className="flex flex-col gap-3">
                <p className="text-white/60 text-sm">
                  {t('deposits.step1Transfer', { amount: mxnFmt.format(deposito.montoExactoMxn) })}
                </p>
                <div className="bg-[#1c1b1a] border border-white/15 rounded-xl px-4 py-3 text-center">
                  <p className="text-white font-semibold text-base tracking-widest">{formatearClabe(deposito.depositClabe)}</p>
                  <p className="text-white/45 text-xs mt-0.5">{t('deposits.bank')}: {deposito.depositBankName || 'STP'}</p>
                  <p className="text-brand font-semibold text-sm mt-2">{mxnFmt.format(deposito.montoExactoMxn)} MXN</p>
                </div>
                <p className="text-yellow-200/80 text-xs">{t('deposits.exactAmountWarning')}</p>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleCopiar}
                    className="flex items-center gap-2 bg-brand hover:bg-brand-dark active:scale-[0.98] text-white text-xs font-semibold px-4 py-2 rounded-lg transition-all cursor-pointer"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                    </svg>
                    {copiado ? t('deposits.copied') : t('deposits.copy')}
                  </button>
                  <button
                    type="button"
                    onClick={handleNuevoDeposito}
                    className="text-white/60 hover:text-white text-xs underline underline-offset-2 cursor-pointer"
                  >
                    {t('deposits.newDeposit')}
                  </button>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-white/8 pt-3" aria-live="polite">
                  <span className="text-white/50 text-xs">{t('deposits.orderStatus')}</span>
                  <EstadoOrden status={deposito.status} />
                </div>
                {!esEstadoFinal(deposito.status) && (
                  <p className="text-white/35 text-[11px]">{t('deposits.autoRefresh')}</p>
                )}
              </div>
            )}

            {/* Paso 2 */}
            <p className="text-white/60 text-sm leading-relaxed">
              {t('deposits.step2')}<br />
              <span className="text-white/40 text-xs">
                {t('deposits.supportPre')}{' '}
                <a href="mailto:contactomananaseguro@gmail.com" className="text-brand underline underline-offset-2 hover:text-brand-dark transition-colors">
                  {t('deposits.supportLink')}
                </a>
                {t('deposits.supportPost')}
              </span>
            </p>
          </div>
        </div>

        {/* Tabla últimos movimientos */}
        <div className="bg-card border border-white/10 rounded-2xl p-6">
          <h3 className="font-display font-bold text-white text-xl mb-5">{t('deposits.recentTitle')}</h3>

          {/* Header tabla */}
          <div className="hidden sm:grid grid-cols-[auto_2fr_2fr_1.5fr_1fr] gap-4 text-white/40 text-xs font-medium pb-3 border-b border-white/8 mb-2">
            <span className="w-8" />
            <span>{t('deposits.colDate')}</span>
            <span>{t('deposits.colAmount')}</span>
            <span>{t('deposits.colStatus')}</span>
            <span>{t('deposits.colClabe')}</span>
          </div>

          {/* Filas */}
          <div className="flex flex-col divide-y divide-white/8">
            {ordenes.map((orden) => {
              const { fecha, hora } = formatearFecha(orden.createdAt)
              return (
                <div key={orden.orderId} className="grid grid-cols-[auto_2fr_2fr_1.5fr_1fr] gap-4 items-center py-4">
                  <div className="w-8 h-8 rounded-full bg-white/8 flex items-center justify-center shrink-0">
                    <ArrowUpRight size={14} className="text-white/60" />
                  </div>
                  <p className="text-white text-sm">
                    {fecha}{' '}
                    <span className="text-white/45">{hora} {t('deposits.hoursSuffix')}</span>
                  </p>
                  <p className="text-brand font-semibold text-sm">
                    + {mxnFmt.format(orden.montoMxn ?? 0)} MXN
                  </p>
                  <EstadoOrden status={orden.status} />
                  <p className="text-white/70 text-sm">
                    {orden.depositClabe ? `•••• ${String(orden.depositClabe).slice(-4)}` : '—'}
                  </p>
                </div>
              )
            })}
          </div>

          {cargandoOrdenes && (
            <p className="text-white/40 text-sm text-center py-8">{t('deposits.loading')}</p>
          )}
          {!cargandoOrdenes && errorOrdenes && (
            <div className="text-center py-6 flex flex-col items-center gap-2">
              <p className="text-red-400 text-sm" role="alert">{mensajeDeError(errorOrdenes, t)}</p>
              <button type="button" onClick={cargarOrdenes} className="text-white/60 hover:text-white text-xs underline cursor-pointer">
                {t('deposits.retry')}
              </button>
            </div>
          )}
          {!cargandoOrdenes && !errorOrdenes && ordenes.length === 0 && (
            <p className="text-white/30 text-sm text-center py-8">{t('deposits.empty')}</p>
          )}
        </div>

      </div>

      <Footer dark />
    </div>
  )
}
