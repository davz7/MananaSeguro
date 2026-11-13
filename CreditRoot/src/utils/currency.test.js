import { describe, expect, it } from 'vitest'
import { mxnToUsdc, usdcToMxn, validarMontoDeposito } from './currency'

describe('mxnToUsdc / usdcToMxn', () => {
  it('convierte con el tipo de cambio', () => {
    expect(mxnToUsdc(1750, 17.5)).toBe(100)
    expect(usdcToMxn(100, 17.5)).toBe(1750)
  })

  it('redondea USDC hacia abajo a 7 decimales', () => {
    expect(mxnToUsdc(100, 3)).toBe(33.3333333)
  })

  it('devuelve null sin tipo de cambio válido', () => {
    expect(mxnToUsdc(100, 0)).toBeNull()
    expect(mxnToUsdc(100, undefined)).toBeNull()
    expect(usdcToMxn('x', 17)).toBeNull()
  })
})

describe('validarMontoDeposito', () => {
  it('acepta montos dentro de los límites del backend', () => {
    expect(validarMontoDeposito(40)).toBeNull()
    expect(validarMontoDeposito('1000')).toBeNull()
    expect(validarMontoDeposito(40.1)).toBeNull()
    expect(validarMontoDeposito(100000)).toBeNull()
  })

  it('rechaza fuera de rango', () => {
    expect(validarMontoDeposito(39.99)).toBe('min')
    expect(validarMontoDeposito(100000.01)).toBe('max')
  })

  it('rechaza vacíos, no numéricos y fracciones de centavo', () => {
    expect(validarMontoDeposito('')).toBe('invalid')
    expect(validarMontoDeposito('abc')).toBe('invalid')
    expect(validarMontoDeposito(0)).toBe('invalid')
    expect(validarMontoDeposito(50.123)).toBe('invalid')
  })
})
