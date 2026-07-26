import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GoalCard } from './GoalCard'

const baseMeta = {
  id: 'goal-1',
  nombre: 'Fondo de emergencia',
  monto_objetivo_mxn: 50000,
  ahorro_mensual_mxn: 2500,
  anos_al_retiro: 2,
  es_principal: false,
}

describe('GoalCard', () => {
  it('renderiza una meta válida con su nombre y datos principales', () => {
    render(<GoalCard meta={baseMeta} saldoMxn={12500} />)

    expect(screen.getByText('Fondo de emergencia')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Editar meta' })).toBeTruthy()
    expect(screen.getByRole('progressbar', { name: 'Progreso hacia la meta: 25%' })).toBeTruthy()
  })

  it('formatea saldo, ahorro mensual y objetivo como moneda MXN', () => {
    render(<GoalCard meta={baseMeta} saldoMxn={12345} />)

    expect(screen.getByText('$12,345')).toBeTruthy()
    expect(screen.getByText('$2,500/mes')).toBeTruthy()
    expect(screen.getByText('$50,000')).toBeTruthy()
  })

  it('usa saldo cero por defecto y muestra el estado recién creado', () => {
    render(<GoalCard meta={baseMeta} />)

    expect(screen.getByText('$0')).toBeTruthy()
    expect(screen.getByText('(Recién creada)')).toBeTruthy()
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0')
  })

  it('maneja una meta vacía de monto sin dividir entre cero', () => {
    render(
      <GoalCard
        meta={{ ...baseMeta, monto_objetivo_mxn: 0, ahorro_mensual_mxn: 0 }}
        saldoMxn={100}
      />
    )

    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0')
    expect(screen.getByText('$0/mes')).toBeTruthy()
    expect(screen.getByText('$0')).toBeTruthy()
  })

  it('marca 100% cuando la meta se alcanza exactamente', () => {
    render(<GoalCard meta={baseMeta} saldoMxn={50000} />)

    const progress = screen.getByRole('progressbar', { name: 'Progreso hacia la meta: 100%' })
    expect(progress.getAttribute('aria-valuenow')).toBe('100')
  })

  it('limita el progreso a 100% cuando el saldo supera la meta', () => {
    render(<GoalCard meta={baseMeta} saldoMxn={75000} />)

    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100')
  })

  it('permite seleccionar con teclado y mantiene separadas las acciones', () => {
    const onSeleccionar = vi.fn()
    const onEditar = vi.fn()
    const onEliminar = vi.fn()
    render(
      <GoalCard
        meta={baseMeta}
        onSeleccionar={onSeleccionar}
        onEditar={onEditar}
        onEliminar={onEliminar}
        puedeEliminar
      />
    )

    fireEvent.keyDown(screen.getByRole('button', { name: /Fondo de emergencia/ }), { key: 'Enter' })
    fireEvent.click(screen.getByRole('button', { name: 'Editar meta' }))
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar meta' }))

    expect(onSeleccionar).toHaveBeenCalledTimes(1)
    expect(onEditar).toHaveBeenCalledTimes(1)
    expect(onEliminar).toHaveBeenCalledTimes(1)
  })
})
