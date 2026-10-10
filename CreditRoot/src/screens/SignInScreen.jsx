import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Mail, Lock, TriangleAlert } from 'lucide-react'
import LandingNavbar from './components/LandingNavbar'
import Footer from './components/Footer'
import { autenticarUsuario } from '../data/mockUsers'
import logoGoogle from '../assets/Logo_Google.png'

export function SignInScreen({ onVerificar, onVolver, onRegister }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()
  const cuentaCreada = location.state?.cuentaCreada ?? false
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null) // 'emptyFields' | 'invalidCredentials'

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim() || !password) {
      setError('emptyFields')
      return
    }
    setLoading(true)
    setError(null)
    setTimeout(() => {
      const usuario = autenticarUsuario(email, password)
      setLoading(false)
      if (usuario) {
        onVerificar(email)   // pasa el identificador a /verificacion
      } else {
        setError('invalidCredentials')
      }
    }, 600)
  }

  return (
    <div className="bg-[#0f0e0d] min-h-screen overflow-x-hidden">
      <LandingNavbar soloVolver onVolver={onVolver} />

      <div className="container mx-auto px-4 pt-10 pb-16">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-start min-h-[calc(100vh-80px)]">

          {/* ── Columna izquierda ── */}
          <div className="hidden lg:flex flex-col anim-fade-up-1">
            <h1
              className="font-display font-bold text-white tracking-tight"
              style={{ fontSize: 'clamp(3rem,7vw,5rem)', lineHeight: 1.05 }}
            >
              {t('signIn.tagline1Pre')} <em className="text-brand not-italic">{t('signIn.tagline1Accent')}</em><br />
              {t('signIn.tagline2Pre')} <em className="text-brand not-italic">{t('signIn.tagline2Accent')}</em><br />
              {t('signIn.tagline3Pre')} <em className="text-brand not-italic">{t('signIn.tagline3Accent')}</em>
            </h1>
          </div>

          {/* ── Columna derecha — card sign in ── */}
          <div className="anim-fade-up-2">
            <div className="bg-[#1a1814] border border-white/10 rounded-3xl p-8 lg:p-10">
              <div className="flex flex-col gap-5">

                <div className="text-center mb-1">
                  <h2 className="font-display font-bold text-white text-4xl mb-3">
                    {t('signIn.title')}
                  </h2>
                  <p className="text-white/55 text-base leading-relaxed">
                    {t('signIn.subtitle1')}<br />{t('signIn.subtitle2')}
                  </p>
                </div>

                {cuentaCreada && (
                  <div className="bg-green-500/10 border border-green-500/30 text-green-400 text-sm text-center px-4 py-3 rounded-xl font-medium">
                    ✓ {t('signIn.accountCreated')}
                  </div>
                )}

                {error && (
                  <div className="bg-red-500/8 border border-dashed border-red-400/40 text-red-500 text-sm text-center px-4 py-3 rounded-xl" role="alert">
                    <TriangleAlert size={16} className="inline shrink-0 mr-1" aria-hidden="true" />{t(`signIn.errors.${error}`)}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                  {/* Email */}
                  <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus-within:border-brand transition-colors">
                    <Mail size={16} className="text-white/40 shrink-0" aria-hidden="true" />
                    <input
                      type="email"
                      placeholder={t('signIn.email')}
                      aria-label={t('signIn.email')}
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="flex-1 bg-transparent text-white text-sm placeholder:text-white/35 outline-none"
                      autoComplete="email"
                    />
                  </div>

                  {/* Contraseña */}
                  <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus-within:border-brand transition-colors">
                    <Lock size={16} className="text-white/40 shrink-0" aria-hidden="true" />
                    <input
                      type="password"
                      placeholder={t('signIn.password')}
                      aria-label={t('signIn.password')}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="flex-1 bg-transparent text-white text-sm placeholder:text-white/35 outline-none"
                      autoComplete="current-password"
                    />
                  </div>

                  {/* Recuperar */}
                  <p className="text-xs text-white/40 text-center">
                    {t('signIn.forgot')}{' '}
                    <button type="button" onClick={() => navigate('/change-password')} className="text-white/60 underline underline-offset-2 hover:text-white transition-colors cursor-pointer">
                      {t('signIn.recover')}
                    </button>
                  </p>

                  {/* CTA */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-4 rounded-xl transition-all hover:-translate-y-px hover:shadow-lg hover:shadow-brand/30 cursor-pointer disabled:opacity-60 mt-1"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg aria-hidden="true" className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                        {t('signIn.loading')}
                      </span>
                    ) : t('signIn.continue')}
                  </button>
                </form>

                {/* Divisor */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-xs text-white/30">{t('signIn.or')}</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>

                {/* Google */}
                <button type="button" disabled className="w-full flex items-center justify-center gap-3 bg-white text-black font-medium py-3.5 rounded-xl border border-gray-200 cursor-not-allowed opacity-80">
                  <img src={logoGoogle} alt="Google" className="w-5 h-5 object-contain" />
                  {t('signIn.google')}
                </button>

                {/* Link registro */}
                <p className="text-sm text-white/45 text-center">
                  {t('signIn.noAccount')}{' '}
                  <button
                    onClick={onRegister}
                    className="text-white font-semibold underline underline-offset-2 hover:text-brand transition-colors cursor-pointer"
                  >
                    {t('signIn.register')}
                  </button>
                </p>

                {/* Términos */}
                <p className="text-xs text-white/30 text-center leading-relaxed">
                  {t('signIn.terms1')}<br />
                  {t('signIn.terms2Pre')}{' '}
                  <a href="#" className="underline underline-offset-2 hover:text-white/60 transition-colors">
                    {t('signIn.termsLink')}
                  </a>
                </p>

              </div>
            </div>
          </div>

        </div>
      </div>
      <Footer />
    </div>
  )
}