import { describe, it, expect } from 'vitest'
import { assertPuedeOperar, CuentaInactivaError } from './cuenta.js'

const ACTIVO = { id: 'u1', deleted_at: null, key_destroyed_at: null }

describe('assertPuedeOperar', () => {
  it('deja pasar una cuenta activa', () => {
    expect(() => assertPuedeOperar(ACTIVO)).not.toThrow()
  })

  it('bloquea una cuenta dada de baja', () => {
    expect(() =>
      assertPuedeOperar({ ...ACTIVO, deleted_at: '2026-09-16T00:00:00Z' })
    ).toThrow(CuentaInactivaError)
  })

  it('bloquea una cuenta con material destruido', () => {
    expect(() =>
      assertPuedeOperar({ ...ACTIVO, key_destroyed_at: '2026-09-16T00:00:00Z' })
    ).toThrow(CuentaInactivaError)
  })

  it('informa la destrucción antes que la baja', () => {
    // Decir "dada de baja" cuando las llaves fueron destruidas haría
    // creer que es reversible.
    try {
      assertPuedeOperar({
        ...ACTIVO,
        deleted_at: '2026-09-16T00:00:00Z',
        key_destroyed_at: '2026-09-16T00:00:00Z',
      })
    } catch (err) {
      expect(err.code).toBe('KEY_DESTROYED')
    }
  })

  it('bloquea una cuenta inexistente', () => {
    expect(() => assertPuedeOperar(null)).toThrow(/no existe/)
  })
})
