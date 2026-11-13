import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, normalizarError } from './api'
import { mensajeDeError } from './errores'

const t = (k) => `«${k}»`

describe('mensajeDeError', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}))
  afterEach(() => vi.restoreAllMocks())

  it('404 sin mensaje → "error con el sistema"', () => {
    expect(mensajeDeError(normalizarError(404, null), t)).toBe('«apiErrors.SYSTEM»')
  })

  it('5xx, 405 y sin conexión → "error con el sistema"', () => {
    expect(mensajeDeError(normalizarError(500, { error: 'Error interno' }), t)).toBe('«apiErrors.SYSTEM»')
    expect(mensajeDeError(normalizarError(405, { error: 'Método no permitido' }), t)).toBe('«apiErrors.SYSTEM»')
    const red = new ApiError({ status: 0, code: 'NETWORK', message: 'Failed to fetch', esDeSistema: true })
    expect(mensajeDeError(red, t)).toBe('«apiErrors.SYSTEM»')
  })

  it('códigos conocidos del backend → texto traducido', () => {
    expect(mensajeDeError(normalizarError(409, { ok: false, code: 'LOAN_NOT_ELIGIBLE', message: 'x' }), t))
      .toBe('«apiErrors.LOAN_NOT_ELIGIBLE»')
  })

  it('error de negocio con mensaje del backend → el mensaje', () => {
    expect(mensajeDeError(normalizarError(400, { error: 'Monto mínimo: $40 MXN' }), t)).toBe('Monto mínimo: $40 MXN')
  })

  it('excepción inesperada → "error con el sistema" y el tipo en consola', () => {
    expect(mensajeDeError(new TypeError('x is undefined'), t)).toBe('«apiErrors.SYSTEM»')
    expect(console.error).toHaveBeenCalledWith('[App] TypeError: x is undefined', expect.any(TypeError))
  })

  it('validación local { message } → el mensaje', () => {
    expect(mensajeDeError({ message: 'El monto mínimo es $40 MXN.' }, t)).toBe('El monto mínimo es $40 MXN.')
  })
})
