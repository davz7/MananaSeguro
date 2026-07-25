// src/features/access/components/ConnectAccountCard.jsx
// 
// Muestra la información del usuario autenticado con Google.
// Ya no pide conectar Freighter , el modelo es custodial via Supabase.

import { useTranslation } from 'react-i18next'

export function ConnectAccountCard({ usuario }) {
  const { t } = useTranslation()

  // Si no hay usuario, mostrar estado pendiente
  if (!usuario) {
    return (
      <div>
        <div className="mb-6">
          <span className="inline-block rounded-lg px-3 py-1.5 text-xs font-semibold mb-3 border bg-brand/10 text-brand-dark border-brand/20">
            🔐 {t('connectCard.badgePendiente')}
          </span>
          <h3 className="font-display font-black text-ink dark:text-white text-xl mb-1 tracking-tight">
            Mañana Seguro
          </h3>
          <p className="text-sm text-ink/45 dark:text-white/45 leading-relaxed">
            {t('connectCard.descripcion')}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[t('connectCard.panelEstado'), t('connectCard.panelUSDC'), t('connectCard.panelXLM'), t('connectCard.panelDireccion')].map(label => (
            <div key={label} className="bg-ink/3 dark:bg-white/3 border border-ink/6 dark:border-white/6 rounded-xl p-3">
              <p className="text-xs text-ink/40 dark:text-white/40 mb-1">{label}</p>
              <p className="text-sm font-bold text-ink/20 dark:text-white/20">—</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Usuario autenticado , mostrar sus datos
  const panels = [
    {
      label: t('connectCard.panelEstado'),
      val: t('connectCard.panelEstadoVal'),
      color: 'text-green-600',
    },
    {
      label: 'KYC',
      val: usuario.kycStatus === 'approved' ? '✓ Verificado' : '⏳ Pendiente',
      color: usuario.kycStatus === 'approved' ? 'text-green-600' : 'text-yellow-500',
    },
    {
      label: 'Email',
      val: usuario.email ?? '—',
      color: 'text-ink dark:text-white',
    },
    {
      label: t('connectCard.panelDireccion'),
      val: usuario.stellarPublicKey
        ? `${usuario.stellarPublicKey.slice(0, 6)}...${usuario.stellarPublicKey.slice(-6)}`
        : '—',
      color: 'text-ink/40 dark:text-white/40',
      mono: true,
    },
  ]

  return (
    <div>
      <div className="mb-6">
        <span className="inline-block rounded-lg px-3 py-1.5 text-xs font-semibold mb-3 border bg-green-500/10 text-green-700 border-green-500/20">
          {t('connectCard.badgeConectada')}
        </span>
        <h3 className="font-display font-black text-ink dark:text-white text-xl mb-1 tracking-tight">
          {usuario.nombre ?? 'Mi cuenta'}
        </h3>
        <p className="text-sm text-ink/45 dark:text-white/45 leading-relaxed">
          Tu ahorro está protegido y generando rendimiento real de CETES.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {panels.map(item => (
          <div key={item.label} className="bg-ink/3 dark:bg-white/3 border border-ink/6 dark:border-white/6 rounded-xl p-3">
            <p className="text-xs text-ink/40 dark:text-white/40 mb-1">{item.label}</p>
            <p className={`text-sm font-bold ${item.color} ${item.mono ? 'font-mono' : ''} truncate`}>
              {item.val}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}