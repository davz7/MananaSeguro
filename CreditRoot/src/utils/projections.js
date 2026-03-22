import { MANANA_SEGURO_RATES, INCENTIVE_SCENARIOS } from '../data/retirementContent'

// ─── Proyección base con tasa del usuario (4.7%) ─────────────────────────────
export function calculateRetirementProjection({
  monthlyDepositUsd,
  yearsToRetirement,
  annualYieldRate,
  incentiveScenario = 'todo',
}) {
  const months = yearsToRetirement * 12
  const monthlyRate = annualYieldRate / 100 / 12
  const investedAmount = monthlyDepositUsd * months

  let projectedBalance = 0
  for (let month = 0; month < months; month++) {
    projectedBalance = (projectedBalance + monthlyDepositUsd) * (1 + monthlyRate)
  }

  const growthAmount = projectedBalance - investedAmount
  const estimatedMonthlyIncome = projectedBalance * 0.04 / 12

  // Incentivos acumulados en ciclos de 5 años
  const incentivePct = INCENTIVE_SCENARIOS.find(s => s.key === incentiveScenario)?.pct ?? 5
  const totalIncentives = calculateTotalIncentives(monthlyDepositUsd, yearsToRetirement, annualYieldRate, incentivePct)

  return {
    investedAmount,
    projectedBalance: projectedBalance + totalIncentives,
    growthAmount,
    estimatedMonthlyIncome,
    totalIncentives,
    incentivePct,
  }
}

// ─── Simulación por ciclos de 5 años (lógica exacta del doc) ─────────────────
export function calculateCycles(monthlyDepositUsd, totalYears, userRate, incentivePct) {
  const cycles = Math.floor(totalYears / 5)
  let balance = 0
  const cycleResults = []

  for (let cycle = 0; cycle < cycles; cycle++) {
    const startBalance = balance
    const cycleYield = simulateCycleYield(balance, monthlyDepositUsd, userRate, 5)
    balance = cycleYield.endBalance

    const incentiveAmount = cycleYield.totalYield * (incentivePct / 100)
    balance += incentiveAmount

    cycleResults.push({
      cycle: cycle + 1,
      yearStart: cycle * 5 + 1,
      yearEnd: (cycle + 1) * 5,
      startBalance,
      endBalance: balance,
      totalYield: cycleYield.totalYield,
      incentiveAmount,
      yearlyBreakdown: cycleYield.yearlyBreakdown,
    })
  }

  return cycleResults
}

function simulateCycleYield(startBalance, monthlyDeposit, annualRate, years) {
  const monthlyRate = annualRate / 100 / 12
  let balance = startBalance
  let totalYield = 0
  const yearlyBreakdown = []

  for (let y = 0; y < years; y++) {
    const yearStart = balance
    for (let m = 0; m < 12; m++) {
      const interest = balance * monthlyRate
      balance += monthlyDeposit + interest
      totalYield += interest
    }
    yearlyBreakdown.push({
      year: y + 1,
      endBalance: balance,
      yearlyYield: balance - yearStart - monthlyDeposit * 12,
    })
  }

  return { endBalance: balance, totalYield, yearlyBreakdown }
}

function calculateTotalIncentives(monthlyDeposit, years, rate, incentivePct) {
  const cycles = calculateCycles(monthlyDeposit, years, rate, incentivePct)
  return cycles.reduce((sum, c) => sum + c.incentiveAmount, 0)
}

// ─── Simulador de autopréstamo ────────────────────────────────────────────────
export function calculateLoan(lockedBalance, requestedAmount) {
  const maxLoan = lockedBalance * MANANA_SEGURO_RATES.loanMaxPct
  const amount = Math.min(requestedAmount, maxLoan)
  const months = MANANA_SEGURO_RATES.loanMaxMonths
  const monthlyFeeRate = MANANA_SEGURO_RATES.loanMonthlyFee / 100

  let balance = amount
  const schedule = []
  let totalFees = 0

  for (let m = 1; m <= months; m++) {
    const fee = balance * monthlyFeeRate
    const principal = amount / months
    const payment = principal + fee
    totalFees += fee
    balance -= principal

    schedule.push({
      month: m,
      payment: payment,
      fee,
      principal,
      remaining: Math.max(0, balance),
    })
  }

  return {
    amount,
    maxLoan,
    monthlyPayment: schedule[0]?.payment ?? 0,
    totalFees,
    totalRepaid: amount + totalFees,
    schedule,
  }
}

// ─── Ingresos de la plataforma con Carlos ────────────────────────────────────
export function calculatePlatformRevenue(monthlyDeposit, years, platformRate = 1.0) {
  const monthlyRate = platformRate / 100 / 12
  let balance = 0
  let totalRevenue = 0

  for (let m = 0; m < years * 12; m++) {
    balance += monthlyDeposit
    totalRevenue += balance * monthlyRate
  }

  return totalRevenue
}
