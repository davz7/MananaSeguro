function CtaFinal({ onLogin, onRegister }) {
    return (
        <section className="py-5 my-3"
            style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.15), rgba(59,130,246,0.05))' }}>
            <div className="container text-center py-4">

                <div className="badge rounded-pill px-3 py-2 mb-4"
                    style={{ backgroundColor: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }}>
                    🛵 Como Carlos, el repartidor de 32 años
                </div>

                <h2 className="display-4 fw-bold mb-3" style={{ letterSpacing: '-2px' }}>
                    $500 pesos al mes.<br />
                    <span style={{ color: '#22c55e' }}>$244,000 pesos a los 52.</span>
                </h2>

                <p className="text-white-50 fs-5 mb-5">
                    Sin banco. Sin IMSS. Sin AFORE. Solo tú, tu wallet y Mañana Seguro.
                </p>

                <div className="d-flex gap-3 justify-content-center flex-wrap mb-5">
                    <button className="btn btn-primary btn-lg px-5 py-3 rounded-4 fw-bold"
                        style={{ background: 'linear-gradient(45deg, #2563eb, #3b82f6)', border: 'none' }}
                        onClick={onRegister}>
                        Empezar con $2 USDC →
                    </button>
                    <button className="btn btn-outline-secondary btn-lg px-5 py-3 rounded-4 fw-bold"
                        onClick={onLogin}>
                        Ya tengo cuenta
                    </button>
                </div>

                {/* Mini stats */}
                <div className="row g-3 justify-content-center">
                    {[
                        { val: '4.7%', label: 'APY en USDC' },
                        { val: '9%', label: 'Incentivo máx. cada 5 años' },
                        { val: '30%', label: 'Autopréstamo de emergencia' },
                        { val: '$2', label: 'USDC mínimo para empezar' },
                    ].map(s => (
                        <div className="col-6 col-md-3" key={s.label}>
                            <div className="p-3 rounded-4"
                                style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <div className="fw-bold fs-5" style={{ color: '#3b82f6' }}>{s.val}</div>
                                <div className="small text-white-50">{s.label}</div>
                            </div>
                        </div>
                    ))}
                </div>

            </div>
        </section>
    )
}
export default CtaFinal
