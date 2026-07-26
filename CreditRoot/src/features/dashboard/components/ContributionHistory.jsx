// src/features/dashboard/components/ContributionHistory.jsx
// 
// Historial de aportaciones , lee órdenes reales de Supabase
// Ya no usa Stellar/Soroban ni localStorage

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { TriangleAlert, Inbox, Check, Hourglass, Clock } from 'lucide-react'
import { formatCurrencyMxn } from '../../../utils/formatters'

export function ContributionHistory() {
  const { t } = useTranslation()
  const [ordenes, setOrdenes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function cargarOrdenes() {
      try {
        const usuario = JSON.parse(localStorage.getItem('ms_usuario') || 'null')
        if (!usuario?.id) return

        const res = await fetch(`/api/etherfuse/order-status?usuarioId=${usuario.id}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        setOrdenes(data.ordenes ?? [])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    cargarOrdenes()
  }, [])

  const completadas = ordenes.filter(o => o.status === 'completed')
  const totalMxn = completadas.reduce((s, o) => s + Number(o.monto_mxn), 0)
  const rendimientoProyectado = totalMxn * 0.0459 // userRate ~4.59%

  return (
    <div className="flex flex-col gap-4">

      {/* Resumen */}
      <div className="bg-white dark:bg-white/5 border border-ink/8 dark:border-white/8 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <h5 className="font-display font-black text-ink dark:text-white text-lg">
            {t('history.titulo')}
          </h5>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-green-500/10 text-green-500 border border-green-500/20">
            {t('history.badgeEtherfuse')}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              label: t('history.saldoBloqueado'),
              val: formatCurrencyMxn(totalMxn),
              color: 'text-green-500',
              sub: t('history.saldoBloqueadoSub'),
            },
            {
              label: t('history.totalDepositos'),
              val: completadas.length !== 1
                ? t('history.totalDepositosValPlural', { n: completadas.length })
                : t('history.totalDepositosVal', { n: completadas.length }),
              color: 'text-yellow-500',
              sub: t('history.viaSpeiEtherfuse'),
            },
            {
              label: t('history.rendimientoProyectado'),
              val: formatCurrencyMxn(rendimientoProyectado),
              color: 'text-yellow-400',
              sub: t('history.rendimientoSub', { apy: '4.59' }),
            },
          ].map(item => (
            <div key={item.label} className="bg-ink/3 dark:bg-white/3 border border-ink/6 dark:border-white/6 rounded-xl p-3">
              <p className="text-xs text-ink/40 dark:text-white/40 mb-1">{item.label}</p>
              <p className={`text-sm font-bold ${item.color}`}>{item.val}</p>
              <p className="text-xs text-ink/30 dark:text-white/30 mt-1">{item.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Lista de órdenes */}
      <div className="bg-white dark:bg-white/5 border border-ink/8 dark:border-white/8 rounded-2xl p-6">
        <div className="mb-5">
          <h5 className="font-display font-black text-ink dark:text-white text-lg mb-1">
            {t('history.movimientos')}
          </h5>
          <p className="text-xs text-ink/40 dark:text-white/40">
            {t('history.movimientosDesc')}
          </p>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-10 gap-2 text-ink/40 dark:text-white/40">
            <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            <span className="text-sm">{t('history.cargando')}</span>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-sm text-red-500">
            <TriangleAlert size={16} className="inline shrink-0" aria-hidden="true" /> {error}
          </div>
        )}

        {!loading && !error && ordenes.length === 0 && (
          <div className="text-center py-10 bg-ink/2 dark:bg-white/2 border border-dashed border-ink/8 dark:border-white/8 rounded-xl">
            <div className="mb-3"><Inbox size={36} aria-hidden="true" className="inline-block text-ink/30 dark:text-white/30" /></div>
            <p className="text-sm text-ink/40 dark:text-white/40">{t('history.vacio')}</p>
            <p className="text-xs text-ink/30 dark:text-white/30 mt-1">{t('history.vacioSub')}</p>
          </div>
        )}

        {!loading && ordenes.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-ink/40 dark:text-white/40 border-b border-ink/6 dark:border-white/6">
                  <th className="text-left pb-2 font-medium">{t('history.colFecha')}</th>
                  <th className="text-left pb-2 font-medium">{t('history.colMonto')}</th>
                  <th className="text-left pb-2 font-medium">{t('history.colClabe')}</th>
                  <th className="text-left pb-2 font-medium">{t('history.colEstado')}</th>
                </tr>
              </thead>
              <tbody>
                {ordenes.map(orden => (
                  <tr key={orden.order_id} className="border-b border-ink/4 dark:border-white/4 last:border-0">
                    <td className="py-2.5 text-xs text-ink/40 dark:text-white/40">
                      {new Date(orden.created_at).toLocaleDateString('es-MX', {
                        day: '2-digit', month: 'short', year: 'numeric'
                      })}
                    </td>
                    <td className="py-2.5 font-bold text-yellow-500">
                      +{formatCurrencyMxn(Number(orden.monto_mxn))}
                    </td>
                    <td className="py-2.5 text-xs font-mono text-ink/40 dark:text-white/40">
                      {orden.deposit_clabe
                        ? `${orden.deposit_clabe.slice(0, 6)}...${orden.deposit_clabe.slice(-4)}`
                        : '—'}
                    </td>
                    <td className="py-2.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${
                        orden.status === 'completed'
                          ? 'bg-green-500/10 text-green-500 border-green-500/20'
                          : orden.status === 'funded'
                          ? 'bg-yellow-400/10 text-yellow-500 border-yellow-400/20'
                          : 'bg-ink/5 text-ink/40 border-ink/10'
                      }`}>
                      {orden.status === 'completed' ? <><Check size={12} aria-hidden="true" className="inline mr-0.5" />{t('history.estadoCompletado')}</>
                        : orden.status === 'funded' ? <><Hourglass size={12} aria-hidden="true" className="inline mr-0.5" />{t('history.estadoProcesando')}</>
                        : <><Clock size={12} aria-hidden="true" className="inline mr-0.5" />{t('history.estadoPendienteReloj')}</>}
                      </span>
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