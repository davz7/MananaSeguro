import { WithdrawalFlow } from '../features/withdrawal/components/WithdrawalFlow'

export function WithdrawalScreen() {
  return (
    <section id="retiro" className="py-5"
      style={{ backgroundColor: '#050505', color: '#fff', fontFamily: "'Inter', sans-serif" }}>
      <div className="container py-4">

        <div className="badge rounded-pill px-3 py-2 mb-3"
          style={{ backgroundColor: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }}>
          Retiro · Mañana Seguro
        </div>
        <h2 className="fw-bold mb-2" style={{ letterSpacing: '-2px' }}>Flujo de retiro</h2>
        <p className="text-white-50 mb-5">
          Al alcanzar tu meta, el contrato libera todos tus fondos directamente a tu wallet.
          Sin intermediarios, sin esperas, sin banco.
        </p>

        <div className="row">
          <div className="col-lg-8">
            <WithdrawalFlow meta={10000} />
          </div>
          <div className="col-lg-4 mt-4 mt-lg-0">
            <div className="p-4 rounded-4 h-100"
              style={{ backgroundColor: '#0c0c0c', border: '1px solid rgba(255,255,255,0.06)' }}>
              <h6 className="fw-bold mb-3">El flujo completo</h6>
              <div className="d-flex flex-column gap-3">
                {[
                  { icon: '💵', step: 'Depositas USDC', desc: 'Desde $2 USDC, cuando quieras' },
                  { icon: '🔒', step: 'Contrato bloquea', desc: 'Soroban en Stellar testnet' },
                  { icon: '📈', step: 'Etherfuse rinde', desc: `${4.7}% APY en USDC vía CETES` },
                  { icon: '🎁', step: 'Incentivos c/5 años', desc: 'Hasta 9% extra por fidelidad' },
                  { icon: '🏆', step: 'Retiras al llegar', desc: 'Todo a tu wallet, sin banco' },
                ].map((item, i) => (
                  <div key={item.step} className="d-flex gap-3 align-items-start">
                    <div className="d-flex flex-column align-items-center">
                      <div className="rounded-circle d-flex align-items-center justify-content-center fw-bold"
                        style={{ width: 32, height: 32, backgroundColor: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', fontSize: 12, color: '#3b82f6', flexShrink: 0 }}>
                        {i + 1}
                      </div>
                      {i < 4 && <div style={{ width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 4 }} />}
                    </div>
                    <div className="pb-2">
                      <div className="small fw-bold">{item.icon} {item.step}</div>
                      <div className="small text-white-50">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  )
}
