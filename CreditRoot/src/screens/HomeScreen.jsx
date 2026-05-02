import { ConnectAccountCard } from '../features/access/components/ConnectAccountCard'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export function HomeScreen({ usuario }) {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const stats = [
    { val: '32M', label: t('home.stats.mexicanos'), color: 'text-brand' },
    { val: '4.7% APY', label: t('home.stats.rendimiento'), color: 'text-green-600' },
    { val: '$2 USDC', label: t('home.stats.empezar'), color: 'text-brand' },
    { val: '1%', label: t('home.stats.comision'), color: 'text-ink/60 dark:text-white/60' },
  ]

  return (
    <section className="bg-surface dark:bg-[#0f0e0d] py-16 lg:py-24">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          {/* Copy izquierdo */}
          <div className="anim-fade-up-1">
            <span className="inline-block bg-brand/10 text-brand-dark border border-brand/20 rounded-lg px-4 py-1.5 text-xs font-semibold tracking-wide mb-6">
              {t('home.badge')}
            </span>

            <h2 className="font-display font-black text-ink dark:text-white tracking-tight mb-4"
              style={{ fontSize: 'clamp(2.2rem,5vw,3.2rem)', lineHeight: 1.05 }}>
              {t('home.titulo')}<br />
              <em className="text-brand italic">{t('home.tituloAccent')}</em>
            </h2>

            <p className="text-ink/50 dark:text-white/50 text-lg leading-relaxed max-w-md mb-8">
              {t('home.descripcion')}
            </p>

            <div className="flex gap-3 flex-wrap mb-10">
              <button
                className="bg-brand hover:bg-brand-dark text-white font-semibold px-6 py-3.5 rounded-xl transition-all hover:-translate-y-px hover:shadow-lg hover:shadow-brand/30 cursor-pointer"
                onClick={() => navigate('/planner')}>
                {t('home.simulador')}
              </button>
              <button
                className="border-[1.5px] border-ink/20 dark:border-white/20 text-ink dark:text-white font-semibold px-6 py-3.5 rounded-xl hover:bg-ink/5 dark:hover:bg-white/5 hover:border-ink/30 transition-all cursor-pointer"
                onClick={() => navigate('/dashboard')}>
                {t('home.dashboard')}
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              {stats.map(s => (
                <div key={s.label} className="bg-white dark:bg-white/5 border border-ink/8 dark:border-white/8 rounded-2xl p-4">
                  <div className={`font-display font-black text-2xl mb-1 ${s.color}`}>{s.val}</div>
                  <div className="text-sm text-ink/45 dark:text-white/45">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ConnectAccountCard */}
          <div className="anim-fade-up-2">
            <div className="bg-white dark:bg-white/5 rounded-3xl p-8 border border-ink/8 dark:border-white/8 shadow-xl shadow-ink/5">
              <ConnectAccountCard walletAddress={usuario?.walletAddress} />
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}