import { SectionHeading } from '../components/common/SectionHeading'
import { RetirementSnapshot } from '../features/dashboard/components/RetirementSnapshot'

export function DashboardScreen() {
  return (
    <section id="dashboard" className="py-5"
      style={{ backgroundColor: '#050505', color: '#fff', fontFamily: "'Inter', sans-serif" }}>
      <div className="container py-4">

        <div className="badge rounded-pill px-3 py-2 mb-3"
          style={{ backgroundColor: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.2)' }}>
          Dashboard · Mañana Seguro
        </div>
        <h2 className="fw-bold mb-2" style={{ letterSpacing: '-2px' }}>Tu ahorro en tiempo real</h2>
        <p className="text-white-50 mb-5">
          Saldo bloqueado, rendimiento Etherfuse, incentivos por ciclo y autopréstamo de emergencia.
        </p>

        <RetirementSnapshot />

      </div>
    </section>
  )
}
