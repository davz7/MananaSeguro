import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LandingNavbar from './components/LandingNavbar'
import Footer from './components/Footer'

const BANCOS = [
  'BBVA', 'Banamex', 'Santander', 'Banorte', 'HSBC',
  'Scotiabank', 'Inbursa', 'Azteca', 'BanBajío',
]

const RELACIONES = ['spouse', 'child', 'father', 'mother', 'sibling', 'other']

function SelectField({ name, value, onChange, placeholder, options = [] }) {
  return (
    <div className="relative w-full">
      <select
        name={name}
        value={value}
        onChange={onChange}
        aria-label={placeholder}
        className="w-full appearance-none bg-[#1c1b1a] text-white text-sm border border-white/20 rounded-xl py-3 pl-4 pr-10 outline-none transition-colors focus:border-[#d96b00] focus:ring-2 focus:ring-[#d96b00]/40 cursor-pointer"
      >
        <option value="" disabled>{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-[#1c1b1a]">{opt.label}</option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white"
        viewBox="0 0 12 8" fill="currentColor" aria-hidden="true"
      >
        <path d="M0 0h12L6 8z" />
      </svg>
    </div>
  )
}

function InputField({ name, value, onChange, placeholder, prefix }) {
  return (
    <div className="relative w-full flex items-center">
      {prefix && (
        <span className="absolute left-4 text-sm text-white/60 select-none">{prefix}</span>
      )}
      <input
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        aria-label={placeholder}
        className={`w-full bg-[#1c1b1a] text-white text-sm border border-white/20 rounded-xl py-3 pr-4 outline-none transition-colors focus:border-[#d96b00] focus:ring-2 focus:ring-[#d96b00]/40 placeholder:text-white/35 ${prefix ? 'pl-14' : 'pl-4'}`}
      />
    </div>
  )
}

const INITIAL = {
  nombreTitular: '',
  banco: '',
  clabe: '',
  nombreBeneficiario: '',
  relacion: '',
  telefono: '',
}

export function DataAccount() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [form, setForm] = useState(INITIAL)

  const bankOptions = [
    ...BANCOS.map((b) => ({ value: b, label: b })),
    { value: 'other', label: t('dataAccount.other') },
  ]
  const relationOptions = RELACIONES.map((r) => ({
    value: r,
    label: t(`dataAccount.relations.${r}`),
  }))

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = () => {
    navigate('/conexion-rapida')
  }

  return (
    <div className="bg-[#0f0e0d] min-h-screen flex flex-col overflow-x-hidden">
      <LandingNavbar soloVolver onVolver={() => navigate('/perfil-meta')} />

      <section className="flex-1 py-10 px-4 sm:px-6 lg:px-12">
        <div className="w-full max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-20 items-start">

            {/* IZQUIERDA */}
            <div className="hidden lg:flex flex-col justify-start items-start space-y-6 pt-2">
              <h1
                className="font-display font-bold text-white tracking-tight leading-[1.05]"
                style={{ fontSize: 'clamp(3rem,6vw,5rem)' }}
              >
                {t('dataAccount.titleLead')}{' '}
                <em className="text-[#d96b00] not-italic">
                  {t('dataAccount.titleAccent1')}<br />{t('dataAccount.titleAccent2')}
                </em>
              </h1>
              <p className="text-white/55 text-base leading-relaxed max-w-md">
                {t('dataAccount.description')}
              </p>
            </div>

            {/* TARJETA */}
            <div className="w-full max-w-md mx-auto">
              <div className="bg-[#1a1917] border border-white/10 shadow-2xl shadow-black/80 p-6 sm:p-10 rounded-3xl flex flex-col">

                {/* Regresar móvil */}
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="lg:hidden flex items-center gap-1.5 text-white/70 hover:text-white transition-colors mb-6 text-sm font-medium self-start cursor-pointer group"
                >
                  <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  <span>{t('dataAccount.back')}</span>
                </button>

                {/* Encabezado móvil */}
                <div className="lg:hidden mb-6 text-left">
                  <h2 className="font-display font-bold text-white text-3xl tracking-tight mb-2">
                    {t('dataAccount.mobileTitleLead')} <em className="text-[#d96b00] not-italic">{t('dataAccount.mobileTitleAccent')}</em>
                  </h2>
                  <p className="text-white/55 text-sm leading-relaxed">
                    {t('dataAccount.mobileSubtitle')}
                  </p>
                </div>

                {/* Encabezado escritorio */}
                <div className="hidden lg:block mb-8 text-center">
                  <h3 className="font-display font-bold text-2xl text-white leading-snug">
                    {t('dataAccount.cardTitle1')}<br />{t('dataAccount.cardTitle2')}
                  </h3>
                </div>

                {/* Datos bancarios */}
                <fieldset className="mb-4">
                  <legend className="text-sm font-semibold text-white mb-2">{t('dataAccount.bankDetails')}</legend>
                  <div className="flex flex-col gap-2">
                    <InputField name="nombreTitular" value={form.nombreTitular} onChange={handleChange} placeholder={t('dataAccount.fullName')} />
                    <SelectField name="banco" value={form.banco} onChange={handleChange} placeholder={t('dataAccount.chooseBank')} options={bankOptions} />
                    <InputField name="clabe" value={form.clabe} onChange={handleChange} placeholder={t('dataAccount.cardOrClabe')} />
                  </div>
                </fieldset>

                {/* Beneficiario principal */}
                <fieldset className="mb-5">
                  <legend className="text-sm font-semibold text-white mb-2">{t('dataAccount.beneficiary')}</legend>
                  <div className="flex flex-col gap-2">
                    <InputField name="nombreBeneficiario" value={form.nombreBeneficiario} onChange={handleChange} placeholder={t('dataAccount.beneficiaryName')} />
                    <SelectField name="relacion" value={form.relacion} onChange={handleChange} placeholder={t('dataAccount.relationship')} options={relationOptions} />
                    <InputField name="telefono" value={form.telefono} onChange={handleChange} placeholder={t('dataAccount.phone')} prefix="+52" />
                  </div>
                  <p className="text-center text-white/45 text-xs mt-3">
                    {t('dataAccount.hasAccountQuestion')}{' '}
                    <a href="#" onClick={e => { e.preventDefault(); navigate('/conexion-rapida') }} className="text-[#d96b00] underline underline-offset-2 hover:text-[#f07a10] cursor-pointer">
                      {t('dataAccount.quickConnect')}
                    </a>
                  </p>
                </fieldset>

                {/* Botón continuar */}
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="w-full bg-[#d96b00] hover:bg-[#c05e00] active:scale-[0.98] text-white font-semibold py-4 px-6 rounded-xl transition-all hover:-translate-y-px hover:shadow-lg hover:shadow-[#d96b00]/30 mb-4 text-base cursor-pointer"
                >
                  {t('dataAccount.continue')}
                </button>

                {/* Nota legal */}
                <p className="text-center text-white/40 text-xs leading-relaxed max-w-xs mx-auto">
                  {t('dataAccount.legal')}
                </p>

              </div>
            </div>

          </div>
        </div>
      </section>

      <Footer dark />
    </div>
  )
}