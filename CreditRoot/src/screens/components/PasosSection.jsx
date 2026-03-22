const pasos = [
    {
        num: '01', icon: '🔐',
        titulo: 'Conecta tu wallet',
        desc: 'Usa Freighter en Stellar. Tú controlas tus claves. Sin banco, sin papeleo.',
    },
    {
        num: '02', icon: '💵',
        titulo: 'Deposita desde $2 USDC',
        desc: 'Sin obligación de frecuencia. Si eliges constancia, mínimo $20 USDC/mes para incentivos.',
    },
    {
        num: '03', icon: '🔒',
        titulo: 'Bloquea en contrato inteligente',
        desc: 'Los fondos se invierten automáticamente en CETES tokenizados vía Etherfuse. Tú no haces nada.',
    },
    {
        num: '04', icon: '🎯',
        titulo: 'Cobra incentivos cada 5 años',
        desc: 'Por fidelidad, constancia y referidos. Hasta 9% adicional sobre tu rendimiento acumulado.',
    },
]

function PasosSection() {
    return (
        <section className="container py-5 my-3">
            <div className="text-center mb-5">
                <span className="badge rounded-pill px-3 py-2 mb-3"
                    style={{ backgroundColor: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.2)' }}>
                    Así funciona
                </span>
                <h2 className="display-5 fw-bold" style={{ letterSpacing: '-2px' }}>
                    En 4 pasos, tu retiro seguro.
                </h2>
                <p className="text-white-50 mt-2">Sin filas. Sin papeleo. Sin banco. Sin IMSS.</p>
            </div>

            <div className="row g-4">
                {pasos.map((p, i) => (
                    <div className="col-md-6 col-lg-3" key={p.num}>
                        <div className="p-4 h-100 rounded-4 position-relative"
                            style={{ backgroundColor: '#0c0c0c', border: '1px solid rgba(255,255,255,0.06)' }}>

                            {/* Conector entre pasos */}
                            {i < pasos.length - 1 && (
                                <div className="d-none d-lg-block position-absolute"
                                    style={{ right: -20, top: '50%', transform: 'translateY(-50%)', color: 'rgba(59,130,246,0.3)', fontSize: 20, zIndex: 2 }}>
                                    →
                                </div>
                            )}

                            <div className="fs-2 mb-3">{p.icon}</div>
                            <div className="fw-black mb-2"
                                style={{ color: 'rgba(59,130,246,0.5)', fontSize: '0.85rem' }}>
                                {p.num}
                            </div>
                            <h6 className="fw-bold mb-2">{p.titulo}</h6>
                            <p className="text-white-50 small mb-0">{p.desc}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Flujo del modelo */}
            <div className="mt-5 p-4 rounded-4 text-center"
                style={{ backgroundColor: 'rgba(59,130,246,0.05)', border: '1px dashed rgba(59,130,246,0.2)' }}>
                <div className="small text-white-50 mb-2">El flujo del dinero</div>
                <div className="d-flex align-items-center justify-content-center flex-wrap gap-2"
                    style={{ fontSize: 13 }}>
                    {[
                        { text: 'Tu USDC', color: '#fff' },
                        { text: '→', color: 'rgba(255,255,255,0.2)' },
                        { text: 'Contrato inteligente', color: '#3b82f6' },
                        { text: '→', color: 'rgba(255,255,255,0.2)' },
                        { text: 'Etherfuse CETES', color: '#22c55e' },
                        { text: '→', color: 'rgba(255,255,255,0.2)' },
                        { text: '4.7% para ti', color: '#22c55e' },
                        { text: '+', color: 'rgba(255,255,255,0.2)' },
                        { text: '1% plataforma', color: '#f59e0b' },
                    ].map((item, i) => (
                        <span key={i} className="fw-bold" style={{ color: item.color }}>{item.text}</span>
                    ))}
                </div>
            </div>
        </section>
    )
}
export default PasosSection
