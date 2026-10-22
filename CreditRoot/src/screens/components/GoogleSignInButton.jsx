// src/screens/components/GoogleSignInButton.jsx
//
// Botón oficial de Google Identity Services. Google solo entrega el ID token
// a través de su propio botón (o One Tap), así que no se puede usar un botón
// con estilo propio. El ID token se canjea en /api/auth/google por el usuario
// y el token de sesión que exigen las APIs protegidas.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TriangleAlert } from 'lucide-react'
import { guardarSesion } from '../../lib/api'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const GSI_SRC = 'https://accounts.google.com/gsi/client'

export function GoogleSignInButton({ onAuth }) {
  const { t } = useTranslation()
  const contenedorRef = useRef(null)
  const [listo, setListo] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleCredentialResponse = useCallback(async (response) => {
    if (!response.credential) {
      setError(t('auth.errorSinCredencial'))
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: response.credential }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('auth.errorLogin'))
      guardarSesion(data.sesion)
      onAuth(data.usuario)
    } catch (err) {
      setError(err.message || t('auth.errorLoginReintentar'))
      setLoading(false)
    }
  }, [onAuth, t])

  const inicializarGoogle = useCallback(() => {
    if (!window.google?.accounts || !contenedorRef.current) return
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleCredentialResponse,
      auto_select: false,
      cancel_on_tap_outside: true,
      ux_mode: 'popup',
    })
    window.google.accounts.id.renderButton(contenedorRef.current, {
      theme: 'outline',
      size: 'large',
      // GIS acepta como máximo 400px de ancho
      width: Math.min(contenedorRef.current.offsetWidth || 360, 400),
      text: 'continue_with',
      shape: 'rectangular',
      logo_alignment: 'center',
    })
    setListo(true)
  }, [handleCredentialResponse])

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      setError(t('auth.errorConfig'))
      return
    }
    if (window.google?.accounts) {
      inicializarGoogle()
      return
    }
    let script = document.querySelector(`script[src="${GSI_SRC}"]`)
    if (!script) {
      script = document.createElement('script')
      script.src = GSI_SRC
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }
    const onError = () => setError(t('auth.errorGoogleCarga'))
    script.addEventListener('load', inicializarGoogle)
    script.addEventListener('error', onError)
    return () => {
      script.removeEventListener('load', inicializarGoogle)
      script.removeEventListener('error', onError)
    }
  }, [inicializarGoogle, t])

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div className="bg-red-500/8 border border-dashed border-red-400/40 text-red-500 text-sm text-center px-4 py-3 rounded-xl" role="alert">
          <TriangleAlert size={16} className="inline shrink-0 mr-1" aria-hidden="true" />{error}
        </div>
      )}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-3 text-sm text-white/60">
          <svg aria-hidden="true" className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
          {t('auth.conectando')}
        </div>
      )}
      <div
        ref={contenedorRef}
        className={`w-full flex justify-center ${loading ? 'hidden' : ''}`}
        style={{ minHeight: '44px' }}
        aria-busy={!listo}
      />
    </div>
  )
}
