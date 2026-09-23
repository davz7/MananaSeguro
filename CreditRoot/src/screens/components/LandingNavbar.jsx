import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDarkMode } from '../../hooks/useDarkMode'
import logoPng from "/src/assets/LogoPng.png";

function LandingNavbar({ onLogin, onRegister, onVolver, soloVolver }) {
    const [scrolled, setScrolled] = useState(false)
    const { t, i18n } = useTranslation()
    const { dark, toggle } = useDarkMode()

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 20)
        window.addEventListener('scroll', onScroll)
        return () => window.removeEventListener('scroll', onScroll)
    }, [])

    function toggleLang() {
        i18n.changeLanguage(i18n.language === 'es' ? 'en' : 'es')
    }

    return (
        <nav className={`sticky top-0 z-50 px-4 py-3 transition-shadow duration-300 bg-[#0f0e0d] border-b border-white/8 ${scrolled ? 'shadow-md shadow-black/40' : ''}`}>
            <div className="container mx-auto flex justify-between items-center">

                <div className="flex items-center gap-2">
                    <img src={logoPng} alt="Logo" className="h-8 w-8 object-contain rounded-lg shrink-0" />
                    <span className="font-display font-bold text-xl text-white tracking-tight">
                        {t('nav.marca')} <span className="text-brand">{t('nav.marcaAccent')}</span>
                    </span>
                </div>

                {soloVolver ? (
                    <div className="flex items-center gap-2">
                        <button
                            className="text-xs font-bold px-3 py-1.5 rounded-lg border border-white/20 text-white/70 hover:text-white hover:border-white/40 transition-all cursor-pointer"
                            onClick={toggleLang}
                            aria-label={t('nav.cambiarIdioma')}>
                            {i18n.language === 'es' ? 'EN' : 'ES'}
                        </button>
                        <button
                            className="text-xs font-bold px-3 py-1.5 rounded-lg border border-white/20 text-white/70 hover:text-white hover:border-white/40 transition-all cursor-pointer"
                            onClick={onVolver}>
                            {t('nav.inicio')}
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        {/* Toggle idioma — único control visible en el navbar del Landing */}
                        <button
                            className="text-xs font-bold px-3 py-1.5 rounded-lg border border-white/20 text-white/70 hover:text-white hover:border-white/40 transition-all cursor-pointer"
                            onClick={toggleLang}
                            aria-label={t('nav.cambiarIdioma')}>
                            {i18n.language === 'es' ? 'EN' : 'ES'}
                        </button>
                    </div>
                )}

            </div>
        </nav>
    )
}
export default LandingNavbar