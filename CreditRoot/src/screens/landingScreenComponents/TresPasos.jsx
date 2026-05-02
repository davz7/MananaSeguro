import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useScrollReveal } from '../../hooks/useScrollReveal'

function TresPasos() {
    const ref = useRef(null)
    const visible = useScrollReveal(ref)
    const { t } = useTranslation()

    const pasos = [
        { num: '01', icon: '🔗', titulo: t('landing.pasos.p1titulo'), desc: t('landing.pasos.p1desc') },
        { num: '02', icon: '💸', titulo: t('landing.pasos.p2titulo'), desc: t('landing.pasos.p2desc') },
        { num: '03', icon: '📈', titulo: t('landing.pasos.p3titulo'), desc: t('landing.pasos.p3desc') },
    ]

    return (
        <section className="py-24 bg-surface dark:bg-[#0f0e0d] relative overflow-hidden" ref={ref}>
            <div className="container mx-auto px-4">

                <div className={`max-w-2xl mb-16 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                    <span className="inline-block bg-brand text-white border border-brand rounded-lg px-6 py-2 text-xs font-semibold tracking-wide mb-4">
                        {t('landing.pasos.badge')}
                    </span>
                    <h2 className="font-display font-black text-ink dark:text-white tracking-tight"
                        style={{ fontSize: 'clamp(2rem,5vw,3rem)', lineHeight: 1.05 }}>
                        {t('landing.pasos.titulo')}{' '}
                        <em className="font-bold italic text-ink/30 dark:text-white/30">{t('landing.pasos.tituloAccent')}</em>
                    </h2>
                </div>

                <div className="grid md:grid-cols-3 gap-5">
                    {pasos.map((p, i) => (
                        <div key={p.num}
                            className={`group relative bg-white dark:bg-white/5 rounded-2xl p-7 border border-ink/8 dark:border-white/8 overflow-hidden cursor-default transition-all duration-500 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-ink/8 dark:hover:shadow-white/5 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
                            style={{ transitionDelay: `${i * 120}ms` }}>

                            <div className="absolute top-0 right-2 font-display font-black leading-none text-ink/[0.04] dark:text-white/[0.04] group-hover:text-brand/70 transition-colors duration-500 pointer-events-none select-none"
                                style={{ fontSize: '7rem' }}>
                                {p.num}
                            </div>

                            <div className="relative w-12 h-12 rounded-2xl bg-ink dark:bg-white/10 flex items-center justify-center mb-6 text-xl group-hover:bg-brand group-hover:-rotate-6 transition-all duration-300">
                                {p.icon}
                            </div>

                            <h3 className="font-display font-bold text-ink dark:text-white text-lg mb-2">{p.titulo}</h3>
                            <p className="text-sm text-ink/55 dark:text-white/55 leading-relaxed">{p.desc}</p>
                        </div>
                    ))}
                </div>

            </div>
        </section>
    )
}
export default TresPasos