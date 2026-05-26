import { describe, it, expect } from 'vitest'
import {
  validateAmount,
  validateKyc,
  validateBankAccount,
  validateUserId,
  MONTO_MINIMO_MXN,
  MONTO_MAXIMO_MXN,
} from './depositValidation.js'

describe('validateAmount', () => {
  it('accepts valid amount within range', () => {
    expect(validateAmount(500).valid).toBe(true)
    expect(validateAmount(MONTO_MINIMO_MXN).valid).toBe(true)
    expect(validateAmount(MONTO_MAXIMO_MXN).valid).toBe(true)
    expect(validateAmount(1000).valid).toBe(true)
  })

  it('rejects amount below minimum', () => {
    const result = validateAmount(MONTO_MINIMO_MXN - 1)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Monto mínimo')
  })

  it('rejects amount above maximum', () => {
    const result = validateAmount(MONTO_MAXIMO_MXN + 1)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Monto máximo')
  })

  it('rejects amount as non-numeric string', () => {
    const result = validateAmount('abc')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('numérico')
  })

  it('rejects empty string amount', () => {
    const result = validateAmount('')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('numérico')
  })

  it('rejects undefined amount', () => {
    const result = validateAmount(undefined)
    expect(result.valid).toBe(false)
  })

  it('rejects null amount', () => {
    const result = validateAmount(null)
    expect(result.valid).toBe(false)
  })

  it('rejects negative amount', () => {
    const result = validateAmount(-100)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Monto mínimo')
  })

  it('rejects zero amount', () => {
    const result = validateAmount(0)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Monto mínimo')
  })

  it('accepts numeric string', () => {
    const result = validateAmount('500')
    expect(result.valid).toBe(true)
  })

  it('rejects floating point below minimum', () => {
    const result = validateAmount(39.99)
    expect(result.valid).toBe(false)
  })
})

describe('validateKyc', () => {
  it('accepts approved status', () => {
    expect(validateKyc('approved').valid).toBe(true)
  })

  it('rejects pending status', () => {
    const result = validateKyc('pending')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('KYC pendiente')
    expect(result.mensaje).toContain('verificación')
    expect(result.kycStatus).toBe('pending')
  })

  it('rejects rejected status', () => {
    const result = validateKyc('rejected')
    expect(result.valid).toBe(false)
    expect(result.kycStatus).toBe('rejected')
  })

  it('rejects missing/empty status', () => {
    expect(validateKyc('').valid).toBe(false)
    expect(validateKyc(null).valid).toBe(false)
    expect(validateKyc(undefined).valid).toBe(false)
  })
})

describe('validateBankAccount', () => {
  it('accepts active status', () => {
    expect(validateBankAccount('active').valid).toBe(true)
  })

  it('rejects pending status', () => {
    const result = validateBankAccount('pending')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Cuenta bancaria pendiente')
    expect(result.mensaje).toContain('verificación')
  })

  it('rejects missing/empty status', () => {
    expect(validateBankAccount('').valid).toBe(false)
    expect(validateBankAccount(null).valid).toBe(false)
    expect(validateBankAccount(undefined).valid).toBe(false)
  })
})

describe('validateUserId', () => {
  it('accepts valid user ID', () => {
    expect(validateUserId('abc-123').valid).toBe(true)
    expect(validateUserId('550e8400-e29b-41d4-a716-446655440000').valid).toBe(true)
  })

  it('rejects missing user ID', () => {
    expect(validateUserId('').valid).toBe(false)
    expect(validateUserId(null).valid).toBe(false)
    expect(validateUserId(undefined).valid).toBe(false)
  })
})
