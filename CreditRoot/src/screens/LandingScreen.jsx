import { useTranslation } from 'react-i18next'
import { CheckCircle } from 'lucide-react'
import LandingNavbar from './components/LandingNavbar'
import Footer from './components/Footer'
import CalculadoraHero from './landingScreenComponents/CalculadoraHero'
import TresPasos from './landingScreenComponents/TresPasos'
import CtaFinal from './landingScreenComponents/CtaFinal'
import { BrandLogo } from '../components/ui/BrandLogo'
import { useEtherfuseRate } from '../hooks/useEtherfuseRate'

export function LandingScreen({ onLogin, onRegister }) {
  const { t } = useTranslation()
  const { userRate } = useEtherfuseRate()

  const apy = userRate > 0 ? userRate.toFixed(2) : '—'

  const puntos = [
    t('landing.puntos.apy', { apy }),
    t('landing.puntos.spei'),
    t('landing.puntos.prestamo'),
  ]

  // Lista de bancos — consumida desde i18n, no duplicada
  const bancos = t('landing.bancos', { returnObjects: true })

  return (
    <div className="bg-[#0f0e0d] min-h-screen overflow-x-hidden">

      <LandingNavbar onLogin={onLogin} onRegister={onRegister} />

      {/* Hero */}
      <header className="container mx-auto px-4 pt-10 pb-16">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-start">

          {/* ── Columna izquierda ── */}
          <div className="anim-fade-up-1 flex flex-col">

            {/* Logo cuadrado redondeado + tagline */}
            <div className="flex items-center gap-4 mb-6">
              <BrandLogo size="lg" />
              <div>
                <p className="text-white/60 text-sm font-medium leading-tight">Somos</p>
                <p className="text-white font-display font-black text-xl leading-tight">MañanaSeguro.</p>
              </div>
            </div>

            {/* H1 */}
            <h1
              className="font-display font-bold text-white tracking-tight mb-6"
              style={{ fontSize: 'clamp(2.8rem,7vw,4.5rem)', lineHeight: 1.0 }}
            >
              {t('landing.titulo')}<br />
              <em className="text-brand not-italic">{t('landing.tituloAccent')}</em>
            </h1>

            {/* Descripción */}
            <p className="text-white/55 text-base leading-relaxed max-w-sm mb-8">
              {t('landing.descripcion')}
            </p>

            {/* Bullets */}
            <div className="flex flex-col gap-3 mb-8">
              {puntos.map(texto => (
                <div key={texto} className="flex items-start gap-3">
                  <CheckCircle size={17} className="text-brand shrink-0 mt-0.5" aria-hidden="true" />
                  <span className="text-sm text-white/60 leading-relaxed">{texto}</span>
                </div>
              ))}
            </div>

            {/* Bancos — debajo de bullets */}
            <div>
              <p className="text-xs text-white/40 mb-3">{t('landing.bancosLabel')}</p>
              <div className="flex gap-2 flex-wrap">
                {Array.isArray(bancos) && bancos.map(banco => (
                  <span
                    key={banco}
                    className="text-sm border border-white/20 rounded-lg px-4 py-2 text-white/80 font-medium bg-transparent hover:border-white/40 transition-colors"
                  >
                    {banco}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* ── Columna derecha — solo calculadora ── */}
          <div className="anim-fade-up-calc">
            <CalculadoraHero onRegister={onRegister} onLogin={onLogin} />
          </div>

        </div>
      </header>

      <TresPasos />
      <CtaFinal onRegister={onRegister} onLogin={onLogin} />
      <Footer />
    </div>
  )
}
