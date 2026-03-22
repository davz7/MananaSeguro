function LandingNavbar({ onLogin, onRegister, onVolver, soloVolver }) {
    return (
        <nav className="navbar sticky-top px-4 py-3"
            style={{ backdropFilter: 'blur(15px)', backgroundColor: 'rgba(5,5,5,0.85)', borderBottom: '1px solid rgba(255,255,255,0.05)', zIndex: 1000 }}>
            <div className="container d-flex justify-content-between align-items-center">

                <span className="fw-black fs-4" style={{ letterSpacing: '-1.5px', color: '#fff' }}>
                    MAÑANA<span style={{ color: '#3b82f6' }}>SEGURO</span>
                </span>

                {soloVolver ? (
                    <button className="btn text-white-50 fw-medium border-0" onClick={onVolver}>
                        ← Volver al inicio
                    </button>
                ) : (
                    <div className="d-flex gap-3 align-items-center">
                        <button
                            className="btn text-white-50 fw-medium border-0 d-none d-md-block"
                            onClick={onLogin}>
                            Iniciar sesión
                        </button>
                        <button
                            className="btn btn-primary px-4 rounded-pill fw-bold"
                            style={{ background: 'linear-gradient(45deg, #2563eb, #3b82f6)', border: 'none' }}
                            onClick={onRegister}>
                            Comenzar gratis
                        </button>
                    </div>
                )}
            </div>
        </nav>
    )
}
export default LandingNavbar
