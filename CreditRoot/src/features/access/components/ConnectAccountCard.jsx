import { useState, useEffect } from 'react'
import { conectarWallet } from '../../../lib/wallet'
import { getBalances } from '../../../lib/stellar'
import { useTranslation } from 'react-i18next'

export function ConnectAccountCard({ walletAddress: initialAddress }) {
  const [wallet, setWallet] = useState(initialAddress ?? null)
  const [balance, setBalance] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const { t } = useTranslation()

  useEffect(() => {
    if (initialAddress) cargarBalances(initialAddress)
  }, [initialAddress])

  async function cargarBalances(address) {
    try {
      const balances = await getBalances(address)
      const xlm = balances.find(b => b.asset_type === 'native')
      const usdc = balances.find(b => b.asset_code === 'USDC')
      setBalance({
        xlm: xlm ? parseFloat(xlm.balance).toFixed(2) : '0',
        usdc: usdc ? parseFloat(usdc.balance).toFixed(2) : '0',
      })
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleConectar() {
    try {
      setLoading(true)
      setError(null)
      const address = await conectarWallet()
      setWallet(address)
      await cargarBalances(address)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const panels = [
    { label: t('connectCard.estado'), val: wallet ? t('connectCard.conectada') : t('connectCard.pendiente'), color: wallet ? 'text-green-600' : 'text-ink/25 dark:text-white/25' },
    { label: t('connectCard.balanceXLM'), val: balance ? `${balance.xlm} XLM` : '—', color: 'text-ink dark:text-white' },
    { label: t('connectCard.balanceUSDC'), val: balance ? `$${balance.usdc}` : '—', color: 'text-brand' },
    { label: t('connectCard.direccion'), val: wallet ? `${wallet.slice(0, 6)}...${wallet.slice(-6)}` : '—', color: 'text-ink/40 dark:text-white/40', mono: true },
  ]

  return (
    <div>
      <div className="mb-6">
        <span className={`inline-block rounded-lg px-3 py-1.5 text-xs font-semibold mb-3 border ${wallet
          ? 'bg-green-500/10 text-green-700 border-green-500/20'
          : 'bg-brand/10 text-brand-dark border-brand/20'
          }`}>
          {wallet ? t('connectCard.badgeConectada') : t('connectCard.badgePendiente')}
        </span>
        <h3 className="font-display font-black text-ink dark:text-white text-xl mb-1 tracking-tight">
          {t('connectCard.titulo')}
        </h3>
        <p className="text-sm text-ink/45 dark:text-white/45 leading-relaxed">
          {t('connectCard.descripcion')}
        </p>
      </div>

      <button
        className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all cursor-pointer mb-5 ${wallet
          ? 'bg-green-500/10 text-green-700 border border-green-500/20 cursor-default'
          : 'bg-brand hover:bg-brand-dark text-white hover:-translate-y-px hover:shadow-lg hover:shadow-brand/30'
          } disabled:opacity-50`}
        onClick={handleConectar}
        disabled={!!wallet || loading}>
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            {t('connectCard.conectando')}
          </span>
        ) : wallet ? t('connectCard.btnConectada') : t('connectCard.btnConectar')}
      </button>

      {error && (
        <div className="bg-red-500/8 border border-dashed border-red-400/40 text-red-500 text-sm px-4 py-3 rounded-xl mb-5">
          ⚠️ {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {panels.map(item => (
          <div key={item.label} className="bg-ink/3 dark:bg-white/3 border border-ink/6 dark:border-white/6 rounded-xl p-3">
            <p className="text-xs text-ink/40 dark:text-white/40 mb-1">{item.label}</p>
            <p className={`text-sm font-bold ${item.color} ${item.mono ? 'font-mono' : ''}`}>
              {item.val}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}