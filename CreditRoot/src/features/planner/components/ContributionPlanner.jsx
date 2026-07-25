// src/features/planner/components/ContributionPlanner.jsx
// Configurador de meta de ahorro , integrado en el Dashboard
// Ya no usa Freighter ni Stellar , el depósito real se hace desde DepositFlow

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { plannerDefaults, INCENTIVE_SCENARIOS, MANANA_SEGURO_RATES } from '../../../data/retirementContent'
import { useRetirementProjection } from '../../../hooks/useRetirementProjection'
import { useEtherfuseRate } from '../../../hooks/useEtherfuseRate'
import { formatCurrencyMxn, formatPercentage } from '../../../utils/formatters'
import { calculateCycles } from '../../../utils/projections'

// Tipo de cambio de referencia para mostrar proyecciones en MXN
// El usuario deposita en MXN, así que las proyecciones también deben estar en MXN
const MXN_PER_USD = 17.5

export function ContributionPlanner() {
  const { userRate, cetesRate, platformRate, isLive } = useEtherfuseRate()
  const { t } = useTranslation()

  const { scenario, projection, updateScenario } = useRetirementProjection({
    ...plannerDefaults,
    annualYieldRate: userRate,
  })

  const [showCycles, setShowCycles] = useState(false)

  // Convertir USDC a MXN para mostrar al usuario
  const mensualMxn = scenario.monthlyDepositUsd * MXN_PER_USD
  const depositoBajo = mensualMxn < 40 // mínimo $40 MXN

  const cycles = calculateCycles(
    scenario.monthlyDepositUsd,
    scenario.yearsToRetirement,
    userRate,
    projection.incentivePct
  )

  const inputClass = "w-full border border-ink/10 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-ink dark:text-white bg-white dark:bg-white/5 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-all"

  const projCards = [
    {
      label: t('contributionPlanner.cardBalance'),
      val: formatCurrencyMxn(projection.projectedBalance * MXN_PER_USD),
      sub: t('contributionPlanner.cardBalanceSub'),
      color: 'text-brand',
      bg: 'bg-brand/8 border-brand/15'
    },
    {
      label: t('contributionPlanner.cardGanancia'),
      val: formatCurrencyMxn(projection.growthAmount * MXN_PER_USD),
      sub: t('contributionPlanner.cardGananciaSub'),
      color: 'text-green-600',
      bg: 'bg-green-500/8 border-green-500/15'
    },
    {
      label: t('contributionPlanner.cardIncentivos'),
      val: formatCurrencyMxn(projection.totalIncentives * MXN_PER_USD),
      sub: t('contributionPlanner.cardIncentivosSub', { pct: projection.incentivePct }),
      color: 'text-yellow-500',
      bg: 'bg-yellow-400/8 border-yellow-400/15'
    },
    {
      label: t('contributionPlanner.cardIngreso'),
      val: formatCurrencyMxn(projection.estimatedMonthlyIncome * MXN_PER_USD),
      sub: t('contributionPlanner.cardIngresoSub'),
      color: 'text-ink dark:text-white',
      bg: 'bg-ink/4 dark:bg-white/4 border-ink/8 dark:border-white/8'
    },
  ]

  return (
    <div className="grid lg:grid-cols-12 gap-4">

      {/* Configurador */}
      <div className="lg:col-span-5">
        <div className="bg-white dark:bg-white/5 border border-ink/8 dark:border-white/8 rounded-2xl p-6 h-full">
          <h5 className="font-display font-black text-ink dark:text-white text-lg mb-5">
            {t('contributionPlanner.titulo')}
          </h5>
          <div className="flex flex-col gap-5">

            {/* Ahorro mensual en MXN */}
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-xs text-ink/50 dark:text-white/50 font-medium">
                  Ahorro mensual (MXN)
                </label>
                <span className="text-xs font-bold text-brand">{formatCurrencyMxn(mensualMxn)}</span>
              </div>
              <input
                type="number"
                className={inputClass}
                min={40}
                max={10000}
                step={10}
                value={mensualMxn}
                onChange={e => updateScenario('monthlyDepositUsd', Number(e.target.value) / MXN_PER_USD)}
              />
              {depositoBajo && (
                <p className="text-xs text-brand mt-1.5">
                  {t('contributionPlanner.minimoDeposito', { min: 40 })}
                </p>
              )}
              {mensualMxn >= 350 && (
                <p className="text-xs text-green-600 mt-1.5">
                  {t('contributionPlanner.calificas')}
                </p>
              )}
            </div>

            {/* Años al retiro */}
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-xs text-ink/50 dark:text-white/50 font-medium">
                  {t('contributionPlanner.aniosLabel')}
                </label>
                <span className="text-xs font-bold text-ink dark:text-white">
                  {scenario.yearsToRetirement} {t('contributionPlanner.aniosSufijo')}
                </span>
              </div>
              <input
                type="range"
                className="w-full accent-brand"
                min="5" max="40" step="5"
                value={scenario.yearsToRetirement}
                onChange={e => updateScenario('yearsToRetirement', e.target.value)}
              />
              <div className="flex justify-between mt-1">
                <span className="text-xs text-ink/35 dark:text-white/35">5 años</span>
                <span className="text-xs text-ink/35 dark:text-white/35">40 años</span>
              </div>
            </div>

            {/* Tasa en vivo */}
            <div className="bg-ink/3 dark:bg-white/3 border border-ink/6 dark:border-white/6 rounded-xl p-4">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs text-ink/50 dark:text-white/50">
                  {t('contributionPlanner.tasaLabel')}
                </span>
                <span className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${
                  isLive
                    ? 'bg-green-500/10 text-green-700 border-green-500/20'
                    : 'bg-yellow-400/10 text-yellow-600 border-yellow-400/20'
                }`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  {userRate}% APY
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: t('contributionPlanner.brutaCetes'), val: `${cetesRate}%` },
                  { label: t('contributionPlanner.comisionPlat'), val: `−${platformRate}%` },
                  { label: t('contributionPlanner.paraTi'), val: `${userRate}%`, color: 'text-green-600' },
                ].map(item => (
                  <div key={item.label}>
                    <p className="text-ink/35 dark:text-white/35 mb-0.5" style={{ fontSize: 10 }}>{item.label}</p>
                    <p className={`text-xs font-bold ${item.color ?? 'text-ink dark:text-white'}`}>{item.val}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Incentivo */}
            <div>
              <label className="text-xs text-ink/50 dark:text-white/50 font-medium mb-2 block">
                {t('contributionPlanner.incentivoLabel')}
              </label>
              <select
                className={inputClass + ' cursor-pointer'}
                value={scenario.incentiveScenario}
                onChange={e => updateScenario('incentiveScenario', e.target.value)}>
                {INCENTIVE_SCENARIOS.map(s => (
                  <option key={s.key} value={s.key}>
                    {s.label} — {s.pct}% para ti
                  </option>
                ))}
              </select>
              <p className="text-xs text-ink/40 dark:text-white/40 mt-1.5">
                {INCENTIVE_SCENARIOS.find(s => s.key === scenario.incentiveScenario)?.description}
              </p>
            </div>

          </div>
        </div>
      </div>

      {/* Proyección */}
      <div className="lg:col-span-7">
        <div className="bg-white dark:bg-white/5 border border-ink/8 dark:border-white/8 rounded-2xl p-6 h-full">
          <h5 className="font-display font-black text-ink dark:text-white text-lg mb-5">
            {t('contributionPlanner.proyeccionTitulo')}
          </h5>
          <div className="grid grid-cols-2 gap-3 mb-5">
            {projCards.map(item => (
              <div key={item.label} className={`border rounded-xl p-4 ${item.bg}`}>
                <p className="text-xs text-ink/40 dark:text-white/40 mb-1">{item.label}</p>
                <p className={`text-lg font-bold mb-0.5 ${item.color}`}>{item.val}</p>
                <p className="text-xs text-ink/35 dark:text-white/35">{item.sub}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-0 mb-5">
            {[
              { label: t('contributionPlanner.detalleAportado'), val: formatCurrencyMxn(projection.investedAmount * MXN_PER_USD) },
              { label: t('contributionPlanner.detalleTasa'), val: `${formatPercentage(userRate)} anual` },
              { label: t('contributionPlanner.detalleComision'), val: `${formatPercentage(MANANA_SEGURO_RATES.platformRate)} anual` },
            ].map(item => (
              <div key={item.label} className="flex justify-between py-2.5 border-b border-ink/5 dark:border-white/5 last:border-0">
                <span className="text-xs text-ink/45 dark:text-white/45">{item.label}</span>
                <span className="text-xs font-semibold text-ink dark:text-white">{item.val}</span>
              </div>
            ))}
          </div>

          <button
            className="w-full border border-ink/10 dark:border-white/10 text-ink/40 dark:text-white/40 hover:text-ink/70 dark:hover:text-white/70 hover:border-ink/20 dark:hover:border-white/20 text-xs font-medium py-2.5 rounded-xl transition-all cursor-pointer"
            onClick={() => setShowCycles(!showCycles)}>
            {showCycles ? t('contributionPlanner.ocultarCiclos') : t('contributionPlanner.verCiclos')}
          </button>
        </div>
      </div>

      {/* Ciclos */}
      {showCycles && cycles.length > 0 && (
        <div className="lg:col-span-12">
          <div className="bg-white dark:bg-white/5 border border-ink/8 dark:border-white/8 rounded-2xl p-6">
            <h6 className="font-semibold text-ink dark:text-white mb-4">
              {t('contributionPlanner.ciclosTitulo')}
            </h6>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-ink/40 dark:text-white/40 text-xs border-b border-ink/6 dark:border-white/6">
                    <th className="text-left pb-2 font-medium">{t('contributionPlanner.ciclo')}</th>
                    <th className="text-left pb-2 font-medium">{t('contributionPlanner.aniosCol')}</th>
                    <th className="text-left pb-2 font-medium">{t('contributionPlanner.saldoInicio')}</th>
                    <th className="text-left pb-2 font-medium">{t('contributionPlanner.saldoFin')}</th>
                    <th className="text-left pb-2 font-medium">{t('contributionPlanner.rendimiento')}</th>
                    <th className="text-left pb-2 font-medium text-yellow-600">
                      {t('contributionPlanner.incentivoCol', { pct: projection.incentivePct })}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cycles.map(c => (
                    <tr key={c.cycle} className="border-b border-ink/4 dark:border-white/4">
                      <td className="py-2.5 font-semibold text-ink dark:text-white">{c.cycle}</td>
                      <td className="py-2.5 text-ink/40 dark:text-white/40">{c.yearStart}–{c.yearEnd}</td>
                      <td className="py-2.5 text-ink dark:text-white">{formatCurrencyMxn(c.startBalance * MXN_PER_USD)}</td>
                      <td className="py-2.5 text-brand font-semibold">{formatCurrencyMxn(c.endBalance * MXN_PER_USD)}</td>
                      <td className="py-2.5 text-green-600 font-semibold">{formatCurrencyMxn(c.totalYield * MXN_PER_USD)}</td>
                      <td className="py-2.5 text-yellow-600 font-semibold">+{formatCurrencyMxn(c.incentiveAmount * MXN_PER_USD)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Info , sin bloquear con Freighter */}
      <div className="lg:col-span-12">
        <div className="bg-brand/5 border border-brand/20 rounded-2xl p-5 flex items-start gap-3">
          <span className="text-2xl shrink-0">💡</span>
          <div>
            <p className="font-semibold text-ink dark:text-white mb-1">¿Cómo funciona?</p>
            <p className="text-sm text-ink/50 dark:text-white/50">
              Esta simulación te muestra cuánto crecerá tu ahorro. Para depositar, usa el botón
              <strong className="text-brand"> + Depositar</strong> arriba — solo necesitas hacer
              un SPEI desde tu banco a la CLABE que te damos.
            </p>
          </div>
        </div>
      </div>

    </div>
  )
}