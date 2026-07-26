// src/hooks/useYieldCounter.js
import { useEffect, useState } from 'react'

const TICK_MS = 100

export function useYieldCounterDirectMxn(realBalance, annualYieldRate, running = true) {
  // El tiempo vive en state. Cada tick lo actualiza desde el interval (async, permitido).
  // El render solo lee este valor , puro.
  const [currentTime, setCurrentTime] = useState(() => Date.now())

  useEffect(() => {
    if (!running || realBalance <= 0) return
    const intervalId = setInterval(() => setCurrentTime(Date.now()), TICK_MS)
    return () => clearInterval(intervalId)
  }, [running, realBalance])

  // Caso pausado
  if (!running || realBalance <= 0) {
    return {
      isGrowing: false,
      yieldTodayMxn: 0,
      displayBalance: realBalance,
    }
  }

  // Cálculo derivado (puro: solo depende de currentTime + props)
  const ratePerMs = (annualYieldRate || 0) / 100 / (365 * 24 * 60 * 60 * 1000)
  const now = new Date(currentTime)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const msSinceMidnight = currentTime - todayStart
  const todayYield = realBalance * ratePerMs * msSinceMidnight

  return {
    isGrowing: true,
    yieldTodayMxn: todayYield,
    displayBalance: realBalance + todayYield,
  }
}