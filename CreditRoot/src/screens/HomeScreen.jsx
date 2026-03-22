import { ConnectAccountCard } from '../features/access/components/ConnectAccountCard'

export function HomeScreen() {
  return (
    <section id="inicio" className="py-5"
      style={{ backgroundColor: '#050505', color: '#fff', fontFamily: "'Inter', sans-serif" }}>
      <div className="container py-4">
        <div className="row align-items-center g-5">

          {/* Copy izquierdo */}
          <div className="col-lg-6">
            <div className="badge rounded-pill mb-3 px-3 py-2"
              style={{ backgroundColor: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.2)' }}>
              🔒 Ahorro para retiro · Etherfuse CETES · Stellar
            </div>

            <h2 className="fw-bold mb-4" style={{ letterSpacing: '-2px', lineHeight: 1, fontSize: '3rem' }}>
              Mañana Seguro,<br />
              <span style={{ opacity: 0.4 }}>empieza hoy.</span>
            </h2>

            <p className="text-white-50 fs-5 mb-5 pe-lg-4">
              Conecta tu wallet Freighter, deposita desde $2 USDC y bloquea
              tu ahorro en contrato inteligente. Sin banco, sin IMSS, sin burocracia.
            </p>

            <div className="d-flex gap-3 flex-wrap mb-5">
              <a href="#proyeccion"
                className="btn btn-primary btn-lg px-5 py-3 rounded-4 fw-bold"
                style={{ background: 'linear-gradient(45deg, #2563eb, #3b82f6)', border: 'none' }}>
                Ver simulador →
              </a>
              <a href="#dashboard"
                className="btn btn-outline-secondary btn-lg px-5 py-3 rounded-4 fw-bold">
                Mi dashboard
              </a>
            </div>

            {/* Stats alineadas al modelo */}
            <div className="row g-3">
              {[
                { val: '32M', label: 'Mexicanos sin pensión', color: 'text-primary' },
                { val: '4.7% APY', label: 'Rendimiento en USDC', color: 'text-success' },
                { val: '$2 USDC', label: 'Para empezar', color: 'text-warning' },
                { val: '1%', label: 'Comisión plataforma', color: 'text-info' },
              ].map((s) => (
                <div className="col-6" key={s.label}>
                  <div className="p-3 rounded-4"
                    style={{ backgroundColor: '#0c0c0c', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className={`fw-bold fs-4 ${s.color}`}>{s.val}</div>
                    <div className="text-white-50 small">{s.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ConnectAccountCard derecha */}
          <div className="col-lg-5 offset-lg-1">
            <div className="p-1 rounded-5"
              style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)' }}>
              <div className="p-4 rounded-5" style={{ backgroundColor: '#0c0c0c' }}>
                <ConnectAccountCard />
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
