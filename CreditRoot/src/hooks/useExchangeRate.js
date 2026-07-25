// src/hooks/useExchangeRate.js
// Tipo de cambio USD/MXN en tiempo real desde Banxico
// Caché de 4 horas , Banxico actualiza el FIX una vez al día hábil

import { useEffect, useState } from 'react'

const CACHE_KEY = 'ms_exchange_rate'
const CACHE_TTL_MS = 1000 * 60 * 60 * 4 // 4 horas
const FALLBACK_RATE = 17.50

function loadFromCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { rate, ts } = JSON.parse(raw)
    if (Date.now() - ts > CACHE_TTL_MS) return null
    return rate
  } catch {
    return null
  }
}

function saveToCache(rate) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ rate, ts: Date.now() }))
  } catch { /* fallo silencioso */ }
}

export function useExchangeRate() {
  const [usdMxn, setUsdMxn] = useState(() => loadFromCache() ?? FALLBACK_RATE)
  const [loading, setLoading] = useState(true)
  const [isLive, setIsLive] = useState(false)

  useEffect(() => {
    const cached = loadFromCache()
    if (cached) {
      setUsdMxn(cached)
      setIsLive(true)
      setLoading(false)
      return
    }

    let cancelled = false

    async function fetchRate() {
      try {
        const res = await fetch('/api/exchange-rate')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (!data.usdMxn || isNaN(data.usdMxn)) throw new Error('Tipo de cambio inválido')
        if (cancelled) return
        saveToCache(data.usdMxn)
        setUsdMxn(data.usdMxn)
        setIsLive(data.source === 'banxico')
      } catch (err) {
        console.warn('[useExchangeRate] falló, usando fallback:', err.message)
        if (!cancelled) setIsLive(false)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchRate()
    return () => { cancelled = true }
  }, [])

  return { usdMxn, loading, isLive }
}