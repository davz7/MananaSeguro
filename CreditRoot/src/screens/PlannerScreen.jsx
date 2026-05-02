import { ContributionPlanner } from '../features/planner/components/ContributionPlanner'
import { useEtherfuseRate } from '../hooks/useEtherfuseRate'
import { useTranslation } from 'react-i18next'

export function PlannerScreen() {
  const { userRate, loading } = useEtherfuseRate()
  const { t } = useTranslation()

  return (
    <section className="bg-surface dark:bg-[#0f0e0d] py-16 lg:py-24">
      <div className="container mx-auto px-4">

        <div className="mb-8 anim-fade-up-1">
          <span className="inline-block bg-brand/10 text-brand-dark border border-brand/20 rounded-lg px-4 py-1.5 text-xs font-semibold tracking-wide mb-4">
            {t('planner.badge')}
          </span>
          <h2 className="font-display font-black text-ink dark:text-white tracking-tight mb-2"
            style={{ fontSize: 'clamp(2rem,4vw,2.8rem)', lineHeight: 1.05 }}>
            {t('planner.titulo')}
          </h2>
          <p className="text-ink/50 dark:text-white/50 text-lg max-w-xl">
            {t('planner.descripcion')}{' '}
            <span className="text-green-600 font-bold">
              {loading ? t('planner.cargando') : `${userRate}%`}
            </span>
            {' '}{t('planner.descripcionSufijo')}
          </p>
        </div>

        <div className="anim-fade-up-2">
          <ContributionPlanner />
        </div>

      </div>
    </section>
  )
}