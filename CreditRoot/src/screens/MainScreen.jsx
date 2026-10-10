import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowUpRight, ArrowDownLeft, ExternalLink, Flame } from 'lucide-react'
import { BrandLogo } from '../components/ui/BrandLogo'
import Footer from './components/Footer'
import LandingNavbar from './components/LandingNavbar'

// ── Shared constants ────────────────────────────────────────────────────────
const cardCls = 'bg-card border border-white/10 rounded-2xl'

const mxnFmt = new Intl.NumberFormat('es-MX', {
  style: 'currency', currency: 'MXN',
  minimumFractionDigits: 2, maximumFractionDigits: 2,
})
const mxnFmtInt = new Intl.NumberFormat('es-MX', {
  style: 'currency', currency: 'MXN', maximumFractionDigits: 0,
})

// ── Sub-components ───────────────────────────────────────────────────────────

function HistorialItem({ item }) {
  const { t } = useTranslation()
  const esIngreso = item.monto > 0
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-white/8 flex items-center justify-center shrink-0">
        {esIngreso
          ? <ArrowUpRight size={16} className="text-white/60" />
          : <ArrowDownLeft size={16} className="text-white/60" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-semibold leading-tight">
          {item.tipo === 'deposito'
            ? t('mainScreen.historyDeposit')
            : t('mainScreen.historyEmergency')}
        </p>
        <p className="text-white/40 text-xs">{item.fecha}&nbsp;&nbsp;{item.hora} {t('mainScreen.hoursSuffix')}</p>
      </div>
      <span className={`text-sm font-semibold shrink-0 ${esIngreso ? 'text-success' : 'text-white/60'}`}>
        {esIngreso ? '+ ' : '- '}{mxnFmt.format(Math.abs(item.monto))} MXN
      </span>
    </div>
  )
}

function PromoCard({ children, onKnowMore }) {
  const { t } = useTranslation()
  return (
    <div className={`${cardCls} p-5 flex flex-col items-center text-center gap-1.5`}>
      {children}
      <button
        onClick={onKnowMore}
        className="mt-2 flex items-center gap-1.5 bg-brand hover:bg-brand-dark rounded-md px-3 py-1.5 text-xs font-semibold text-white transition-all cursor-pointer"
      >
        <ExternalLink size={12} />
        {t('mainScreen.knowMore')}
      </button>
    </div>
  )
}

// ── MainScreen ───────────────────────────────────────────────────────────────

export function MainScreen({ usuario }) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const u = {
    saldoMXN: 0,
    tasaCetes: 0,
    metaAnios: 10,
    totalEstimadoMXN: 0,
    mesesActivo: 0,
    historial: [],
    ...usuario,
  }

  return (
    <div className="bg-bg min-h-screen text-white">
      <LandingNavbar appMode />

      <div className="container mx-auto px-4 py-5 max-w-5xl">

        {/* Fila 1: Hero + Balance */}
        <div className="grid lg:grid-cols-2 gap-3 mb-3">

          <div className="flex flex-col justify-center gap-4">
            <div className="flex items-center gap-4">
              <BrandLogo size="lg" />
              <div>
                <p className="text-white/60 text-base font-medium leading-tight">{t('mainScreen.weAre')}</p>
                <p className="text-white font-display font-bold text-2xl leading-tight">MañanaSeguro.</p>
              </div>
            </div>
            <h1
              className="font-display font-bold text-white tracking-tight leading-[1.05]"
              style={{ fontSize: 'clamp(2rem,4.5vw,2.8rem)' }}
            >
              {t('mainScreen.heroLine1Pre')} <em className="text-brand not-italic">{t('mainScreen.heroLine1Accent')}</em> {t('mainScreen.heroLine1Post')}<br />
              {t('mainScreen.heroLine2Pre')} <em className="text-brand not-italic">{t('mainScreen.heroLine2Accent')}</em>
            </h1>
          </div>

          <div className={`${cardCls} p-5 flex flex-col gap-3`}>
            <p className="text-white/50 text-xs">{t('mainScreen.mainAccount')}</p>
            <p
              className="font-display font-bold text-white leading-none"
              style={{ fontSize: 'clamp(2.2rem,5vw,3.2rem)', letterSpacing: '-1px' }}
            >
              {mxnFmtInt.format(u.saldoMXN)}
            </p>
            <p className="text-white/50 text-xs">
              {t('mainScreen.cetesAsset')} <span className="text-brand font-semibold">{u.tasaCetes}%</span>
            </p>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <button
                onClick={() => navigate('/deposits')}
                className="flex flex-col items-center justify-center gap-1.5 bg-brand hover:bg-brand-dark rounded-xl py-4 transition-all cursor-pointer"
              >
                <ArrowUpRight size={22} />
                <span className="text-xs font-semibold">{t('mainScreen.deposit')}</span>
              </button>
              <button className="flex flex-col items-center justify-center gap-1.5 bg-white/10 rounded-xl py-4 transition-all cursor-not-allowed text-white/40" disabled>
                <ArrowDownLeft size={22} />
                <span className="text-xs font-semibold">{t('mainScreen.withdraw')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Fila 2: [Meta | Meses] + Historial */}
        <div className="grid lg:grid-cols-2 gap-3 mb-3">

          <div className="grid grid-cols-2 gap-3">
            {/* Meta */}
            <div className={`${cardCls} p-4 flex flex-col gap-2`}>
              <p className="text-white/70 text-base font-medium">
                {t('mainScreen.goalPrefix')} <span className="text-white font-bold">{t('mainScreen.goalYears', { years: u.metaAnios })}</span>
              </p>
              <svg viewBox="0 0 120 44" className="w-full h-10" preserveAspectRatio="none">
                <defs>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="2" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>
                <path
                  d="M0,40 C20,38 30,30 50,22 C70,14 90,8 120,2"
                  fill="none" stroke="#3ecf8e" strokeWidth="2.5"
                  strokeLinecap="round" filter="url(#glow)" opacity="0.9"
                />
              </svg>
              <div className="mt-auto">
                <p className="text-white/40 text-xs">{t('mainScreen.estimatedTotal')}</p>
                <p className="text-brand font-bold text-xs leading-tight">
                  {mxnFmt.format(u.totalEstimadoMXN)} MXN
                </p>
              </div>
              <button
                onClick={() => navigate('/goal')}
                className="mt-2 w-full flex items-center justify-center gap-1.5 bg-white/8 hover:bg-white/12 rounded-lg px-3 py-2 text-xs font-semibold text-white/70 hover:text-white transition-all cursor-pointer"
              >
                {t('mainScreen.learnMore')}
              </button>
            </div>

            {/* Meses */}
            <div className={`${cardCls} p-4 flex flex-col items-center justify-center gap-1`}>
              <Flame size={116} className="text-brand" />
              <p className="font-display font-bold text-brand leading-none" style={{ fontSize: '3.4rem' }}>
                {u.mesesActivo}
              </p>
              <p className="text-white text-base font-light">{t('mainScreen.months')}</p>
            </div>
          </div>

          {/* Historial */}
          <div className={`${cardCls} p-5 flex flex-col gap-3`}>
            <p className="text-white/70 text-sm font-semibold">{t('mainScreen.history')}</p>
            {u.historial.map((item, i) => (
              <HistorialItem key={i} item={item} />
            ))}
          </div>
        </div>

        {/* Fila 3: Promo cards */}
        <div className="grid lg:grid-cols-2 gap-3">
          <PromoCard onKnowMore={() => navigate('/incentives')}>
            <p className="text-white/60 text-sm">{t('mainScreen.promoGetUpTo')}</p>
            <p className="font-display font-bold text-brand leading-none" style={{ fontSize: '2.8rem' }}>5%</p>
            <p className="text-white/60 text-sm leading-relaxed">
              {t('mainScreen.promoOf')} <span className="text-white font-semibold">{t('mainScreen.promoYield')}</span><br />
              {t('mainScreen.promoRest')}
            </p>
          </PromoCard>

          <PromoCard onKnowMore={() => navigate('/emergency')}>
            <p className="text-white/60 text-sm">{t('mainScreen.emergencyQuestion')}</p>
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#e37310" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            <p className="text-white font-bold text-sm">{t('mainScreen.weUnderstand')}</p>
            <p className="text-white/50 text-xs leading-relaxed">
              {t('mainScreen.emergencyText')}
            </p>
          </PromoCard>
        </div>
      </div>
      <Footer dark />
    </div>
  )
}