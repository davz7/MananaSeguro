import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useDarkMode } from '../../hooks/useDarkMode'
import { navigationItems } from '../../app/navigation'
import { useEtherfuseRate } from '../../hooks/useEtherfuseRate'
import logoCompleto from '../../assets/LOGO_MS.png'

export function AppHeader({ usuario, onLogout }) {
  const { userRate, isLive } = useEtherfuseRate()
  const navigate = useNavigate()
  const location = useLocation()
  const { t, i18n } = useTranslation()
  const { dark, toggle } = useDarkMode()
  const [menuOpen, setMenuOpen] = useState(false)

  function toggleLang() {
    i18n.changeLanguage(i18n.language === 'es' ? 'en' : 'es')
  }

  function handleNavigate(href) {
    navigate(href)
    setMenuOpen(false)
  }

  return (
    <nav className="sticky top-0 z-50 bg-surface/90 dark:bg-[#0f0e0d]/90 backdrop-blur-md border-b border-ink/8 dark:border-white/8 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-3">

          {/* Logo */}
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/home')}>
            <img src={logoCompleto} alt="Logo Mañana Seguro" className="h-8 w-auto rounded-lg" />
            <span className="font-display font-bold text-xl text-ink dark:text-white tracking-tight">
              Mañana <span className="text-brand">Seguro</span>
            </span>
          </div>

          {/* Nav desktop */}
          <div className="hidden md:flex items-center gap-1">
            {navigationItems.map(item => (
              <button
                key={item.href}
                className={`text-sm font-medium px-4 py-2 rounded-lg transition-all cursor-pointer ${location.pathname === item.href
                    ? 'text-brand bg-brand/8'
                    : 'text-ink/45 dark:text-white/45 hover:text-ink dark:hover:text-white hover:bg-ink/5 dark:hover:bg-white/5'
                  }`}
                onClick={() => handleNavigate(item.href)}>
                {t(`nav.${item.key}`)}
              </button>
            ))}
          </div>

          {/* Acciones desktop */}
          <div className="hidden md:flex items-center gap-2">

            <button
              className="text-xs font-bold px-3 py-1.5 rounded-lg border border-ink/10 dark:border-white/10 text-ink/50 dark:text-white/50 hover:text-ink dark:hover:text-white hover:border-ink/20 transition-all cursor-pointer"
              onClick={toggleLang}>
              {i18n.language === 'es' ? 'EN' : 'ES'}
            </button>

            <button
              className="text-xs font-bold px-3 py-1.5 rounded-lg border border-ink/10 dark:border-white/10 text-ink/50 dark:text-white/50 hover:text-ink dark:hover:text-white hover:border-ink/20 transition-all cursor-pointer"
              onClick={toggle}
              aria-label="Toggle dark mode">
              {dark ? '☀️' : '🌙'}
            </button>

            <span className={`hidden lg:flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border ${isLive
                ? 'bg-green-500/10 text-green-700 border-green-500/20'
                : 'bg-yellow-400/10 text-yellow-600 border-yellow-400/20'
              }`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current pulse-dot" />
              {userRate}% APY
            </span>

            {usuario && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {usuario.nombre.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm text-ink/50 dark:text-white/50">
                  {usuario.nombre.split(' ')[0]}
                </span>
              </div>
            )}

            {onLogout && (
              <button
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-ink/10 dark:border-white/10 text-ink/50 dark:text-white/50 hover:text-red-500 hover:border-red-500/30 transition-all cursor-pointer"
                onClick={onLogout}>
                {t('nav.cerrarSesion')}
              </button>
            )}

          </div>

          {/* Hamburguesa mobile */}
          <button
            className="md:hidden flex flex-col justify-center items-center w-8 h-8 gap-1.5 cursor-pointer"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu">
            <span className={`w-5 h-0.5 bg-ink dark:bg-white transition-all duration-300 ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
            <span className={`w-5 h-0.5 bg-ink dark:bg-white transition-all duration-300 ${menuOpen ? 'opacity-0' : ''}`} />
            <span className={`w-5 h-0.5 bg-ink dark:bg-white transition-all duration-300 ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
          </button>

        </div>
      </div>

      {/* Menu mobile */}
      {menuOpen && (
        <div className="md:hidden border-t border-ink/8 dark:border-white/8 bg-surface dark:bg-[#0f0e0d]">
          <div className="container mx-auto px-4 py-4 flex flex-col gap-1">

            {/* Nav links */}
            {navigationItems.map(item => (
              <button
                key={item.href}
                className={`text-sm font-medium px-4 py-3 rounded-xl text-left transition-all cursor-pointer ${location.pathname === item.href
                    ? 'text-brand bg-brand/8'
                    : 'text-ink/60 dark:text-white/60 hover:text-ink dark:hover:text-white hover:bg-ink/5 dark:hover:bg-white/5'
                  }`}
                onClick={() => handleNavigate(item.href)}>
                {t(`nav.${item.key}`)}
              </button>
            ))}

            <div className="h-px bg-ink/8 dark:bg-white/8 my-2" />

            {/* Controles */}
            <div className="flex items-center gap-2 px-2">

              <button
                className="text-xs font-bold px-3 py-1.5 rounded-lg border border-ink/10 dark:border-white/10 text-ink/50 dark:text-white/50 hover:text-ink dark:hover:text-white transition-all cursor-pointer"
                onClick={toggleLang}>
                {i18n.language === 'es' ? 'EN' : 'ES'}
              </button>

              <button
                className="text-xs font-bold px-3 py-1.5 rounded-lg border border-ink/10 dark:border-white/10 text-ink/50 dark:text-white/50 hover:text-ink dark:hover:text-white transition-all cursor-pointer"
                onClick={toggle}>
                {dark ? '☀️' : '🌙'}
              </button>

              <span className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border ${isLive
                  ? 'bg-green-500/10 text-green-700 border-green-500/20'
                  : 'bg-yellow-400/10 text-yellow-600 border-yellow-400/20'
                }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current pulse-dot" />
                {userRate}% APY
              </span>
            </div>

            {/* Usuario + logout */}
            {usuario && (
              <div className="flex items-center justify-between px-2 pt-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {usuario.nombre.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm text-ink/50 dark:text-white/50">
                    {usuario.nombre.split(' ')[0]}
                  </span>
                </div>
                {onLogout && (
                  <button
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-ink/10 dark:border-white/10 text-ink/50 dark:text-white/50 hover:text-red-500 hover:border-red-500/30 transition-all cursor-pointer"
                    onClick={onLogout}>
                    {t('nav.cerrarSesion')}
                  </button>
                )}
              </div>
            )}

          </div>
        </div>
      )}
    </nav>
  )
}