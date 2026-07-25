import { useTranslation } from 'react-i18next'
import LandingNavbar from './components/LandingNavbar'
import Footer from './components/Footer'
import CalculadoraHero from "./landingScreenComponents/CalculadoraHero"
import TresPasos from "./landingScreenComponents/TresPasos"
import CtaFinal from "./landingScreenComponents/CtaFinal"
import Marquee from './landingScreenComponents/Marquee'
import { useEtherfuseRate } from '../hooks/useEtherfuseRate'

export function LandingScreen({ onLogin, onRegister }) {
  const { t } = useTranslation()
  const { userRate, loading } = useEtherfuseRate()

  const apy = userRate > 0 ? userRate.toFixed(2) : '—'

  // Puntos del hero , todos via i18n para que el cambio de idioma funcione
  const puntos = [
    t('landing.puntos.apy', { apy }),
    t('landing.puntos.spei'),
    t('landing.puntos.prestamo'),
  ]

  // Bancos , via i18n
  const bancos = t('landing.bancos', { returnObjects: true })

  return (
    <div className="bg-surface dark:bg-[#0f0e0d] min-h-screen overflow-x-hidden">

      <LandingNavbar onLogin={onLogin} onRegister={onRegister} />

      <header className="container mx-auto px-4 py-16 lg:py-24">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          <div>
            <span className="inline-block bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20 rounded-lg px-4 py-1.5 text-xs font-semibold mb-6 anim-fade-up-1">
              {t('landing.badge')}
            </span>

            <h1 className="font-display font-black text-ink dark:text-white tracking-tight mb-4 anim-fade-up-2"
              style={{ fontSize: 'clamp(2.6rem,6vw,4rem)', lineHeight: 1.05 }}>
              {t('landing.titulo')}<br />
              <em className="text-brand italic">{t('landing.tituloAccent')}</em>
            </h1>

            <p className="text-ink/55 dark:text-white/55 text-lg leading-relaxed max-w-md mb-8 anim-fade-up-3">
              {t('landing.descripcion')}
            </p>

            <div className="flex flex-col gap-3 mb-8 anim-fade-up-4">
              {puntos.map(texto => (
                <div key={texto} className="flex items-start gap-3 group">
                  <span className="w-5 h-5 rounded-full bg-brand/10 group-hover:bg-brand/20 flex items-center justify-center shrink-0 mt-0.5 transition-colors">
                    <svg width="9" height="9" viewBox="0 0 10 10">
                      <polyline points="1,5 4,8 9,2" fill="none" stroke="#e3730d" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="text-sm text-ink/55 dark:text-white/55 leading-relaxed">{texto}</span>
                </div>
              ))}
            </div>

            {/* Live rate pill */}
            {!loading && (
              <div className="inline-flex items-center gap-2 bg-green-500/8 border border-green-500/20 rounded-full px-4 py-2 mb-8 anim-fade-up-4">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
                <span className="text-xs text-green-700 dark:text-green-400 font-semibold">
                  {apy !== '—' ? t('landing.ratePill', { apy }) : t('calc.cargando')}
                </span>
              </div>
            )}

            {/* Bancos aceptados */}
            <div className="mb-8 anim-fade-up-4">
              <p className="text-xs text-ink/30 dark:text-white/30 mb-3">{t('landing.bancosLabel')}</p>
              <div className="flex gap-2 flex-wrap">
                {Array.isArray(bancos) && bancos.map(banco => (
                  <span key={banco} className="text-xs bg-ink/4 dark:bg-white/5 border border-ink/8 dark:border-white/8 rounded-lg px-3 py-1.5 text-ink/45 dark:text-white/45 font-medium">
                    {banco}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex gap-3 flex-wrap anim-fade-up-5">
              <button
                className="bg-brand hover:bg-brand-dark text-white font-semibold px-6 py-3.5 rounded-xl transition-all hover:-translate-y-px hover:shadow-lg hover:shadow-brand/30 cursor-pointer"
                onClick={onRegister}>
                {t('landing.comenzar')}
              </button>
              <button
                className="border-[1.5px] border-ink/20 dark:border-white/20 text-ink dark:text-white font-semibold px-6 py-3.5 rounded-xl hover:bg-ink/5 dark:hover:bg-white/5 hover:border-ink/30 hover:-translate-y-px transition-all cursor-pointer"
                onClick={onLogin}>
                {t('landing.yaTengo')}
              </button>
            </div>
          </div>

          <div className="anim-fade-up-calc">
            <CalculadoraHero onRegister={onRegister} />
          </div>

        </div>
      </header>

      <Marquee />
      <TresPasos />
      <CtaFinal onRegister={onRegister} onLogin={onLogin} />
      <Footer />
    </div>
  )
}
