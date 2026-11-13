import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Clock } from 'lucide-react'
import LandingNavbar from './components/LandingNavbar'
import Footer from './components/Footer'
import { GoogleSignInButton } from './components/GoogleSignInButton'

export function SignInScreen({ onAuth, onVolver, onRegister }) {
  const location = useLocation()
  const { t } = useTranslation()
  const sesionExpirada = location.state?.sesionExpirada ?? false

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
                    {t('signIn.subtitle1')}<br />{t('signIn.subtitleGoogle')}
                  </p>
                </div>

                {sesionExpirada && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-sm text-center px-4 py-3 rounded-xl" role="status">
                    <Clock size={15} className="inline shrink-0 mr-1" aria-hidden="true" />
                    {t('signIn.sessionExpired')}
                  </div>
                )}

                {/* Google: único método de acceso */}
                <GoogleSignInButton onAuth={onAuth} />

                {/* Link registro */}
                <p className="text-sm text-white/45 text-center">
                  {t('signIn.noAccount')}{' '}
                  <button
                    type="button"
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
