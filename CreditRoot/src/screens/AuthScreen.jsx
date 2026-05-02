import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Footer from './components/Footer'
import LandingNavbar from './components/LandingNavbar'
import { conectarWallet } from '../lib/wallet'
import ardilla from '../assets/Ardilla_vector.png'

export function AuthScreen({ onAuth, onVolver }) {
    const { t } = useTranslation()
    const [paso, setPaso] = useState('wallet')
    const [walletAddress, setWalletAddress] = useState(null)
    const [nombre, setNombre] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    async function handleConectarWallet() {
        setLoading(true)
        setError(null)
        try {
            const address = await conectarWallet()
            setWalletAddress(address)
            setPaso('nombre')
        } catch (e) {
            if (e.message.includes('Freighter no está disponible')) {
                setError('Freighter no está instalado. Instálalo desde freighter.app')
            } else {
                setError('No se pudo conectar la wallet. Intenta de nuevo.')
            }
        } finally {
            setLoading(false)
        }
    }

    function handleSubmit(e) {
        e.preventDefault()
        if (!nombre.trim()) {
            setError(t('auth.nombreLabel') + ' requerido')
            return
        }
        onAuth({ nombre: nombre.trim(), walletAddress })
    }

    return (
        <div className="bg-surface dark:bg-[#0f0e0d] min-h-screen overflow-x-hidden">
            <LandingNavbar soloVolver onVolver={onVolver} />

            <div className="container mx-auto px-4 py-16 lg:py-24">
                <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

                    {/* Copy izquierda */}
                    <div className="hidden lg:flex flex-col justify-center anim-fade-up-1">
                        <span className="inline-block bg-brand/10 text-brand-dark border border-brand/20 rounded-lg px-4 py-1.5 text-xs font-semibold tracking-wide mb-6">
                            🛡️ {t('auth.badge')}
                        </span>
                        <h1 className="font-display font-black text-ink dark:text-white tracking-tight mb-4"
                            style={{ fontSize: 'clamp(2.4rem,5vw,3.6rem)', lineHeight: 1.05 }}>
                            {paso === 'wallet' ? (
                                <>{t('auth.tituloWallet')}<br /><em className="text-brand italic">{t('auth.tituloWalletAccent')}</em></>
                            ) : (
                                <>{t('auth.tituloNombre')}<br /><em className="text-brand italic">{t('auth.tituloNombreAccent')}</em></>
                            )}
                        </h1>
                        <p className="text-ink/50 dark:text-white/50 text-lg leading-relaxed max-w-md mb-8">
                            {paso === 'wallet' ? t('auth.descWallet') : t('auth.descNombre')}
                        </p>
                        <div className="mt-4">
                            <img src={ardilla} alt="Mascota Mañana Seguro" className="h-48 object-contain float-squirrel" />
                        </div>
                    </div>

                    {/* Card */}
                    <div className="anim-fade-up-2">
                        <div className="bg-white dark:bg-white/5 rounded-3xl p-8 lg:p-10 border border-ink/8 dark:border-white/8 shadow-xl shadow-ink/5">

                            {/* Paso 1 — Conectar wallet */}
                            {paso === 'wallet' && (
                                <div className="flex flex-col items-center text-center gap-6">
                                    <div className="w-16 h-16 rounded-2xl bg-brand/10 flex items-center justify-center">
                                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#e3730d" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="2" y="7" width="20" height="14" rx="2" />
                                            <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                                            <line x1="12" y1="12" x2="12" y2="16" />
                                            <line x1="10" y1="14" x2="14" y2="14" />
                                        </svg>
                                    </div>

                                    <div>
                                        <h3 className="font-display font-black text-ink dark:text-white text-2xl mb-2">
                                            {t('auth.tituloWallet')}
                                        </h3>
                                        <p className="text-ink/45 dark:text-white/45 text-sm leading-relaxed max-w-xs mx-auto">
                                            {t('auth.descWallet')}
                                        </p>
                                    </div>

                                    {error && (
                                        <div className="w-full bg-red-500/8 border border-dashed border-red-400/40 text-red-500 text-sm text-center px-4 py-3 rounded-xl">
                                            ⚠️ {error}
                                            {error.includes('freighter.app') && (
                                                <a href="https://freighter.app" target="_blank" rel="noopener noreferrer"
                                                    className="block mt-2 text-brand underline font-medium">
                                                    {t('auth.instalar')} →
                                                </a>
                                            )}
                                        </div>
                                    )}

                                    <button
                                        className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-4 rounded-xl transition-all hover:-translate-y-px hover:shadow-lg hover:shadow-brand/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                        onClick={handleConectarWallet}
                                        disabled={loading}>
                                        {loading ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                                                </svg>
                                                {t('auth.conectando')}
                                            </span>
                                        ) : t('auth.conectar')}
                                    </button>

                                    <p className="text-xs text-ink/30 dark:text-white/30">
                                        {t('auth.noFreighter')}{' '}
                                        <a href="https://freighter.app" target="_blank" rel="noopener noreferrer"
                                            className="text-brand hover:text-brand-dark transition-colors">
                                            {t('auth.instalar')}
                                        </a>
                                    </p>
                                </div>
                            )}

                            {/* Paso 2 — Nombre */}
                            {paso === 'nombre' && (
                                <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                                    <div className="bg-green-500/8 border border-green-500/20 rounded-xl px-4 py-3 flex items-center gap-3">
                                        <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-xs text-green-700 font-semibold mb-0.5">{t('auth.walletConectada')}</p>
                                            <p className="text-xs text-ink/40 dark:text-white/40 font-mono truncate">{walletAddress}</p>
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="font-display font-black text-ink dark:text-white text-2xl mb-1">
                                            {t('auth.tituloNombreAccent')}
                                        </h3>
                                        <p className="text-ink/40 dark:text-white/40 text-sm">{t('auth.descNombre')}</p>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-ink/40 dark:text-white/40 uppercase tracking-widest mb-2">
                                            {t('auth.nombreLabel')}
                                        </label>
                                        <input
                                            className="w-full rounded-xl px-5 py-3.5 text-base bg-white dark:bg-white/5 outline-none transition-all duration-200 border border-ink/10 dark:border-white/10 focus:border-brand focus:ring-2 focus:ring-brand/20 text-ink dark:text-white"
                                            placeholder={t('auth.nombrePlaceholder')}
                                            value={nombre}
                                            onChange={e => setNombre(e.target.value)}
                                            autoFocus
                                        />
                                    </div>

                                    {error && (
                                        <div className="bg-red-500/8 border border-dashed border-red-400/40 text-red-500 text-sm text-center px-4 py-3 rounded-xl">
                                            ⚠️ {error}
                                        </div>
                                    )}

                                    <button
                                        type="submit"
                                        className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-4 rounded-xl transition-all hover:-translate-y-px hover:shadow-lg hover:shadow-brand/30 cursor-pointer">
                                        {t('auth.entrar')}
                                    </button>

                                    <button
                                        type="button"
                                        className="text-sm text-ink/30 dark:text-white/30 hover:text-ink/60 dark:hover:text-white/60 transition-colors cursor-pointer"
                                        onClick={() => { setPaso('wallet'); setError(null) }}>
                                        {t('auth.cambiarWallet')}
                                    </button>
                                </form>
                            )}

                        </div>
                    </div>

                </div>
            </div>
            <Footer />
        </div>
    )
}