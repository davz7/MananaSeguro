import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createLogger, sanitizeMeta, errorBody } from './logger.js'

// Semilla con forma válida, inexistente en cualquier red.
// Se arma en dos mitades para que el archivo no contenga una cadena
// detectable por el escáner de secretos del CI.
const SEED = 'SBRTWWQ4EXAMPLEZ7K3MFAKE5NOTREAL' + 'SEEDXYZ2345ABCDEFGH23456'

describe('sanitizeMeta — material criptográfico', () => {
  it('elimina un campo llamado seed en lugar de truncarlo', () => {
    const out = sanitizeMeta({ seed: SEED })
    expect(out.seed).toBe('[REDACTED]')
    expect(JSON.stringify(out)).not.toContain(SEED)
  })

  it('elimina secretKey por completo, no a sus últimos 4 caracteres', () => {
    const out = sanitizeMeta({ secretKey: SEED })
    expect(out.secretKey).toBe('[REDACTED]')
    expect(out.secretKey).not.toContain(SEED.slice(-4))
  })

  it('cubre las variantes habituales de nombre', () => {
    const out = sanitizeMeta({
      privateKey: 'x',
      password: 'x',
      sessionToken: 'x',
      dataKey: 'x',
      ciphertext: 'x',
      signature: 'x',
    })
    for (const v of Object.values(out)) expect(v).toBe('[REDACTED]')
  })

  it('detecta una semilla aunque el campo tenga un nombre inocuo', () => {
    const out = sanitizeMeta({ valor: SEED, data: SEED, payload: SEED })
    expect(out.valor).toBe('[REDACTED]')
    expect(out.data).toBe('[REDACTED]')
    expect(out.payload).toBe('[REDACTED]')
  })

  it('detecta una semilla incrustada dentro de una cadena más larga', () => {
    const out = sanitizeMeta({ detalle: `fallo al firmar con ${SEED} en testnet` })
    expect(out.detalle).toBe('[REDACTED]')
  })
})

describe('sanitizeMeta — estructuras anidadas', () => {
  it('sanea arreglos elemento por elemento', () => {
    const out = sanitizeMeta({ claves: [SEED, 'valor-normal'] })
    expect(out.claves[0]).toBe('[REDACTED]')
    expect(out.claves[1]).toBe('valor-normal')
  })

  it('sanea objetos dentro de arreglos', () => {
    const out = sanitizeMeta({ usuarios: [{ seed: SEED, montoMxn: 500 }] })
    expect(out.usuarios[0].seed).toBe('[REDACTED]')
    expect(out.usuarios[0].montoMxn).toBe(500)
  })

  it('sanea objetos anidados', () => {
    const out = sanitizeMeta({ wallet: { interno: { seed: SEED } } })
    expect(JSON.stringify(out)).not.toContain(SEED)
  })

  it('no entra en bucle con referencias circulares', () => {
    const a = { montoMxn: 100 }
    a.self = a
    expect(() => sanitizeMeta(a)).not.toThrow()
  })

  it('extrae el mensaje de un Error y lo sanea', () => {
    const out = sanitizeMeta({ err: new Error(`no se pudo firmar: ${SEED}`) })
    expect(out.err.name).toBe('Error')
    expect(out.err.message).toBe('[REDACTED]')
  })
})

describe('createLogger — la línea emitida', () => {
  let consoleSpy

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  function lastRaw() {
    return consoleSpy.mock.calls.at(-1)[0]
  }

  it('la línea de log jamás contiene la semilla', () => {
    const log = createLogger('sign-intent')
    log.error('Fallo de firma', { seed: SEED, userId: 'user-1234' })
    expect(lastRaw()).not.toContain(SEED)
  })

  it('sanea también el mensaje, no solo los metadatos', () => {
    const log = createLogger('sign-intent')
    log.error(`Fallo con ${SEED}`)
    expect(lastRaw()).not.toContain(SEED)
  })

  it('conserva los campos que sí son útiles para depurar', () => {
    const log = createLogger('sign-intent')
    log.info('Intento', { seed: SEED, montoMxn: 500, intentType: 'deposit' })
    const entry = JSON.parse(lastRaw())
    expect(entry.montoMxn).toBe(500)
    expect(entry.intentType).toBe('deposit')
  })
})

describe('errorBody', () => {
  it('no filtra material en la respuesta que viaja al cliente', () => {
    const log = createLogger('sign-intent')
    const body = errorBody(log, `no se pudo firmar con ${SEED}`, { seed: SEED })
    expect(body).not.toContain(SEED)
  })
})
