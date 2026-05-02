import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import ardilla from '../../assets/Ardilla_vector.png'
import logo from '../../assets/LOGO_MS.png'
import { useScrollReveal } from '../../hooks/useScrollReveal'

function CtaFinal({ onRegister, onLogin }) {
    const ref = useRef(null)
    const visible = useScrollReveal(ref)
    const { t } = useTranslation()

    return (
        <section className="container mx-auto px-40 py-16" ref={ref}>
            <div className={`relative bg-brand rounded-3xl px-5 py-10 text-center overflow-hidden transition-all duration-700 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>

                <img src={ardilla} alt="" aria-hidden="true"
                    className="absolute -bottom-16 -right-16 w-80 opacity-10 rotate-[-12deg] pointer-events-none rounded-2xl" />
                <img src={logo} alt="" aria-hidden="true"
                    className="absolute -top-6 -left-6 w-40 opacity-10 rotate-[15deg] pointer-events-none rounded-xl" />

                <div className="relative z-10">
                    <span className="inline-block bg-white/15 text-white rounded-full px-4 py-1.5 text-xs font-semibold tracking-widest uppercase mb-5">
                        {t('landing.cta.badge')}
                    </span>
                    <h2 className="font-display font-black text-white mb-4 tracking-tight"
                        style={{ fontSize: 'clamp(2rem,5vw,3.2rem)', lineHeight: 1.05 }}>
                        {t('landing.cta.titulo')}<br />
                        <em className="italic opacity-85">{t('landing.cta.tituloAccent')}</em>
                    </h2>
                    <p className="text-white/70 text-base leading-relaxed max-w-md mx-auto mb-10">
                        {t('landing.cta.descripcion')}
                    </p>
                    <div className="flex gap-3 justify-center flex-wrap items-center">
                        <button
                            className="bg-white text-brand font-bold px-8 py-3.5 rounded-xl hover:-translate-y-px hover:shadow-lg transition-all cursor-pointer"
                            onClick={onRegister}>
                            {t('landing.cta.crear')}
                        </button>
                        <button
                            className="border-[1.5px] border-white/40 text-white font-semibold px-8 py-3.5 rounded-xl hover:bg-white/10 hover:-translate-y-px transition-all cursor-pointer"
                            onClick={onLogin}>
                            {t('landing.cta.yaTengo')}
                        </button>
                    </div>
                    <p className="text-white/40 text-xs mt-5">
                        {t('landing.cta.trust')}
                    </p>
                </div>
            </div>
        </section>
    )
}
export default CtaFinal