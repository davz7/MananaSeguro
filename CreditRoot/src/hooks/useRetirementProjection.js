import { useMemo, useState } from 'react'
import { calculateRetirementProjection } from '../utils/projections'

export function useRetirementProjection(initialScenario) {
  const [scenario, setScenario] = useState(initialScenario)

  const projection = useMemo(
    () => calculateRetirementProjection(scenario),
    [scenario],
  )

  function updateScenario(field, value) {
    setScenario((current) => ({
      ...current,
      // Campos numéricos
      [field]: ['monthlyDepositUsd', 'yearsToRetirement', 'annualYieldRate'].includes(field)
        ? Number(value)
        : value,
    }))
  }

  return { scenario, projection, updateScenario }
}
