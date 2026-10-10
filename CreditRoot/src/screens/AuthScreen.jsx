import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { TriangleAlert } from 'lucide-react'
import Footer from './components/Footer'
import LandingNavbar from './components/LandingNavbar'
import ardilla from '../assets/Ardilla_vector.png'

export function AuthScreen({ onVolver, onIrADatosPersonales }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [error] = useState(null)

  return (
    <div className="bg-[#0f0e0d] min-h-screen overflow-x-hidden">
      <LandingNavbar soloVolver onVolver={onVolver} />

      <div className="container mx-auto px-4 pt-10 pb-16">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center min-h-[calc(100vh-80px)]">

          {/* ── Columna izquierda ── */}
          <div className="hidden lg:flex flex-col justify-center anim-fade-up-1">
            <h1
              className="font-display font-bold text-white tracking-tight"
              style={{ fontSize: 'clamp(3rem,7vw,5rem)', lineHeight: 1.05 }}
            >
              {t('authScreen.tagline1Pre')} <em className="text-brand not-italic">{t('authScreen.tagline1Accent')}</em><br />
              {t('authScreen.tagline2Pre')} <em className="text-brand not-italic">{t('authScreen.tagline2Accent')}</em><br />
              {t('authScreen.tagline3Pre')} <em className="text-brand not-italic">{t('authScreen.tagline3Accent')}</em>
            </h1>
          </div>

          {/* ── Columna derecha — card ── */}
          <div className="anim-fade-up-2">
            <div className="bg-[#1a1814] border border-white/10 rounded-3xl p-8 lg:p-10">
              <div className="flex flex-col items-center gap-5">

                <div className="text-center">
                  <h2 className="font-display font-bold text-white text-4xl mb-3">
                    {t('authScreen.title')}
                  </h2>
                  <p className="text-white/55 text-base leading-relaxed">
                    {t('authScreen.subtitle1')}<br />{t('authScreen.subtitle2')}
                  </p>
                </div>

                <img
                  src={ardilla}
                  alt={t('auth.mascotaAlt')}
                  className="h-44 object-contain float-squirrel"
                />

                {error && (
                  <div className="w-full bg-red-500/8 border border-dashed border-red-400/40 text-red-500 text-sm text-center px-4 py-3 rounded-xl" role="alert">
                    <TriangleAlert size={16} className="inline shrink-0" aria-hidden="true" /> {error}
                  </div>
                )}

                <button
                  className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-4 rounded-xl transition-all hover:-translate-y-px hover:shadow-lg hover:shadow-brand/30 cursor-pointer text-base"
                  onClick={onIrADatosPersonales}
                >
                  {t('authScreen.createWithEmail')}
                </button>

                <p className="text-sm text-white/45">
                  {t('calc.yaTienesCuenta')}{' '}
                  <button
                    onClick={() => navigate('/signin-registro')}
                    className="text-white font-semibold underline underline-offset-2 hover:text-brand transition-colors cursor-pointer"
                  >
                    {t('calc.iniciarSesion')}
                  </button>
                </p>

                <p className="text-xs text-white/30 text-center leading-relaxed">
                  {t('authScreen.terms1')}<br />
                  {t('authScreen.terms2Pre')}{' '}
                  <a href="#" className="underline underline-offset-2 hover:text-white/60 transition-colors">
                    {t('authScreen.termsLink')}
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