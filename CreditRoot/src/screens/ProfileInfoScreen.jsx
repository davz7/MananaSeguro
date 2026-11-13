import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import ardilla from '../assets/Ardilla_vector.png'
import LandingNavbar from './components/LandingNavbar'
import Footer from './components/Footer'

// TODO: reemplazar por catálogos reales (API / constantes)
const BANKS = ['BBVA', 'Santander', 'Banorte', 'Citibanamex', 'HSBC', 'Scotiabank']
// Códigos de parentesco; el texto sale de i18n (dataAccount.relations.*), igual que en Datos de cuenta
const RELATIONSHIPS = ['mother', 'father', 'spouse', 'child', 'sibling', 'other']

const INITIAL_FORM = {
  foto: null,
  nombre: '',
  apellidoPaterno: '',
  apellidoMaterno: '',
  telefono: '',
  correo: '',
  contrasena: '',
  confirmarContrasena: '',
  titular: '',
  banco: '',
  cuenta: '',
  beneficiarioNombre: '',
  beneficiarioParentesco: '',
  beneficiarioTelefono: '',
}

const inputBase =
  'w-full bg-[#1c1b1a] text-white text-sm placeholder:text-white/50 border border-white/20 rounded-xl py-3 px-4 outline-none transition-colors focus:border-[#d96b00] focus:ring-2 focus:ring-[#d96b00]/40'

/* ---------- Campos reutilizables ---------- */
function TextField({ label, ...props }) {
  return <input aria-label={label} placeholder={label} className={inputBase} {...props} />
}

function PhoneField({ label, prefix = '+52', ...props }) {
  return (
    <div className="flex gap-2">
      <span className="flex items-center justify-center px-3 text-sm text-white/80 bg-[#1c1b1a] border border-white/20 rounded-xl shrink-0">
        {prefix}
      </span>
      <input
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        aria-label={label}
        placeholder={label}
        className={inputBase}
        {...props}
      />
    </div>
  )
}

function SelectField({ label, name, value, onChange, options = [] }) {
  return (
    <div className="relative w-full">
      <select
        name={name}
        value={value}
        onChange={onChange}
        aria-label={label}
        className={`${inputBase} appearance-none pr-10 cursor-pointer ${value ? '' : 'text-white/50'}`}
      >
        <option value="" disabled>{label}</option>
        {options.map((opt) => {
          // Acepta 'texto' o { value, label } (para opciones traducidas)
          const { value: v, label: texto } = typeof opt === 'object' ? opt : { value: opt, label: opt }
          return <option key={v} value={v} className="bg-[#1c1b1a] text-white">{texto}</option>
        })}
      </select>
      <svg
        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white"
        viewBox="0 0 12 8"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M0 0h12L6 8z" />
      </svg>
    </div>
  )
}

function FormSection({ title, children }) {
  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend className="text-sm font-semibold text-white mb-2">{title}</legend>
      {children}
    </fieldset>
  )
}

export function ProfileInfoScreen({ initialData = {}, onSubmit }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()
  const [form, setForm] = useState({ ...INITIAL_FORM, ...initialData })
  const [fotoPreview, setFotoPreview] = useState(null)

  useEffect(() => {
    if (!fotoPreview) return
    return () => URL.revokeObjectURL(fotoPreview)
  }, [fotoPreview])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleFile = (e) => {
    const file = e.target.files?.[0] ?? null
    setForm((prev) => ({ ...prev, foto: file }))
    setFotoPreview(file ? URL.createObjectURL(file) : null)
  }

  const passwordsMismatch =
    form.confirmarContrasena !== '' && form.contrasena !== form.confirmarContrasena

  const handleSubmit = (e) => {
    e.preventDefault()
    if (passwordsMismatch) return
    onSubmit ? onSubmit(form) : navigate('/main')
  }

  return (
    <div className="bg-[#0f0e0d] min-h-screen flex flex-col text-white">
      <LandingNavbar
        soloVolver
        onVolver={() => navigate(location.state?.from || '/settings')}
      />
      <section className="flex-1 py-10 px-4 sm:px-6 lg:px-12">
        <div className="w-full max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-20 items-start">

            {/* IZQUIERDA */}
            <div className="flex flex-col gap-5 lg:gap-8 lg:sticky lg:top-28">

              {/* Regresar móvil */}
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="lg:hidden flex items-center gap-1.5 text-white/70 hover:text-white transition-colors text-sm font-medium self-start cursor-pointer group"
              >
                <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                <span>{t('perfilInfo.regresar')}</span>
              </button>

              <h1
                className="font-display font-bold text-white tracking-tight leading-[1.05]"
                style={{ fontSize: 'clamp(3rem,6vw,5rem)' }}
              >
                {t('perfilInfo.tituloParte1')} {t('perfilInfo.tituloParte2')}{' '}
                <em className="text-brand not-italic">{t('perfilInfo.tituloParte3')}</em>
              </h1>

              <div>
                <p className="border-l-4 border-brand pl-3 text-lg font-medium leading-snug mb-3 text-white">
                  {t('perfilInfo.subtitulo')}
                </p>
                <p className="text-white/55 text-base leading-relaxed max-w-md">
                  {t('perfilInfo.descripcion')}
                </p>
              </div>

              <img src={ardilla} alt="" aria-hidden="true"
                className="hidden lg:block w-64 xl:w-80 h-auto select-none pointer-events-none" />
            </div>

            {/* FORMULARIO */}
            <form
              onSubmit={handleSubmit}
              noValidate
              className="w-full max-w-md mx-auto lg:mx-0 bg-[#1a1917] p-6 sm:p-8 rounded-3xl border border-white/10 shadow-2xl shadow-black/80 flex flex-col gap-7"
            >

              {/* ---------- Foto de perfil ---------- */}
              <FormSection title={t('perfilInfo.foto')}>
                <div className="flex items-center justify-between gap-4">
                  <label className="flex-1 cursor-pointer">
                    <input type="file" accept="image/*" onChange={handleFile} className="peer sr-only" />
                    <span className="block w-full text-sm text-white/80 border border-white/20 rounded-xl py-3 px-4 transition-colors hover:border-white/40 peer-focus-visible:border-[#d96b00] peer-focus-visible:ring-2 peer-focus-visible:ring-[#d96b00]/40 truncate">
                      {form.foto?.name || t('perfilInfo.seleccionarArchivo')}
                    </span>
                  </label>
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden bg-[#1c1b1a] border border-white/10 shrink-0 flex items-center justify-center">
                    {fotoPreview ? (
                      <img src={fotoPreview} alt={t('perfilInfo.fotoAlt')} className="w-full h-full object-cover" />
                    ) : (
                      <svg className="w-8 h-8 text-white/30" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5Z" />
                      </svg>
                    )}
                  </div>
                </div>
              </FormSection>

              {/* ---------- Nombre completo ---------- */}
              <FormSection title={t('perfilInfo.nombreCompleto')}>
                <TextField name="nombre" value={form.nombre} onChange={handleChange} autoComplete="given-name" label={t('perfilInfo.nombre')} />
                <TextField name="apellidoPaterno" value={form.apellidoPaterno} onChange={handleChange} autoComplete="family-name" label={t('perfilInfo.apellidoPaterno')} />
                <TextField name="apellidoMaterno" value={form.apellidoMaterno} onChange={handleChange} label={t('perfilInfo.apellidoMaterno')} />
              </FormSection>

              {/* ---------- Crear acceso ---------- */}
              <FormSection title={t('perfilInfo.crearAcceso')}>
                <PhoneField name="telefono" value={form.telefono} onChange={handleChange} label={t('perfilInfo.telefono')} />
                <TextField type="email" name="correo" value={form.correo} onChange={handleChange} autoComplete="email" label={t('perfilInfo.correo')} />
                <TextField type="password" name="contrasena" value={form.contrasena} onChange={handleChange} autoComplete="new-password" label={t('perfilInfo.contrasena')} />
                <TextField
                  type="password"
                  name="confirmarContrasena"
                  value={form.confirmarContrasena}
                  onChange={handleChange}
                  autoComplete="new-password"
                  aria-invalid={passwordsMismatch}
                  label={t('perfilInfo.confirmarContrasena')}
                />
                {passwordsMismatch && (
                  <p className="text-xs text-red-400" role="alert">
                    {t('perfilInfo.errorContrasena')}
                  </p>
                )}
              </FormSection>

              {/* ---------- Datos bancarios ---------- */}
              <FormSection title={t('perfilInfo.datosBancarios')}>
                <TextField name="titular" value={form.titular} onChange={handleChange} autoComplete="cc-name" label={t('perfilInfo.titular')} />
                <SelectField name="banco" value={form.banco} onChange={handleChange} options={BANKS} label={t('perfilInfo.banco')} />
                <TextField name="cuenta" value={form.cuenta} onChange={handleChange} inputMode="numeric" autoComplete="off" label={t('perfilInfo.cuenta')} />
              </FormSection>

              {/* ---------- Beneficiario principal ---------- */}
              <FormSection title={t('perfilInfo.beneficiario')}>
                <TextField name="beneficiarioNombre" value={form.beneficiarioNombre} onChange={handleChange} label={t('perfilInfo.beneficiarioNombre')} />
                <SelectField name="beneficiarioParentesco" value={form.beneficiarioParentesco} onChange={handleChange} options={RELATIONSHIPS.map((r) => ({ value: r, label: t(`dataAccount.relations.${r}`) }))} label={t('perfilInfo.parentesco')} />
                <PhoneField name="beneficiarioTelefono" value={form.beneficiarioTelefono} onChange={handleChange} label={t('perfilInfo.beneficiarioTelefono')} />
              </FormSection>

              {/* Botón principal */}
              <button
                type="submit"
                disabled={passwordsMismatch}
                className="w-full bg-[#d96b00] hover:bg-[#c45f00] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 text-white font-semibold py-4 px-6 rounded-xl transition-all shadow-lg shadow-[#d96b00]/20 text-base cursor-pointer"
              >
                {t('perfilInfo.cambiar')}
              </button>
            </form>

          </div>
        </div>
      </section>

      <Footer dark />
    </div>
  )
}