import { describe, it, expect, beforeEach } from 'vitest'
import { calculateRetirementProjection, calculateCycles } from '../../src/utils/projections'
import { useRetirementProjection } from '../../src/hooks/useRetirementProjection'
import { renderHook, act } from '@testing-library/react'

describe('calculateRetirementProjection', () => {
  it('returns correct projection for known inputs: $25/month, 20 years, 4.7% APY', () => {
    const result = calculateRetirementProjection({
      monthlyDepositUsd: 25,
      yearsToRetirement: 20,
      annualYieldRate: 4.7,
    })

    expect(result.investedAmount).toBe(6000)
    expect(result.projectedBalance).toBeGreaterThan(6000)
    expect(result.estimatedMonthlyIncome).toBeGreaterThan(0)
  })

  it('handles minimum deposit $2 with short period', () => {
    const result = calculateRetirementProjection({
      monthlyDepositUsd: 2,
      yearsToRetirement: 1,
      annualYieldRate: 4.7,
    })

    expect(result.investedAmount).toBe(24)
    expect(result.projectedBalance).toBeGreaterThanOrEqual(result.investedAmount)
  })

  it('handles maximum years (40) with minimum deposit', () => {
    const result = calculateRetirementProjection({
      monthlyDepositUsd: 2,
      yearsToRetirement: 40,
      annualYieldRate: 4.7,
    })

    expect(result.investedAmount).toBe(960)
    expect(result.projectedBalance).toBeGreaterThan(result.investedAmount)
  })

  it('handles zero yield rate', () => {
    const result = calculateRetirementProjection({
      monthlyDepositUsd: 25,
      yearsToRetirement: 20,
      annualYieldRate: 0,
    })

    expect(result.investedAmount).toBe(6000)
    expect(result.projectedBalance).toBe(6000)
    expect(result.growthAmount).toBe(0)
    expect(result.estimatedMonthlyIncome).toBe(20)
  })

  it('calculates incentives for fidelity scenario (5-year cycles)', () => {
    const resultDefault = calculateRetirementProjection({
      monthlyDepositUsd: 25,
      yearsToRetirement: 5,
      annualYieldRate: 4.7,
      incentiveScenario: 'solo_fidelidad',
    })

    const resultNoIncentive = calculateRetirementProjection({
      monthlyDepositUsd: 25,
      yearsToRetirement: 5,
      annualYieldRate: 4.7,
      incentiveScenario: 'todo',
    })

    expect(resultDefault.totalIncentives).toBeGreaterThan(0)
    expect(resultDefault.incentivePct).toBe(5)
  })

  it('calculates higher incentives for fidelidad_constancia (7%)', () => {
    const result = calculateRetirementProjection({
      monthlyDepositUsd: 25,
      yearsToRetirement: 10,
      annualYieldRate: 4.7,
      incentiveScenario: 'fidelidad_constancia',
    })

    expect(result.incentivePct).toBe(7)
    expect(result.totalIncentives).toBeGreaterThan(0)
  })

  it('calculates incentives every 5-year cycle correctly', () => {
    const cycles5 = calculateCycles(25, 5, 4.7, 5)
    const cycles10 = calculateCycles(25, 10, 4.7, 5)
    const cycles15 = calculateCycles(25, 15, 4.7, 5)

    expect(cycles5).toHaveLength(1)
    expect(cycles10).toHaveLength(2)
    expect(cycles15).toHaveLength(3)

    cycles10.forEach((cycle, i) => {
      expect(cycle.cycle).toBe(i + 1)
      expect(cycle.incentiveAmount).toBeGreaterThan(0)
    })
  })

  it('returns correct structure with all required fields', () => {
    const result = calculateRetirementProjection({
      monthlyDepositUsd: 25,
      yearsToRetirement: 20,
      annualYieldRate: 4.7,
    })

    expect(result).toHaveProperty('investedAmount')
    expect(result).toHaveProperty('projectedBalance')
    expect(result).toHaveProperty('growthAmount')
    expect(result).toHaveProperty('estimatedMonthlyIncome')
    expect(result).toHaveProperty('totalIncentives')
    expect(result).toHaveProperty('incentivePct')
  })

  it('handles different referral incentive scenarios', () => {
    const result1Refer = calculateRetirementProjection({
      monthlyDepositUsd: 25,
      yearsToRetirement: 10,
      annualYieldRate: 4.7,
      incentiveScenario: 'fidelidad_1_referido',
    })

    const result2Refer = calculateRetirementProjection({
      monthlyDepositUsd: 25,
      yearsToRetirement: 10,
      annualYieldRate: 4.7,
      incentiveScenario: 'fidelidad_2_referidos',
    })

    expect(result1Refer.incentivePct).toBe(6)
    expect(result2Refer.incentivePct).toBe(7)
    expect(result2Refer.totalIncentives).toBeGreaterThanOrEqual(result1Refer.totalIncentives)
  })
})

describe('useRetirementProjection', () => {
  it('updateScenario correctly updates numeric fields', () => {
    const initialScenario = {
      monthlyDepositUsd: 25,
      yearsToRetirement: 20,
      annualYieldRate: 4.7,
      incentiveScenario: 'fidelidad_constancia',
    }

    const { result } = renderHook(() => useRetirementProjection(initialScenario))

    expect(result.current.scenario.monthlyDepositUsd).toBe(25)

    act(() => {
      result.current.updateScenario('monthlyDepositUsd', '50')
    })

    expect(result.current.scenario.monthlyDepositUsd).toBe(50)

    act(() => {
      result.current.updateScenario('yearsToRetirement', '30')
    })

    expect(result.current.scenario.yearsToRetirement).toBe(30)
  })

  it('projection recalculates when scenario changes', () => {
    const initialScenario = {
      monthlyDepositUsd: 25,
      yearsToRetirement: 20,
      annualYieldRate: 4.7,
      incentiveScenario: 'fidelidad_constancia',
    }

    const { result } = renderHook(() => useRetirementProjection(initialScenario))

    const projectionWith25 = result.current.projection
    expect(projectionWith25.investedAmount).toBe(6000)

    act(() => {
      result.current.updateScenario('monthlyDepositUsd', '50')
    })

    const projectionWith50 = result.current.projection
    expect(projectionWith50.investedAmount).toBe(12000)

    expect(projectionWith50.projectedBalance).not.toBe(projectionWith25.projectedBalance)
  })

  it('returns correct structure with scenario, projection, and updateScenario', () => {
    const initialScenario = {
      monthlyDepositUsd: 25,
      yearsToRetirement: 20,
      annualYieldRate: 4.7,
      incentiveScenario: 'fidelidad_constancia',
    }

    const { result } = renderHook(() => useRetirementProjection(initialScenario))

    expect(result.current).toHaveProperty('scenario')
    expect(result.current).toHaveProperty('projection')
    expect(result.current).toHaveProperty('updateScenario')
    expect(typeof result.current.updateScenario).toBe('function')
  })
})