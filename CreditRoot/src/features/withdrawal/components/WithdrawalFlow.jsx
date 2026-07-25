// src/features/withdrawal/components/WithdrawalFlow.jsx
// Flujo de retiro , lee datos de Supabase, sin Freighter/Stellar
// El retiro real se habilitará cuando Etherfuse lance su API de retiros

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Building2, LockKeyhole, TrendingUp, Gift, User,
  Hourglass, TriangleAlert, PartyPopper
} from 'lucide-react'
import { useEtherfuseRate } from '../../../hooks/useEtherfuseRate'
import { MANANA_SEGURO_RATES } from '../../../data/retirementContent'
import { formatCurrencyMxn } from '../../../utils/formatters'
import { Skeleton } from '../../../components/ui/Skeleton'

function WithdrawalSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white dark:bg-white/5 border border-ink/8 dark:border-white/8 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <Skeleton className="w-10 h-10 rounded-full shrink-0" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
        <div className="mb-5 space-y-3">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-12" />
          </div>
          <Skeleton className="h-3 w-full rounded-full" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </div>
      <div className="bg-white dark:bg-white/5 border border-ink/8 dark:border-white/8 rounded-2xl p-6">
        <Skeleton className="h-5 w-32 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-3">
              <Skeleton className="w-6 h-6 shrink-0" />
              <div className="space-y-1 flex-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function WithdrawalFlow({ meta = 175000 }) {
  const { t } = useTranslation()
  const { userRate, cetesRate } = useEtherfuseRate()
  const [fase, setFase] = useState('verificando')
  const [saldoMxn, setSaldoMxn] = useState(0)
  const [depositCount, setDepositCount] = useState(0)
  const [errorMsg, setErrorMsg] = useState(null)

  const verificarEstado = useCallback(async () => {
    setFase('verificando')
    setErrorMsg(null)
    try {
      const usuario = JSON.parse(localStorage.getItem('ms_usuario') || 'null')
      if (!usuario?.id) throw new Error('Sin sesión activa')

      const res = await fetch(`/api/etherfuse/order-status?usuarioId=${usuario.id}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()

      const total = data.ordenes
        ?.filter(o => o.status === 'completed')
        ?.reduce((sum, o) => sum + Number(o.monto_mxn), 0) ?? 0

      setSaldoMxn(total)
      setDepositCount(data.ordenes?.filter(o => o.status === 'completed').length ?? 0)
      setFase(total >= meta ? 'alcanzada' : 'no_alcanzada')
    } catch (err) {
      setErrorMsg(err.message ?? 'No se pudo cargar tu saldo')
      setFase('error')
    }
  }, [meta])

  useEffect(() => { verificarEstado() }, [verificarEstado])

  if (fase === 'verificando') return <WithdrawalSkeleton />

  const falta = Math.max(0, meta - saldoMxn)
  const progresoPct = Math.min((saldoMxn / meta) * 100, 100)
  const apy = userRate > 0 ? userRate.toFixed(1) : '—'

  const pasos = [
    { Icon: Building2, step: 'Depositas desde tu banco', desc: 'Desde $40 MXN vía SPEI, cuando quieras' },
    { Icon: LockKeyhole, step: 'Etherfuse guarda tu ahorro', desc: 'Respaldado por CETES del gobierno mexicano' },
    { Icon: TrendingUp, step: 'Etherfuse rinde', desc: `${apy}% APY neto en pesos vía CETES` },
    { Icon: Gift, step: 'Incentivos c/5 años', desc: 'Hasta 9% extra por fidelidad' },
    { Icon: User, step: 'Retiras al llegar', desc: 'Todo a tu cuenta bancaria, sin banco intermediario' },
  ]

  return (
    <div className="flex flex-col gap-4">

      {/* Verificando */}
      {fase === 'verificando' && (
        <div className="bg-white dark:bg-white/5 border border-ink/8 dark:border-white/8 rounded-2xl p-10 text-center">
          <svg aria-hidden="true" className="animate-spin mx-auto mb-4 text-brand" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <p className="font-semibold text-ink dark:text-white mb-1">{t('withdrawal.verificandoTitulo')}</p>
          <p className="text-sm text-ink/45 dark:text-white/45">{t('withdrawal.verificandoDesc')}</p>
        </div>
      )}

      {/* Meta no alcanzada */}
      {fase === 'no_alcanzada' && (
        <div className="flex flex-col gap-4">

          <div className="bg-white dark:bg-white/5 border border-ink/8 dark:border-white/8 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center shrink-0">
                <Hourglass size={20} aria-hidden="true" className="text-yellow-500" />
              </div>
              <div>
                <h4 className="font-semibold text-ink dark:text-white">{t('withdrawal.noAlcanzadaTitulo')}</h4>
                <p className="text-sm text-ink/45 dark:text-white/45">{t('withdrawal.noAlcanzadaDesc')}</p>
              </div>
            </div>

            {/* Barra de progreso */}
            <div className="mb-5">
              <div className="flex justify-between mb-2">
                <span className="text-sm font-semibold text-ink dark:text-white">
                  {t('withdrawal.progresoTitulo')}
                </span>
                <span className="text-sm font-bold text-brand">{progresoPct.toFixed(1)}%</span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={Math.round(progresoPct)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Progreso de ahorro: ${Math.round(progresoPct)}%`}
                className="h-3 bg-ink/5 dark:bg-white/5 rounded-full overflow-hidden mb-2">
                <div className="h-full bg-linear-to-r from-brand-dark to-brand rounded-full transition-all duration-700"
                  style={{ width: `${progresoPct}%` }} />
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-ink/40 dark:text-white/40">
                  {formatCurrencyMxn(saldoMxn)} ahorrados
                </span>
                <span className="text-xs text-ink/40 dark:text-white/40">
                  Meta: {formatCurrencyMxn(meta)}
                </span>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Ahorro actual', val: formatCurrencyMxn(saldoMxn), color: 'text-brand' },
                { label: 'Falta para meta', val: formatCurrencyMxn(falta), color: 'text-red-400' },
                { label: 'Depósitos vía SPEI', val: `${depositCount} completados`, color: 'text-yellow-500' },
                { label: 'Rendimiento APY', val: `${apy}% neto`, color: 'text-green-600' },
              ].map(item => (
                <div key={item.label} className="bg-ink/3 dark:bg-white/3 border border-ink/6 dark:border-white/6 rounded-xl p-3">
                  <p className="text-xs text-ink/40 dark:text-white/40 mb-1">{item.label}</p>
                  <p className={`text-sm font-bold ${item.color}`}>{item.val}</p>
                </div>
              ))}
            </div>
          </div>

          {/* El flujo completo */}
          <div className="bg-white dark:bg-white/5 border border-ink/8 dark:border-white/8 rounded-2xl p-6">
            <h6 className="font-semibold text-ink dark:text-white mb-4">{t('withdrawal.flujoCompleto')}</h6>
            <div className="flex flex-col gap-3">
              {pasos.map((paso, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="shrink-0 mt-0.5"><paso.Icon size={20} aria-hidden="true" className="text-ink/40 dark:text-white/40" /></span>
                  <div>
                    <p className="text-sm font-semibold text-ink dark:text-white">{paso.step}</p>
                    <p className="text-xs text-ink/45 dark:text-white/45">{paso.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Autopréstamo de emergencia */}
          {saldoMxn > 0 && (
            <div className="bg-yellow-400/5 border border-dashed border-yellow-400/30 rounded-2xl p-5">
              <div className="flex items-start gap-3">
                <TriangleAlert size={24} aria-hidden="true" className="text-yellow-500 shrink-0" />
                <div>
                  <p className="font-semibold text-ink dark:text-white mb-1">
                    {t('withdrawal.emergenciaTitulo')}
                  </p>
                  <p className="text-sm text-ink/50 dark:text-white/50 mb-3">
                    Puedes acceder hasta el {MANANA_SEGURO_RATES.loanMaxPct * 100}% de tu ahorro
                    ({formatCurrencyMxn(saldoMxn * MANANA_SEGURO_RATES.loanMaxPct)}) como autopréstamo
                    sin romper tu ahorro.
                  </p>
                  <span className="inline-block bg-yellow-400/15 text-yellow-600 border border-yellow-400/30 rounded-full px-3 py-1.5 text-xs font-semibold">
                    {t('withdrawal.emergenciaLink')}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Meta alcanzada */}
      {fase === 'alcanzada' && (
        <div className="flex flex-col gap-4">
          <div className="bg-green-500/8 border border-green-500/25 rounded-2xl p-8 text-center">
            <div className="mb-3"><PartyPopper size={48} aria-hidden="true" className="inline-block text-yellow-500" /></div>
            <h4 className="font-display font-black text-ink dark:text-white text-2xl mb-2">
              {t('withdrawal.alcanzadaTitulo')}
            </h4>
            <p className="font-black text-green-600 mb-1"
              style={{ fontSize: 'clamp(1.8rem,4vw,2.6rem)', letterSpacing: '-2px' }}>
              {formatCurrencyMxn(saldoMxn)}
            </p>
            <p className="text-sm text-ink/45 dark:text-white/45">
              Tu ahorro está listo para retirarse
            </p>
          </div>

          <div className="bg-white dark:bg-white/5 border border-ink/8 dark:border-white/8 rounded-2xl p-6">
            <h6 className="font-semibold text-ink dark:text-white mb-4">{t('withdrawal.resumenTitulo')}</h6>
            <div className="flex flex-col gap-0 mb-5">
              {[
                { label: 'Ahorro total', val: formatCurrencyMxn(saldoMxn), color: 'text-green-600' },
                { label: 'Tasa CETES bruta', val: `${cetesRate > 0 ? cetesRate.toFixed(2) : '—'}%`, color: 'text-ink/50 dark:text-white/50' },
                { label: 'Rendimiento neto', val: `${apy}% APY`, color: 'text-green-600' },
                { label: 'Comisión plataforma', val: `${formatCurrencyMxn(saldoMxn * 0.01)}`, color: 'text-red-400' },
              ].map(item => (
                <div key={item.label} className="flex justify-between py-2.5 border-b border-ink/5 dark:border-white/5 last:border-0">
                  <span className="text-xs text-ink/45 dark:text-white/45">{item.label}</span>
                  <span className={`text-xs font-semibold ${item.color}`}>{item.val}</span>
                </div>
              ))}
            </div>

            <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-4 mb-5">
              <p className="text-xs text-blue-600/80 dark:text-blue-400/80 leading-relaxed">
                {t('withdrawal.resumenAviso')}
              </p>
            </div>

            {/* Retiro próximamente */}
            <div className="bg-ink/3 dark:bg-white/3 border border-ink/8 dark:border-white/8 rounded-xl p-4 text-center">
              <p className="text-sm font-semibold text-ink dark:text-white mb-1">Retiro disponible próximamente</p>
              <p className="text-xs text-ink/45 dark:text-white/45">
                Estamos habilitando la función de retiro vía SPEI. Te notificaremos cuando esté lista.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {fase === 'error' && (
        <div className="bg-white dark:bg-white/5 border border-ink/8 dark:border-white/8 rounded-2xl p-8">
          <div className="text-center mb-5">
            <div className="mb-3"><TriangleAlert size={36} aria-hidden="true" className="inline-block text-red-500" /></div>
            <p className="font-semibold text-ink dark:text-white mb-1">{t('withdrawal.errorTitulo')}</p>
            <p className="text-sm text-ink/45 dark:text-white/45">{errorMsg}</p>
          </div>
          {errorMsg?.includes('sesión') ? (
            <button
              className="w-full bg-brand text-white font-semibold py-3 rounded-xl cursor-pointer"
              onClick={() => window.location.href = '/login'}>
              Iniciar sesión
            </button>
          ) : (
            <button
              className="w-full border border-ink/15 dark:border-white/15 text-ink dark:text-white font-semibold py-3 rounded-xl hover:bg-ink/5 dark:hover:bg-white/5 transition-all cursor-pointer"
              onClick={verificarEstado}>
              {t('withdrawal.errorReintentar')}
            </button>
          )}
        </div>
      )}

    </div>
  )
}