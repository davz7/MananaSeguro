import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Check, Circle, TriangleAlert } from 'lucide-react'
import LandingNavbar from './components/LandingNavbar'
import Footer from './components/Footer'
import { COUNTRY_LIST, COUNTRY_LOOKUP, getLocalizedCountryName } from '../data/countries'

function getCountryFlagUrl(flag) {
  const countryCode = [...flag]
    .map((indicator) => String.fromCharCode(indicator.codePointAt(0) - 127397))
    .join('')
    .toLowerCase()

  return `https://flagcdn.com/w40/${countryCode}.png`
}

export function DataProfile({ onContinuar }) {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()

  const [form, setForm] = useState({
    nombre: '',
    apellidoPaterno: '',
    apellidoMaterno: '',
    telefono: '',
    pais: 'México',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [countryPickerOpen, setCountryPickerOpen] = useState(false)
  const [countrySearch, setCountrySearch] = useState('')
  const selectedCountry = COUNTRY_LOOKUP[form.pais] ?? COUNTRY_LOOKUP['México']
  const localizedCountry = getLocalizedCountryName(selectedCountry, i18n.resolvedLanguage ?? i18n.language)

  const requirements = [
    { id: 'length', valid: form.password.length >= 12 },
    { id: 'uppercase', valid: /\p{Lu}/u.test(form.password) },
    { id: 'lowercase', valid: /\p{Ll}/u.test(form.password) },
    { id: 'number', valid: /\p{N}/u.test(form.password) },
    { id: 'symbol', valid: /[^\p{L}\p{N}]/u.test(form.password) },
  ]

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    if (error) setError(null)
  }

  function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      onContinuar ? onContinuar(form) : navigate('/verificacion-registro')
    }, 400)
  }

  const inputCls = 'w-full bg-card border border-white/15 rounded-xl px-4 py-3 text-sm text-white font-sans placeholder:text-white/35 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20'

  return (
    <div className="bg-bg min-h-screen flex flex-col overflow-x-hidden">
      <LandingNavbar soloVolver onVolver={() => navigate('/login')} />

      <div className="container mx-auto px-4 pt-10 pb-16 flex-1">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-start">

          {/* ── Columna izquierda ── */}
          <div className="hidden lg:flex flex-col justify-start pt-4 anim-fade-up-1">
            <h1 className="font-display font-bold text-white tracking-tight leading-[1.0] mb-5"
              style={{ fontSize: 'clamp(3.5rem,7vw,5.5rem)' }}>
              {t('dataProfile.titleLead')}<br />
              <em className="text-brand not-italic">{t('dataProfile.titleAccent')}</em>
            </h1>
            <p className="text-white/55 text-base leading-relaxed max-w-sm mb-12">
              {t('dataProfile.intro')}
            </p>

            <div className="flex flex-col gap-8">
              <div className="border-l-2 border-brand pl-4">
                <h3 className="font-display font-bold text-white text-2xl leading-tight mb-2">
                  {t('dataProfile.secureTitle')}
                </h3>
                <p className="text-white/55 text-sm leading-relaxed max-w-xs">
                  {t('dataProfile.secureText')}
                </p>
              </div>

              <div className="border-l-2 border-brand pl-4">
                <h3 className="font-display font-bold text-white text-2xl leading-tight mb-2">
                  {t('dataProfile.fastTitle')}
                </h3>
                <p className="text-white/55 text-sm leading-relaxed max-w-xs">
                  {t('dataProfile.fastText')}
                </p>
              </div>
            </div>
          </div>

          {/* ── Columna derecha — formulario ── */}
          <div className="anim-fade-up-2">
            <div className="bg-card border border-white/10 rounded-3xl p-8 lg:p-10">

              <h2 className="font-display font-bold text-white text-2xl mb-6">
                {t('dataProfile.formTitle')}
              </h2>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">

                {error && (
                  <div className="bg-red-500/8 border border-dashed border-red-400/40 text-red-400 text-sm px-4 py-3 rounded-xl flex items-center gap-2" role="alert">
                    <TriangleAlert size={15} className="shrink-0" aria-hidden="true" />
                    {error}
                  </div>
                )}

                {/* Nombre completo */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-white/50 uppercase tracking-widest font-sans">
                    {t('dataProfile.fullName')}
                  </span>
                  <input name="nombre" type="text" placeholder={t('dataProfile.firstName')} aria-label={t('dataProfile.firstName')}
                    value={form.nombre} onChange={handleChange} className={inputCls} />
                  <input name="apellidoPaterno" type="text" placeholder={t('dataProfile.paternalName')} aria-label={t('dataProfile.paternalName')}
                    value={form.apellidoPaterno} onChange={handleChange} className={inputCls} />
                  <input name="apellidoMaterno" type="text" placeholder={t('dataProfile.maternalName')} aria-label={t('dataProfile.maternalName')}
                    value={form.apellidoMaterno} onChange={handleChange} className={inputCls} />
                </div>

                {/* Crear acceso */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-white/50 uppercase tracking-widest font-sans">
                    {t('dataProfile.createAccess')}
                  </span>

                  {/* Teléfono con prefijo */}
                  <div className="relative">
                    <div className="flex items-center bg-[#1c1b1a] border border-white/15 rounded-xl overflow-hidden focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20 transition">
                      <button
                        type="button"
                        onClick={() => setCountryPickerOpen((open) => !open)}
                        aria-label={t('auth.registro.seleccionarPais')}
                        aria-expanded={countryPickerOpen}
                        className="flex items-center gap-2 self-stretch border-r border-white/15 px-3 text-sm text-white/75 transition hover:bg-white/5"
                      >
                        <img src={getCountryFlagUrl(selectedCountry.flag)} alt="" aria-hidden="true" className="h-[18px] w-6 shrink-0 rounded-[2px] object-cover" />
                        <span className="sr-only">{localizedCountry}</span>
                        <span>{selectedCountry.code}</span>
                      </button>
                      <input name="telefono" type="tel" placeholder={t('auth.registro.telefono')} aria-label={t('auth.registro.telefono')}
                        value={form.telefono} onChange={handleChange}
                        className="flex-1 bg-transparent px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none" />
                    </div>

                    {countryPickerOpen && (
                      <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-xl border border-white/15 bg-[#171615] shadow-2xl shadow-black/50">
                        <div className="border-b border-white/10 p-2.5">
                          <input
                            type="search"
                            value={countrySearch}
                            onChange={(event) => setCountrySearch(event.target.value)}
                            placeholder={t('auth.registro.buscarPais')}
                            aria-label={t('auth.registro.buscarPais')}
                            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-brand"
                          />
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                          {COUNTRY_LIST.filter((country) => {
                            const query = countrySearch.trim().toLowerCase()
                            const countryName = getLocalizedCountryName(country, i18n.resolvedLanguage ?? i18n.language)
                            return !query || country.name.toLowerCase().includes(query) || countryName.toLowerCase().includes(query) || country.code.includes(query)
                          }).map((country) => (
                            <button
                              key={country.name}
                              type="button"
                              onClick={() => {
                                setForm((previous) => ({ ...previous, pais: country.name }))
                                setCountryPickerOpen(false)
                                setCountrySearch('')
                              }}
                              className="flex w-full items-center gap-3 border-b border-white/5 px-3 py-2.5 text-left text-sm text-white/80 transition last:border-0 hover:bg-white/5"
                            >
                              <img src={getCountryFlagUrl(country.flag)} alt="" aria-hidden="true" loading="lazy" className="h-[18px] w-6 shrink-0 rounded-[2px] object-cover" />
                              <span className="min-w-0 flex-1 truncate">{getLocalizedCountryName(country, i18n.resolvedLanguage ?? i18n.language)}</span>
                              <span className="shrink-0 text-white/45">{country.code}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <input name="email" type="email" placeholder={t('dataProfile.email')} aria-label={t('dataProfile.email')}
                    value={form.email} onChange={handleChange} className={inputCls} />
                  <input name="password" type="password" placeholder={t('dataProfile.password')} aria-label={t('dataProfile.password')}
                    value={form.password} onChange={handleChange} className={inputCls} />

                  {form.password.length > 0 && (
                    <div className="rounded-xl border border-white/10 bg-[#1c1b1a] p-4">
                      <p className="mb-3 text-sm font-semibold text-white">{t('changePassword.requirementsTitle')}</p>
                      <ul className="space-y-2">
                        {requirements.map(({ id, valid }) => (
                          <li key={id} className={`flex items-center gap-2 text-sm ${valid ? 'text-green-400' : 'text-white/45'}`}>
                            {valid ? <Check size={14} /> : <Circle size={12} />}
                            <span>{t(`changePassword.requirements.${id}`)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <input name="confirmPassword" type="password" placeholder={t('dataProfile.confirmPassword')} aria-label={t('dataProfile.confirmPassword')}
                    value={form.confirmPassword} onChange={handleChange} className={inputCls} />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-3.5 rounded-xl transition-all hover:-translate-y-px hover:shadow-lg hover:shadow-brand/30 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-base mt-1"
                >
                  {loading ? t('dataProfile.processing') : t('dataProfile.continue')}
                </button>

                <p className="text-center text-xs text-white/35 leading-relaxed">
                  {t('dataProfile.privacyPre')}{' '}
                  <a href="#" className="underline underline-offset-2 hover:text-white/60 transition-colors">
                    {t('dataProfile.privacyLink')}
                  </a>
                </p>

              </form>
            </div>
          </div>

        </div>
      </div>

      <Footer dark />
    </div>
  )
}