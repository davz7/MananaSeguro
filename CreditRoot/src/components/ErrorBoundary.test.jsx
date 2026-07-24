import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ErrorBoundary } from './ErrorBoundary'
import '../i18n/index.js'

function Boom({ shouldThrow }) {
  if (shouldThrow) throw new Error('boom')
  return <div>contenido ok</div>
}

describe('ErrorBoundary', () => {
  beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}) })
  afterEach(() => { vi.restoreAllMocks() })

  it('renderiza los hijos cuando no hay error', () => {
    render(
      <MemoryRouter>
        <ErrorBoundary><Boom shouldThrow={false} /></ErrorBoundary>
      </MemoryRouter>
    )
    expect(screen.getByText('contenido ok')).toBeTruthy()
  })

  it('muestra el fallback con Reintentar y Volver al inicio, y loguea el error', () => {
    render(
      <MemoryRouter>
        <ErrorBoundary><Boom shouldThrow={true} /></ErrorBoundary>
      </MemoryRouter>
    )
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByRole('button')).toBeTruthy()
    expect(screen.getByRole('link')).toBeTruthy()
    expect(console.error).toHaveBeenCalled()
  })

  it('Reintentar resetea el estado y vuelve a renderizar los hijos', () => {
    let throwIt = true
    function Toggle() {
      if (throwIt) throw new Error('boom')
      return <div>recuperado</div>
    }
    render(
      <MemoryRouter>
        <ErrorBoundary><Toggle /></ErrorBoundary>
      </MemoryRouter>
    )
    expect(screen.getByRole('alert')).toBeTruthy()
    throwIt = false
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('recuperado')).toBeTruthy()
  })
})
