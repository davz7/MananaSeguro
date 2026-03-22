import { useEffect, useState } from 'react'
import { MANANA_SEGURO_RATES } from '../data/retirementContent'

const CACHE_KEY = 'manana_seguro_cetes_rate_v3'
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7 // 7 días
const FALLBACK_RATE = MANANA_SEGURO_RATES.cetesRate

export function useEtherfuseRate() {
  const [state, setState] = useState(() => {
    const cached = loadFromCache()
    if (cached) return buildState(cached.rate, true, new Date(cached.ts), false, null)
    return buildState(FALLBACK_RATE, false, null, true, null)
  })

  useEffect(() => {
    const cached = loadFromCache()
    if (cached) return

    let cancelled = false

    async function fetchRate() {
      try {
        // Llama al proxy local de Vite — el SDK corre en Node, sin CORS
        const res = await fetch('/api/cetes-rate')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const { rate } = await res.json()
        if (!rate || isNaN(rate)) throw new Error('Tasa inválida')
        if (cancelled) return
        saveToCache(rate)
        setState(buildState(rate, true, new Date(), false, null))
      } catch (err) {
        if (cancelled) return
        console.warn('[useEtherfuseRate] falló, usando fallback:', err.message)
        setState(buildState(FALLBACK_RATE, false, null, false, err.message))
      }
    }

    fetchRate()
    return () => { cancelled = true }
  }, [])

  return state
}

function buildState(cetesRate, isLive, lastUpdated, loading, error) {
  const effectivePlatformRate = cetesRate < MANANA_SEGURO_RATES.cetesFloorTrigger
    ? MANANA_SEGURO_RATES.platformRateFloor
    : MANANA_SEGURO_RATES.platformRate

  return {
    cetesRate,
    userRate: parseFloat(Math.max(0, cetesRate - effectivePlatformRate).toFixed(2)),
    platformRate: effectivePlatformRate,
    isLive,
    lastUpdated,
    loading,
    error,
  }
}

function loadFromCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { rate, ts } = JSON.parse(raw)
    if (Date.now() - ts > CACHE_TTL_MS) return null
    return { rate, ts }
  } catch { return null }
}

function saveToCache(rate) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ rate, ts: Date.now() }))
  } catch {}
}