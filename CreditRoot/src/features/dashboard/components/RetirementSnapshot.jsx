import { useEffect, useState } from 'react'
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
  const [balances, setBalances] = useState(null)
  const [address, setAddress] = useState(null)
  const [fechaRetiro, setFechaRetiro] = useState(null)
  // ─── Datos reales del contrato Soroban ───────────────────────────────────────
  const [lockedBalance, setLockedBalance] = useState(0)   // saldo real bloqueado en contrato
  const [meta, setMeta] = useState(10000)                  // meta real del contrato
  const [depositCount, setDepositCount] = useState(0)      // depósitos reales on-chain
  // ────────────────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('resumen')

  const { cetesRate, userRate, platformRate, isLive } = useEtherfuseRate()

  // Keyboard navigation for tabs
  const handleTabKeyDown = (e, currentIndex) => {
    let newIndex = currentIndex
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      newIndex = (currentIndex + 1) % tabs.length
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      newIndex = (currentIndex - 1 + tabs.length) % tabs.length
    } else if (e.key === 'Home') {
      e.preventDefault()
      newIndex = 0
    } else if (e.key === 'End') {
      e.preventDefault()
      newIndex = tabs.length - 1
    } else {
      return
    }
    setActiveTab(tabs[newIndex].key)
    // Focus the new tab after state update
    setTimeout(() => {
      const newTab = document.getElementById(`tab-${tabs[newIndex].key}`)
      if (newTab) newTab.focus()
    }, 0)
  }

  useEffect(() => {
    async function cargarDatos() {
      try {
        const { address } = await freighterApi.getAddress()
        if (!address) throw new Error('Wallet no conectada')
        setAddress(address)

        // Balances de la wallet (XLM + USDC libre)
        const data = await getBalances(address)
        const xlm = data.find(b => b.asset_type === 'native')
        const usdc = data.find(b => b.asset_code === 'USDC')
        setBalances({
          xlm: xlm ? parseFloat(xlm.balance).toFixed(2) : '0.00',
          usdc: usdc ? parseFloat(usdc.balance).toFixed(2) : '0.00',
        })

        // Fecha de retiro del contrato
        try {
          const fecha = await verFechaRetiro(address)
          setFechaRetiro(fecha)
        } catch { setFechaRetiro('Pendiente de primer depósito') }

        // ── Datos reales del contrato Soroban ────────────────────────────────
        try {
          const saldoReal = await verBalanceContrato(address)
          setLockedBalance(Number(saldoReal))
        } catch { /* si no hay depósito aún, queda en 0 */ }

        try {
          const metaReal = await verMeta(address)
          if (metaReal > 0) setMeta(Number(metaReal))
        } catch { /* meta default 10000 */ }

        try {
          const depositos = await verDepositos(address)
          setDepositCount(Number(depositos))
        } catch { /* 0 depósitos */ }
        // ────────────────────────────────────────────────────────────────────

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
  const cardStyle = { backgroundColor: '#0c0c0c', border: '1px solid rgba(255,255,255,0.06)' }

  const tabs = [
    { key: 'resumen', label: '📊 Resumen' },
    { key: 'historial', label: '📋 Historial' },
    { key: 'ciclos', label: '🔄 Ciclos' },
    { key: 'prestamo', label: '🚨 Autopréstamo' },
    { key: 'referidos', label: '👥 Referidos' },
    { key: 'carlos', label: '🛵 Simulación' },
    { key: 'ingresos', label: '💰 Distribución' },
  ]

  return (
    <div style={{ backgroundColor: '#050505', color: '#fff', fontFamily: "'Inter', sans-serif" }}>
      <div className="mb-4">
        <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
          <div className="badge rounded-pill px-3 py-2"
            style={{ backgroundColor: 'rgba(59,130,246,0.1)', color: '#f59e0b', border: '1px solid rgba(59,130,246,0.2)' }}>
            📊 Mañana Seguro
          </div>
          {address && <span className="text-white-50 small font-monospace">{address.slice(0, 8)}...{address.slice(-8)}</span>}
        </div>
        <h2 className="fw-bold mb-2" style={{ letterSpacing: '-2px' }}>Dashboard de ahorro</h2>
        <RateBadge compact />
      </div>

      {loading && (
        <div className="text-center py-5">
          <div className="spinner-border text-primary mb-3" role="status" />
          <p className="text-white-50 small">Cargando datos desde Stellar testnet...</p>
        </div>
      )}
      {error && (
  <div className="error-container" style={{ backgroundColor: '#1a1a1a', color: '#f59e0b', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
    {error?.includes('Freighter') || error?.includes('not installed') ? (
      <>
        <strong>⚠️ Freighter wallet not detected</strong>
        <p style={{ marginTop: '8px', marginBottom: '8px' }}>To use this app, you need the Freighter wallet extension.</p>
        <a href="https://freighter.app/" target="_blank" rel="noopener noreferrer" style={{ color: '#f59e0b' }}>Install Freighter →</a>
      </>
    ) : error?.includes('connected') ? (
      <>
        <strong>⚠️ Wallet not connected</strong>
        <p style={{ marginTop: '8px', marginBottom: '8px' }}>Please connect your wallet to continue.</p>
        <button className="connect-wallet-btn" style={{ backgroundColor: '#f59e0b', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', color: '#000', fontWeight: 'bold' }}>
          Connect Wallet
        </button>
      </>
    ) : (
      <>
        <strong>⚠️ {error}</strong>
        <p style={{ marginTop: '8px', marginBottom: '8px' }}>Something went wrong. Please try again.</p>
      </>
    )}
  </div>
)}

      {balances && (
        <>
          <div className="row g-3 mb-4">
            {[
              { label: 'USDC en wallet', val: `$${usdcLibre.toFixed(2)}`, sub: 'Balance libre Stellar testnet', color: '#f59e0b' },
              { label: 'USDC bloqueado', val: formatCurrencyUsd(lockedBalance), sub: `${depositCount} depósito${depositCount !== 1 ? 's' : ''} on-chain`, color: '#22c55e' },
              { label: 'Proyección a 20 años', val: formatCurrencyUsd(Number(proyeccion20)), sub: `a ${userRate.toFixed(2)}% APY`, color: '#fbbf24' },
              { label: 'Fecha de retiro', val: fechaRetiro ?? '—', sub: 'Según contrato Soroban', color: 'rgba(255,255,255,0.6)' },
            ].map((stat) => (
              <div className="col-sm-6 col-xl-3" key={stat.label}>
                <div className="p-4 rounded-4 h-100" style={cardStyle}>
                  <div className="small text-white-50 mb-2">{stat.label}</div>
                  <div className="fs-5 fw-bold" style={{ color: stat.color }}>{stat.val}</div>
                  <div className="small text-white-50 mt-1">{stat.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Progreso con datos reales del contrato */}
          <div className="p-4 rounded-4 mb-4" style={cardStyle}>
            <div className="d-flex justify-content-between mb-3">
              <span className="fw-bold">Progreso hacia meta</span>
              <span className="text-white-50 small">Meta: {formatCurrencyUsd(meta)}</span>
            </div>
            <div className="progress rounded-pill mb-2" style={{ height: 8, backgroundColor: 'rgba(255,255,255,0.05)' }}>
              <div className="progress-bar rounded-pill"
                style={{ width: `${Math.min((lockedBalance / meta) * 100, 100)}%`, background: 'linear-gradient(90deg, #d97706, #f59e0b)' }} />
            </div>
            <div className="d-flex justify-content-between">
              <span className="small text-white-50">{formatCurrencyUsd(lockedBalance)} bloqueados en contrato</span>
              <span className="small" style={{ color: '#f59e0b' }}>{((lockedBalance / meta) * 100).toFixed(1)}%</span>
            </div>
          </div>

          <div role="tablist" className="d-flex gap-2 mb-4 pb-1" style={{ overflowX: 'auto', flexWrap: 'nowrap' }} aria-label="Dashboard sections">
            {tabs.map((t, index) => (
              <button key={t.key}
                id={`tab-${t.key}`}
                role="tab"
                aria-selected={activeTab === t.key}
                aria-controls={`panel-${t.key}`}
                tabIndex={activeTab === t.key ? 0 : -1}
                className="btn btn-sm rounded-3 fw-bold flex-shrink-0"
                style={{
                  backgroundColor: activeTab === t.key ? 'rgba(59,130,246,0.15)' : 'transparent',
                  border: activeTab === t.key ? '1px solid rgba(59,130,246,0.4)' : '1px solid rgba(255,255,255,0.08)',
                  color: activeTab === t.key ? '#f59e0b' : 'rgba(255,255,255,0.4)',
                  whiteSpace: 'nowrap',
                }}
                onClick={() => setActiveTab(t.key)}
                onKeyDown={(e) => handleTabKeyDown(e, index)}>
                {t.label}
              </button>
            ))}
          </div>

          {activeTab === 'resumen' && (
            <div id="panel-resumen" role="tabpanel" aria-labelledby="tab-resumen" className="d-flex flex-column gap-4">
              <RateBadge />
              <div className="p-4 rounded-4" style={cardStyle}>
                <h6 className="fw-bold mb-3">Estado del contrato</h6>
                <div className="row g-3">
                  {[
                    { label: 'Red', val: 'Stellar Testnet' },
                    { label: 'Proveedor yield', val: 'Etherfuse CETES' },
                    { label: 'Tasa bruta CETES', val: `${cetesRate.toFixed(2)}% APY` },
                    { label: 'Tasa usuario', val: `${userRate.toFixed(2)}% APY` },
                    { label: 'Comisión plataforma', val: `${platformRate.toFixed(2)}% APY` },
                    { label: 'Mínimo depósito', val: `$${MANANA_SEGURO_RATES.minDeposit} USDC` },
                    { label: 'Autopréstamo máx.', val: `${MANANA_SEGURO_RATES.loanMaxPct * 100}% del saldo` },
                    { label: 'Incentivo máximo', val: '9% cada 5 años' },
                  ].map((item) => (
                    <div className="col-sm-6 col-md-4 col-lg-3" key={item.label}>
                      <div className="small text-white-50">{item.label}</div>
                      <div className="fw-bold small">{item.val}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'historial' && <div id="panel-historial" role="tabpanel" aria-labelledby="tab-historial"><ContributionHistory walletAddress={address} lockedBalance={lockedBalance} depositCount={depositCount} /></div>}

          {activeTab === 'ciclos' && (
            <div id="panel-ciclos" role="tabpanel" aria-labelledby="tab-ciclos" className="p-4 rounded-4" style={cardStyle}>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="fw-bold mb-0">Ciclos cada 5 años · $25 USDC/mes</h6>
                <span className="badge rounded-pill" style={{ backgroundColor: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }}>
                  9% incentivo máx.
                </span>
              </div>
              <div className="table-responsive">
                <table className="table table-dark table-borderless mb-0" style={{ fontSize: 13 }}>
                  <thead>
                    <tr className="text-white-50">
                      <th>Ciclo</th><th>Años</th><th>Saldo fin</th><th>Rendimiento</th><th style={{ color: '#fbbf24' }}>Incentivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cycles.map(c => (
                      <tr key={c.cycle}>
                        <td className="fw-bold">{c.cycle}</td>
                        <td className="text-white-50">{c.yearStart}–{c.yearEnd}</td>
                        <td style={{ color: '#f59e0b' }}>{formatCurrencyUsd(c.endBalance)}</td>
                        <td style={{ color: '#22c55e' }}>{formatCurrencyUsd(c.totalYield)}</td>
                        <td style={{ color: '#fbbf24' }}>+{formatCurrencyUsd(c.incentiveAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                      <td colSpan={4} className="fw-bold">Total incentivos</td>
                      <td className="fw-bold" style={{ color: '#fbbf24' }}>
                        {formatCurrencyUsd(cycles.reduce((s, c) => s + c.incentiveAmount, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* AutoloanCard recibe el saldo REAL del contrato y la dirección */}
          {activeTab === 'prestamo' && <div id="panel-prestamo" role="tabpanel" aria-labelledby="tab-prestamo"><AutoloanCard lockedBalance={lockedBalance} walletAddress={address} /></div>}
          {activeTab === 'referidos' && <div id="panel-referidos" role="tabpanel" aria-labelledby="tab-referidos"><ReferralModule userName={address?.slice(0, 8) ?? 'usuario'} walletAddress={address} /></div>}
          {activeTab === 'carlos' && <div id="panel-carlos" role="tabpanel" aria-labelledby="tab-carlos"><CarlosSimulator /></div>}

          {activeTab === 'ingresos' && (
            <div id="panel-ingresos" role="tabpanel" aria-labelledby="tab-ingresos" className="p-4 rounded-4" style={cardStyle}>
              <h6 className="fw-bold mb-3">Distribución del rendimiento</h6>
              <div className="mb-4">
                <div className="progress rounded-pill mb-2" style={{ height: 24, backgroundColor: 'rgba(255,255,255,0.05)' }}>
                  <div className="progress-bar"
                    style={{ width: `${(userRate / cetesRate) * 100}%`, background: 'linear-gradient(90deg, #d97706, #22c55e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
                    {userRate.toFixed(2)}% → tú
                  </div>
                  <div className="progress-bar"
                    style={{ width: `${(platformRate / cetesRate) * 100}%`, background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#000' }}>
                    {platformRate.toFixed(2)}%
                  </div>
                </div>
                <div className="d-flex justify-content-between">
                  <span className="small" style={{ color: '#22c55e' }}>{userRate.toFixed(2)}% al usuario</span>
                  <span className="small" style={{ color: '#f59e0b' }}>{platformRate.toFixed(2)}% Mañana Seguro</span>
                </div>
              </div>
              <h6 className="fw-bold mb-3">Proyección por escala</h6>
              <div className="table-responsive">
                <table className="table table-dark table-borderless mb-0" style={{ fontSize: 13 }}>
                  <thead><tr className="text-white-50"><th>Usuarios</th><th>Activos</th><th>Ingreso anual</th></tr></thead>
                  <tbody>
                    {[['200', '$100K USDC', '$1,000'], ['1,000', '$500K USDC', '$5,000'], ['10,000', '$5M USDC', '$50,000'], ['50,000', '$25M USDC', '$250,000']].map(([u, a, i]) => (
                      <tr key={u}><td className="fw-bold">{u}</td><td className="text-white-50">{a}</td><td style={{ color: '#22c55e' }}>{i} USDC</td></tr>
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
