import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useDarkMode } from '../../hooks/useDarkMode'
import logoPng from '../../assets/LOGO_MS_orange.png'

// onLogin y onRegister: reservadas para el flujo de auth del Landing (aún no implementado en navbar)
function LandingNavbar({ onVolver, soloVolver, appMode }) {
    const [scrolled, setScrolled] = useState(false)
    const { t, i18n } = useTranslation()
    // _dark y _toggle: dark mode pendiente de implementar en navbar
    const { dark: _dark, toggle: _toggle } = useDarkMode()
    const navigate = useNavigate()

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 20)
        window.addEventListener('scroll', onScroll)
        return () => window.removeEventListener('scroll', onScroll)
    }, [])

    function toggleLang() {
        i18n.changeLanguage(i18n.language === 'es' ? 'en' : 'es')
    }

    function irAlInicio() {
        let autenticado = false
        try {
            autenticado = !!localStorage.getItem('ms_usuario')
        } catch {
            autenticado = false
        }
        navigate(autenticado ? '/main' : '/')
    }

    return (
        <nav className={`sticky top-0 z-50 px-4 py-3 transition-shadow duration-300 bg-[#0f0e0d] border-b border-white/8 ${scrolled ? 'shadow-md shadow-black/40' : ''}`}>
            <div className="container mx-auto flex justify-between items-center">
                <button
                    type="button"
                    onClick={irAlInicio}
                    className="flex items-center gap-2 bg-transparent border-0 p-0 cursor-pointer"
                    aria-label={t('nav.inicio')}>
                    <img src={logoPng} alt="" className="h-8 w-8 object-contain rounded-lg shrink-0" />
                    <span className="font-display font-bold text-xl text-white tracking-tight">
                        {t('nav.marca')} <span className="text-brand">{t('nav.marcaAccent')}</span>
                    </span>
                </button>

                {appMode ? (
                    <div className="flex items-center gap-2">
                        <button
                            className="text-xs font-bold px-3 py-1.5 rounded-lg border border-white/20 text-white/70 hover:text-white hover:border-white/40 transition-all cursor-pointer"
                            onClick={toggleLang}
                            aria-label={t('nav.cambiarIdioma')}>
                            {i18n.language === 'es' ? 'EN' : 'ES'}
                        </button>
                        <button
                            onClick={() => navigate('/settings')}
                            className="w-8 h-8 rounded-full flex items-center justify-center border border-white/20 text-white/70 hover:text-white hover:border-white/40 transition-all cursor-pointer"
                            aria-label="Perfil"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="8" r="4" />
                                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                            </svg>
                        </button>
                    </div>
                ) : soloVolver ? (
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
