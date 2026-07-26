// src/features/dashboard/components/RetirementSnapshot.jsx
// 
// ISO 25010
// Seguridad:      Lee usuario del localStorage , nunca expone datos ajenos.
// Fiabilidad:     Manejo de errores en cada fetch. Estados de carga explícitos.
// Mantenibilidad: Lógica de metas separada en GoalCard/GoalSetup.
// Usabilidad:     Primera vez → configurador de meta. Regresa → dashboard completo.
// 

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TriangleAlert } from 'lucide-react'
import { useEtherfuseRate } from '../../../hooks/useEtherfuseRate'
import { MANANA_SEGURO_RATES } from '../../../data/retirementContent'
import { calculateCycles } from '../../../utils/projections'
import { formatCurrencyUsd, formatCurrencyMxn } from '../../../utils/formatters'
import { useYieldCounterDirectMxn } from '../../../hooks/useYieldCounter'

import { AutoloanCard } from './AutoloanCard'
import { ContributionHistory } from './ContributionHistory'
import { ReferralModule } from '../../referrals/components/ReferralModule'
import { CarlosSimulator } from '../../simulator/components/CarlosSimulator'
import { RateBadge } from '../../../components/common/RateBadge'
import { DepositFlow } from '../../deposit/components/DepositFlow'
import { GoalCard, GoalEditModal, AddGoalButton } from '../../goals/components/GoalCard'
import { GoalSetup as GoalSetupComponent } from '../../goals/components/GoalSetup'

export function RetirementSnapshot() {
  const { t } = useTranslation()

  // Estado de datos
  const [lockedBalance, setLockedBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sinSesionError, setSinSesionError] = useState(false)
  const [activeTab, setActiveTab] = useState('resumen')
  const [showDeposit, setShowDeposit] = useState(false)

  // Estado de metas
  const [metas, setMetas] = useState([])          // todas las metas del usuario
  const [metaSeleccionada, setMetaSeleccionada] = useState(null)
  const metaIniciadaRef = useRef(false) // evita loop infinito
  const [metaEditando, setMetaEditando] = useState(null)
  const [loadingMetas, setLoadingMetas] = useState(true)

  // Hooks de tasas
  const { cetesRate, userRate, platformRate } = useEtherfuseRate()

  // Contador animado de rendimiento
  const {
    isGrowing,
    yieldTodayMxn: yieldTodayMxnAnimado,
    displayBalance: saldoAnimado,
  } = useYieldCounterDirectMxn(lockedBalance, userRate, lockedBalance > 0)

  // Tabs
  const tabs = [
    { key: 'resumen',   label: t('snapshot.tabs.resumen') },
    { key: 'historial', label: t('snapshot.tabs.historial') },
    { key: 'ciclos',    label: t('snapshot.tabs.ciclos') },
    { key: 'prestamo',  label: t('snapshot.tabs.prestamo') },
    { key: 'referidos', label: t('snapshot.tabs.referidos') },
    { key: 'carlos',    label: t('snapshot.tabs.carlos') },
    { key: 'ingresos',  label: t('snapshot.tabs.ingresos') },
  ]

  function handleTabKeyDown(e, currentIndex) {
    let newIndex = currentIndex
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault(); newIndex = (currentIndex + 1) % tabs.length
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault(); newIndex = (currentIndex - 1 + tabs.length) % tabs.length
    } else if (e.key === 'Home') { e.preventDefault(); newIndex = 0 }
    else if (e.key === 'End') { e.preventDefault(); newIndex = tabs.length - 1 }
    else return
    setActiveTab(tabs[newIndex].key)
    setTimeout(() => { document.getElementById(`tab-${tabs[newIndex].key}`)?.focus() }, 0)
  }

  // Cargar órdenes completadas
  const cargarDatos = useCallback(async () => {
    setSinSesionError(false)
    try {
      const usuarioGuardado = JSON.parse(localStorage.getItem('ms_usuario') || 'null')
      if (!usuarioGuardado?.id) {
        setSinSesionError(true)
        throw new Error(t('snapshot.errorWallet'))
      }

      const res = await fetch(`/api/etherfuse/order-status?usuarioId=${usuarioGuardado.id}`)
      if (res.ok) {
        const data = await res.json()
        const totalMxn = data.ordenes
          ?.filter(o => o.status === 'completed')
          ?.reduce((sum, o) => sum + Number(o.monto_mxn), 0) ?? 0
        setLockedBalance(totalMxn)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [t])

  // Cargar metas del usuario
  const cargarMetas = useCallback(async () => {
    try {
      const usuarioGuardado = JSON.parse(localStorage.getItem('ms_usuario') || 'null')
      if (!usuarioGuardado?.id) return

      const res = await fetch(`/api/metas?usuarioId=${usuarioGuardado.id}`)
      if (!res.ok) return
      const data = await res.json()
      const metasData = data.metas ?? []
      setMetas(metasData)

      // Seleccionar la meta principal solo la primera vez , usar ref para
      // evitar que metaSeleccionada sea dependencia y cause loop infinito
      if (metasData.length > 0 && !metaIniciadaRef.current) {
        metaIniciadaRef.current = true
        const principal = metasData.find(m => m.es_principal) ?? metasData[0]
        setMetaSeleccionada(principal)
      }
    } catch {
      // fallo silencioso , las metas son opcionales en el render
    } finally {
      setLoadingMetas(false)
    }
  }, []) // sin dependencias, metaIniciadaRef es estable

  useEffect(() => {
    cargarDatos()
    cargarMetas()
  }, [cargarDatos, cargarMetas])

  // Cuando se crea una nueva meta
  function handleMetaCreada(nuevaMeta) {
    setMetas(prev => [...prev, nuevaMeta])
    setMetaSeleccionada(nuevaMeta)
  }

  // Cuando se edita una meta
  function handleMetaEditada(metaActualizada) {
    setMetas(prev => prev.map(m => m.id === metaActualizada.id ? metaActualizada : m))
    if (metaSeleccionada?.id === metaActualizada.id) setMetaSeleccionada(metaActualizada)
    setMetaEditando(null)
  }

  // Cuando se elimina una meta
  async function handleEliminarMeta(meta) {
    const usuario = JSON.parse(localStorage.getItem('ms_usuario') || 'null')
    if (!usuario?.id) return
    if (!confirm(t('snapshot.confirmarEliminarMeta', { nombre: meta.nombre }))) return

    try {
      const res = await fetch(`/api/metas?id=${meta.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuarioId: usuario.id }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error); return }
      const metasRestantes = metas.filter(m => m.id !== meta.id)
      setMetas(metasRestantes)
      if (metaSeleccionada?.id === meta.id) {
        setMetaSeleccionada(metasRestantes.find(m => m.es_principal) ?? metasRestantes[0] ?? null)
      }
    } catch { /* fallo silencioso */ }
  }

  // Cálculos de la meta seleccionada
  const metaMxn = metaSeleccionada?.monto_objetivo_mxn ?? 10000
  const lockedBalanceMxn = lockedBalance  // ya en MXN desde Supabase
  const proyeccion20Mxn = lockedBalance * Math.pow(1 + userRate / 100, 20)

  // Fecha estimada de retiro basada en meta seleccionada
  const fechaRetiroEstimada = (() => {
    if (!metaSeleccionada || lockedBalance <= 0) return t('snapshot.calculando')
    const anosRestantes = metaSeleccionada.anos_al_retiro
    const anioRetiro = new Date().getFullYear() + anosRestantes
    return t('snapshot.fechaRetiroFormato', { anio: anioRetiro, anos: anosRestantes })
  })()

  const cycles = calculateCycles(25, 20, userRate, 9)
  const skeletonLabels = t('snapshot.skeletonLabels', { returnObjects: true })

  const usuario = JSON.parse(localStorage.getItem('ms_usuario') || 'null')
  const tieneMetas = metas.length > 0
  const primeraVez = !loadingMetas && !tieneMetas

  return (
    <div className="flex flex-col gap-4">

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 flex-wrap mb-2">
          <span className="inline-block bg-brand/10 text-brand-dark border border-brand/20 rounded-lg px-3 py-1.5 text-xs font-semibold">
            {t('snapshot.badge')}
          </span>
          {usuario?.email && (
            <span className="text-xs text-ink/40 dark:text-white/40">{usuario.email}</span>
          )}
        </div>
        <h2 className="font-display font-black text-ink dark:text-white tracking-tight mb-2"
          style={{ fontSize: 'clamp(1.8rem,4vw,2.4rem)' }}>
          {t('snapshot.titulo')}
        </h2>
        <RateBadge compact />
      </div>

      {/* PRIMERA VEZ: Configurador de meta */}
      {primeraVez && usuario && (
        <GoalSetupComponent usuario={usuario} onMetaCreada={handleMetaCreada} />
      )}

      {/* CON METAS: Botón depositar + row de metas */}
      {tieneMetas && (
        <>
          {/* Botón depositar , arriba de todo cuando ya hay meta */}
          {!showDeposit && (
            <button
              onClick={() => setShowDeposit(true)}
              className="mt-1 bg-brand hover:bg-brand-dark text-white text-sm font-semibold px-5 py-3 rounded-xl transition-all hover:-translate-y-px hover:shadow-lg hover:shadow-brand/30 cursor-pointer">
              + {t('deposit.depositarBtn')}
            </button>
          )}

          {showDeposit && usuario && (
            <DepositFlow
              usuarioId={usuario.id}
              kycStatus={usuario.kycStatus ?? 'pending'}
              metaId={metas.length === 1 ? metas[0].id : metaSeleccionada?.id}
              metas={metas.length > 1 ? metas : null}
              onComplete={() => { setShowDeposit(false); cargarDatos() }}
              onClose={() => setShowDeposit(false)}
            />
          )}

          {/* Row de tarjetas de metas */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h6 className="font-semibold text-ink dark:text-white text-sm">{t('snapshot.metasActivasTitulo')}</h6>
            </div>
            <div className={`grid gap-3 ${metas.length === 1 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
              {metas.map(meta => (
                <GoalCard
                  key={meta.id}
                  meta={meta}
                  saldoMxn={meta.id === metaSeleccionada?.id ? lockedBalanceMxn : 0}
                  seleccionada={meta.id === metaSeleccionada?.id}
                  onSeleccionar={() => setMetaSeleccionada(meta)}
                  onEditar={() => setMetaEditando(meta)}
                  onEliminar={() => handleEliminarMeta(meta)}
                  puedeEliminar={metas.length > 1}
                />
              ))}
              {/* Botón agregar nueva meta */}
              <AddGoalButton usuarioId={usuario?.id} onMetaCreada={handleMetaCreada} />
            </div>
          </div>
        </>
      )}

      {/* Modal de edición */}
      {metaEditando && usuario && (
        <GoalEditModal
          meta={metaEditando}
          usuarioId={usuario.id}
          onGuardado={handleMetaEditada}
          onCerrar={() => setMetaEditando(null)}
        />
      )}

      {/* Skeleton */}
      {loading && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3" aria-busy="true">
          {skeletonLabels.map(label => (
            <div key={label} className="bg-ink/4 dark:bg-white/4 border border-ink/6 dark:border-white/6 rounded-2xl p-4 h-28">
              <div className="text-transparent text-xs select-none mb-3">{label}</div>
              <div className="skeleton-pulse h-6 w-3/4 mb-2 rounded" />
              <div className="skeleton-pulse h-3 w-full rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-ink/5 dark:bg-white/5 border border-brand/20 rounded-2xl p-5">
          {sinSesionError ? (
            <div>
              <p className="font-semibold text-ink dark:text-white mb-1"><TriangleAlert size={16} className="inline shrink-0" aria-hidden="true" /> {t('snapshot.errorWallet')}</p>
              <p className="text-sm text-ink/50 dark:text-white/50 mb-3">{t('snapshot.errorWalletDesc')}</p>
              <button className="bg-brand text-white text-sm font-semibold px-4 py-2 rounded-xl cursor-pointer"
                onClick={() => window.location.href = '/login'}>
                {t('snapshot.errorWalletBtn')}
              </button>
            </div>
          ) : (
            <div>
              <p className="font-semibold text-ink dark:text-white mb-1"><TriangleAlert size={16} className="inline shrink-0" aria-hidden="true" /> {error}</p>
              <p className="text-sm text-ink/50 dark:text-white/50">{t('snapshot.errorGenerico')}</p>
            </div>
          )}
        </div>
      )}

      {/* Stat cards + tabs , solo cuando tiene metas y datos cargados */}
      {tieneMetas && !loading && (
        <>
          {/* 4 Stat cards , cambian según meta seleccionada */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            {[
              {
                label: t('snapshot.statSaldoDisponible'),
                val: formatCurrencyMxn(0),
                sub: t('snapshot.statProximamente'),
                color: 'text-brand',
              },
              {
                label: t('history.saldoBloqueado'),
                val: isGrowing
                  ? new Intl.NumberFormat('es-MX', {
                      style: 'currency', currency: 'MXN',
                      minimumFractionDigits: 5, maximumFractionDigits: 5,
                    }).format(saldoAnimado)
                  : formatCurrencyMxn(lockedBalanceMxn),
                // Solo mostrar la flecha de rendimiento de hoy , sin subtexto fijo
                sub: null,
                color: isGrowing ? 'text-green-500' : 'text-green-600',
                extra: isGrowing && (
                  <span className="text-xs text-green-400 mt-1 flex items-center gap-1">
                    {t('snapshot.hoyPrefijo', {
                      val: new Intl.NumberFormat('es-MX', {
                        style: 'currency', currency: 'MXN',
                        minimumFractionDigits: 5, maximumFractionDigits: 5,
                      }).format(Math.max(0, yieldTodayMxnAnimado)),
                    })}
                  </span>
                ),
              },
              {
                label: t('snapshot.statProyeccion'),
                val: formatCurrencyMxn(proyeccion20Mxn),
                sub: t('snapshot.statProyeccionSubNeto', { apy: userRate.toFixed(2) }),
                color: 'text-yellow-500',
              },
              {
                label: t('snapshot.statFecha'),
                val: fechaRetiroEstimada,
                sub: metaSeleccionada?.nombre ?? t('snapshot.sinMeta'),
                color: 'text-ink/60 dark:text-white/60',
              },
            ].map(stat => (
              <div key={stat.label} className="bg-white dark:bg-white/5 border border-ink/8 dark:border-white/8 rounded-2xl p-4">
                <p className="text-xs text-ink/40 dark:text-white/40 mb-2">{stat.label}</p>
                <p className={`text-base font-bold mb-1 ${stat.color}`}>{stat.val}</p>
                {stat.sub && <p className="text-xs text-ink/35 dark:text-white/35">{stat.sub}</p>}
                {stat.extra}
              </div>
            ))}
          </div>

          {/* Barra de progreso hacia meta seleccionada */}
          <div className="bg-white dark:bg-white/5 border border-ink/8 dark:border-white/8 rounded-2xl p-5">
            <div className="flex justify-between items-center mb-3">
              <span className="font-semibold text-ink dark:text-white text-sm">{t('snapshot.progresoTitulo')}</span>
              <span className="text-xs text-ink/40 dark:text-white/40">{t('snapshot.progresoMeta', { val: formatCurrencyMxn(metaMxn) })}</span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={metaMxn > 0 ? Math.round(Math.min((lockedBalance / metaMxn) * 100, 100)) : 0}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t('goalCard.progresoAria', { pct: metaMxn > 0 ? Math.round(Math.min((lockedBalance / metaMxn) * 100, 100)) : 0 })}
              className="h-2 bg-ink/5 dark:bg-white/5 rounded-full mb-2 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-brand-dark to-brand rounded-full transition-all duration-700"
                style={{ width: `${metaMxn > 0 ? Math.min((lockedBalance / metaMxn) * 100, 100) : 0}%` }} />
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-ink/40 dark:text-white/40">
                {t('snapshot.progresoBloqueados', { val: formatCurrencyMxn(lockedBalanceMxn) })}
              </span>
              <span className="text-xs text-brand font-semibold">
                {((lockedBalance / metaMxn) * 100).toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Tab bar */}
          <div className="relative">
            <div className="absolute top-0 right-0 w-12 h-full bg-gradient-to-r from-transparent to-surface dark:to-[#0f0e0d] pointer-events-none z-10" />
            <div role="tablist" aria-label={t('snapshot.tablistAriaLabel')}
              className="flex gap-2 overflow-x-auto pb-1 tab-scroll">
              {tabs.map((tab, index) => (
                <button
                  key={tab.key}
                  id={`tab-${tab.key}`}
                  role="tab"
                  aria-selected={activeTab === tab.key}
                  aria-controls={`panel-${tab.key}`}
                  tabIndex={activeTab === tab.key ? 0 : -1}
                  className={`shrink-0 text-xs font-semibold px-4 py-2 rounded-xl border transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === tab.key
                      ? 'bg-brand/10 border-brand/30 text-brand'
                      : 'bg-transparent border-ink/10 dark:border-white/10 text-ink/40 dark:text-white/40 hover:text-ink/70 dark:hover:text-white/70 hover:border-ink/20 dark:hover:border-white/20'
                  }`}
                  onClick={() => setActiveTab(tab.key)}
                  onKeyDown={e => handleTabKeyDown(e, index)}>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Panel: Resumen */}
          {activeTab === 'resumen' && (
            <div id="panel-resumen" role="tabpanel" aria-labelledby="tab-resumen" className="flex flex-col gap-4">
              <RateBadge />
              <div className="bg-white dark:bg-white/5 border border-ink/8 dark:border-white/8 rounded-2xl p-5">
                <h6 className="font-semibold text-ink dark:text-white mb-4">{t('snapshot.resumenTitulo')}</h6>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: t('snapshot.resumenRed'), val: t('snapshot.valRedBanxico') },
                    { label: t('snapshot.resumenProveedor'), val: t('snapshot.valProveedorCetes') },
                    { label: t('snapshot.resumenTasaBruta'), val: t('rateBadge.apySuffix', { value: cetesRate.toFixed(2) }) },
                    { label: t('snapshot.resumenTasaUsuario'), val: t('rateBadge.apySuffix', { value: userRate.toFixed(2) }) },
                    { label: t('snapshot.resumenComision'), val: t('rateBadge.apySuffix', { value: platformRate.toFixed(2) }) },
                    { label: t('snapshot.resumenMinDeposito'), val: t('snapshot.valMinDeposito') },
                    { label: t('snapshot.resumenPrestamo'), val: t('snapshot.resumenPrestamoVal', { pct: MANANA_SEGURO_RATES.loanMaxPct * 100 }) },
                    { label: t('snapshot.resumenIncentivo'), val: t('snapshot.resumenIncentivoVal') },
                  ].map(item => (
                    <div key={item.label}>
                      <p className="text-xs text-ink/40 dark:text-white/40 mb-0.5">{item.label}</p>
                      <p className="text-sm font-semibold text-ink dark:text-white">{item.val}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Panel: Historial */}
          {activeTab === 'historial' && (
            <div id="panel-historial" role="tabpanel" aria-labelledby="tab-historial">
              <ContributionHistory />
            </div>
          )}

          {/* Panel: Ciclos */}
          {activeTab === 'ciclos' && (
            <div id="panel-ciclos" role="tabpanel" aria-labelledby="tab-ciclos"
              className="bg-white dark:bg-white/5 border border-ink/8 dark:border-white/8 rounded-2xl p-5">
              <div className="flex justify-between items-center mb-4">
                <h6 className="font-semibold text-ink dark:text-white">{t('snapshot.ciclosTitulo')}</h6>
                <span className="text-xs bg-yellow-400/10 text-yellow-600 border border-yellow-400/20 rounded-full px-3 py-1 font-semibold">
                  {t('snapshot.ciclosIncentivo')}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-ink/40 dark:text-white/40 text-xs border-b border-ink/6 dark:border-white/6">
                      <th className="text-left pb-2 font-medium">{t('snapshot.ciclosColCiclo')}</th>
                      <th className="text-left pb-2 font-medium">{t('snapshot.ciclosColAnios')}</th>
                      <th className="text-left pb-2 font-medium">{t('snapshot.ciclosColSaldo')}</th>
                      <th className="text-left pb-2 font-medium">{t('snapshot.ciclosColRendimiento')}</th>
                      <th className="text-left pb-2 font-medium text-yellow-600">{t('snapshot.ciclosColIncentivo')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cycles.map(c => (
                      <tr key={c.cycle} className="border-b border-ink/4 dark:border-white/4">
                        <td className="py-2.5 font-semibold text-ink dark:text-white">{c.cycle}</td>
                        <td className="py-2.5 text-ink/40 dark:text-white/40">{c.yearStart}–{c.yearEnd}</td>
                        <td className="py-2.5 text-brand font-semibold">{formatCurrencyUsd(c.endBalance)}</td>
                        <td className="py-2.5 text-green-600 font-semibold">{formatCurrencyUsd(c.totalYield)}</td>
                        <td className="py-2.5 text-yellow-600 font-semibold">+{formatCurrencyUsd(c.incentiveAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-ink/10 dark:border-white/10">
                      <td colSpan={4} className="pt-3 font-semibold text-ink dark:text-white">
                        {t('snapshot.ciclosTotalIncentivos')}
                      </td>
                      <td className="pt-3 font-bold text-yellow-600">
                        {formatCurrencyUsd(cycles.reduce((s, c) => s + c.incentiveAmount, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Panel: Préstamo */}
          {activeTab === 'prestamo' && (
            <div id="panel-prestamo" role="tabpanel" aria-labelledby="tab-prestamo">
              <AutoloanCard lockedBalance={lockedBalance} walletAddress={null} />
            </div>
          )}

          {/* Panel: Referidos */}
          {activeTab === 'referidos' && (
            <div id="panel-referidos" role="tabpanel" aria-labelledby="tab-referidos">
              <ReferralModule userName={usuario?.nombre?.slice(0, 8) ?? 'usuario'} walletAddress={null} />
            </div>
          )}

          {/* Panel: Carlos */}
          {activeTab === 'carlos' && (
            <div id="panel-carlos" role="tabpanel" aria-labelledby="tab-carlos">
              <CarlosSimulator />
            </div>
          )}

          {/* Panel: Ingresos */}
          {activeTab === 'ingresos' && (
            <div id="panel-ingresos" role="tabpanel" aria-labelledby="tab-ingresos"
              className="bg-white dark:bg-white/5 border border-ink/8 dark:border-white/8 rounded-2xl p-5">
              <h6 className="font-semibold text-ink dark:text-white mb-4">{t('snapshot.ingresosDistribucion')}</h6>
              <div className="mb-6">
                <div className="h-7 bg-ink/5 dark:bg-white/5 rounded-full overflow-hidden flex mb-2">
                  <div className="h-full bg-gradient-to-r from-brand-dark to-green-500 flex items-center justify-center text-white text-xs font-bold transition-all"
                    style={{ width: `${(userRate / cetesRate) * 100}%` }}>
                    {t('snapshot.ingresosAlUsuario', { rate: userRate.toFixed(2) })}
                  </div>
                  <div className="h-full bg-brand flex items-center justify-center text-white text-xs font-bold transition-all"
                    style={{ width: `${(platformRate / cetesRate) * 100}%` }}>
                    {platformRate.toFixed(2)}%
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-green-600 font-medium">
                    {t('snapshot.ingresosAlUsuario', { rate: userRate.toFixed(2) })}
                  </span>
                  <span className="text-xs text-brand font-medium">
                    {t('snapshot.ingresosPlatforma', { rate: platformRate.toFixed(2) })}
                  </span>
                </div>
              </div>
              <h6 className="font-semibold text-ink dark:text-white mb-3">{t('snapshot.ingresosProyeccion')}</h6>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-ink/40 dark:text-white/40 text-xs border-b border-ink/6 dark:border-white/6">
                      <th className="text-left pb-2 font-medium">{t('snapshot.ingresosColUsuarios')}</th>
                      <th className="text-left pb-2 font-medium">{t('snapshot.ingresosColActivos')}</th>
                      <th className="text-left pb-2 font-medium">{t('snapshot.ingresosColIngreso')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['200', '$1.75M MXN', '$17,500'],
                      ['1,000', '$8.75M MXN', '$87,500'],
                      ['10,000', '$87.5M MXN', '$875,000'],
                      ['50,000', '$437M MXN', '$4.37M'],
                    ].map(([u, a, i]) => (
                      <tr key={u} className="border-b border-ink/4 dark:border-white/4">
                        <td className="py-2.5 font-semibold text-ink dark:text-white">{u}</td>
                        <td className="py-2.5 text-ink/40 dark:text-white/40">{a}</td>
                        <td className="py-2.5 text-green-600 font-semibold">{i} MXN</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}