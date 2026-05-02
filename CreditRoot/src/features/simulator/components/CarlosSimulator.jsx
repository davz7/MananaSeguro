import { useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
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

  const steps = [
    t('carlos.perfil'),
    t('carlos.ciclos'),
    t('carlos.emergencia'),
    t('carlos.resultado'),
  ]

  const inputClass = "w-full border border-ink/10 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-white/5 text-ink dark:text-white outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-all"

  return (
    <div className="flex flex-col gap-4">

      {/* ── Header stepper ── */}
      <div className="bg-white dark:bg-white/5 border border-ink/8 dark:border-white/8 rounded-2xl p-6">
        <div className="flex items-center gap-4 mb-5">
          <span className="text-4xl">🛵</span>
          <div>
            <h5 className="font-display font-black text-ink dark:text-white text-lg mb-0.5">
              {t('carlos.titulo')} {params.nombre}
            </h5>
            <p className="text-xs text-ink/40 dark:text-white/40">
              {t('carlos.subtitulo', { edad: params.edad, mensual: params.mensual, anios: params.anios, apy: userRate })}
            </p>
          </div>
        </div>

        {/* Stepper */}
        <div className="flex items-center">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center" style={{ flex: i < steps.length - 1 ? 1 : 'none' }}>
              <button
                className={`w-8 h-8 rounded-full text-xs font-bold flex items-center justify-content shrink-0 cursor-pointer transition-all ${i <= step
                    ? 'bg-brand text-white'
                    : 'bg-ink/5 dark:bg-white/5 border border-ink/10 dark:border-white/10 text-ink/30 dark:text-white/30'
                  }`}
                onClick={() => setStep(i)}>
                {i < step ? '✓' : i + 1}
              </button>
              {i < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-1 transition-all ${i < step ? 'bg-brand' : 'bg-ink/8 dark:bg-white/8'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Parámetros ── */}
      <div className="bg-white dark:bg-white/5 border border-ink/8 dark:border-white/8 rounded-2xl p-6">
        <h6 className="font-semibold text-ink dark:text-white mb-4">{t('carlos.personaliza')}</h6>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          {[
            { label: t('carlos.nombre'), field: 'nombre', type: 'text' },
            { label: t('carlos.edad'), field: 'edad', type: 'number', min: 18 },
            { label: t('carlos.mensual'), field: 'mensual', type: 'number', min: 2 },
            { label: t('carlos.anios'), field: 'anios', type: 'number', min: 5 },
          ].map(f => (
            <div key={f.field}>
              <label className="block text-xs text-ink/40 dark:text-white/40 mb-1.5">{f.label}</label>
              <input
                type={f.type}
                className={inputClass}
                value={params[f.field]}
                min={f.min}
                onChange={e => setParams(p => ({
                  ...p,
                  [f.field]: f.type === 'number' ? Number(e.target.value) : e.target.value,
                }))}
              />
            </div>
          ))}
        </div>
        <div>
          <label className="block text-xs text-ink/40 dark:text-white/40 mb-1.5">{t('carlos.incentivo')}</label>
          <select
            className={inputClass + ' cursor-pointer'}
            value={params.escenario}
            onChange={e => setParams(p => ({ ...p, escenario: e.target.value }))}>
            {INCENTIVE_SCENARIOS.map(s => (
              <option key={s.key} value={s.key}>{s.label} — {s.pct}%</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Step 0: Perfil ── */}
      {step === 0 && (
        <div className="bg-white dark:bg-white/5 border border-ink/8 dark:border-white/8 rounded-2xl p-6">
          <h6 className="font-semibold text-ink dark:text-white mb-4">{t('carlos.perfilTitulo')}</h6>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {[
              { label: t('carlos.aporteLabel'), val: formatCurrencyUsd(params.mensual), sub: `≈ ${formatCurrencyMxn(params.mensual * 17)}` },
              { label: t('carlos.totalAportar'), val: formatCurrencyUsd(totalAportado), sub: t('carlos.enAnios', { anios: params.anios }) },
              { label: t('carlos.tasaLabel'), val: `${userRate}% APY`, sub: t('carlos.tasaSub') },
              { label: t('carlos.incentivoLabel'), val: `${incentivePct}%`, sub: t('carlos.incentivoPorCiclo') },
            ].map(item => (
              <div key={item.label} className="bg-ink/3 dark:bg-white/3 border border-ink/6 dark:border-white/6 rounded-xl p-3">
                <p className="text-xs text-ink/40 dark:text-white/40 mb-1">{item.label}</p>
                <p className="text-sm font-bold text-ink dark:text-white mb-0.5">{item.val}</p>
                <p className="text-xs text-ink/35 dark:text-white/35">{item.sub}</p>
              </div>
            ))}
          </div>
          <button
            className="bg-brand hover:bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl transition-all hover:-translate-y-px cursor-pointer"
            onClick={() => setStep(1)}>
            {t('carlos.verCiclos')}
          </button>
        </div>
      )}

      {/* ── Step 1: Ciclos ── */}
      {step === 1 && (
        <div className="bg-white dark:bg-white/5 border border-ink/8 dark:border-white/8 rounded-2xl p-6">
          <h6 className="font-semibold text-ink dark:text-white mb-1">
            {t('carlos.ciclosTitulo', { pct: incentivePct })}
          </h6>
          <p className="text-xs text-ink/40 dark:text-white/40 mb-4">
            {INCENTIVE_SCENARIOS.find(s => s.key === params.escenario)?.label}
          </p>
          <div className="overflow-x-auto mb-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-ink/40 dark:text-white/40 text-xs border-b border-ink/6 dark:border-white/6">
                  <th className="text-left pb-2 font-medium">{t('carlos.ciclo')}</th>
                  <th className="text-left pb-2 font-medium">{t('carlos.aniosCol')}</th>
                  <th className="text-left pb-2 font-medium">{t('carlos.saldoFin')}</th>
                  <th className="text-left pb-2 font-medium">{t('carlos.rendimiento')}</th>
                  <th className="text-left pb-2 font-medium text-yellow-600">{t('carlos.incentivoCol', { pct: incentivePct })}</th>
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
            </table>
          </div>
          <div className="flex gap-2">
            <button className="border border-ink/10 dark:border-white/10 text-ink/50 dark:text-white/50 hover:text-ink dark:hover:text-white text-sm font-medium px-4 py-2 rounded-xl transition-all cursor-pointer" onClick={() => setStep(0)}>
              {t('carlos.volver')}
            </button>
            <button className="bg-brand hover:bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl transition-all hover:-translate-y-px cursor-pointer" onClick={() => setStep(2)}>
              {t('carlos.verEmergencia')}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Emergencia ── */}
      {step === 2 && (
        <div className="bg-white dark:bg-white/5 border border-ink/8 dark:border-white/8 rounded-2xl p-6">
          <h6 className="font-semibold text-ink dark:text-white mb-1">
            {t('carlos.emergenciaTitulo', { mes: mesAEmergencia })}
          </h6>
          <p className="text-sm text-ink/50 dark:text-white/50 mb-5">
            {t('carlos.emergenciaDesc', { nombre: params.nombre })}{' '}
            <strong className="text-ink dark:text-white">{formatCurrencyUsd(saldoMes36)}</strong>
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {[
              { label: t('carlos.saldoMes'), val: formatCurrencyUsd(saldoMes36), color: 'text-ink dark:text-white' },
              { label: t('carlos.prestamoMax'), val: formatCurrencyUsd(loan.maxLoan), color: 'text-yellow-500' },
              { label: t('carlos.solicita'), val: formatCurrencyUsd(250), color: 'text-yellow-500' },
              { label: t('carlos.pagoMensual'), val: formatCurrencyUsd(loan.monthlyPayment), color: 'text-red-400' },
            ].map(item => (
              <div key={item.label} className="bg-ink/3 dark:bg-white/3 border border-ink/6 dark:border-white/6 rounded-xl p-3">
                <p className="text-xs text-ink/40 dark:text-white/40 mb-1">{item.label}</p>
                <p className={`text-sm font-bold ${item.color}`}>{item.val}</p>
              </div>
            ))}
          </div>

          {/* Toggle impago */}
          <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-ink/2 dark:bg-white/2 border border-ink/6 dark:border-white/6 mb-4">
            <div>
              <p className="text-sm font-semibold text-ink dark:text-white mb-0.5">{t('carlos.simularImpago')}</p>
              <p className="text-xs text-ink/40 dark:text-white/40">{t('carlos.simularImpagoDesc')}</p>
            </div>
            <button
              className={`text-xs font-bold px-4 py-2 rounded-xl border transition-all cursor-pointer ${params.simularImpago
                  ? 'bg-red-500/10 text-red-500 border-red-500/25'
                  : 'bg-ink/4 dark:bg-white/4 text-ink/40 dark:text-white/40 border-ink/10 dark:border-white/10'
                }`}
              onClick={() => setParams(p => ({ ...p, simularImpago: !p.simularImpago }))}>
              {params.simularImpago ? 'ON' : 'OFF'}
            </button>
          </div>

          {params.simularImpago && (
            <div className="bg-red-500/5 border border-dashed border-red-500/25 rounded-xl p-4 mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-ink/50 dark:text-white/50">{t('carlos.mesesImpago')}</span>
                <span className="text-sm font-bold text-red-500">{params.mesesImpago}</span>
              </div>
              <input
                type="range" className="w-full mb-2" min={1} max={12} step={1}
                value={params.mesesImpago}
                onChange={e => setParams(p => ({ ...p, mesesImpago: Number(e.target.value) }))}
                style={{ accentColor: '#ef4444' }}
              />
              <p className="text-xs text-red-500">
                {t('carlos.penalizacion', { pct: penalizacion.toFixed(2), nueva: tasaEscenario.toFixed(2) })}
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <button className="border border-ink/10 dark:border-white/10 text-ink/50 dark:text-white/50 hover:text-ink dark:hover:text-white text-sm font-medium px-4 py-2 rounded-xl transition-all cursor-pointer" onClick={() => setStep(1)}>
              {t('carlos.volver')}
            </button>
            <button className="bg-brand hover:bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl transition-all hover:-translate-y-px cursor-pointer" onClick={() => setStep(3)}>
              {t('carlos.verResultado')}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Resultado ── */}
      {step === 3 && (
        <div className="bg-white dark:bg-white/5 border border-ink/8 dark:border-white/8 rounded-2xl p-6">
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">🎯</div>
            <h5 className="font-display font-black text-ink dark:text-white text-xl mb-1">
              {t('carlos.resultadoTitulo', { nombre: params.nombre, edad: params.edad + params.anios })}
            </h5>
            <p className="text-xs text-ink/40 dark:text-white/40">
              {t('carlos.resultadoSub', { anios: params.anios, mensual: params.mensual, apy: tasaEscenario.toFixed(2) })}
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {[
              { label: t('carlos.totalAportado'), val: formatCurrencyUsd(totalAportado), color: 'text-brand' },
              { label: t('carlos.rendimientoLabel'), val: formatCurrencyUsd(saldoFinal - totalAportado - totalIncentivos), color: 'text-green-600' },
              { label: t('carlos.incentivosLabel'), val: formatCurrencyUsd(totalIncentivos), color: 'text-yellow-500' },
              { label: t('carlos.saldoTotal'), val: formatCurrencyUsd(saldoFinal), color: 'text-ink dark:text-white', bold: true },
            ].map(item => (
              <div key={item.label} className="bg-ink/3 dark:bg-white/3 border border-ink/6 dark:border-white/6 rounded-xl p-3 text-center">
                <p className="text-xs text-ink/40 dark:text-white/40 mb-1">{item.label}</p>
                <p className={`font-bold ${item.bold ? 'text-base' : 'text-sm'} ${item.color}`}>{item.val}</p>
              </div>
            ))}
          </div>

          {/* En pesos */}
          <div className="bg-green-500/8 border border-green-500/15 rounded-xl p-5 text-center mb-5">
            <p className="text-xs text-ink/40 dark:text-white/40 mb-1">{t('carlos.enPesosSub')}</p>
            <p className="font-display font-black text-green-600" style={{ fontSize: 'clamp(1.8rem,4vw,2.4rem)', letterSpacing: '-2px' }}>
              {formatCurrencyMxn(enPesos)}
            </p>
            <p className="text-xs text-ink/35 dark:text-white/35 mt-1">
              {t('carlos.aportandoSub', { mxn: formatCurrencyMxn(params.mensual * 17), anios: params.anios })}
            </p>
          </div>

          {/* Ingresos plataforma */}
          <div className="bg-yellow-400/5 border border-yellow-400/15 rounded-xl p-4 mb-5">
            <p className="text-xs font-bold text-yellow-600 mb-3">
              {t('carlos.platTitulo', { nombre: params.nombre })}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: t('carlos.platComision'), val: formatCurrencyUsd(ingresosPlat.comision), bold: false },
                { label: t('carlos.platAuto'), val: formatCurrencyUsd(ingresosPlat.autoprestamo), bold: false },
                { label: t('carlos.platIncentivos'), val: `−${formatCurrencyUsd(totalIncentivos)}`, bold: false },
                { label: t('carlos.platNeto'), val: formatCurrencyUsd(ingresosPlat.neto - totalIncentivos), bold: true },
              ].map(item => (
                <div key={item.label}>
                  <p className="text-xs text-ink/40 dark:text-white/40 mb-0.5">{item.label}</p>
                  <p className={`text-sm font-bold ${item.bold ? 'text-yellow-600' : 'text-ink dark:text-white'}`}>{item.val}</p>
                </div>
              ))}
            </div>
          </div>

          <button
            className="border border-ink/10 dark:border-white/10 text-ink/50 dark:text-white/50 hover:text-ink dark:hover:text-white text-sm font-medium px-4 py-2 rounded-xl transition-all cursor-pointer"
            onClick={() => setStep(0)}>
            {t('carlos.reiniciar')}
          </button>
        </div>
      )}

    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
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
  return {
    comision: parseFloat(comision.toFixed(2)),
    autoprestamo: parseFloat(autoprestamo.toFixed(2)),
    neto: parseFloat((comision + autoprestamo).toFixed(2)),
  }
}