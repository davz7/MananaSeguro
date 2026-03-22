import { useState, useEffect } from 'react'
import { INCENTIVE_SCENARIOS } from '../../../data/retirementContent'

/**
 * ReferralModule — Sistema de referidos de Mañana Seguro
 *
 * Reglas del modelo de negocio:
 * - Referido válido: 6 meses activo + al menos 1 depósito
 * - 1 referido activo → incentivo sube de 5% a 6%
 * - 2 referidos activos → incentivo sube a 7% (o 9% con constancia)
 * - Fraude: referido solo válido con actividad real
 */
export function ReferralModule({ userName = 'Usuario', walletAddress = null }) {
  const [referrals, setReferrals] = useState(() => loadReferrals())
  const [copied, setCopied] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [addError, setAddError] = useState(null)

  // Código único derivado de la wallet o mock
  const referralCode = generateCode(walletAddress ?? userName)
  const referralLink = `https://manana-seguro.app/r/${referralCode}`

  // Referidos que califican (6+ meses activos, al menos 1 depósito)
  const activeReferrals = referrals.filter(r => r.monthsActive >= 6 && r.deposits >= 1)
  const pendingReferrals = referrals.filter(r => r.monthsActive < 6)

  // Incentivo actual según referidos activos
  const incentiveTier = getIncentiveTier(activeReferrals.length)

  useEffect(() => {
    saveReferrals(referrals)
  }, [referrals])

  function handleCopy() {
    navigator.clipboard.writeText(referralLink).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleAddReferral() {
    setAddError(null)
    if (!newEmail.trim() || !newEmail.includes('@')) {
      setAddError('Ingresa un correo válido')
      return
    }
    if (referrals.find(r => r.email === newEmail.trim())) {
      setAddError('Este correo ya está registrado')
      return
    }
    const mock = {
      id: Date.now(),
      email: newEmail.trim(),
      name: newEmail.split('@')[0],
      joinedAt: new Date().toISOString(),
      monthsActive: 0,   // mock: empieza en 0
      deposits: 0,
      status: 'pendiente',
    }
    setReferrals(prev => [...prev, mock])
    setNewEmail('')
  }

  // Simula progreso (solo para demo/hackathon)
  function handleSimulateProgress(id) {
    setReferrals(prev => prev.map(r => r.id === id
      ? { ...r, monthsActive: Math.min(r.monthsActive + 1, 12), deposits: Math.max(r.deposits, 1), status: r.monthsActive >= 5 ? 'activo' : 'en progreso' }
      : r
    ))
  }

  const cardStyle = { backgroundColor: '#0c0c0c', border: '1px solid rgba(255,255,255,0.06)' }

  return (
    <div className="d-flex flex-column gap-4">

      {/* Header con tier actual */}
      <div className="p-4 rounded-4" style={cardStyle}>
        <div className="d-flex align-items-start justify-content-between flex-wrap gap-3 mb-4">
          <div>
            <h5 className="fw-bold mb-1">Sistema de referidos</h5>
            <p className="text-white-50 small mb-0">
              Invita amigos y sube tu incentivo cada 5 años hasta el 9%.
            </p>
          </div>
          <div className="text-center">
            <div className="fw-bold" style={{ fontSize: 28, color: incentiveTier.color }}>
              {incentiveTier.pct}%
            </div>
            <div className="small text-white-50">tu incentivo actual</div>
          </div>
        </div>

        {/* Tabla de tiers */}
        <div className="d-flex flex-column gap-2 mb-4">
          {INCENTIVE_SCENARIOS.map((s) => {
            const isActive = s.pct === incentiveTier.pct
            return (
              <div key={s.key} className="d-flex justify-content-between align-items-center p-3 rounded-3"
                style={{
                  backgroundColor: isActive ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.02)',
                  border: isActive ? '1px solid rgba(59,130,246,0.3)' : '1px solid rgba(255,255,255,0.04)',
                }}>
                <div>
                  <div className="small fw-bold" style={{ color: isActive ? '#3b82f6' : '#fff' }}>
                    {isActive ? '→ ' : ''}{s.label}
                  </div>
                  <div className="small text-white-50">{s.description}</div>
                </div>
                <span className="badge rounded-pill"
                  style={{
                    backgroundColor: isActive ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.05)',
                    color: isActive ? '#3b82f6' : 'rgba(255,255,255,0.4)',
                    border: isActive ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
                  }}>
                  {s.pct}%
                </span>
              </div>
            )
          })}
        </div>

        {/* Stats rápidos */}
        <div className="row g-2">
          {[
            { label: 'Referidos totales', val: referrals.length, color: '#fff' },
            { label: 'Activos (6+ meses)', val: activeReferrals.length, color: '#22c55e' },
            { label: 'En progreso', val: pendingReferrals.length, color: '#fbbf24' },
          ].map(item => (
            <div className="col-4" key={item.label}>
              <div className="p-3 rounded-3 text-center"
                style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="fw-bold fs-5" style={{ color: item.color }}>{item.val}</div>
                <div className="small text-white-50">{item.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Link de referido */}
      <div className="p-4 rounded-4" style={cardStyle}>
        <h6 className="fw-bold mb-3">Tu link de referido</h6>
        <div className="d-flex gap-2 mb-2">
          <input
            readOnly
            value={referralLink}
            className="form-control bg-transparent text-white border-secondary rounded-3 font-monospace small"
            style={{ fontSize: 12 }}
          />
          <button
            className="btn btn-sm px-3 rounded-3 fw-bold flex-shrink-0"
            style={{
              background: copied ? 'rgba(34,197,94,0.15)' : 'linear-gradient(45deg, #2563eb, #3b82f6)',
              border: copied ? '1px solid rgba(34,197,94,0.3)' : 'none',
              color: copied ? '#22c55e' : '#fff',
              minWidth: 80,
            }}
            onClick={handleCopy}
          >
            {copied ? '✓ Copiado' : 'Copiar'}
          </button>
        </div>
        <div className="small text-white-50">
          Código: <span className="font-monospace fw-bold" style={{ color: '#3b82f6' }}>{referralCode}</span>
          {' '}· Un referido califica después de 6 meses activo y al menos 1 depósito.
        </div>
      </div>

      {/* Invitar por correo */}
      <div className="p-4 rounded-4" style={cardStyle}>
        <h6 className="fw-bold mb-3">Invitar por correo</h6>
        <div className="d-flex gap-2 mb-1">
          <input
            type="email"
            className="form-control bg-transparent text-white border-secondary rounded-3"
            placeholder="correo@ejemplo.com"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddReferral()}
          />
          <button
            className="btn btn-sm px-3 rounded-3 fw-bold flex-shrink-0"
            style={{ background: 'linear-gradient(45deg, #2563eb, #3b82f6)', border: 'none', minWidth: 80 }}
            onClick={handleAddReferral}
          >
            Invitar
          </button>
        </div>
        {addError && <div className="small mt-1" style={{ color: '#f87171' }}>⚠ {addError}</div>}
      </div>

      {/* Lista de referidos */}
      {referrals.length > 0 && (
        <div className="p-4 rounded-4" style={cardStyle}>
          <h6 className="fw-bold mb-3">Mis referidos</h6>
          <div className="d-flex flex-column gap-2">
            {referrals.map(r => {
              const isActive = r.monthsActive >= 6 && r.deposits >= 1
              const progress = Math.min((r.monthsActive / 6) * 100, 100)
              return (
                <div key={r.id} className="p-3 rounded-3"
                  style={{
                    backgroundColor: isActive ? 'rgba(34,197,94,0.05)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${isActive ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)'}`,
                  }}>
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <div>
                      <div className="small fw-bold">{r.name}</div>
                      <div className="small text-white-50">{r.email}</div>
                    </div>
                    <span className="badge rounded-pill"
                      style={{
                        backgroundColor: isActive ? 'rgba(34,197,94,0.1)' : 'rgba(251,191,36,0.1)',
                        color: isActive ? '#22c55e' : '#fbbf24',
                        border: `1px solid ${isActive ? 'rgba(34,197,94,0.2)' : 'rgba(251,191,36,0.2)'}`,
                        fontSize: 10,
                      }}>
                      {isActive ? '✓ Activo' : `${r.monthsActive}/6 meses`}
                    </span>
                  </div>

                  {!isActive && (
                    <>
                      <div className="progress rounded-pill mb-1" style={{ height: 4, backgroundColor: 'rgba(255,255,255,0.05)' }}>
                        <div className="progress-bar rounded-pill"
                          style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #d97706, #fbbf24)' }} />
                      </div>
                      <div className="d-flex justify-content-between">
                        <span className="small text-white-50">{r.monthsActive} de 6 meses para calificar</span>
                        {/* Solo para demo */}
                        <button className="btn btn-sm p-0 small text-white-50"
                          style={{ fontSize: 10, textDecoration: 'underline', background: 'none', border: 'none' }}
                          onClick={() => handleSimulateProgress(r.id)}>
                          +1 mes (demo)
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
  // Código corto determinístico basado en wallet o nombre
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i)
    hash |= 0
  }
  return 'MS' + Math.abs(hash).toString(36).toUpperCase().slice(0, 6)
}

function getIncentiveTier(activeCount) {
  if (activeCount >= 2) return { pct: 7, color: '#22c55e', label: '2 referidos activos' }
  if (activeCount >= 1) return { pct: 6, color: '#3b82f6', label: '1 referido activo' }
  return { pct: 5, color: 'rgba(255,255,255,0.6)', label: 'Solo fidelidad' }
}

function loadReferrals() {
  try {
    const raw = localStorage.getItem('manana_seguro_referrals')
    return raw ? JSON.parse(raw) : getMockReferrals()
  } catch { return getMockReferrals() }
}

function saveReferrals(referrals) {
  try { localStorage.setItem('manana_seguro_referrals', JSON.stringify(referrals)) } catch {}
}

function getMockReferrals() {
  // Datos demo para el hackathon
  return [
    { id: 1, email: 'maria@ejemplo.com', name: 'maria', joinedAt: '2025-09-01', monthsActive: 6, deposits: 4, status: 'activo' },
    { id: 2, email: 'pedro@ejemplo.com', name: 'pedro', joinedAt: '2025-12-01', monthsActive: 3, deposits: 2, status: 'en progreso' },
  ]
}
