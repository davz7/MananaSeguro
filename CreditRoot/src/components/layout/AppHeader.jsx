import { navigationItems } from '../../app/navigation'
import { useEtherfuseRate } from '../../hooks/useEtherfuseRate'

export function AppHeader({ usuario }) {
  const { userRate, isLive } = useEtherfuseRate()

  return (
    <nav className="navbar sticky-top px-4 py-3"
      style={{ backdropFilter: 'blur(15px)', backgroundColor: 'rgba(5,5,5,0.85)', borderBottom: '1px solid rgba(255,255,255,0.05)', zIndex: 1000 }}>
      <div className="container d-flex justify-content-between align-items-center">

        {/* Logo */}
        <span className="fw-black fs-4" style={{ letterSpacing: '-1.5px', color: '#fff' }}>
          MAÑANA<span style={{ color: '#3b82f6' }}>SEGURO</span>
        </span>

        {/* Nav links + tasa en vivo */}
        <div className="d-flex align-items-center gap-4">
          {navigationItems.map((item) => (
            <a key={item.href} href={item.href}
              className="text-decoration-none small fw-medium d-none d-md-block"
              style={{ color: 'rgba(255,255,255,0.5)' }}>
              {item.label}
            </a>
          ))}

          {/* Badge tasa en vivo */}
          <span className="d-none d-lg-flex align-items-center gap-1"
            style={{
              backgroundColor: isLive ? 'rgba(34,197,94,0.1)' : 'rgba(251,191,36,0.1)',
              border: `1px solid ${isLive ? 'rgba(34,197,94,0.3)' : 'rgba(251,191,36,0.3)'}`,
              borderRadius: 99,
              padding: '3px 10px',
              fontSize: 11,
              fontWeight: 700,
              color: isLive ? '#22c55e' : '#fbbf24',
            }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              backgroundColor: 'currentColor', display: 'inline-block',
            }} />
            {userRate}% APY
          </span>
        </div>

        {/* Usuario */}
        {usuario && (
          <div className="d-flex align-items-center gap-2">
            <div className="rounded-circle d-flex align-items-center justify-content-center fw-bold small"
              style={{ width: 32, height: 32, backgroundColor: '#3b82f6', fontSize: '0.75rem' }}>
              {usuario.nombre.charAt(0).toUpperCase()}
            </div>
            <span className="small text-white-50 d-none d-md-block">{usuario.nombre.split(' ')[0]}</span>
          </div>
        )}

      </div>
    </nav>
  )
}
