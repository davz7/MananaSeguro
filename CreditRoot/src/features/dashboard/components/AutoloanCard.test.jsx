import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../../../i18n/index.js'
import { AutoloanCard } from './AutoloanCard'

const stellarMocks = vi.hoisted(() => ({
  solicitarPrestamo: vi.fn(),
  pagarPrestamo: vi.fn(),
  verPrestamo: vi.fn(),
  enviarTransaccion: vi.fn(),
}))

const walletMocks = vi.hoisted(() => ({
  firmarTransaccion: vi.fn(),
}))

vi.mock('../../../hooks/useEtherfuseRate', () => ({
  useEtherfuseRate: () => ({ userRate: 4.59 }),
}))

vi.mock('../../../lib/stellar', () => stellarMocks)
vi.mock('../../../lib/wallet', () => walletMocks)

describe('AutoloanCard', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    stellarMocks.verPrestamo.mockResolvedValue({ saldo: 0, meses: 0 })
    await i18n.changeLanguage('es')
  })

  it('renderiza el formulario con props válidas', () => {
    render(<AutoloanCard lockedBalance={1000} />)

    expect(screen.getByText('Autopréstamo de emergencia')).toBeTruthy()
    expect(screen.getByRole('slider', { name: 'Monto a solicitar' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Solicitar préstamo de $250' })).toBeTruthy()
  })

  it('formatea el saldo y el máximo disponible como moneda USD', () => {
    render(<AutoloanCard lockedBalance={12345} />)

    expect(screen.getByText('$12,345')).toBeTruthy()
    expect(screen.getByText('$3,704')).toBeTruthy()
    expect(screen.getByText('$3,704 máx.')).toBeTruthy()
    expect(screen.getAllByText('$250').length).toBeGreaterThan(0)
  })

  it('muestra el estado vacío cuando no hay saldo bloqueado', () => {
    render(<AutoloanCard lockedBalance={0} />)

    expect(screen.getByText(/Necesitas tener USDC bloqueado/)).toBeTruthy()
    expect(screen.queryByRole('slider', { name: 'Monto a solicitar' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Solicitar préstamo/ })).toBeNull()
  })

  it('deshabilita la solicitud cuando el 30% del saldo no alcanza el mínimo', () => {
    render(<AutoloanCard lockedBalance={20} />)

    const button = screen.getByRole('button', { name: 'Solicitar préstamo' })
    expect(button.disabled).toBe(true)
    expect(screen.queryByText('Resumen del préstamo')).toBeNull()
    expect(screen.getByText('$6')).toBeTruthy()
    expect(screen.getByText('$6 máx.')).toBeTruthy()
  })

  it('muestra una tabla accesible con los 24 pagos', () => {
    render(<AutoloanCard lockedBalance={1000} />)

    fireEvent.click(screen.getByRole('button', { name: '▼ Ver tabla de pagos (24 meses)' }))

    const table = screen.getByRole('table')
    expect(table).toBeTruthy()
    expect(screen.getAllByRole('row')).toHaveLength(25)
    expect(screen.getByRole('columnheader', { name: 'Pendiente' })).toBeTruthy()
  })

  it('carga un préstamo activo desde el mock del contrato', async () => {
    stellarMocks.verPrestamo.mockResolvedValueOnce({ saldo: 120, meses: 5 })

    render(<AutoloanCard lockedBalance={1000} walletAddress="GTESTWALLET" />)

    expect(await screen.findByText(/Préstamo activo/)).toBeTruthy()
    expect(screen.getByText('$120')).toBeTruthy()
    expect(screen.getByText('5 de 24 meses pagados')).toBeTruthy()
    expect(stellarMocks.verPrestamo).toHaveBeenCalledWith('GTESTWALLET')
  })

  it('muestra el límite de préstamo pagado después de liquidar la última cuota', async () => {
    stellarMocks.verPrestamo
      .mockResolvedValueOnce({ saldo: 10, meses: 23 })
      .mockResolvedValueOnce({ saldo: 0, meses: 24 })
    stellarMocks.pagarPrestamo.mockResolvedValue({ toXDR: () => 'unsigned-xdr' })
    walletMocks.firmarTransaccion.mockResolvedValue('signed-xdr')
    stellarMocks.enviarTransaccion.mockResolvedValue('transaction-hash')

    render(<AutoloanCard lockedBalance={1000} walletAddress="GTESTWALLET" />)

    fireEvent.click(await screen.findByRole('button', { name: 'Pagar mes 24 del préstamo' }))

    expect(await screen.findByText(/Préstamo liquidado/)).toBeTruthy()
    expect(screen.getByText(/Préstamo completado/)).toBeTruthy()
    expect(screen.getByText('24 meses pagados')).toBeTruthy()
    expect(screen.getByText('0 restantes')).toBeTruthy()
    await waitFor(() => expect(stellarMocks.enviarTransaccion).toHaveBeenCalledWith('signed-xdr'))
  })
})
