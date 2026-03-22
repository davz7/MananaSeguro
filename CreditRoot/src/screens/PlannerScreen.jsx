import { ContributionPlanner } from '../features/planner/components/ContributionPlanner'
import { useEtherfuseRate } from '../hooks/useEtherfuseRate'

export function PlannerScreen() {
  const { userRate, loading } = useEtherfuseRate()

  return (
    <section id="proyeccion" className="py-5"
      style={{ backgroundColor: '#050505', color: '#fff', fontFamily: "'Inter', sans-serif" }}>
      <div className="container py-4">

        <div className="badge rounded-pill px-3 py-2 mb-3"
          style={{ backgroundColor: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.2)' }}>
          Simulador · Mañana Seguro
        </div>
        <h2 className="fw-bold mb-2" style={{ letterSpacing: '-2px' }}>¿Cuánto puedes ahorrar?</h2>
        <p className="text-white-50 mb-5">
          Desde $2 USDC, con rendimiento Etherfuse al{' '}
          <span style={{ color: '#22c55e', fontWeight: 700 }}>
            {loading ? '...' : `${userRate}%`}
          </span>
          {' '}e incentivos cada 5 años. Así crece tu retiro con constancia.
        </p>

        <ContributionPlanner />

      </div>
    </section>
  )
}
