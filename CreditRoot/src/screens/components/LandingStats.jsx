import { useEtherfuseRate } from '../../hooks/useEtherfuseRate'

function LandingStats() {
    const { cetesRate, userRate, isLive } = useEtherfuseRate()

    const stats = [
        { val: '32M', label: 'Mexicanos sin pensión ni AFORE', color: '#3b82f6' },
        { val: `${userRate}%`, label: `Rendimiento en USDC para ti${isLive ? ' · en vivo' : ''}`, color: '#22c55e' },
        { val: '$2 USDC', label: 'Mínimo para empezar a ahorrar', color: '#fbbf24' },
    ]

    return (
        <section className="container py-5">
            <div className="row g-4 text-center">
                {stats.map((s) => (
                    <div className="col-md-4" key={s.label}>
                        <h2 className="fw-bold display-4" style={{ color: s.color, letterSpacing: '-2px' }}>
                            {s.val}
                        </h2>
                        <p className="text-white-50">{s.label}</p>
                    </div>
                ))}
            </div>
        </section>
    )
}
export default LandingStats
