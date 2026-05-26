import { Component } from 'react'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught error:', error)
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack)
    // TODO: Send to Sentry or other error tracking service
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      const { t } = this.props
      return (
        <div className="bg-white dark:bg-white/5 border border-ink/8 dark:border-white/8 rounded-2xl p-6 flex flex-col gap-5 items-center text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-3xl">
            ⚠️
          </div>
          <h3 className="font-display font-black text-ink dark:text-white text-xl">
            {t?.('errorBoundary.title') || 'Algo salió mal'}
          </h3>
          <p className="text-sm text-ink/60 dark:text-white/60 max-w-sm">
            {t?.('errorBoundary.message') || 'Ha ocurrido un error inesperado. Puedes intentar de nuevo o volver al inicio.'}
          </p>
          <div className="flex gap-3 w-full max-w-sm">
            <button
              onClick={this.handleRetry}
              className="flex-1 bg-brand hover:bg-brand/90 text-white font-semibold py-2.5 px-4 rounded-xl transition-all cursor-pointer"
            >
              {t?.('errorBoundary.retry') || 'Reintentar'}
            </button>
            <a
              href="/"
              className="flex-1 bg-transparent border border-ink/15 dark:border-white/15 text-ink dark:text-white font-semibold py-2.5 px-4 rounded-xl transition-all hover:border-ink/30 dark:hover:border-white/30 text-center cursor-pointer"
            >
              {t?.('errorBoundary.backHome') || 'Volver al inicio'}
            </a>
          </div>
          {import.meta?.env?.DEV && this.state.error && (
            <details className="w-full text-left text-xs text-ink/40 dark:text-white/40 bg-ink/3 dark:bg-white/5 rounded-lg p-3 mt-2">
              <summary className="cursor-pointer">Error details (dev)</summary>
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-[10px] text-red-400">
                {this.state.error?.stack || String(this.state.error)}
              </pre>
            </details>
          )}
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
