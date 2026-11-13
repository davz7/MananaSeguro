// src/hooks/useKyc.js
//
// Verificación de identidad (KYC) con Etherfuse.
//   iniciar()   → pide la URL de onboarding y redirige al usuario a Etherfuse.
//   verificar() → consulta el estado actual sin redirigir (al volver de Etherfuse).
//
// El backend no tiene todavía GET /api/me, así que el estado se obtiene del
// mismo endpoint de onboarding: si responde yaCompletado, el KYC está aprobado.

import { useCallback, useState } from 'react'
import { iniciarOnboarding } from '../lib/endpoints'
import i18n from '../i18n'

export function useKyc({ onAprobado } = {}) {
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)

  const iniciar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const data = await iniciarOnboarding()
      if (data?.yaCompletado) {
        onAprobado?.({ kycStatus: data.kycStatus, bankAccountStatus: data.bankAccountStatus })
        setCargando(false)
        return { aprobado: true }
      }
      if (!data?.onboardingUrl) throw new Error(i18n.t('mainScreen.kycUrlError'))
      window.location.assign(data.onboardingUrl)
      return { aprobado: false }
    } catch (err) {
      setError(err)
      setCargando(false)
      return { aprobado: false, error: err }
    }
  }, [onAprobado])

  const verificar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const data = await iniciarOnboarding()
      const aprobado = Boolean(data?.yaCompletado)
      if (aprobado) {
        onAprobado?.({ kycStatus: data.kycStatus, bankAccountStatus: data.bankAccountStatus })
      }
      return { aprobado, kycStatus: data?.kycStatus ?? null }
    } catch (err) {
      setError(err)
      return { aprobado: false, error: err }
    } finally {
      setCargando(false)
    }
  }, [onAprobado])

  return { iniciar, verificar, cargando, error }
}
