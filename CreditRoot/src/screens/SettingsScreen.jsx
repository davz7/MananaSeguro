import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  FileText,
  Info,
  LogOut,
  MessageSquare,
  Shield,
  Star,
  UserRound,
  Zap,
} from 'lucide-react'
import ardilla from '../assets/Ardilla_vector.png'
import brandLogo from '../assets/LOGO_MS_orange.png'
import Footer from './components/Footer'

const settingsActions = [
  { id: 'profile', icon: <UserRound size={19} strokeWidth={2} aria-hidden="true" /> },
  { id: 'privacy', icon: <Shield size={19} strokeWidth={2} aria-hidden="true" /> },
  { id: 'help', icon: <MessageSquare size={19} strokeWidth={2} aria-hidden="true" /> },
  { id: 'history', icon: <FileText size={19} strokeWidth={2} aria-hidden="true" /> },
  { id: 'msid', icon: <Star size={19} strokeWidth={2} aria-hidden="true" /> },
  { id: 'wallet', icon: <Zap size={19} strokeWidth={2} aria-hidden="true" /> },
  { id: 'about', icon: <Info size={19} strokeWidth={2} aria-hidden="true" /> },
]

export function SettingsScreen({ usuario, onLogout, onAction }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const firstName = usuario?.nombre?.trim() || t('settings.namePlaceholder')
  const lastNames = [usuario?.apellidoPaterno, usuario?.apellidoMaterno]
    .filter(Boolean)
    .join(' ')
  const displayName = `${firstName} ${lastNames || t('settings.lastNamePlaceholder')}`

  function toggleLanguage() {
    i18n.changeLanguage(i18n.resolvedLanguage?.startsWith('es') ? 'en' : 'es')
  }

  function handleAction(actionId) {
    onAction?.(actionId)
    if (actionId === 'profile') {
      navigate('/profile-info')
      return
    }
    if (actionId === 'privacy') {
      navigate('/change-password', { state: { from: '/settings' } })
      return
    }
    if (actionId === 'about') {
      navigate('/about', { state: { from: location.pathname } })
    }
  }

  return (
    <div className="dark flex min-h-screen flex-col bg-[#100f0e] text-[#f4f0ec]">
      <header className="relative z-10 flex h-[60px] items-center justify-between border-b border-white/10 px-5 sm:px-8">
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            type="button"
            onClick={() => navigate(location.state?.from || '/main')}
            className="flex h-9 items-center gap-1 rounded-lg px-2 text-sm text-white/65 transition hover:bg-white/5 hover:text-white"
            aria-label={t('settings.back')}
          >
            <ArrowLeft size={17} aria-hidden="true" />
            <span>{t('settings.back')}</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/main')}
            className="flex min-h-10 items-center gap-2 text-left"
            aria-label={t('settings.goHome')}
          >
            <img src={brandLogo} alt="" className="h-8 w-8 object-contain" />
            <span className="font-display text-lg font-bold text-white sm:text-xl">
              {t('nav.marca')} <span className="text-brand">{t('nav.marcaAccent')}</span>
            </span>
          </button>
        </div>

        <button
          type="button"
          onClick={toggleLanguage}
          className="h-9 min-w-10 rounded-lg border border-white/25 px-2 text-xs font-semibold transition hover:border-white/60 hover:bg-white/5"
          aria-label={t('nav.cambiarIdioma')}
        >
          {i18n.resolvedLanguage?.startsWith('es') ? 'EN' : 'ES'}
        </button>
      </header>

      <main className="mx-auto grid w-full max-w-[1120px] flex-1 content-center gap-10 px-6 py-10 sm:px-10 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16 lg:px-12">
        <section className="flex flex-col justify-center" aria-labelledby="settings-title">
          <div className="mb-6 flex items-center gap-5">
            {usuario?.foto ? (
              <img
                src={usuario.foto}
                alt={displayName}
                className="h-[76px] w-[76px] shrink-0 rounded-full border border-white/10 object-cover"
              />
            ) : (
              <img
                src={ardilla}
                alt={t('settings.avatarAlt')}
                className="h-[76px] w-[76px] shrink-0 rounded-full border border-white/10 bg-[#292521] object-cover"
              />
            )}
            <h1 className="max-w-[300px] text-[1.6rem] font-bold leading-tight sm:text-[1.8rem]">
              {displayName}
            </h1>
          </div>

          <h2 id="settings-title" className="max-w-[460px] text-[2.6rem] font-black leading-[1.03] sm:text-[3.5rem]">
            {t('settings.title')}
            <span className="mt-1 block text-[#e97816]">{t('settings.titleAccent')}</span>
          </h2>

          <div className="mt-10 max-w-[380px]">
            <p className="mb-4 text-sm text-white/55">{t('settings.signOutLabel')}</p>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex min-h-11 w-full items-center justify-center gap-3 rounded-md bg-[#e97816] px-4 text-sm font-semibold text-white transition hover:bg-[#f08727] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f08727]"
            >
              <LogOut size={18} aria-hidden="true" />
              {t('settings.signOut')}
            </button>
          </div>
        </section>

        <section className="w-full rounded-[24px] bg-white/[0.035] p-5 sm:p-7" aria-labelledby="settings-menu-title">
          <h2 id="settings-menu-title" className="mb-5 px-2 text-sm font-medium text-white/55">
            {t('settings.menuTitle')}
          </h2>
          <div className="space-y-1">
            {settingsActions.map(({ id, icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => handleAction(id)}
                className="flex min-h-11 w-full items-center gap-4 rounded-lg bg-black/10 px-3 text-left text-sm transition hover:bg-white/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e97816]"
              >
                {icon}
                <span>{t(`settings.actions.${id}`)}</span>
              </button>
            ))}
          </div>
        </section>
      </main>
      <Footer dark />
    </div>
  )
}