import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LandingNavbar from './components/LandingNavbar'
import Footer from './components/Footer'

// TODO: estos datos pueden venir del backend
// Los textos viven en i18n: incentivos.<id>.titulo / descripcion / boton
const INCENTIVES = [
  {
    id: 'fidelidad',
    titleKey: 'incentivos.fidelidad.titulo',
    descKey: 'incentivos.fidelidad.descripcion',
    buttonKey: 'incentivos.fidelidad.boton',
  },
  {
    id: 'confianza',
    titleKey: 'incentivos.confianza.titulo',
    descKey: 'incentivos.confianza.descripcion',
    buttonKey: 'incentivos.confianza.boton',
  },
]


function IncentiveCard({ title, description, buttonLabel, selectedLabel, note, isSelected, onSelect }) {
  return (
    <article
      className={`bg-card rounded-3xl p-6 sm:p-8 flex flex-col border transition-colors ${
        isSelected ? 'border-brand' : 'border-white/10'
      }`}
    >
      <h3 className="font-display font-bold text-2xl sm:text-3xl xl:text-4xl text-white tracking-tight leading-tight mb-4">
        {title}
      </h3>
      <p className="text-sm text-white/70 leading-relaxed mb-6 max-w-prose">
        {description}
      </p>

      <button
        type="button"
        onClick={onSelect}
        aria-pressed={isSelected}
        className={`w-full font-semibold py-3.5 px-6 rounded-xl transition-all text-sm sm:text-base cursor-pointer active:scale-[0.98] ${
          isSelected
            ? 'bg-transparent border border-brand text-brand'
            : 'bg-brand hover:bg-brand-dark text-white shadow-lg shadow-brand/20'
        }`}
      >
        {isSelected ? selectedLabel : buttonLabel}
      </button>

      <p className="text-center text-white/40 text-[11px] leading-relaxed mt-3 max-w-sm mx-auto">
        {note}
      </p>
    </article>
  )
}

export function IncentivesScreen({ initialSelected = null, onSelect }) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [selected, setSelected] = useState(initialSelected)

  const handleSelect = (id) => {
    setSelected(id)
    // TODO: guardar selección en el backend
    onSelect?.(id)
  }

  return (
    <div className="bg-bg min-h-screen flex flex-col text-white">
      <LandingNavbar soloVolver onVolver={() => navigate('/main')} />

      <div className="flex-1 py-10 px-4 sm:px-6 lg:px-12">
        <div className="w-full max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-start">

            {/* IZQUIERDA */}
            <div className="flex flex-col gap-5 lg:gap-8">

              {/* Título */}
              <h1
                className="font-display font-bold text-white tracking-tight leading-[1.05]"
                style={{ fontSize: 'clamp(3rem,6vw,5rem)' }}
              >
                {t('incentivos.tituloParte1')}{' '}
                <em className="text-brand not-italic block">{t('incentivos.tituloParte2')}.</em>
              </h1>

              {/* Subtítulo + descripción */}
              <div>
                <p className="border-l-2 border-white/40 pl-3 text-lg sm:text-xl font-medium leading-snug mb-3 max-w-md">
                  {t('incentivos.subtitulo')}
                </p>
                <p className="text-sm text-white/60 leading-relaxed max-w-md">
                  {t('incentivos.descripcion')}
                </p>
              </div>
            </div>

            {/* TARJETAS */}
            <div className="flex flex-col gap-5 lg:gap-6">
              {INCENTIVES.map((incentive) => (
                <IncentiveCard
                  key={incentive.id}
                  title={t(incentive.titleKey)}
                  description={t(incentive.descKey)}
                  buttonLabel={t(incentive.buttonKey)}
                  selectedLabel={t('incentivos.seleccionada')}
                  note={t('incentivos.nota')}
                  isSelected={selected === incentive.id}
                  onSelect={() => handleSelect(incentive.id)}
                />
              ))}
            </div>

          </div>
        </div>
      </div>

      <Footer dark />
    </div>
  )
}