// src/components/ErrorBoundary.jsx
//
// Error Boundary global de la app.
//
// React requiere que los Error Boundaries sean componentes de clase: los
// hooks (useState/useEffect) NO pueden capturar errores de renderizado de los
// hijos. Por eso este componente es una clase y no una función.
//
// Captura cualquier error que se lance durante el render / lifecycle de los
// componentes hijos (p. ej. DepositFlow o WithdrawalFlow cuando el polling
// contra /api/etherfuse/order-status devuelve una forma inesperada) y muestra
// una pantalla de respaldo amigable en lugar de dejar la app en blanco.
//
// Props:
//   children — árbol a proteger
//   onReset  — (opcional) callback extra al pulsar "Reintentar"

import { Component, Fragment } from 'react'
import { Link } from 'react-router-dom'
import { TriangleAlert } from 'lucide-react'
import i18n from '../i18n/index.js'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null, resetKey: 0 }
    this.handleReset = this.handleReset.bind(this)
  }

  // Actualiza el estado para que el siguiente render muestre el fallback.
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  // Se ejecuta después de que un hijo lanza durante el render/lifecycle.
  componentDidCatch(error, errorInfo) {
    // Log para diagnóstico local.
    console.error('[ErrorBoundary] Componente capturado:', error, errorInfo)

    // TODO(Sentry): reportar a Sentry cuando esté configurado, p. ej.
    //   Sentry.captureException(error, { extra: { componentStack: errorInfo?.componentStack } })

    this.setState({ errorInfo })
  }

  // Resetea el estado del boundary y fuerza el remontaje de los hijos
  // (cambiando la key) para que se reintente el render desde cero.
  handleReset() {
    this.setState(prev => ({
      hasError: false,
      error: null,
      errorInfo: null,
      resetKey: prev.resetKey + 1,
    }))
    this.props.onReset?.()
  }

  render() {
    const { hasError, error, errorInfo, resetKey } = this.state
    // i18n.t funciona fuera de un componente React (clase sin hooks).
    const t = (key) => i18n.t(key)
    const isDev = import.meta.env.DEV

    if (hasError) {
      return (
        <div className="bg-surface dark:bg-[#0f0e0d] min-h-screen flex items-center justify-center px-4">
          <div
            role="alert"
            className="max-w-md w-full bg-white dark:bg-white/5 border border-ink/8 dark:border-white/8 rounded-2xl p-7 flex flex-col gap-5 text-center shadow-lg"
          >
            <div className="w-16 h-16 mx-auto rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <TriangleAlert size={32} aria-hidden="true" className="text-red-500" />
            </div>

            <div>
              <h2 className="font-display font-black text-ink dark:text-white text-2xl mb-2">
                {t('errorBoundary.titulo')}
              </h2>
              <p className="text-sm text-ink/50 dark:text-white/50">
                {t('errorBoundary.descripcion')}
              </p>
            </div>

            {/* En desarrollo, mostramos el stack del error colapsado */}
            {isDev && error && (
              <details className="text-left bg-ink/3 dark:bg-white/5 border border-ink/10 dark:border-white/10 rounded-xl p-3">
                <summary className="text-xs font-semibold text-ink/60 dark:text-white/60 cursor-pointer select-none">
                  {t('errorBoundary.detallesDev')}
                </summary>
                <pre className="mt-2 text-[11px] leading-relaxed text-red-500 whitespace-pre-wrap break-all overflow-auto max-h-64">
                  {String(error?.stack || error?.message || error)}
                  {errorInfo?.componentStack ? `\n${errorInfo.componentStack}` : ''}
                </pre>
              </details>
            )}

            <div className="flex flex-col gap-2">
              <button
                onClick={this.handleReset}
                className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-3.5 px-4 rounded-xl transition-all hover:-translate-y-px hover:shadow-lg hover:shadow-brand/30 cursor-pointer"
              >
                {t('errorBoundary.reintentar')}
              </button>

              <Link
                to="/home"
                onClick={this.handleReset}
                className="w-full bg-transparent border border-ink/15 dark:border-white/15 text-ink dark:text-white font-semibold py-3 px-4 rounded-xl transition-all hover:border-ink/30 dark:hover:border-white/30 cursor-pointer"
              >
                {t('errorBoundary.volverInicio')}
              </Link>
            </div>
          </div>
        </div>
      )
    }

    // La key fuerza el remontaje del subárbol al pulsar "Reintentar".
    return <Fragment key={resetKey}>{this.props.children}</Fragment>
  }
}

export default ErrorBoundary
