// netlify/functions/_lib/depositValidation.test.js
//
// Vitest unit tests for deposit validation helpers.
// Covers: amount validation (min, max, string, negative),
//         KYC status (pending, rejected, missing),
//         userId validation (missing),
//         all valid → passes.

import { describe, it, expect } from 'vitest'
import { validateAmount, validateKyc, validateUserId } from './depositValidation.js'

describe('validateAmount', () => {
  it('returns number for valid amount within range', () => {
    expect(validateAmount(100)).toBe(100)
    expect(validateAmount(40)).toBe(40)
    expect(validateAmount(100_000)).toBe(100_000)
    expect(validateAmount(99_999)).toBe(99_999)
    expect(validateAmount(41)).toBe(41)
  })

  it('throws when amount is below minimum ($40)', () => {
    expect(() => validateAmount(39)).toThrow('Monto mínimo: $40 MXN')
    expect(() => validateAmount(1)).toThrow('Monto mínimo: $40 MXN')
    expect(() => validateAmount(0)).toThrow('montoMxn requerido y debe ser numérico')
  })

  it('throws when amount is above maximum ($100,000)', () => {
    expect(() => validateAmount(100_001)).toThrow('Monto máximo: $100,000 MXN')
    expect(() => validateAmount(999_999)).toThrow('Monto máximo: $100,000 MXN')
  })

  it('throws when amount is a string', () => {
    expect(() => validateAmount('hello')).toThrow('montoMxn requerido y debe ser numérico')
    expect(() => validateAmount('')).toThrow('montoMxn requerido y debe ser numérico')
  })

  it('throws when amount is negative', () => {
    expect(() => validateAmount(-1)).toThrow('montoMxn requerido y debe ser numérico')
    expect(() => validateAmount(-100)).toThrow('montoMxn requerido y debe ser numérico')
  })

  it('throws when amount is null or undefined', () => {
    expect(() => validateAmount(null)).toThrow('montoMxn requerido y debe ser numérico')
    expect(() => validateAmount(undefined)).toThrow('montoMxn requerido y debe ser numérico')
  })

  it('handles stringified numbers', () => {
    // Number('100') = 100, which is valid
    expect(validateAmount('100')).toBe(100)
  })
})

describe('validateKyc', () => {
  it('passes when KYC is approved', () => {
    expect(() => validateKyc('approved')).not.toThrow()
  })

  it('throws when KYC is pending', () => {
    expect(() => validateKyc('pending')).toThrow('KYC pendiente')
  })

  it('throws when KYC is rejected', () => {
    expect(() => validateKyc('rejected')).toThrow('KYC pendiente')
  })

  it('throws when KYC is missing/undefined', () => {
    expect(() => validateKyc(undefined)).toThrow('KYC pendiente')
    expect(() => validateKyc(null)).toThrow('KYC pendiente')
    expect(() => validateKyc('')).toThrow('KYC pendiente')
  })
})

describe('validateUserId', () => {
  it('passes when userId is present', () => {
    expect(() => validateUserId('user-123')).not.toThrow()
    expect(() => validateUserId(42)).not.toThrow()
  })

  it('throws when userId is missing', () => {
    expect(() => validateUserId(null)).toThrow('usuarioId requerido')
    expect(() => validateUserId(undefined)).toThrow('usuarioId requerido')
    expect(() => validateUserId('')).toThrow('usuarioId requerido')
  })
})

describe('integration: all valid → passes', () => {
  it('all validators pass for a valid deposit request', () => {
    const montoMxn = 500
    const kycStatus = 'approved'
    const userId = 'user-abc-123'

    const validatedAmount = validateAmount(montoMxn)
    expect(() => validateKyc(kycStatus)).not.toThrow()
    expect(() => validateUserId(userId)).not.toThrow()
    expect(validatedAmount).toBe(500)
  })
})
