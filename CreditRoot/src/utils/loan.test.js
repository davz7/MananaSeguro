import { describe, expect, it } from 'vitest'
import { disponiblePrestamo, primeraCuota, validarMontoPrestamo } from './loan'

describe('autopréstamo (reglas del contrato)', () => {
  it('disponible = 30% del saldo', () => {
    expect(disponiblePrestamo(2300)).toBe(690)
    expect(disponiblePrestamo(0)).toBe(0)
    expect(disponiblePrestamo(null)).toBe(0)
  })

  it('primera cuota = capital/24 + 0.5% de interés', () => {
    // 2400/24 = 100 ; 2400 * 0.005 = 12
    expect(primeraCuota(2400)).toBe(112)
    expect(primeraCuota(0)).toBe(0)
  })

  it('valida contra el disponible y el mínimo de 1 USDC', () => {
    const base = { disponibleMxn: 690 }
    expect(validarMontoPrestamo({ ...base, montoMxn: '500', amountUsdc: 28.5 })).toBeNull()
    expect(validarMontoPrestamo({ ...base, montoMxn: '700', amountUsdc: 40 })).toBe('max')
    expect(validarMontoPrestamo({ ...base, montoMxn: '10', amountUsdc: 0.57 })).toBe('min')
    expect(validarMontoPrestamo({ ...base, montoMxn: '0', amountUsdc: 0 })).toBe('invalid')
    expect(validarMontoPrestamo({ disponibleMxn: 0, montoMxn: '10', amountUsdc: 1 })).toBe('sinSaldo')
  })
})
