import { useState } from 'react'
import { MANANA_SEGURO_RATES, INCENTIVE_SCENARIOS } from '../../../data/retirementContent'
import { formatCurrencyUsd, formatCurrencyMxn } from '../../../utils/formatters'
import { calculateCycles, calculateLoan } from '../../../utils/projections'
import { useEtherfuseRate } from '../../../hooks/useEtherfuseRate'

const DEFAULTS = {
  nombre: 'Carlos',
  edad: 32,
  mensual: 25,
  anios: 20,
  escenario: 'fidelidad_constancia',
  mesesImpago: 4,
  simularImpago: false,
}

export function CarlosSimulator() {
  const { userRate } = useEtherfuseRate()
  const [params, setParams] = useState(DEFAULTS)
  const [step, setStep] = useState(0)

  const incentivePct = INCENTIVE_SCENARIOS.find(s => s.key === params.escenario)?.pct ?? 7
  const cycles = calculateCycles(params.mensual, params.anios, userRate, incentivePct)

  const mesAEmergencia = 36
  const saldoMes36 = estimateSaldoMes(params.mensual, mesAEmergencia, userRate)
  const loan = calculateLoan(saldoMes36, saldoMes36 * 0.30)

  const penalizacion = params.simularImpago ? params.mesesImpago * MANANA_SEGURO_RATES.loanPenaltyPerMonth : 0
  const tasaEscenario = Math.max(MANANA_SEGURO_RATES.loanMinUserRate, userRate - penalizacion)

  const cyclesFinal = calculateCycles(params.mensual, params.anios, tasaEscenario, incentivePct)
  const saldoFinal = cyclesFinal[cyclesFinal.length - 1]?.endBalance ?? 0
  const totalIncentivos = cyclesFinal.reduce((s, c) => s + c.incentiveAmount, 0)
  const totalAportado = params.mensual * params.anios * 12
  const enPesos = saldoFinal * 17
  const ingresosPlat = calcPlatformRevenue(params.mensual, params.anios)

  const cardStyle = { backgroundColor: '#0c0c0c', border: '1px solid rgba(255,255,255,0.06)' }
  const steps = ['Perfil', 'Ciclos', 'Emergencia', 'Resultado']

  return (
    <div className="d-flex flex-column gap-4">

      {/* Header stepper */}
      <div className="p-4 rounded-4"
        style={{ ...cardStyle, background: 'linear-gradient(135deg, #0c0c0c 0%, rgba(37,99,235,0.08) 100%)' }}>
        <div className="d-flex align-items-center gap-3 mb-3">
          <div style={{ fontSize: 36 }}>🛵</div>
          <div>
            <h5 className="fw-bold mb-1">Simulación: {params.nombre}</h5>
            <p className="text-white-50 small mb-0">
              {params.edad} años · ${params.mensual} USDC/mes · {params.anios} años · {userRate}% APY
            </p>
          </div>
        </div>
        <div className="d-flex gap-0">
          {steps.map((s, i) => (
            <div key={s} className="d-flex align-items-center" style={{ flex: i < steps.length - 1 ? 1 : 'none' }}>
              <button className="btn btn-sm rounded-circle fw-bold d-flex align-items-center justify-content-center flex-shrink-0"
                style={{ width: 32, height: 32, backgroundColor: i <= step ? '#2563eb' : 'rgba(255,255,255,0.05)', border: i <= step ? 'none' : '1px solid rgba(255,255,255,0.1)', color: i <= step ? '#fff' : 'rgba(255,255,255,0.3)', fontSize: 12 }}
                onClick={() => setStep(i)}>
                {i < step ? '✓' : i + 1}
              </button>
              {i < steps.length - 1 && (
                <div style={{ flex: 1, height: 2, backgroundColor: i < step ? '#2563eb' : 'rgba(255,255,255,0.08)', margin: '0 4px' }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Parámetros */}
      <div className="p-4 rounded-4" style={cardStyle}>
        <h6 className="fw-bold mb-3">Personaliza la simulación</h6>
        <div className="row g-3">
          {[
            { label: 'Nombre', field: 'nombre', type: 'text' },
            { label: 'Edad inicial', field: 'edad', type: 'number', min: 18 },
            { label: 'Aportación mensual (USDC)', field: 'mensual', type: 'number', min: 2 },
            { label: 'Años al retiro', field: 'anios', type: 'number', min: 5 },
          ].map(f => (
            <div className="col-sm-6 col-md-3" key={f.field}>
              <label className="small text-white-50 mb-1 d-block">{f.label}</label>
              <input type={f.type} className="form-control bg-transparent text-white border-secondary rounded-3"
                value={params[f.field]} min={f.min}
                onChange={e => setParams(p => ({ ...p, [f.field]: f.type === 'number' ? Number(e.target.value) : e.target.value }))}
              />
            </div>
          ))}
          <div className="col-sm-6 col-md-6">
            <label className="small text-white-50 mb-1 d-block">Incentivo cada 5 años</label>
            <select className="form-select bg-transparent text-white border-secondary rounded-3" style={{ backgroundColor: '#111' }}
              value={params.escenario}
              onChange={e => setParams(p => ({ ...p, escenario: e.target.value }))}>
              {INCENTIVE_SCENARIOS.map(s => (
                <option key={s.key} value={s.key} style={{ backgroundColor: '#111' }}>
                  {s.label} — {s.pct}%
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Step 0: Perfil */}
      {step === 0 && (
        <div className="p-4 rounded-4" style={cardStyle}>
          <h6 className="fw-bold mb-3">Perfil de ahorro</h6>
          <div className="row g-3 mb-4">
            {[
              { label: 'Aportación mensual', val: formatCurrencyUsd(params.mensual), sub: `≈ ${formatCurrencyMxn(params.mensual * 17)}` },
              { label: 'Total a aportar', val: formatCurrencyUsd(totalAportado), sub: `en ${params.anios} años` },
              { label: 'Tasa que recibirá', val: `${userRate}% APY`, sub: 'vía Etherfuse CETES' },
              { label: 'Incentivo por ciclo', val: `${incentivePct}%`, sub: 'del rendimiento cada 5 años' },
            ].map(item => (
              <div className="col-sm-6 col-md-3" key={item.label}>
                <div className="p-3 rounded-4 h-100" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="small text-white-50 mb-1">{item.label}</div>
                  <div className="fw-bold">{item.val}</div>
                  <div className="small text-white-50">{item.sub}</div>
                </div>
              </div>
            ))}
          </div>
          <button className="btn btn-primary rounded-3 fw-bold px-4"
            style={{ background: 'linear-gradient(45deg, #2563eb, #3b82f6)', border: 'none' }}
            onClick={() => setStep(1)}>Ver ciclos de 5 años →</button>
        </div>
      )}

      {/* Step 1: Ciclos */}
      {step === 1 && (
        <div className="p-4 rounded-4" style={cardStyle}>
          <h6 className="fw-bold mb-1">Ciclos de incentivo ({incentivePct}% cada 5 años)</h6>
          <p className="small text-white-50 mb-3">{INCENTIVE_SCENARIOS.find(s => s.key === params.escenario)?.label}</p>
          <div className="table-responsive mb-4">
            <table className="table table-dark table-borderless mb-0" style={{ fontSize: 13 }}>
              <thead>
                <tr className="text-white-50">
                  <th>Ciclo</th><th>Años</th><th>Saldo fin</th><th>Rendimiento</th>
                  <th style={{ color: '#fbbf24' }}>Incentivo {incentivePct}%</th>
                </tr>
              </thead>
              <tbody>
                {cycles.map(c => (
                  <tr key={c.cycle} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td className="fw-bold">{c.cycle}</td>
                    <td className="text-white-50">{c.yearStart}–{c.yearEnd}</td>
                    <td style={{ color: '#3b82f6' }}>{formatCurrencyUsd(c.endBalance)}</td>
                    <td style={{ color: '#22c55e' }}>{formatCurrencyUsd(c.totalYield)}</td>
                    <td style={{ color: '#fbbf24' }}>+{formatCurrencyUsd(c.incentiveAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="d-flex gap-2">
            <button className="btn btn-sm rounded-3 text-white-50" style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'none' }} onClick={() => setStep(0)}>← Volver</button>
            <button className="btn btn-primary rounded-3 fw-bold px-4" style={{ background: 'linear-gradient(45deg, #2563eb, #3b82f6)', border: 'none' }} onClick={() => setStep(2)}>Ver emergencia mes 36 →</button>
          </div>
        </div>
      )}

      {/* Step 2: Emergencia */}
      {step === 2 && (
        <div className="p-4 rounded-4" style={cardStyle}>
          <h6 className="fw-bold mb-1">🚨 Emergencia médica — Mes {mesAEmergencia}</h6>
          <p className="small text-white-50 mb-4">
            {params.nombre} necesita dinero urgente. Saldo acumulado: <strong style={{ color: '#fff' }}>{formatCurrencyUsd(saldoMes36)}</strong>
          </p>
          <div className="row g-3 mb-4">
            {[
              { label: 'Saldo mes 36', val: formatCurrencyUsd(saldoMes36) },
              { label: 'Autopréstamo máx. (30%)', val: formatCurrencyUsd(loan.maxLoan), color: '#fbbf24' },
              { label: 'Solicita', val: formatCurrencyUsd(250), color: '#fbbf24' },
              { label: 'Pago mensual', val: formatCurrencyUsd(loan.monthlyPayment), color: '#f87171' },
            ].map(item => (
              <div className="col-sm-6 col-md-3" key={item.label}>
                <div className="p-3 rounded-4" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="small text-white-50 mb-1">{item.label}</div>
                  <div className="fw-bold" style={{ color: item.color ?? '#fff' }}>{item.val}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Toggle impago */}
          <div className="d-flex align-items-center gap-3 mb-4 p-3 rounded-4"
            style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex-grow-1">
              <div className="small fw-bold">Simular meses de impago</div>
              <div className="small text-white-50">Ver cómo afecta el rendimiento</div>
            </div>
            <button className="btn btn-sm rounded-3 fw-bold"
              style={{
                backgroundColor: params.simularImpago ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)',
                border: params.simularImpago ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(255,255,255,0.1)',
                color: params.simularImpago ? '#f87171' : 'rgba(255,255,255,0.4)',
              }}
              onClick={() => setParams(p => ({ ...p, simularImpago: !p.simularImpago }))}>
              {params.simularImpago ? 'ON' : 'OFF'}
            </button>
          </div>

          {params.simularImpago && (
            <div className="p-3 rounded-4 mb-4"
              style={{ backgroundColor: 'rgba(239,68,68,0.06)', border: '1px dashed rgba(239,68,68,0.3)' }}>
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="small text-white-50">Meses de impago</span>
                <span className="fw-bold" style={{ color: '#f87171' }}>{params.mesesImpago}</span>
              </div>
              <input type="range" className="form-range" min={1} max={12} step={1}
                value={params.mesesImpago}
                onChange={e => setParams(p => ({ ...p, mesesImpago: Number(e.target.value) }))}
                style={{ accentColor: '#f87171' }} />
              <div className="small mt-2" style={{ color: '#f87171' }}>
                Penalización: −{penalizacion.toFixed(2)}% → rendimiento baja a {tasaEscenario.toFixed(2)}%
              </div>
            </div>
          )}

          <div className="d-flex gap-2">
            <button className="btn btn-sm rounded-3 text-white-50" style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'none' }} onClick={() => setStep(1)}>← Volver</button>
            <button className="btn btn-primary rounded-3 fw-bold px-4" style={{ background: 'linear-gradient(45deg, #2563eb, #3b82f6)', border: 'none' }} onClick={() => setStep(3)}>Ver resultado final →</button>
          </div>
        </div>
      )}

      {/* Step 3: Resultado */}
      {step === 3 && (
        <div className="p-4 rounded-4"
          style={{ ...cardStyle, background: 'linear-gradient(135deg, #0c0c0c 0%, rgba(34,197,94,0.06) 100%)' }}>
          <div className="text-center mb-4">
            <div style={{ fontSize: 48 }}>🎯</div>
            <h5 className="fw-bold mt-2 mb-1">{params.nombre} a los {params.edad + params.anios} años</h5>
            <p className="text-white-50 small">{params.anios} años · ${params.mensual} USDC/mes · {tasaEscenario.toFixed(2)}% APY</p>
          </div>

          <div className="row g-3 mb-4">
            {[
              { label: 'Total aportado', val: formatCurrencyUsd(totalAportado), color: '#3b82f6' },
              { label: 'Rendimiento Etherfuse', val: formatCurrencyUsd(saldoFinal - totalAportado - totalIncentivos), color: '#22c55e' },
              { label: 'Incentivos cobrados', val: formatCurrencyUsd(totalIncentivos), color: '#fbbf24' },
              { label: 'Saldo total', val: formatCurrencyUsd(saldoFinal), color: '#fff', bold: true },
            ].map(item => (
              <div className="col-sm-6 col-md-3" key={item.label}>
                <div className="p-3 rounded-4 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="small text-white-50 mb-1">{item.label}</div>
                  <div className={item.bold ? 'fw-bold fs-5' : 'fw-bold'} style={{ color: item.color }}>{item.val}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 rounded-4 text-center mb-4"
            style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.1), rgba(59,130,246,0.1))', border: '1px solid rgba(34,197,94,0.2)' }}>
            <div className="text-white-50 small mb-1">En pesos mexicanos (tipo de cambio $17)</div>
            <div className="fw-bold" style={{ fontSize: 36, color: '#22c55e', letterSpacing: '-2px' }}>
              {formatCurrencyMxn(enPesos)}
            </div>
            <div className="text-white-50 small mt-1">
              Aportando {formatCurrencyMxn(params.mensual * 17)}/mes durante {params.anios} años
            </div>
          </div>

          <div className="p-3 rounded-4 mb-4"
            style={{ backgroundColor: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)' }}>
            <div className="small fw-bold mb-2" style={{ color: '#fbbf24' }}>Lo que gana Mañana Seguro con {params.nombre}</div>
            <div className="row g-2">
              {[
                { label: 'Comisión 1% anual', val: formatCurrencyUsd(ingresosPlat.comision) },
                { label: 'Adm. autopréstamo', val: formatCurrencyUsd(ingresosPlat.autoprestamo) },
                { label: 'Incentivos pagados', val: `−${formatCurrencyUsd(totalIncentivos)}` },
                { label: 'Ingreso neto', val: formatCurrencyUsd(ingresosPlat.neto - totalIncentivos), bold: true },
              ].map(item => (
                <div className="col-sm-6 col-md-3" key={item.label}>
                  <div className="small text-white-50">{item.label}</div>
                  <div className="small fw-bold" style={{ color: item.bold ? '#fbbf24' : '#fff' }}>{item.val}</div>
                </div>
              ))}
            </div>
          </div>

          <button className="btn btn-sm rounded-3 text-white-50"
            style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'none' }}
            onClick={() => setStep(0)}>↺ Reiniciar simulación</button>
        </div>
      )}

    </div>
  )
}

function estimateSaldoMes(mensual, meses, annualRate) {
  const monthlyRate = annualRate / 100 / 12
  let balance = 0
  for (let m = 0; m < meses; m++) {
    balance = (balance + mensual) * (1 + monthlyRate)
  }
  return parseFloat(balance.toFixed(2))
}

function calcPlatformRevenue(mensual, anios) {
  const monthlyRate = MANANA_SEGURO_RATES.platformRate / 100 / 12
  let balance = 0, comision = 0
  for (let m = 0; m < anios * 12; m++) {
    balance += mensual
    comision += balance * monthlyRate
  }
  const autoprestamo = 250 * 0.005 * 24
  return { comision: parseFloat(comision.toFixed(2)), autoprestamo: parseFloat(autoprestamo.toFixed(2)), neto: parseFloat((comision + autoprestamo).toFixed(2)) }
}
