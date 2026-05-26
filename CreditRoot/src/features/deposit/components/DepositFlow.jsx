// src/features/deposit/components/DepositFlow.jsx
//
// Flujo de depósito SPEI → CETES via Etherfuse
// Usa las Netlify functions del backend — sin Freighter, sin etherfuseRamp.js
//
// Props:
//   usuarioId  — ID del usuario en Supabase
//   kycStatus  — estado KYC del usuario ('pending' | 'approved')
//   onComplete — callback cuando el depósito se confirma
//   onClose    — callback para cerrar

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Skeleton, DepositFlowSkeleton } from '../../components/Skeleton'

const MIN_MXN = 40
const MAX_MXN = 10000

const STEPS = {
  KYC:    'kyc',    // 1. KYC pendiente
  AMOUNT: 'amount', // 2. Ingresar monto
  CLABE:  'clabe',  // 3. Mostrar CLABE y esperar SPEI
  DONE:   'done',   // 4. Completado
}

export function DepositFlow({ usuarioId, kycStatus, onComplete, onClose }) {
  const { t } = useTranslation()

  // Debug: throw behind ?crash=1 to test ErrorBoundary
  if (typeof window !== 'undefined' && window.location.search.includes('crash=1')) {
    throw new Error('[DEV] DepositFlow crash test — ErrorBoundary should catch this')
  }

  const [step, setStep] = useState(
    kycStatus !== 'approved' ? STEPS.KYC : STEPS.AMOUNT
  )
  const [amountMxn, setAmountMxn] = useState(500)
  const [order, setOrder] = useState(null)
  const [orderStatus, setOrderStatus] = useState('created')
  const [onboardingUrl, setOnboardingUrl] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingOrder, setLoadingOrder] = useState(false)
  const [error, setError] = useState(null)

  // ── Polling del estado de la orden ────────────────────────────────────────
  useEffect(() => {
    if (!order?.orderId || orderStatus === 'completed') return

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/etherfuse/order-status?orderId=${order.orderId}`)
        const data = await res.json()
        if (data.status && data.status !== orderStatus) {
          setOrderStatus(data.status)
          if (data.status === 'completed') {
            clearInterval(interval)
            setStep(STEPS.DONE)
            onComplete?.()
          }
        }
      } catch { /* fallo silencioso en polling */ }
    }, 5000)

    return () => clearInterval(interval)
  }, [order, orderStatus, onComplete])

  // ── KYC: abrir Etherfuse ──────────────────────────────────────────────────
  async function handleStartKyc() {
    setLoading(true)
    setLoadingOrder(true)
    setError(null)
    try {
      const res = await fetch('/api/etherfuse/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuarioId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('deposit.errorKyc'))
      if (data.yaCompletado) { setStep(STEPS.AMOUNT); return }
      setOnboardingUrl(data.onboardingUrl)
      window.open(data.onboardingUrl, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setLoadingOrder(false)
    }
  }

  // ── Depósito: crear orden ─────────────────────────────────────────────────
  async function handleDepositar() {
    setLoading(true)
    setLoadingOrder(true)
    setError(null)
    try {
      const res = await fetch('/api/etherfuse/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuarioId, montoMxn: amountMxn }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'KYC pendiente') { setStep(STEPS.KYC); return }
        throw new Error(data.error || t('deposit.errorOrden'))
      }
      setOrder(data)
      setOrderStatus('created')
      setStep(STEPS.CLABE)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setLoadingOrder(false)
    }
  } = 'w-full bg-brand hover:bg-brand-dark text-white font-semibold py-3.5 px-4 rounded-xl transition-all hover:-translate-y-px hover:shadow-lg hover:shadow-brand/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
  const btnSecondary = 'w-full bg-transparent border border-ink/15 dark:border-white/15 text-ink dark:text-white font-semibold py-3 px-4 rounded-xl transition-all hover:border-ink/30 dark:hover:border-white/30 cursor-pointer'

  return (
    <div className="bg-white dark:bg-white/5 border border-ink/8 dark:border-white/8 rounded-2xl p-6 flex flex-col gap-5">

      {/* ── KYC ── */}
      {step === STEPS.KYC && (
        <>
          <div>
            <h3 className="font-display font-black text-ink dark:text-white text-xl mb-1">
              {t('deposit.kycTitulo')}
            </h3>
            <p className="text-sm text-ink/50 dark:text-white/50">{t('deposit.kycDesc')}</p>
          </div>
          <div className="flex flex-col gap-2">
            {t('deposit.kycItems', { returnObjects: true }).map(item => (
              <div key={item} className="flex items-center gap-2 text-sm text-ink/60 dark:text-white/60">
                <span className="text-brand">✓</span> {item}
              </div>
            ))}
          </div>
          {error && <ErrorBanner message={error} />}
          <button onClick={handleStartKyc} disabled={loading} className={btnPrimary}>
            {loading ? t('deposit.kycAbriendo') : t('deposit.kycBtn')}
          </button>
          {onboardingUrl && (
            <button onClick={() => setStep(STEPS.AMOUNT)} className={btnSecondary}>
              {t('deposit.kycYaComplete')}
            </button>
          )}
        </>
      )}

      {/* ── Monto ── */}
      {step === STEPS.AMOUNT && loading && <DepositFlowSkeleton />}

      {step === STEPS.AMOUNT && !loading && (
        <>
          <div>
            <h3 className="font-display font-black text-ink dark:text-white text-xl mb-1">
              {t('deposit.montoTitulo')}
            </h3>
            <p className="text-sm text-ink/50 dark:text-white/50">
              {t('deposit.montoDesc', { min: MIN_MXN })}
            </p>
          </div>

          <div>
            <label className="text-xs text-ink/40 dark:text-white/40 mb-2 block">
              {t('deposit.montoLabel')}
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/40 dark:text-white/40 font-semibold">$</span>
              <input
                type="number"
                min={MIN_MXN}
                max={MAX_MXN}
                step={10}
                value={amountMxn}
                onChange={e => setAmountMxn(Number(e.target.value))}
                className="w-full pl-8 pr-16 py-3 bg-ink/3 dark:bg-white/5 border border-ink/10 dark:border-white/10 rounded-xl text-ink dark:text-white font-semibold focus:outline-none focus:border-brand"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-ink/40 dark:text-white/40">MXN</span>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            {[100, 200, 500, 1000].map(n => (
              <button key={n} onClick={() => setAmountMxn(n)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                  amountMxn === n
                    ? 'bg-brand/10 border-brand/30 text-brand font-semibold'
                    : 'bg-transparent border-ink/10 dark:border-white/10 text-ink/40 dark:text-white/40 hover:border-ink/20'
                }`}>
                ${n}
              </button>
            ))}
          </div>

          {error && <ErrorBanner message={error} />}

          <button
            onClick={handleDepositar}
            disabled={loading || amountMxn < MIN_MXN || amountMxn > MAX_MXN}
            className={btnPrimary}>
            {loading ? t('deposit.generandoClabe') : t('deposit.montoCta')}
          </button>
        </>
      )}

      {/* ── CLABE ── */}
      {step === STEPS.CLABE && order && (
        <>
          <div>
            <h3 className="font-display font-black text-ink dark:text-white text-xl mb-1">
              {t('deposit.clabeTitulo')}
            </h3>
            <p className="text-sm text-ink/50 dark:text-white/50">{t('deposit.clabeDesc')}</p>
          </div>

          <div className="bg-brand/5 border border-brand/20 rounded-xl p-4 flex flex-col gap-3">
            <InfoRow label={t('deposit.montoExacto')} value={`$${order.montoExactoMxn?.toLocaleString('es-MX')} MXN`} important />
            <InfoRow label={t('deposit.clabe')} value={order.depositClabe} mono copyable />
            <InfoRow label={t('deposit.banco')} value={order.depositBankName ?? 'STP'} />
            <InfoRow label={t('deposit.beneficiario')} value={order.depositAccountHolder ?? 'Etherfuse'} />
            <InfoRow label={t('deposit.comision')} value={`$${parseFloat(order.feeAmount ?? 0).toFixed(2)} MXN`} />
          </div>

          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full transition-colors ${
              orderStatus === 'funded'    ? 'bg-yellow-400 animate-pulse' :
              orderStatus === 'completed' ? 'bg-green-500' :
              'bg-ink/20 dark:bg-white/20 animate-pulse'
            }`} />
            <span className="text-sm text-ink/50 dark:text-white/50">
              {orderStatus === 'created'   ? t('deposit.esperandoSpei') :
               orderStatus === 'funded'    ? t('deposit.speiRecibido') :
               orderStatus === 'completed' ? t('deposit.cetesAcreditados') :
               t('deposit.procesando')}
            </span>
          </div>

          <p className="text-xs text-ink/30 dark:text-white/30">
            {t('deposit.advertenciaMontoExacto')}
          </p>
      </>
      )}

      {/* ── Done ── */}
      {step === STEPS.DONE && (
        <div className="flex flex-col items-center text-center gap-5 py-4">
          <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center text-3xl">
            🎉
          </div>
          <div>
            <h3 className="font-display font-black text-ink dark:text-white text-xl mb-1">
              {t('deposit.doneTitulo')}
            </h3>
            <p className="text-sm text-ink/50 dark:text-white/50">{t('deposit.doneDesc')}</p>
          </div>
          <button onClick={onClose} className={btnPrimary}>{t('deposit.doneBtn')}</button>
        </div>
      )}

    </div>
  )
}

function InfoRow({ label, value, mono, important, copyable }) {
  const { t } = useTranslation()
  function handleCopy() {
    navigator.clipboard.writeText(value)
      .then(() => alert(t('deposit.clabeCopiada')))
      .catch(() => {})
  }
  return (
    <div className="flex justify-between items-center gap-4">
      <span className="text-xs text-ink/40 dark:text-white/40 shrink-0">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`text-sm font-semibold text-right break-all ${
          mono ? 'font-mono text-brand tracking-wider' : ''
        } ${important ? 'text-brand text-base' : 'text-ink dark:text-white'}`}>
          {value}
        </span>
        {copyable && (
          <button onClick={handleCopy}
            className="text-xs text-ink/30 hover:text-brand transition-colors cursor-pointer shrink-0"
            title={t('deposit.copiarClabe')}>
            ⧉
          </button>
        )}
      </div>
    </div>
  )
}

function ErrorBanner({ message }) {
  return (
    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
      <p className="text-sm text-red-500">{message}</p>
    </div>
  )
}
