import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { MANANA_SEGURO_RATES } from '../../../data/retirementContent'
import { formatCurrencyUsd } from '../../../utils/formatters'
import { loadHistory, saveHistory } from './contributionHistoryUtils'

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
  const { t } = useTranslation()
  const [history, setHistory] = useState(() => loadHistory(walletAddress))

  useEffect(() => {
    setHistory(loadHistory(walletAddress))
  }, [walletAddress])

  useEffect(() => {
    saveHistory(walletAddress, history)
  }, [history, walletAddress])

  const localDepositCount = history.filter(e => e.type === 'deposito').length
  const hasNewOnChain = depositCount > localDepositCount

  return (
    <div className="flex flex-col gap-4">

      {/* ── Resumen real del contrato ── */}
      <div className="bg-white dark:bg-white/5 border border-ink/8 dark:border-white/8 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <h5 className="font-display font-black text-ink dark:text-white text-lg mb-0">
            {t('history.titulo')}
          </h5>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-green-500/10 text-green-500 border border-green-500/20">
            {t('history.onchain')}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              label: t('history.usdcBloqueado'),
              val: formatCurrencyUsd(lockedBalance),
              color: 'text-green-500',
              sub: t('history.usdcSub'),
            },
            {
              label: t('history.totalDepositos'),
              val: depositCount !== 1
                ? t('history.totalDepositosValPlural', { n: depositCount })
                : t('history.totalDepositosVal', { n: depositCount }),
              color: 'text-yellow-500',
              sub: t('history.totalDepositosSub'),
            },
            {
              label: t('history.rendimientoProyectado'),
              val: formatCurrencyUsd(lockedBalance * (MANANA_SEGURO_RATES.userRate / 100)),
              color: 'text-yellow-400',
              sub: t('history.rendimientoSub', { apy: MANANA_SEGURO_RATES.userRate }),
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

      {/* ── Aviso on-chain ── */}
      {hasNewOnChain && (
        <div className="bg-blue-500/5 border border-dashed border-blue-500/25 rounded-xl p-4">
          <p className="text-xs text-blue-300">
            {depositCount !== 1
              ? t('history.avisoOnchainPlural', { onchain: depositCount, local: localDepositCount })
              : t('history.avisoOnchain', { onchain: depositCount, local: localDepositCount })}
          </p>
        </div>
      )}

      {/* ── Lista local de movimientos ── */}
      <div className="bg-white dark:bg-white/5 border border-ink/8 dark:border-white/8 rounded-2xl p-6">
        <div className="mb-5">
          <h5 className="font-display font-black text-ink dark:text-white text-lg mb-1">
            {t('history.movimientos')}
          </h5>
          <p className="text-xs text-ink/40 dark:text-white/40">
            {t('history.movimientosSub')}{' '}
            <strong className="text-yellow-500">{t('history.movimientosSeccion')}</strong>
          </p>
        </div>

        {history.length === 0 ? (
          <div className="text-center py-10 bg-ink/2 dark:bg-white/2 border border-dashed border-ink/8 dark:border-white/8 rounded-xl">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-sm text-ink/40 dark:text-white/40">{t('history.vacio')}</p>
            <p className="text-xs text-ink/30 dark:text-white/30 mt-1">{t('history.vacioSub')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-ink/40 dark:text-white/40 border-b border-ink/6 dark:border-white/6">
                  <th className="text-left pb-2 font-medium">{t('history.colFecha')}</th>
                  <th className="text-left pb-2 font-medium">{t('history.colTipo')}</th>
                  <th className="text-left pb-2 font-medium">{t('history.colMonto')}</th>
                  <th className="text-left pb-2 font-medium">{t('history.colRendimiento')}</th>
                  <th className="text-left pb-2 font-medium">{t('history.colSaldo')}</th>
                  <th className="text-left pb-2 font-medium">{t('history.colEstado')}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => (
                  <tr key={entry.id} className="border-b border-ink/4 dark:border-white/4 last:border-0">
                    <td className="py-2.5 text-xs text-ink/40 dark:text-white/40">{entry.date}</td>
                    <td className="py-2.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${entry.type === 'deposito'
                          ? 'bg-yellow-400/10 text-yellow-500 border-yellow-400/20'
                          : 'bg-green-500/10 text-green-500 border-green-500/20'
                        }`}>
                        {entry.type === 'deposito' ? t('history.tipoDeposito') : t('history.tipoRendimiento')}
                      </span>
                    </td>
                    <td className="py-2.5 font-bold text-yellow-500">
                      +{formatCurrencyUsd(entry.amount)}
                    </td>
                    <td className="py-2.5 text-green-500 font-medium">
                      +{formatCurrencyUsd(entry.yieldAccrued)}
                    </td>
                    <td className="py-2.5 font-bold text-ink dark:text-white">
                      {formatCurrencyUsd(entry.balanceAfter)}
                    </td>
                    <td className="py-2.5">
                      {entry.txHash ? (
                        <a href={`https://stellar.expert/explorer/testnet/tx/${entry.txHash}`}
                          target="_blank" rel="noopener noreferrer"
                          className="text-xs text-yellow-500 hover:underline">
                          {t('history.verTx')}
                        </a>
                      ) : (
                        <span className={`text-xs font-medium ${entry.confirmed ? 'text-green-500' : 'text-yellow-500'}`}>
                          {entry.confirmed ? t('history.confirmado') : t('history.pendiente')}
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