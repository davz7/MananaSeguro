import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { INCENTIVE_SCENARIOS } from '../../../data/retirementContent'

export function ReferralModule({ userName = 'Usuario', walletAddress = null }) {
  const { t } = useTranslation()
  const [referrals, setReferrals] = useState(() => loadReferrals())
  const [copied, setCopied] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [addError, setAddError] = useState(null)

  const referralCode = generateCode(walletAddress ?? userName)
  const referralLink = `https://manana-seguro.app/r/${referralCode}`
  const activeReferrals = referrals.filter(r => r.monthsActive >= 6 && r.deposits >= 1)
  const pendingReferrals = referrals.filter(r => r.monthsActive < 6)
  const incentiveTier = getIncentiveTier(activeReferrals.length)

  useEffect(() => { saveReferrals(referrals) }, [referrals])

  function handleCopy() {
    navigator.clipboard.writeText(referralLink).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleAddReferral() {
    setAddError(null)
    if (!newEmail.trim() || !newEmail.includes('@')) {
      setAddError(t('referrals.errorCorreo'))
      return
    }
    if (referrals.find(r => r.email === newEmail.trim())) {
      setAddError(t('referrals.errorDuplicado'))
      return
    }
    setReferrals(prev => [...prev, {
      id: Date.now(),
      email: newEmail.trim(),
      name: newEmail.split('@')[0],
      joinedAt: new Date().toISOString(),
      monthsActive: 0,
      deposits: 0,
      status: 'pendiente',
    }])
    setNewEmail('')
  }

  function handleSimulateProgress(id) {
    setReferrals(prev => prev.map(r => r.id === id
      ? {
        ...r,
        monthsActive: Math.min(r.monthsActive + 1, 12),
        deposits: Math.max(r.deposits, 1),
        status: r.monthsActive >= 5 ? 'activo' : 'en progreso',
      }
      : r
    ))
  }

  return (
    <div className="flex flex-col gap-4">

      {/* ── Tier actual ── */}
      <div className="bg-white dark:bg-white/5 border border-ink/8 dark:border-white/8 rounded-2xl p-6">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
          <div>
            <h5 className="font-display font-black text-ink dark:text-white text-lg mb-1">
              {t('referrals.titulo')}
            </h5>
            <p className="text-sm text-ink/50 dark:text-white/50 max-w-sm">
              {t('referrals.desc')}
            </p>
          </div>
          <div className="text-center shrink-0">
            <div className="font-display font-black text-3xl mb-0.5" style={{ color: incentiveTier.color }}>
              {incentiveTier.pct}%
            </div>
            <div className="text-xs text-ink/40 dark:text-white/40">{t('referrals.incentivoActual')}</div>
          </div>
        </div>

        {/* Tiers */}
        <div className="flex flex-col gap-2 mb-5">
          {INCENTIVE_SCENARIOS.map(s => {
            const isActive = s.pct === incentiveTier.pct
            const label = t(`incentiveScenarios.${s.key}.label`)
            const description = t(`incentiveScenarios.${s.key}.description`)
            return (
              <div key={s.key}
                className={`flex justify-between items-center p-3 rounded-xl border transition-all ${isActive
                  ? 'bg-brand/8 border-brand/25'
                  : 'bg-ink/2 dark:bg-white/2 border-ink/5 dark:border-white/5'
                  }`}>
                <div>
                  <p className={`text-sm font-semibold mb-0.5 ${isActive ? 'text-brand' : 'text-ink dark:text-white'}`}>
                    {isActive ? '→ ' : ''}{label}
                  </p>
                  <p className="text-xs text-ink/40 dark:text-white/40">{description}</p>
                </div>
                <span className={`text-xs font-bold px-3 py-1 rounded-full border ${isActive
                  ? 'bg-brand/10 text-brand border-brand/25'
                  : 'bg-ink/4 dark:bg-white/4 text-ink/40 dark:text-white/40 border-transparent'
                  }`}>
                  {s.pct}%
                </span>
              </div>
            )
          })}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: t('referrals.statsTotales'), val: referrals.length, color: 'text-ink dark:text-white' },
            { label: t('referrals.statsActivos'), val: activeReferrals.length, color: 'text-green-600' },
            { label: t('referrals.statsProgreso'), val: pendingReferrals.length, color: 'text-yellow-500' },
          ].map(item => (
            <div key={item.label} className="bg-ink/3 dark:bg-white/3 border border-ink/6 dark:border-white/6 rounded-xl p-3 text-center">
              <div className={`font-display font-black text-xl mb-0.5 ${item.color}`}>{item.val}</div>
              <div className="text-xs text-ink/40 dark:text-white/40">{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Link de referido ── */}
      <div className="bg-white dark:bg-white/5 border border-ink/8 dark:border-white/8 rounded-2xl p-6">
        <h6 className="font-semibold text-ink dark:text-white mb-3">{t('referrals.tuLink')}</h6>
        <div className="flex gap-2 mb-2">
          <input
            readOnly
            value={referralLink}
            className="w-full border border-ink/10 dark:border-white/10 rounded-xl px-4 py-2.5 text-xs font-mono bg-ink/3 dark:bg-white/3 text-ink dark:text-white outline-none"
          />
          <button
            className={`shrink-0 text-xs font-bold px-4 py-2.5 rounded-xl border transition-all cursor-pointer ${copied
              ? 'bg-green-500/10 text-green-600 border-green-500/20'
              : 'bg-brand hover:bg-brand-dark text-white border-transparent hover:-translate-y-px'
              }`}
            onClick={handleCopy}>
            {copied ? t('referrals.copiado') : t('referrals.copiar')}
          </button>
        </div>
        <p className="text-xs text-ink/40 dark:text-white/40">
          {t('referrals.codigo')}{' '}
          <span className="font-mono font-bold text-brand">{referralCode}</span>
          {' '}· {t('referrals.codigoDesc')}
        </p>
      </div>

      {/* ── Invitar por correo ── */}
      <div className="bg-white dark:bg-white/5 border border-ink/8 dark:border-white/8 rounded-2xl p-6">
        <h6 className="font-semibold text-ink dark:text-white mb-3">{t('referrals.invitarCorreo')}</h6>
        <div className="flex gap-2 mb-1">
          <input
            type="email"
            className="w-full border border-ink/10 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-white/5 text-ink dark:text-white outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-all"
            placeholder={t('referrals.placeholder')}
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddReferral()}
          />
          <button
            className="shrink-0 bg-brand hover:bg-brand-dark text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all hover:-translate-y-px cursor-pointer"
            onClick={handleAddReferral}>
            {t('referrals.invitar')}
          </button>
        </div>
        {addError && (
          <p className="text-xs text-red-500 mt-1">⚠ {addError}</p>
        )}
      </div>

      {/* ── Lista de referidos ── */}
      {referrals.length > 0 && (
        <div className="bg-white dark:bg-white/5 border border-ink/8 dark:border-white/8 rounded-2xl p-6">
          <h6 className="font-semibold text-ink dark:text-white mb-4">{t('referrals.misReferidos')}</h6>
          <div className="flex flex-col gap-3">
            {referrals.map(r => {
              const isActive = r.monthsActive >= 6 && r.deposits >= 1
              const progress = Math.min((r.monthsActive / 6) * 100, 100)
              return (
                <div key={r.id}
                  className={`p-4 rounded-xl border transition-all ${isActive
                    ? 'bg-green-500/5 border-green-500/15'
                    : 'bg-ink/2 dark:bg-white/2 border-ink/5 dark:border-white/5'
                    }`}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-sm font-semibold text-ink dark:text-white mb-0.5">{r.name}</p>
                      <p className="text-xs text-ink/40 dark:text-white/40">{r.email}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${isActive
                      ? 'bg-green-500/10 text-green-600 border-green-500/20'
                      : 'bg-yellow-400/10 text-yellow-600 border-yellow-400/20'
                      }`}>
                      {isActive ? t('referrals.activo') : `${r.monthsActive}/6 meses`}
                    </span>
                  </div>

                  {!isActive && (
                    <>
                      <div className="h-1.5 bg-ink/5 dark:bg-white/5 rounded-full overflow-hidden mb-1.5">
                        <div className="h-full bg-gradient-to-r from-brand-dark to-brand rounded-full transition-all duration-500"
                          style={{ width: `${progress}%` }} />
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-ink/40 dark:text-white/40">
                          {t('referrals.mesesProgreso', { meses: r.monthsActive })}
                        </span>
                        <button
                          className="text-xs text-ink/30 dark:text-white/30 hover:text-brand transition-colors underline cursor-pointer bg-transparent border-none"
                          onClick={() => handleSimulateProgress(r.id)}>
                          {t('referrals.masMes')}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function generateCode(seed) {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i)
    hash |= 0
  }
  return 'MS' + Math.abs(hash).toString(36).toUpperCase().slice(0, 6)
}

function getIncentiveTier(activeCount) {
  if (activeCount >= 2) return { pct: 7, color: '#22c55e', label: '2 referidos activos' }
  if (activeCount >= 1) return { pct: 6, color: '#e3730d', label: '1 referido activo' }
  return { pct: 5, color: '#a69f97', label: 'Solo fidelidad' }
}

function loadReferrals() {
  try {
    const raw = localStorage.getItem('manana_seguro_referrals')
    return raw ? JSON.parse(raw) : getMockReferrals()
  } catch { /* storage no disponible */ }
  return getMockReferrals()
}

function saveReferrals(referrals) {
  try {
    localStorage.setItem('manana_seguro_referrals', JSON.stringify(referrals))
  } catch { /* storage no disponible */ }
}

function getMockReferrals() {
  return [
    { id: 1, email: 'maria@ejemplo.com', name: 'maria', joinedAt: '2025-09-01', monthsActive: 6, deposits: 4, status: 'activo' },
    { id: 2, email: 'pedro@ejemplo.com', name: 'pedro', joinedAt: '2025-12-01', monthsActive: 3, deposits: 2, status: 'en progreso' },
  ]
}