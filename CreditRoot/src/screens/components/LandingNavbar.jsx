import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDarkMode } from '../../hooks/useDarkMode'
import logoCompleto from '../../assets/LOGO_MS.png'

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
        <nav className={`sticky top-0 z-50 px-4 py-3 transition-shadow duration-300 bg-surface/90 dark:bg-[#0f0e0d]/90 backdrop-blur-md border-b border-ink/8 dark:border-white/8 ${scrolled ? 'shadow-md' : ''}`}>
            <div className="container mx-auto flex justify-between items-center">

                <div className="flex items-center gap-2">
                    <img src={logoCompleto} alt="Logo Mañana Seguro" className="h-8 w-auto rounded-lg" />
                    <span className="font-display font-bold text-xl text-ink dark:text-white tracking-tight">
                        Mañana <span className="text-brand">Seguro</span>
                    </span>
                </div>

                {soloVolver ? (
                    <button className="text-gray hover:text-ink dark:hover:text-white text-sm font-medium transition-colors cursor-pointer" onClick={onVolver}>
                        {t('nav.volverInicio')}
                    </button>
                ) : (
                    <div className="flex items-center gap-2">

                        {/* Toggle idioma */}
                        <button
                            className="text-xs font-bold px-3 py-1.5 rounded-lg border border-ink/10 dark:border-white/10 text-ink/50 dark:text-white/50 hover:text-ink dark:hover:text-white hover:border-ink/20 dark:hover:border-white/20 transition-all cursor-pointer"
                            onClick={toggleLang}>
                            {i18n.language === 'es' ? 'EN' : 'ES'}
                        </button>

                        {/* Toggle dark mode */}
                        <button
                            className="text-xs font-bold px-3 py-1.5 rounded-lg border border-ink/10 dark:border-white/10 text-ink/50 dark:text-white/50 hover:text-ink dark:hover:text-white hover:border-ink/20 transition-all cursor-pointer"
                            onClick={toggle}
                            aria-label="Toggle dark mode">
                            {dark ? '☀️' : '🌙'}
                        </button>

                        <button
                            className="hidden md:block text-gray hover:text-ink dark:hover:text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-ink/5 dark:hover:bg-white/5 transition-all cursor-pointer"
                            onClick={onLogin}>
                            {t('nav.iniciarSesion')}
                        </button>
                        <button
                            className="bg-brand hover:bg-brand-dark text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all hover:-translate-y-px hover:shadow-lg hover:shadow-brand/30 cursor-pointer"
                            onClick={onRegister}>
                            {t('nav.comenzarGratis')}
                        </button>
                    </div>
                )}

            </div>
        </nav>
    )
}
export default LandingNavbar