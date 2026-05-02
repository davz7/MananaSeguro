import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getBalances, verFechaRetiro, verBalanceContrato, verMeta, verDepositos } from '../../../lib/stellar'
import freighterApi from '@stellar/freighter-api'
import { useEtherfuseRate } from '../../../hooks/useEtherfuseRate'
import { MANANA_SEGURO_RATES } from '../../../data/retirementContent'
import { calculateCycles } from '../../../utils/projections'
import { formatCurrencyUsd } from '../../../utils/formatters'
import { AutoloanCard } from './AutoloanCard'
import { ContributionHistory } from './ContributionHistory'
import { ReferralModule } from '../../referrals/components/ReferralModule'
import { CarlosSimulator } from '../../simulator/components/CarlosSimulator'
import { RateBadge } from '../../../components/common/RateBadge'

export function RetirementSnapshot() {
  const { t } = useTranslation()
  const [balances, setBalances] = useState(null)
  const [address, setAddress] = useState(null)
  const [fechaRetiro, setFechaRetiro] = useState(null)
  const [lockedBalance, setLockedBalance] = useState(0)
  const [meta, setMeta] = useState(10000)
  const [depositCount, setDepositCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('resumen')

  const { cetesRate, userRate, platformRate } = useEtherfuseRate()

  const tabs = [
    { key: 'resumen', label: t('snapshot.tabs.resumen') },
    { key: 'historial', label: t('snapshot.tabs.historial') },
    { key: 'ciclos', label: t('snapshot.tabs.ciclos') },
    { key: 'prestamo', label: t('snapshot.tabs.prestamo') },
    { key: 'referidos', label: t('snapshot.tabs.referidos') },
    { key: 'carlos', label: t('snapshot.tabs.carlos') },
    { key: 'ingresos', label: t('snapshot.tabs.ingresos') },
  ]

  function handleTabKeyDown(e, currentIndex) {
    let newIndex = currentIndex
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault(); newIndex = (currentIndex + 1) % tabs.length
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault(); newIndex = (currentIndex - 1 + tabs.length) % tabs.length
    } else if (e.key === 'Home') {
      e.preventDefault(); newIndex = 0
    } else if (e.key === 'End') {
      e.preventDefault(); newIndex = tabs.length - 1
    } else return
    setActiveTab(tabs[newIndex].key)
    setTimeout(() => { document.getElementById(`tab-${tabs[newIndex].key}`)?.focus() }, 0)
  }

  useEffect(() => {
    async function cargarDatos() {
      try {
        const { address } = await freighterApi.getAddress()
        if (!address) throw new Error('Wallet no conectada')
        setAddress(address)
        const data = await getBalances(address)
        const xlm = data.find(b => b.asset_type === 'native')
        const usdc = data.find(b => b.asset_code === 'USDC')
        setBalances({
          xlm: xlm ? parseFloat(xlm.balance).toFixed(2) : '0.00',
          usdc: usdc ? parseFloat(usdc.balance).toFixed(2) : '0.00',
        })
        try { setFechaRetiro(await verFechaRetiro(address)) }
        catch { setFechaRetiro('Pendiente de primer depósito') }
        try { setLockedBalance(Number(await verBalanceContrato(address))) }
        catch { /* saldo en 0 */ }
        try { const m = await verMeta(address); if (m > 0) setMeta(Number(m)) }
        catch { /* meta default */ }
        try { setDepositCount(Number(await verDepositos(address))) }
        catch { /* 0 depósitos */ }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    cargarDatos()
  }, [])

  const usdcLibre = balances ? parseFloat(balances.usdc) : 0
  const proyeccion20 = (lockedBalance * Math.pow(1 + userRate / 100, 20)).toFixed(2)
  const cycles = calculateCycles(25, 20, userRate, 9)
  const skeletonLabels = t('snapshot.skeletonLabels', { returnObjects: true })

  return (
    <div className="flex flex-col gap-4">

      {/* ── Header ── */}
      <div>
        <div className="flex items-center gap-3 flex-wrap mb-2">
          <span className="inline-block bg-brand/10 text-brand-dark border border-brand/20 rounded-lg px-3 py-1.5 text-xs font-semibold">
            {t('snapshot.badge')}
          </span>
          {address && (
            <span className="text-xs text-ink/40 dark:text-white/40 font-mono">
              {address.slice(0, 8)}...{address.slice(-8)}
            </span>
          )}
        </div>
        <h2 className="font-display font-black text-ink dark:text-white tracking-tight mb-2"
          style={{ fontSize: 'clamp(1.8rem,4vw,2.4rem)' }}>
          {t('snapshot.titulo')}
        </h2>
        <RateBadge compact />
      </div>

      {/* ── Skeleton ── */}
      {loading && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3"
          aria-busy="true" aria-label="Cargando datos del dashboard">
          {skeletonLabels.map(label => (
            <div key={label} className="bg-ink/4 dark:bg-white/4 border border-ink/6 dark:border-white/6 rounded-2xl p-4 h-28">
              <div className="text-transparent text-xs select-none mb-3">{label}</div>
              <div className="skeleton-pulse h-6 w-3/4 mb-2 rounded" />
              <div className="skeleton-pulse h-3 w-full rounded" />
            </div>
          ))}
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="bg-ink/5 dark:bg-white/5 border border-brand/20 rounded-2xl p-5">
          {error.includes('Freighter') || error.includes('not installed') ? (
            <div>
              <p className="font-semibold text-ink dark:text-white mb-1">{t('snapshot.errorFreighter')}</p>
              <p className="text-sm text-ink/50 dark:text-white/50 mb-3">{t('snapshot.errorFreighterDesc')}</p>
              <a href="https://freighter.app/" target="_blank" rel="noopener noreferrer"
                className="text-sm text-brand font-semibold hover:text-brand-dark transition-colors">
                {t('snapshot.errorFreighterLink')}
              </a>
            </div>
          ) : error.includes('connected') || error.includes('conectada') ? (
            <div>
              <p className="font-semibold text-ink dark:text-white mb-1">{t('snapshot.errorWallet')}</p>
              <p className="text-sm text-ink/50 dark:text-white/50 mb-3">{t('snapshot.errorWalletDesc')}</p>
              <button
                className="bg-brand hover:bg-brand-dark text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all cursor-pointer"
                onClick={() => window.location.reload()}>
                {t('snapshot.errorWalletBtn')}
              </button>
            </div>
          ) : (
            <div>
              <p className="font-semibold text-ink dark:text-white mb-1">⚠️ {error}</p>
              <p className="text-sm text-ink/50 dark:text-white/50">{t('snapshot.errorGenerico')}</p>
            </div>
          )}
        </div>
      )}

      {balances && (
        <>
          {/* ── Stat cards ── */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            {[
              {
                label: t('snapshot.statUsdcWallet'),
                val: `$${usdcLibre.toFixed(2)}`,
                sub: t('snapshot.statUsdcWalletSub'),
                color: 'text-brand',
              },
              {
                label: t('snapshot.statUsdcBloqueado'),
                val: formatCurrencyUsd(lockedBalance),
                sub: depositCount !== 1
                  ? t('snapshot.statUsdcBloqueadoSubPlural', { n: depositCount })
                  : t('snapshot.statUsdcBloqueadoSub', { n: depositCount }),
                color: 'text-green-600',
              },
              {
                label: t('snapshot.statProyeccion'),
                val: formatCurrencyUsd(Number(proyeccion20)),
                sub: t('snapshot.statProyeccionSub', { apy: userRate.toFixed(2) }),
                color: 'text-yellow-500',
              },
              {
                label: t('snapshot.statFecha'),
                val: fechaRetiro ?? '—',
                sub: t('snapshot.statFechaSub'),
                color: 'text-ink/60 dark:text-white/60',
              },
            ].map(stat => (
              <div key={stat.label} className="bg-white dark:bg-white/5 border border-ink/8 dark:border-white/8 rounded-2xl p-4">
                <p className="text-xs text-ink/40 dark:text-white/40 mb-2">{stat.label}</p>
                <p className={`text-base font-bold mb-1 ${stat.color}`}>{stat.val}</p>
                <p className="text-xs text-ink/35 dark:text-white/35">{stat.sub}</p>
              </div>
            ))}
          </div>

          {/* ── Progreso ── */}
          <div className="bg-white dark:bg-white/5 border border-ink/8 dark:border-white/8 rounded-2xl p-5">
            <div className="flex justify-between items-center mb-3">
              <span className="font-semibold text-ink dark:text-white text-sm">{t('snapshot.progresoTitulo')}</span>
              <span className="text-xs text-ink/40 dark:text-white/40">{t('snapshot.progresoMeta', { val: formatCurrencyUsd(meta) })}</span>
            </div>
            <div className="h-2 bg-ink/5 dark:bg-white/5 rounded-full mb-2 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-brand-dark to-brand rounded-full transition-all duration-700"
                style={{ width: `${Math.min((lockedBalance / meta) * 100, 100)}%` }} />
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-ink/40 dark:text-white/40">
                {t('snapshot.progresoBloqueados', { val: formatCurrencyUsd(lockedBalance) })}
              </span>
              <span className="text-xs text-brand font-semibold">
                {((lockedBalance / meta) * 100).toFixed(1)}%
              </span>
            </div>
          </div>

          {/* ── Tab bar ── */}
          <div className="relative">
            <div className="absolute top-0 right-0 w-12 h-full bg-gradient-to-r from-transparent to-surface dark:to-[#0f0e0d] pointer-events-none z-10" />
            <div role="tablist" aria-label="Dashboard sections"
              className="flex gap-2 overflow-x-auto pb-1 tab-scroll">
              {tabs.map((tab, index) => (
                <button
                  key={tab.key}
                  id={`tab-${tab.key}`}
                  role="tab"
                  aria-selected={activeTab === tab.key}
                  aria-controls={`panel-${tab.key}`}
                  tabIndex={activeTab === tab.key ? 0 : -1}
                  className={`shrink-0 text-xs font-semibold px-4 py-2 rounded-xl border transition-all cursor-pointer whitespace-nowrap ${activeTab === tab.key
                    ? 'bg-brand/10 border-brand/30 text-brand'
                    : 'bg-transparent border-ink/10 dark:border-white/10 text-ink/40 dark:text-white/40 hover:text-ink/70 dark:hover:text-white/70 hover:border-ink/20 dark:hover:border-white/20'
                    }`}
                  onClick={() => setActiveTab(tab.key)}
                  onKeyDown={e => handleTabKeyDown(e, index)}>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Panel: Resumen ── */}
          {activeTab === 'resumen' && (
            <div id="panel-resumen" role="tabpanel" aria-labelledby="tab-resumen" className="flex flex-col gap-4">
              <RateBadge />
              <div className="bg-white dark:bg-white/5 border border-ink/8 dark:border-white/8 rounded-2xl p-5">
                <h6 className="font-semibold text-ink dark:text-white mb-4">{t('snapshot.resumenTitulo')}</h6>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: t('snapshot.resumenRed'), val: 'Stellar Testnet' },
                    { label: t('snapshot.resumenProveedor'), val: 'Etherfuse CETES' },
                    { label: t('snapshot.resumenTasaBruta'), val: `${cetesRate.toFixed(2)}% APY` },
                    { label: t('snapshot.resumenTasaUsuario'), val: `${userRate.toFixed(2)}% APY` },
                    { label: t('snapshot.resumenComision'), val: `${platformRate.toFixed(2)}% APY` },
                    { label: t('snapshot.resumenMinDeposito'), val: `$${MANANA_SEGURO_RATES.minDeposit} USDC` },
                    { label: t('snapshot.resumenPrestamo'), val: t('snapshot.resumenPrestamoVal', { pct: MANANA_SEGURO_RATES.loanMaxPct * 100 }) },
                    { label: t('snapshot.resumenIncentivo'), val: t('snapshot.resumenIncentivoVal') },
                  ].map(item => (
                    <div key={item.label}>
                      <p className="text-xs text-ink/40 dark:text-white/40 mb-0.5">{item.label}</p>
                      <p className="text-sm font-semibold text-ink dark:text-white">{item.val}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Panel: Historial ── */}
          {activeTab === 'historial' && (
            <div id="panel-historial" role="tabpanel" aria-labelledby="tab-historial">
              <ContributionHistory walletAddress={address} lockedBalance={lockedBalance} depositCount={depositCount} />
            </div>
          )}

          {/* ── Panel: Ciclos ── */}
          {activeTab === 'ciclos' && (
            <div id="panel-ciclos" role="tabpanel" aria-labelledby="tab-ciclos"
              className="bg-white dark:bg-white/5 border border-ink/8 dark:border-white/8 rounded-2xl p-5">
              <div className="flex justify-between items-center mb-4">
                <h6 className="font-semibold text-ink dark:text-white">{t('snapshot.ciclosTitulo')}</h6>
                <span className="text-xs bg-yellow-400/10 text-yellow-600 border border-yellow-400/20 rounded-full px-3 py-1 font-semibold">
                  {t('snapshot.ciclosIncentivo')}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-ink/40 dark:text-white/40 text-xs border-b border-ink/6 dark:border-white/6">
                      <th className="text-left pb-2 font-medium">{t('snapshot.ciclosColCiclo')}</th>
                      <th className="text-left pb-2 font-medium">{t('snapshot.ciclosColAnios')}</th>
                      <th className="text-left pb-2 font-medium">{t('snapshot.ciclosColSaldo')}</th>
                      <th className="text-left pb-2 font-medium">{t('snapshot.ciclosColRendimiento')}</th>
                      <th className="text-left pb-2 font-medium text-yellow-600">{t('snapshot.ciclosColIncentivo')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cycles.map(c => (
                      <tr key={c.cycle} className="border-b border-ink/4 dark:border-white/4">
                        <td className="py-2.5 font-semibold text-ink dark:text-white">{c.cycle}</td>
                        <td className="py-2.5 text-ink/40 dark:text-white/40">{c.yearStart}–{c.yearEnd}</td>
                        <td className="py-2.5 text-brand font-semibold">{formatCurrencyUsd(c.endBalance)}</td>
                        <td className="py-2.5 text-green-600 font-semibold">{formatCurrencyUsd(c.totalYield)}</td>
                        <td className="py-2.5 text-yellow-600 font-semibold">+{formatCurrencyUsd(c.incentiveAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-ink/10 dark:border-white/10">
                      <td colSpan={4} className="pt-3 font-semibold text-ink dark:text-white">
                        {t('snapshot.ciclosTotalIncentivos')}
                      </td>
                      <td className="pt-3 font-bold text-yellow-600">
                        {formatCurrencyUsd(cycles.reduce((s, c) => s + c.incentiveAmount, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ── Panel: Préstamo ── */}
          {activeTab === 'prestamo' && (
            <div id="panel-prestamo" role="tabpanel" aria-labelledby="tab-prestamo">
              <AutoloanCard lockedBalance={lockedBalance} walletAddress={address} />
            </div>
          )}

          {/* ── Panel: Referidos ── */}
          {activeTab === 'referidos' && (
            <div id="panel-referidos" role="tabpanel" aria-labelledby="tab-referidos">
              <ReferralModule userName={address?.slice(0, 8) ?? 'usuario'} walletAddress={address} />
            </div>
          )}

          {/* ── Panel: Carlos ── */}
          {activeTab === 'carlos' && (
            <div id="panel-carlos" role="tabpanel" aria-labelledby="tab-carlos">
              <CarlosSimulator />
            </div>
          )}

          {/* ── Panel: Ingresos ── */}
          {activeTab === 'ingresos' && (
            <div id="panel-ingresos" role="tabpanel" aria-labelledby="tab-ingresos"
              className="bg-white dark:bg-white/5 border border-ink/8 dark:border-white/8 rounded-2xl p-5">
              <h6 className="font-semibold text-ink dark:text-white mb-4">{t('snapshot.ingresosDistribucion')}</h6>
              <div className="mb-6">
                <div className="h-7 bg-ink/5 dark:bg-white/5 rounded-full overflow-hidden flex mb-2">
                  <div className="h-full bg-gradient-to-r from-brand-dark to-green-500 flex items-center justify-center text-white text-xs font-bold transition-all"
                    style={{ width: `${(userRate / cetesRate) * 100}%` }}>
                    {t('snapshot.ingresosAlUsuario', { rate: userRate.toFixed(2) })}
                  </div>
                  <div className="h-full bg-brand flex items-center justify-center text-white text-xs font-bold transition-all"
                    style={{ width: `${(platformRate / cetesRate) * 100}%` }}>
                    {platformRate.toFixed(2)}%
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-green-600 font-medium">
                    {t('snapshot.ingresosAlUsuario', { rate: userRate.toFixed(2) })}
                  </span>
                  <span className="text-xs text-brand font-medium">
                    {t('snapshot.ingresosPlatforma', { rate: platformRate.toFixed(2) })}
                  </span>
                </div>
              </div>
              <h6 className="font-semibold text-ink dark:text-white mb-3">{t('snapshot.ingresosProyeccion')}</h6>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-ink/40 dark:text-white/40 text-xs border-b border-ink/6 dark:border-white/6">
                      <th className="text-left pb-2 font-medium">{t('snapshot.ingresosColUsuarios')}</th>
                      <th className="text-left pb-2 font-medium">{t('snapshot.ingresosColActivos')}</th>
                      <th className="text-left pb-2 font-medium">{t('snapshot.ingresosColIngreso')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['200', '$100K USDC', '$1,000'],
                      ['1,000', '$500K USDC', '$5,000'],
                      ['10,000', '$5M USDC', '$50,000'],
                      ['50,000', '$25M USDC', '$250,000'],
                    ].map(([u, a, i]) => (
                      <tr key={u} className="border-b border-ink/4 dark:border-white/4">
                        <td className="py-2.5 font-semibold text-ink dark:text-white">{u}</td>
                        <td className="py-2.5 text-ink/40 dark:text-white/40">{a}</td>
                        <td className="py-2.5 text-green-600 font-semibold">{i} USDC</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}