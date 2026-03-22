import { useState } from 'react'
import { plannerDefaults, INCENTIVE_SCENARIOS, MANANA_SEGURO_RATES } from '../../../data/retirementContent'
import { useRetirementProjection } from '../../../hooks/useRetirementProjection'
import { useEtherfuseRate } from '../../../hooks/useEtherfuseRate'
import { formatCurrencyUsd, formatCurrencyMxn, formatPercentage } from '../../../utils/formatters'
import { calculateCycles } from '../../../utils/projections'
import { lockFunds, enviarTransaccion } from '../../../lib/stellar'
import { firmarTransaccion } from '../../../lib/wallet'
import { buildHistoryEntry, addHistoryEntry } from "../../dashboard/components/ContributionHistory"
import freighterApi from '@stellar/freighter-api'

export function ContributionPlanner() {
  const { userRate, cetesRate, platformRate, isLive } = useEtherfuseRate()

  const { scenario, projection, updateScenario } = useRetirementProjection({
    ...plannerDefaults,
    annualYieldRate: userRate,
  })

  const [estado, setEstado] = useState(null)
  const [txHash, setTxHash] = useState(null)
  const [errorMsg, setErrorMsg] = useState(null)
  const [showCycles, setShowCycles] = useState(false)

  const depositoBajo = scenario.monthlyDepositUsd < MANANA_SEGURO_RATES.minDeposit
  const cycles = calculateCycles(
    scenario.monthlyDepositUsd,
    scenario.yearsToRetirement,
    userRate,
    projection.incentivePct
  )

  async function handleBloquear() {
    if (depositoBajo) return
    try {
      setEstado('loading')
      setErrorMsg(null)
      const { address } = await freighterApi.getAddress()
      if (!address) throw new Error('Conecta tu wallet primero')
      const tx = await lockFunds(address, Number(scenario.monthlyDepositUsd))
      const signedXdr = await firmarTransaccion(tx.toXDR())
      const hash = await enviarTransaccion(signedXdr)
      setTxHash(hash)

      // ── Registrar en historial local con el tx hash real ──────────────────
      const entry = buildHistoryEntry(Number(scenario.monthlyDepositUsd), address)
      entry.txHash = hash
      addHistoryEntry(address, entry)
      // ─────────────────────────────────────────────────────────────────────

      setEstado('success')
    } catch (err) {
      setErrorMsg(err.message)
      setEstado('error')
    }
  }

  const txUrl = txHash ? 'https://stellar.expert/explorer/testnet/tx/' + txHash : null
  const cardStyle = { backgroundColor: '#0c0c0c', border: '1px solid rgba(255,255,255,0.06)' }

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="row g-4">

        {/* ── Simulador ── */}
        <div className="col-lg-5">
          <div className="p-4 rounded-4 h-100" style={cardStyle}>
            <h5 className="fw-bold mb-4">Configura tu ahorro</h5>

            <div className="d-flex flex-column gap-4">

              <div>
                <div className="d-flex justify-content-between mb-2">
                  <label className="small text-white-50">Aportación mensual (USDC)</label>
                  <span className="fw-bold small" style={{ color: '#3b82f6' }}>
                    {formatCurrencyUsd(scenario.monthlyDepositUsd)}
                  </span>
                </div>
                <input type="number"
                  className="form-control bg-transparent text-white border-secondary rounded-3"
                  min={MANANA_SEGURO_RATES.minDeposit} step="1"
                  value={scenario.monthlyDepositUsd}
                  onChange={(e) => updateScenario('monthlyDepositUsd', e.target.value)}
                />
                {depositoBajo && (
                  <div className="small mt-1" style={{ color: '#f59e0b' }}>
                    ⚠ Mínimo ${MANANA_SEGURO_RATES.minDeposit} USDC por depósito
                  </div>
                )}
                {scenario.monthlyDepositUsd >= MANANA_SEGURO_RATES.constancyMinDeposit && (
                  <div className="small mt-1" style={{ color: '#22c55e' }}>
                    ✓ Calificas para incentivo de constancia
                  </div>
                )}
              </div>

              <div>
                <div className="d-flex justify-content-between mb-2">
                  <label className="small text-white-50">Años al retiro</label>
                  <span className="fw-bold small">{scenario.yearsToRetirement} años</span>
                </div>
                <input type="number"
                  className="form-control bg-transparent text-white border-secondary rounded-3"
                  min="5" max="40" step="5"
                  value={scenario.yearsToRetirement}
                  onChange={(e) => updateScenario('yearsToRetirement', e.target.value)}
                />
              </div>

              <div className="p-3 rounded-3"
                style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="small text-white-50">Tasa que recibirás</span>
                  <span className="d-flex align-items-center gap-1"
                    style={{
                      backgroundColor: isLive ? 'rgba(34,197,94,0.1)' : 'rgba(251,191,36,0.1)',
                      border: `1px solid ${isLive ? 'rgba(34,197,94,0.3)' : 'rgba(251,191,36,0.3)'}`,
                      borderRadius: 99, padding: '2px 8px', fontSize: 11, fontWeight: 700,
                      color: isLive ? '#22c55e' : '#fbbf24',
                    }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: 'currentColor', display: 'inline-block' }} />
                    {userRate}% APY
                  </span>
                </div>
                <div className="row g-2">
                  {[
                    { label: 'Bruta CETES', val: `${cetesRate}%` },
                    { label: 'Comisión plataforma', val: `−${platformRate}%` },
                    { label: 'Para ti', val: `${userRate}%`, color: '#22c55e' },
                  ].map(item => (
                    <div className="col-4" key={item.label}>
                      <div className="small text-white-50" style={{ fontSize: 10 }}>{item.label}</div>
                      <div className="small fw-bold" style={{ color: item.color ?? '#fff' }}>{item.val}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="small text-white-50 mb-2 d-block">Incentivo cada 5 años</label>
                <select
                  className="form-select bg-transparent text-white border-secondary rounded-3"
                  style={{ backgroundColor: '#111' }}
                  value={scenario.incentiveScenario}
                  onChange={(e) => updateScenario('incentiveScenario', e.target.value)}
                >
                  {INCENTIVE_SCENARIOS.map((s) => (
                    <option key={s.key} value={s.key} style={{ backgroundColor: '#111' }}>
                      {s.label} — {s.pct}% del rendimiento
                    </option>
                  ))}
                </select>
                <div className="small text-white-50 mt-1">
                  {INCENTIVE_SCENARIOS.find(s => s.key === scenario.incentiveScenario)?.description}
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* ── Proyección ── */}
        <div className="col-lg-7">
          <div className="p-4 rounded-4 h-100" style={cardStyle}>
            <h5 className="fw-bold mb-4">Proyección de tu retiro</h5>

            <div className="row g-3 mb-4">
              {[
                { label: 'Balance al retiro', val: formatCurrencyUsd(projection.projectedBalance), sub: 'incl. incentivos', color: '#3b82f6' },
                { label: 'Ganancia por rendimiento', val: formatCurrencyUsd(projection.growthAmount), sub: 'sobre lo aportado', color: '#22c55e' },
                { label: 'Incentivos acumulados', val: formatCurrencyUsd(projection.totalIncentives), sub: `${projection.incentivePct}% cada 5 años`, color: '#fbbf24' },
                { label: 'Ingreso mensual retiro', val: formatCurrencyUsd(projection.estimatedMonthlyIncome), sub: 'retiro del 4% anual', color: '#fff' },
              ].map(item => (
                <div className="col-6" key={item.label}>
                  <div className="p-3 rounded-4"
                    style={{ backgroundColor: `rgba(${item.color === '#3b82f6' ? '59,130,246' : item.color === '#22c55e' ? '34,197,94' : item.color === '#fbbf24' ? '251,191,36' : '255,255,255'},0.08)`, border: `1px solid rgba(${item.color === '#3b82f6' ? '59,130,246' : item.color === '#22c55e' ? '34,197,94' : item.color === '#fbbf24' ? '251,191,36' : '255,255,255'},0.2)` }}>
                    <div className="small text-white-50 mb-1">{item.label}</div>
                    <div className="fw-bold fs-5" style={{ color: item.color }}>{item.val}</div>
                    <div className="small text-white-50">{item.sub}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="d-flex flex-column gap-2 mb-4">
              {[
                { label: 'Total aportado por ti', val: formatCurrencyUsd(projection.investedAmount) },
                { label: 'Tasa usuario (Cetes − comisión)', val: `${formatPercentage(userRate)} anual` },
                { label: 'Comisión plataforma', val: `${formatPercentage(MANANA_SEGURO_RATES.platformRate)} anual` },
                { label: 'En pesos (tipo cambio $17)', val: formatCurrencyMxn(projection.projectedBalance * 17) },
              ].map((item) => (
                <div key={item.label} className="d-flex justify-content-between py-2"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <span className="small text-white-50">{item.label}</span>
                  <span className="small fw-bold">{item.val}</span>
                </div>
              ))}
            </div>

            <button
              className="btn btn-sm w-100 rounded-3 mb-0"
              style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', backgroundColor: 'transparent' }}
              onClick={() => setShowCycles(!showCycles)}>
              {showCycles ? '▲ Ocultar ciclos de 5 años' : '▼ Ver desglose por ciclos de 5 años'}
            </button>
          </div>
        </div>

        {/* ── Ciclos ── */}
        {showCycles && cycles.length > 0 && (
          <div className="col-12">
            <div className="p-4 rounded-4" style={cardStyle}>
              <h6 className="fw-bold mb-3">Ciclos de incentivo cada 5 años</h6>
              <div className="table-responsive">
                <table className="table table-dark table-borderless mb-0" style={{ fontSize: 13 }}>
                  <thead>
                    <tr className="text-white-50">
                      <th>Ciclo</th><th>Años</th><th>Saldo inicio</th><th>Saldo fin</th><th>Rendimiento</th>
                      <th style={{ color: '#fbbf24' }}>Incentivo ({projection.incentivePct}%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cycles.map((c) => (
                      <tr key={c.cycle}>
                        <td className="fw-bold">{c.cycle}</td>
                        <td className="text-white-50">{c.yearStart}–{c.yearEnd}</td>
                        <td>{formatCurrencyUsd(c.startBalance)}</td>
                        <td style={{ color: '#3b82f6' }}>{formatCurrencyUsd(c.endBalance)}</td>
                        <td style={{ color: '#22c55e' }}>{formatCurrencyUsd(c.totalYield)}</td>
                        <td style={{ color: '#fbbf24' }}>+{formatCurrencyUsd(c.incentiveAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── Bloquear ── */}
        <div className="col-12">
          <div className="p-4 rounded-4" style={cardStyle}>
            <div className="row align-items-center g-4">
              <div className="col-lg-8">
                <h5 className="fw-bold mb-1">Bloquear ahorro en Mañana Seguro</h5>
                <p className="text-white-50 small mb-0">
                  Confirma tu aportación de{' '}
                  <strong style={{ color: '#fff' }}>{formatCurrencyUsd(scenario.monthlyDepositUsd)} USDC</strong>.
                  Los fondos quedan bloqueados por contrato inteligente hasta tu meta.
                </p>
              </div>
              <div className="col-lg-4">
                <button
                  className="btn btn-lg w-100 py-3 rounded-4 fw-bold"
                  style={{
                    background: estado === 'success' ? 'rgba(34,197,94,0.15)' : depositoBajo ? 'rgba(255,255,255,0.05)' : 'linear-gradient(45deg, #2563eb, #3b82f6)',
                    border: estado === 'success' ? '1px solid rgba(34,197,94,0.3)' : depositoBajo ? '1px solid rgba(255,255,255,0.1)' : 'none',
                    color: estado === 'success' ? '#22c55e' : depositoBajo ? 'rgba(255,255,255,0.3)' : '#fff',
                    cursor: depositoBajo ? 'not-allowed' : 'pointer',
                  }}
                  onClick={handleBloquear}
                  disabled={estado === 'loading' || estado === 'success' || depositoBajo}>
                  {estado === 'loading' ? (
                    <span className="d-flex align-items-center justify-content-center gap-2">
                      <span className="spinner-border spinner-border-sm" /> Procesando...
                    </span>
                  ) : estado === 'success' ? '✓ Ahorro bloqueado' : '🔒 Bloquear ahorro'}
                </button>
              </div>
            </div>

            {estado === 'success' && txHash && (
              <div className="mt-3 p-3 rounded-4 small"
                style={{ backgroundColor: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                <div className="fw-bold mb-1" style={{ color: '#22c55e' }}>✅ Transacción confirmada en testnet</div>
                <a href={txUrl} target="_blank" rel="noreferrer" style={{ color: '#3b82f6' }}>
                  Ver en Stellar Expert → {txHash.slice(0, 16)}...
                </a>
              </div>
            )}
            {estado === 'error' && (
              <div className="mt-3 p-3 rounded-4 small"
                style={{ backgroundColor: 'rgba(220,53,69,0.1)', border: '1px dashed rgba(220,53,69,0.4)', color: '#ff6b6b' }}>
                ⚠️ {errorMsg}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
