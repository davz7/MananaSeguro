import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { AtSign, DollarSign, TrendingUp } from 'lucide-react'
import { useScrollReveal } from '../../hooks/useScrollReveal'
import { Card } from '../../components/ui/Card'

const STEP_ICONS = [AtSign, DollarSign, TrendingUp]

function TresPasos() {
  const ref = useRef(null)
  const visible = useScrollReveal(ref)
  const { t } = useTranslation()

  const pasos = [
    { num: '01', titulo: t('landing.pasos.p1titulo'), desc: t('landing.pasos.p1desc') },
    { num: '02', titulo: t('landing.pasos.p2titulo'), desc: t('landing.pasos.p2desc') },
    { num: '03', titulo: t('landing.pasos.p3titulo'), desc: t('landing.pasos.p3desc') },
  ]

  return (
    <section className="py-16 bg-[#0f0e0d]" ref={ref}>
      <div className="container mx-auto px-4">

        {/* Encabezado */}
        <div className={`mb-12 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <p className="text-brand font-display font-bold"
            style={{ fontSize: 'clamp(1.8rem,5vw,2.6rem)', lineHeight: 1.1 }}>
            {t('landing.pasos.badge')}
          </p>
          <h2 className="font-display font-bold text-white"
            style={{ fontSize: 'clamp(2rem,5vw,3rem)', lineHeight: 1.05 }}>
            {t('landing.pasos.titulo')}{' '}
            <span className="text-white">{t('landing.pasos.tituloAccent')}</span>
          </h2>
        </div>

        {/* Grid de 3 cards */}
        <div className="grid md:grid-cols-3 gap-5">
          {pasos.map((p, i) => {
            const Icon = STEP_ICONS[i]
            return (
              <Card
                key={p.num}
                variant="flat"
                padding="lg"
                rounded="2xl"
                className={`relative overflow-hidden transition-all duration-500
                  bg-[#1a1814] border-white/10
                  ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
                style={{ transitionDelay: `${i * 120}ms` }}
              >
                {/* Número decorativo de fondo — no interfiere con el padding del Card */}
                <div
                  className="absolute top-0 right-2 font-display font-black leading-none text-white/[0.04] pointer-events-none select-none"
                  style={{ fontSize: '7rem' }}
                  aria-hidden="true"
                >
                  {p.num}
                </div>

                {/* Ícono circular naranja + número brand */}
                <div className="relative flex items-center gap-4 mb-5">
                  <div className="w-14 h-14 rounded-full bg-brand flex items-center justify-center shrink-0">
                    <Icon size={24} className="text-white" aria-hidden="true" />
                  </div>
                  <span className="font-display font-black text-brand text-4xl leading-none">
                    {p.num}
                  </span>
                </div>

                <h3 className="font-display font-black text-white text-xl mb-2 leading-tight relative">
                  {p.titulo}
                </h3>
                <p className="text-sm text-white/55 leading-relaxed relative">
                  {p.desc}
                </p>
              </Card>
            )
          })}
        </div>

      </div>
    </section>
  )
}
export default TresPasos
