import { useEffect, useState } from 'react'
import LandingNavbar from './components/LandingNavbar'
import Footer from './components/Footer'
import { useEtherfuseRate } from '../hooks/useEtherfuseRate'

// ─── Mini calculadora en vivo ─────────────────────────────────────────────────
function CalculadoraHero({ onRegister }) {
  const { userRate, cetesRate, isLive, loading } = useEtherfuseRate()
  const apy = userRate > 0 ? userRate : 4.7
  const [cuota, setCuota] = useState(25)
  const [anios, setAnios] = useState(20)

  const total = (() => {
    const r = apy / 100 / 12
    const n = anios * 12
    if (r === 0) return cuota * n
    return cuota * ((Math.pow(1 + r, n) - 1) / r)
  })()

  return (
    <div className="p-1 rounded-5"
      style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 100%)' }}>
      <div className="p-4 p-md-5 rounded-5" style={{ backgroundColor: '#0c0c0c' }}>

        {/* Tasa en vivo */}
        <div className="d-flex align-items-center gap-2 mb-4">
          <span className="rounded-circle d-inline-block"
            style={{ width: 8, height: 8, backgroundColor: isLive ? '#22c55e' : '#fbbf24', flexShrink: 0 }} />
          <span className="small text-white-50">
            {loading ? 'Cargando tasa...' : isLive
              ? `Tasa CETES en vivo · ${cetesRate.toFixed(2)}% bruto`
              : `Tasa referencial · ${cetesRate.toFixed(2)}%`}
          </span>
        </div>

        {/* Resultado */}
        <p className="text-white-50 small text-uppercase mb-1" style={{ letterSpacing: 1 }}>
          Proyección a {anios} años
        </p>
        <h2 className="fw-black mb-1" style={{ fontSize: 'clamp(2rem, 5vw, 3.2rem)', letterSpacing: '-2px', color: '#f59e0b' }}>
          ${Math.round(total).toLocaleString('es-MX')}
        </h2>
        <p className="text-white-50 small mb-4">USDC · a {apy.toFixed(2)}% APY neto</p>

        {/* Sliders */}
        <div className="mb-4">
          <div className="d-flex justify-content-between mb-2">
            <label id="cuota-label" className="small text-white-50">Aporte mensual</label>
            <span className="fw-bold small">${cuota} USDC</span>
          </div>
          <input type="range" className="form-range" min={2} max={500} step={1}
            value={cuota} onChange={e => setCuota(Number(e.target.value))}
            aria-labelledby="cuota-label"
            style={{ accentColor: '#f59e0b' }} />
          <div className="d-flex justify-content-between">
            <span className="text-white-50" style={{ fontSize: 11 }}>$2 USDC</span>
            <span className="text-white-50" style={{ fontSize: 11 }}>$500 USDC</span>
          </div>
        </div>

        <div className="mb-5">
          <div className="d-flex justify-content-between mb-2">
            <label id="anios-label" className="small text-white-50">Tiempo de ahorro</label>
            <span className="fw-bold small">{anios} años</span>
          </div>
          <input type="range" className="form-range" min={1} max={40}
            value={anios} onChange={e => setAnios(Number(e.target.value))}
            aria-labelledby="anios-label"
            style={{ accentColor: '#f59e0b' }} />
          <div className="d-flex justify-content-between">
            <span className="text-white-50" style={{ fontSize: 11 }}>1 año</span>
            <span className="text-white-50" style={{ fontSize: 11 }}>40 años</span>
          </div>
        </div>

        <button
          className="btn btn-primary w-100 py-3 rounded-4 fw-bold fs-6"
          style={{ background: 'linear-gradient(45deg, #d97706, #f59e0b)', border: 'none' }}
          onClick={onRegister}
          aria-label="Empezar a ahorrar">
          Empezar a ahorrar →
        </button>
      </div>
    </div>
  )
}

// ─── Sección: 3 pasos ─────────────────────────────────────────────────────────
function TresPasos() {
  const pasos = [
    {
      num: '01',
      icon: '🔗',
      titulo: 'Conecta tu wallet',
      desc: 'Usa Freighter en Stellar Testnet. Sin banco, sin papeleo, sin esperas.',
    },
    {
      num: '02',
      icon: '💸',
      titulo: 'Deposita USDC',
      desc: 'Desde $2 USDC. Tus fondos quedan bloqueados en un contrato Soroban — ni nosotros podemos tocarlos.',
    },
    {
      num: '03',
      icon: '📈',
      titulo: 'Gana rendimiento',
      desc: 'Tu dinero crece con la tasa CETES real vía Etherfuse. Retiras al cumplir tu meta.',
    },
  ]

  return (
    <section className="container py-5 my-3">
      <div className="text-center mb-5">
        <span className="badge rounded-pill px-3 py-2 mb-3"
          style={{ backgroundColor: 'rgba(59,130,246,0.1)', color: '#f59e0b', border: '1px solid rgba(59,130,246,0.2)' }}>
          ¿Cómo funciona?
        </span>
        <h2 className="fw-black" style={{ letterSpacing: '-2px', fontSize: 'clamp(1.8rem,4vw,2.8rem)' }}>
          Tres pasos.<br /><span style={{ opacity: 0.35 }}>Nada más.</span>
        </h2>
      </div>
      <div className="row g-4 justify-content-center">
        {pasos.map((p) => (
          <div className="col-md-4" key={p.num}>
            <div className="p-4 rounded-4 h-100"
              style={{ backgroundColor: '#0c0c0c', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="d-flex align-items-center gap-3 mb-3">
                <span className="fw-black" style={{ fontSize: 13, color: 'rgba(255,255,255,0.2)', letterSpacing: 1 }}>
                  {p.num}
                </span>
                <span style={{ fontSize: 24 }}>{p.icon}</span>
              </div>
              <h5 className="fw-bold mb-2">{p.titulo}</h5>
              <p className="text-white-50 small mb-0">{p.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── CTA final ────────────────────────────────────────────────────────────────
function CtaFinal({ onRegister, onLogin }) {
  return (
    <section className="container py-5 my-3">
      <div className="p-5 rounded-4 text-center"
        style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.15) 0%, rgba(16,185,129,0.08) 100%)', border: '1px solid rgba(59,130,246,0.2)' }}>
        <h2 className="fw-black mb-3" style={{ letterSpacing: '-2px', fontSize: 'clamp(1.8rem,4vw,2.8rem)' }}>
          Tu retiro empieza hoy.
        </h2>
        <p className="text-white-50 mb-4 mx-auto" style={{ maxWidth: 480 }}>
          Sin banco, sin intermediarios. El contrato Soroban garantiza que tus fondos
          están seguros y generando rendimiento real.
        </p>
        <div className="d-flex gap-3 justify-content-center flex-wrap">
          <button className="btn btn-primary btn-lg px-5 py-3 rounded-4 fw-bold"
            style={{ background: 'linear-gradient(45deg, #d97706, #f59e0b)', border: 'none' }}
            onClick={onRegister}
            aria-label="Crear cuenta gratis">
            Crear cuenta gratis
          </button>
          <button className="btn btn-outline-secondary btn-lg px-5 py-3 rounded-4 fw-bold"
            onClick={onLogin}
            aria-label="Iniciar sesión con cuenta existente">
            Ya tengo cuenta
          </button>
        </div>
      </div>
    </section>
  )
}

// ─── Landing principal ────────────────────────────────────────────────────────
export function LandingScreen({ onLogin, onRegister }) {
  return (
    <div style={{ backgroundColor: '#050505', color: '#fff', minHeight: '100vh', fontFamily: "'Inter', sans-serif", overflowX: 'hidden' }}>

      <LandingNavbar onLogin={onLogin} onRegister={onRegister} />

      {/* Hero */}
      <header className="container py-5 mt-3">
        <div className="row align-items-center g-5">

          {/* Copy */}
          <div className="col-lg-6">
            <div className="badge rounded-pill mb-3 px-3 py-2"
              style={{ backgroundColor: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }}>
              🔒 Contrato Soroban · Stellar Testnet
            </div>
            <h1 className="fw-black mb-4"
              style={{ fontSize: 'clamp(2.4rem, 6vw, 4.5rem)', lineHeight: 1, letterSpacing: '-3px' }}>
              Ahorra para<br />
              <span style={{ opacity: 0.35 }}>tu retiro.</span>
            </h1>
            <p className="fs-5 text-white-50 mb-4 pe-lg-4">
              Deposita USDC, gana rendimiento real con CETES vía Etherfuse, y retira
              cuando llegues a tu meta. Sin banco de por medio.
            </p>

            {/* Puntos clave */}
            <div className="d-flex flex-column gap-2 mb-5">
              {[
                { icon: '📈', text: `~4.70% APY neto en USDC (CETES −1% comisión)` },
                { icon: '🔒', text: 'Fondos bloqueados en contrato Soroban — nadie los puede mover' },
                { icon: '🚨', text: 'Autopréstamo de emergencia hasta 30% de tu saldo' },
              ].map(item => (
                <div key={item.text} className="d-flex align-items-start gap-2">
                  <span style={{ fontSize: 16, flexShrink: 0, marginTop: 2 }}>{item.icon}</span>
                  <span className="text-white-50 small">{item.text}</span>
                </div>
              ))}
            </div>

            {/* Botones mobile */}
            <div className="d-flex gap-3 flex-wrap d-lg-none">
              <button className="btn btn-primary btn-lg px-5 py-3 rounded-4 fw-bold"
                style={{ background: 'linear-gradient(45deg, #d97706, #f59e0b)', border: 'none' }}
                onClick={onRegister}
                aria-label="Comenzar ahora">
                Comenzar ahora
              </button>
              <button className="btn btn-outline-secondary btn-lg px-4 py-3 rounded-4 fw-bold"
                onClick={onLogin}
                aria-label="Iniciar sesión">
                Iniciar sesión
              </button>
            </div>
          </div>

          {/* Calculadora */}
          <div className="col-lg-5 offset-lg-1">
            <CalculadoraHero onRegister={onRegister} />
          </div>
        </div>
      </header>

      {/* Tres pasos */}
      <TresPasos />

      {/* CTA */}
      <CtaFinal onRegister={onRegister} onLogin={onLogin} />

      <Footer />
    </div>
  )
}
