import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Footer from './components/Footer'
import LandingNavbar from './components/LandingNavbar'
import { conectarWallet } from '../lib/wallet'
import ardilla from '../assets/Ardilla_vector.png'
import pollarLogo from '../assets/polo.webp'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

export function AuthScreen({ onAuth, onVolver }) {
  const { t } = useTranslation()
  const [paso, setPaso] = useState('inicio') // 'inicio' | 'freighter' | 'nombre'
  const [walletAddressFreighter, setWalletAddressFreighter] = useState(null)
  const [nombre, setNombre] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [googleListo, setGoogleListo] = useState(false)
  const googleBtnRef = useRef(null)

  // ── Callback de Google — cuando el usuario selecciona su cuenta ────────────
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
      localStorage.setItem('ms_usuario', JSON.stringify(data.usuario))
      onAuth(data.usuario)
    } catch (err) {
      setError(err.message || t('auth.errorLoginReintentar'))
    } finally {
      setLoading(false)
    }
  }, [onAuth, t])

  // ── Inicializar SDK de Google ───────────────────────────────────────────────
  const inicializarGoogle = useCallback(() => {
    if (!window.google?.accounts) return
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleCredentialResponse,
      auto_select: false,
      cancel_on_tap_outside: true,
      ux_mode: 'popup',
    })
    if (googleBtnRef.current) {
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'outline',
        size: 'large',
        width: googleBtnRef.current.offsetWidth || 360,
        text: 'continue_with',
        shape: 'rectangular',
        logo_alignment: 'left',
      })
    }
    setGoogleListo(true)
  }, [handleCredentialResponse])

  // ── Cargar SDK de Google ───────────────────────────────────────────────────
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      setError(t('auth.errorConfig'))
      return
    }
    if (window.google?.accounts) {
      inicializarGoogle()
      return
    }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = inicializarGoogle
    script.onerror = () => setError(t('auth.errorGoogleCarga'))
    document.head.appendChild(script)
  }, [inicializarGoogle, t])

  // ── Freighter: conectar wallet ─────────────────────────────────────────────
  async function handleConectarFreighter() {
    setLoading(true)
    setError(null)
    try {
      const address = await conectarWallet()
      setWalletAddressFreighter(address)
      setPaso('nombre')
    } catch (e) {
      if (e.message.includes('Freighter no está disponible')) {
        setError(t('auth.errorFreighterNoInstalado'))
      } else if (e.message.includes('Cancelaste')) {
        setError(t('auth.errorConexionCancelada'))
      } else {
        setError(e.message ?? t('auth.errorWalletConexion'))
      }
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!nombre.trim()) {
      setError(t('auth.errorCampoRequerido', { campo: t('auth.nombreLabel') }))
      return
    }
    onAuth({ nombre: nombre.trim(), walletAddress: walletAddressFreighter })
  }

  return (
    <div className="bg-surface dark:bg-[#0f0e0d] min-h-screen overflow-x-hidden">
      <LandingNavbar soloVolver onVolver={onVolver} />

      <div className="container mx-auto px-4 py-16 lg:py-24">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          {/* Copy izquierda */}
          <div className="hidden lg:flex flex-col justify-center anim-fade-up-1">
            <span className="inline-block bg-brand/10 text-brand-dark border border-brand/20 rounded-lg px-4 py-1.5 text-xs font-semibold tracking-wide mb-6">
              🛡️ {t('auth.badge')}
            </span>
            <h1 className="font-display font-black text-ink dark:text-white tracking-tight mb-4"
              style={{ fontSize: 'clamp(2.4rem,5vw,3.6rem)', lineHeight: 1.05 }}>
              {t('auth.heroTitulo')}<br />
              <em className="text-brand italic">{t('auth.heroTituloAccent')}</em>
            </h1>
            <p className="text-ink/50 dark:text-white/50 text-lg leading-relaxed max-w-md mb-8">
              {t('auth.descWallet')}
            </p>

            <div className="flex flex-col gap-3 mb-8">
              {[
                { num: '1', text: t('auth.paso1') },
                { num: '2', text: t('auth.paso2') },
                { num: '3', text: t('auth.paso3') },
                { num: '4', text: t('auth.paso4') },
              ].map(p => (
                <div key={p.num} className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center text-xs font-black text-brand shrink-0">
                    {p.num}
                  </span>
                  <span className="text-sm text-ink/60 dark:text-white/60">{p.text}</span>
                </div>
              ))}
            </div>

            <img src={ardilla} alt={t('auth.mascotaAlt')} className="h-40 object-contain float-squirrel" />
          </div>

          {/* Card de auth */}
          <div className="anim-fade-up-2">
            <div className="bg-white dark:bg-white/5 rounded-3xl p-8 lg:p-10 border border-ink/8 dark:border-white/8 shadow-xl shadow-ink/5">

              {/* ── Paso inicio ── */}
              {paso === 'inicio' && (
                <div className="flex flex-col gap-5">
                  <div className="text-center mb-1">
                    <h3 className="font-display font-black text-ink dark:text-white text-2xl mb-2">
                      {t('auth.tituloWallet')} <em className="text-brand italic">{t('auth.tituloWalletAccent')}</em>
                    </h3>
                    <p className="text-ink/45 dark:text-white/45 text-sm leading-relaxed">
                      {t('auth.descNombre')}
                    </p>
                  </div>

                  {error && (
                    <div className="bg-red-500/8 border border-dashed border-red-400/40 text-red-500 text-sm text-center px-4 py-3 rounded-xl">
                      ⚠️ {error}
                    </div>
                  )}

                  {/* Loading */}
                  {loading && (
                    <div className="flex flex-col items-center gap-3 py-4">
                      <svg aria-hidden="true" className="animate-spin text-brand" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                      <p className="text-sm text-ink/50 dark:text-white/50">{t('auth.conectando')}</p>
                    </div>
                  )}

                  {/* Botón oficial de Google */}
                  {!loading && (
                    <>
                      <div ref={googleBtnRef} className="w-full flex justify-center" style={{ minHeight: '44px' }} />
                      {!googleListo && !error && (
                        <div className="w-full h-11 bg-ink/5 dark:bg-white/5 rounded-lg animate-pulse" />
                      )}
                    </>
                  )}

                  {/* Trust indicators */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { icon: '🔒', text: t('auth.trust1') },
                      { icon: '⚡', text: t('auth.trust2') },
                      { icon: '🏦', text: t('auth.trust3') },
                    ].map(item => (
                      <div key={item.text} className="bg-ink/2 dark:bg-white/3 rounded-xl p-3 text-center">
                        <div className="text-lg mb-1">{item.icon}</div>
                        <div className="text-xs text-ink/45 dark:text-white/45 font-medium">{item.text}</div>
                      </div>
                    ))}
                  </div>

                  {/* Divisor */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-ink/8 dark:bg-white/8" />
                    <span className="text-xs text-ink/25 dark:text-white/25">{t('auth.opcionesAvanzadas')}</span>
                    <div className="flex-1 h-px bg-ink/8 dark:bg-white/8" />
                  </div>

                  {/* Freighter — avanzado */}
                  <button
                    className="w-full flex items-center justify-center gap-2 border border-ink/8 dark:border-white/8 hover:border-ink/20 dark:hover:border-white/20 text-ink/35 dark:text-white/35 hover:text-ink/60 dark:hover:text-white/60 font-medium py-3 rounded-xl transition-all cursor-pointer text-sm disabled:opacity-50"
                    onClick={() => setPaso('freighter')}
                    disabled={loading}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="7" width="20" height="14" rx="2" />
                      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                    </svg>
                    {t('auth.usarFreighter')}
                  </button>

                  {/* Powered by Pollar */}
                  <div className="flex items-center justify-center gap-1.5 pt-1">
                    <span className="text-xs text-ink/25 dark:text-white/25">{t('auth.poweredBy')}</span>
                    <a href="https://pollar.xyz" target="_blank" rel="noopener noreferrer" className="flex items-center">
                      <img src={pollarLogo} alt={t('auth.pollarAlt')} className="h-8 w-auto opacity-60 hover:opacity-90 transition-opacity dark:invert" />
                    </a>
                  </div>
                </div>
              )}

              {/* ── Paso freighter ── */}
              {paso === 'freighter' && (
                <div className="flex flex-col items-center text-center gap-6">
                  <div className="w-16 h-16 rounded-2xl bg-brand/10 flex items-center justify-center">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#e3730d" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="7" width="20" height="14" rx="2" />
                      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                      <line x1="12" y1="12" x2="12" y2="16" />
                      <line x1="10" y1="14" x2="14" y2="14" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-display font-black text-ink dark:text-white text-2xl mb-2">{t('auth.conectar')}</h3>
                    <p className="text-ink/45 dark:text-white/45 text-sm leading-relaxed max-w-xs mx-auto">{t('auth.descWallet')}</p>
                  </div>
                  {error && (
                    <div className="w-full bg-red-500/8 border border-dashed border-red-400/40 text-red-500 text-sm text-center px-4 py-3 rounded-xl">
                      ⚠️ {error}
                      {error.includes('freighter.app') && (
                        <a href="https://freighter.app" target="_blank" rel="noopener noreferrer" className="block mt-2 text-brand underline font-medium">
                          {t('auth.instalar')} →
                        </a>
                      )}
                    </div>
                  )}
                  <button
                    className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-4 rounded-xl transition-all hover:-translate-y-px hover:shadow-lg hover:shadow-brand/30 cursor-pointer disabled:opacity-50"
                    onClick={handleConectarFreighter}
                    disabled={loading}>
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg aria-hidden="true" className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                        {t('auth.conectando')}
                      </span>
                    ) : t('auth.conectar')}
                  </button>
                  <button className="text-sm text-ink/30 dark:text-white/30 hover:text-ink/60 transition-colors cursor-pointer"
                    onClick={() => { setPaso('inicio'); setError(null) }}>
                    ← {t('nav.volverInicio')}
                  </button>
                </div>
              )}

              {/* ── Paso nombre (Freighter) ── */}
              {paso === 'nombre' && (
                <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                  <div className="bg-green-500/8 border border-green-500/20 rounded-xl px-4 py-3 flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-green-700 font-semibold mb-0.5">{t('auth.walletConectada')}</p>
                      <p className="text-xs text-ink/40 dark:text-white/40 font-mono truncate">{walletAddressFreighter}</p>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-display font-black text-ink dark:text-white text-2xl mb-1">
                      {t('auth.tituloNombre')} <em className="text-brand italic">{t('auth.tituloNombreAccent')}</em>
                    </h3>
                    <p className="text-ink/40 dark:text-white/40 text-sm">{t('auth.descNombre')}</p>
                  </div>
                  <div>
                    <label htmlFor="auth-nombre" className="block text-xs font-semibold text-ink/40 dark:text-white/40 uppercase tracking-widest mb-2">{t('auth.nombreLabel')}</label>
                    <input
                      id="auth-nombre"
                      className="w-full rounded-xl px-5 py-3.5 text-base bg-white dark:bg-white/5 outline-none transition-all duration-200 border border-ink/10 dark:border-white/10 focus:border-brand focus:ring-2 focus:ring-brand/20 text-ink dark:text-white"
                      placeholder={t('auth.nombrePlaceholder')}
                      value={nombre}
                      onChange={e => setNombre(e.target.value)}
                      autoFocus
                    />
                  </div>
                  {error && (
                    <div className="bg-red-500/8 border border-dashed border-red-400/40 text-red-500 text-sm text-center px-4 py-3 rounded-xl">⚠️ {error}</div>
                  )}
                  <button type="submit" className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-4 rounded-xl transition-all hover:-translate-y-px hover:shadow-lg hover:shadow-brand/30 cursor-pointer">
                    {t('auth.entrar')}
                  </button>
                  <button type="button" className="text-sm text-ink/30 dark:text-white/30 hover:text-ink/60 dark:hover:text-white/60 transition-colors cursor-pointer"
                    onClick={() => { setPaso('inicio'); setError(null) }}>
                    {t('auth.cambiarWallet')}
                  </button>
                </form>
              )}

            </div>
          </div>

        </div>
      </div>
      <Footer />
    </div>
  )
}
