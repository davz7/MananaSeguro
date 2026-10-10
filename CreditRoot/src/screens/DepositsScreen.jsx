import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowUpRight } from 'lucide-react'
import LandingNavbar from './components/LandingNavbar'
import Footer from './components/Footer'

const CLABE = '4154 3214 9874 9967'
const BANCO = 'STP'

const MOCK_MOVIMIENTOS = [
  { fecha: '04/07/2026', hora: '18:00:45', monto: 1000, estado: 'processing', banco: 'BBVA' },
  { fecha: '04/07/2026', hora: '18:00:45', monto: 1000, estado: 'completed', banco: 'BBVA' },
]

const estadoColor = {
  processing: 'bg-yellow-400',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
}

const mxnFmt = new Intl.NumberFormat('es-MX', {
  style: 'currency', currency: 'MXN',
  minimumFractionDigits: 2,
})

export function DepositsScreen() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [copiado, setCopiado] = useState(false)

  const handleCopiar = () => {
    navigator.clipboard.writeText(CLABE.replace(/\s/g, ''))
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="bg-bg min-h-screen flex flex-col text-white">
      <LandingNavbar soloVolver onVolver={() => navigate('/main')} />

      <div className="container mx-auto px-4 py-8 max-w-5xl flex-1">

        {/* Fila 1: Hero + Card instrucciones */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

          {/* Hero izquierda */}
          <div className="flex flex-col justify-center gap-4">
            <h1
              className="font-display font-bold tracking-tight leading-[1.05]"
              style={{ fontSize: 'clamp(2.8rem,6vw,4.5rem)' }}
            >
              <em className="text-brand not-italic">{t('deposits.heroAccent')}</em>{' '}{t('deposits.heroMid')}<br />{t('deposits.heroEnd')}
            </h1>
          </div>

          {/* Card instrucciones derecha */}
          <div className="bg-card border border-white/10 rounded-2xl p-6 flex flex-col gap-4">
            <h2 className="font-display font-bold text-white text-xl leading-snug">
              {t('deposits.cardTitle')}
            </h2>

            {/* Paso 1 */}
            <div>
              <p className="text-white/60 text-sm mb-2">
                {t('deposits.step1')}
              </p>
              <div className="bg-[#1c1b1a] border border-white/15 rounded-xl px-4 py-3 text-center mb-3">
                <p className="text-white font-semibold text-base tracking-widest">{CLABE}</p>
                <p className="text-white/45 text-xs mt-0.5">{t('deposits.bank')}: {BANCO}</p>
              </div>
              <button
                onClick={handleCopiar}
                className="flex items-center gap-2 bg-brand hover:bg-brand-dark active:scale-[0.98] text-white text-xs font-semibold px-4 py-2 rounded-lg transition-all cursor-pointer"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                </svg>
                {copiado ? t('deposits.copied') : t('deposits.copy')}
              </button>
            </div>

            {/* Paso 2 */}
            <p className="text-white/60 text-sm leading-relaxed">
              {t('deposits.step2')}<br />
              <span className="text-white/40 text-xs">
                {t('deposits.supportPre')}{' '}
                <a href="mailto:contactomananaseguro@gmail.com" className="text-brand underline underline-offset-2 hover:text-brand-dark transition-colors">
                  {t('deposits.supportLink')}
                </a>
                {t('deposits.supportPost')}
              </span>
            </p>
          </div>
        </div>

        {/* Tabla últimos movimientos */}
        <div className="bg-card border border-white/10 rounded-2xl p-6">
          <h3 className="font-display font-bold text-white text-xl mb-5">{t('deposits.recentTitle')}</h3>

          {/* Header tabla */}
          <div className="hidden sm:grid grid-cols-[2fr_2fr_1.5fr_1fr] gap-4 text-white/40 text-xs font-medium pb-3 border-b border-white/8 mb-2">
            <span>{t('deposits.colDate')}</span>
            <span>{t('deposits.colAmount')}</span>
            <span>{t('deposits.colStatus')}</span>
            <span>{t('deposits.colBank')}</span>
          </div>

          {/* Filas */}
          <div className="flex flex-col divide-y divide-white/8">
            {MOCK_MOVIMIENTOS.map((mov, i) => (
              <div key={i} className="grid grid-cols-[auto_2fr_2fr_1.5fr_1fr] gap-4 items-center py-4">
                <div className="w-8 h-8 rounded-full bg-white/8 flex items-center justify-center shrink-0">
                  <ArrowUpRight size={14} className="text-white/60" />
                </div>
                <p className="text-white text-sm">
                  {mov.fecha}{' '}
                  <span className="text-white/45">{mov.hora} {t('deposits.hoursSuffix')}</span>
                </p>
                <p className="text-brand font-semibold text-sm">
                  + {mxnFmt.format(mov.monto)} MXN
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-white/80 text-sm">{t(`deposits.status.${mov.estado}`)}</span>
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${estadoColor[mov.estado] ?? 'bg-white/30'}`} />
                </div>
                <p className="text-white/70 text-sm">{mov.banco}</p>
              </div>
            ))}
          </div>

          {MOCK_MOVIMIENTOS.length === 0 && (
            <p className="text-white/30 text-sm text-center py-8">{t('deposits.empty')}</p>
          )}
        </div>

      </div>

      <Footer dark />
    </div>
  )
}