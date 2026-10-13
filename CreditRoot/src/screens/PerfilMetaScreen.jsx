import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LandingNavbar from './components/LandingNavbar'
import Footer from './components/Footer'

// TODO: reemplazar por catálogos reales (API / constantes)

// TODO: estos datos pueden venir del backend
const YEAR_OPTIONS = Array.from({ length: 100 }, (_, i) => {
  const year = String(new Date().getFullYear() - i)
  return { value: year, label: year }
})
const DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))
const GOALS = [5, 10, 15, 20]

const SEGMENT_FIELDS = [
  { name: 'ocupacion', key: 'perfilMeta.ocupacion', options: [] },
  { name: 'estudios', key: 'perfilMeta.estudios', options: [] },
  { name: 'ingreso', key: 'perfilMeta.ingreso', options: [] },
  { name: 'genero', key: 'perfilMeta.genero', options: [] },
  { name: 'estadoCivil', key: 'perfilMeta.estadoCivil', options: [] },
  { name: 'residencia', key: 'perfilMeta.residencia', options: [] },
]

const INITIAL_FORM = {
  anio: '',
  mes: '',
  dia: '',
  ocupacion: '',
  estudios: '',
  ingreso: '',
  genero: '',
  estadoCivil: '',
  residencia: '',
  meta: '10',
}

/*  Select reutilizable con flecha  */
function SelectField({ name, value, onChange, placeholder, options = [], ariaLabel }) {
  return (
    <div className="relative w-full">
      <select
        name={name}
        value={value}
        onChange={onChange}
        aria-label={ariaLabel || placeholder}
        className="w-full appearance-none bg-[#1c1b1a] text-white text-sm border border-white/20 rounded-xl py-3 pl-4 pr-10 outline-none transition-colors focus:border-[#d96b00] focus:ring-2 focus:ring-[#d96b00]/40 cursor-pointer"
      >
        {placeholder && <option value="" disabled>{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-[#1c1b1a]">{opt.label}</option>
        ))}
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

export function PerfilMetaScreen({ onSubmit }) {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const [form, setForm] = useState(INITIAL_FORM)

  // Meses en el idioma activo (enero / January), sin depender de una lista fija
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const name = new Intl.DateTimeFormat(i18n.language, { month: 'long' }).format(new Date(2000, i, 1))
    return { value: String(i + 1), label: name.charAt(0).toUpperCase() + name.slice(1) }
  })

  // "5 años" / "5 years" con plural automático
  const goalOptions = GOALS.map((y) => ({ value: String(y), label: t('perfilMeta.anios', { count: y }) }))

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const isComplete = true

  const handleSubmit = () => {
    onSubmit ? onSubmit(form) : navigate('/datos-cuenta')
  }

  return (
    <div className="bg-bg min-h-screen flex flex-col overflow-x-hidden">
      <LandingNavbar soloVolver onVolver={() => navigate('/verificacion-registro')} />

      <section className="flex-1 py-10 px-4 sm:px-6 lg:px-12">
      <div className="w-full max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-20 items-start">

          {/* SECCIÓN IZQUIERDA */}
          <div className="hidden lg:flex flex-col justify-start items-start space-y-6 pt-2">
            <h1 className="font-display font-bold text-white tracking-tight leading-[1.05]"
              style={{ fontSize: 'clamp(3rem,6vw,5rem)' }}>
              {t('perfilMeta.tituloParte1')}{' '}
              <em className="text-brand not-italic">{t('perfilMeta.tituloParte2')}</em>
            </h1>
            <p className="text-white/55 text-base leading-relaxed max-w-md">
              {t('perfilMeta.descripcion')}
            </p>
          </div>

          {/* TARJETA PRINCIPAL (Móvil & Escritorio) */}
          <div className="w-full max-w-md mx-auto">
            <div className="bg-card border border-white/10 shadow-2xl shadow-black/80 p-6 sm:p-10 rounded-3xl flex flex-col">

              {/* Botón "Regresar" (solo móvil) */}
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="lg:hidden flex items-center gap-1.5 text-white/70 hover:text-white transition-colors mb-6 text-sm font-medium self-start cursor-pointer group"
              >
                <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                <span>{t('perfilMeta.regresar')}</span>
              </button>

              {/* Encabezado Móvil */}
              <div className="lg:hidden mb-6 text-left">
                <h2 className="font-display font-bold text-white text-3xl tracking-tight mb-2">
                  {t('perfilMeta.titulo')}
                </h2>
                <p className="text-white/55 text-sm leading-relaxed">
                  {t('perfilMeta.descripcion')}
                </p>
              </div>

              {/* Encabezado Escritorio */}
              <div className="hidden lg:block mb-8 text-center">
                <h3 className="font-display font-bold text-2xl text-white">
                  {t('perfilMeta.cardTitulo')}
                </h3>
              </div>

              {/*Fecha de nacimiento */}
              <fieldset className="mb-3">
                <legend className="text-sm font-semibold text-white mb-2">
                  {t('perfilMeta.fechaNacimiento')}
                </legend>
                <div className="grid grid-cols-[1fr_1.4fr_1fr] gap-2">
                  <SelectField name="anio" value={form.anio} onChange={handleChange} placeholder={t('perfilMeta.anio')} options={YEAR_OPTIONS} />
                  <SelectField name="mes" value={form.mes} onChange={handleChange} placeholder={t('perfilMeta.mes')} options={monthOptions} />
                  <SelectField name="dia" value={form.dia} onChange={handleChange} placeholder={t('perfilMeta.dia')} options={DAY_OPTIONS} />
                </div>
              </fieldset>

              {/* Actividades y segmentación */}
              <fieldset className="mb-3">
                <legend className="text-sm font-semibold text-white">
                  {t('perfilMeta.segmentacion')}
                </legend>
                <p className="text-xs text-white/60 mb-2">
                  {t('perfilMeta.segmentacionNota')}
                </p>
                <div className="flex flex-col gap-2">
                  {SEGMENT_FIELDS.map((field) => (
                    <SelectField
                      key={field.name}
                      name={field.name}
                      value={form[field.name]}
                      onChange={handleChange}
                      placeholder={t(field.key)}
                      options={field.options}
                    />
                  ))}
                </div>
              </fieldset>

              {/* Elige tu meta */}
              <fieldset className="mb-4">
                <legend className="text-sm font-semibold text-white mb-2">
                  {t('perfilMeta.eligeMeta')}
                </legend>
                <SelectField
                  name="meta"
                  value={form.meta}
                  onChange={handleChange}
                  options={goalOptions}
                  ariaLabel={t('perfilMeta.eligeMeta')}
                />
              </fieldset>

              {/* Botón Principal "Continuar" */}
              <button
                type="button"
                disabled={!isComplete}
                onClick={handleSubmit}
                className="w-full bg-brand hover:bg-brand-dark active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-xl transition-all hover:-translate-y-px hover:shadow-lg hover:shadow-brand/30 mb-5 text-base cursor-pointer"
              >
                {t('perfilMeta.continuar')}
              </button>

              {/* Nota al pie */}
              <p className="text-center text-white/60 text-xs leading-relaxed max-w-xs mx-auto">
                {t('perfilMeta.nota')}{' '}
                {/* TODO: ruta real del aviso de privacidad */}
                <a href="#" className="underline underline-offset-2 hover:text-white">
                  {t('perfilMeta.aqui')}
                </a>
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