import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SignJWT } from 'jose'
import {
  issueSession,
  verifySession,
  withSession,
  SessionError,
} from './session.js'

const KEY = 'clave-de-prueba-de-al-menos-32-bytes-de-largo'
const OTRA_KEY = 'otra-clave-distinta-de-al-menos-32-bytes-largo'

function bearer(token) {
  return { headers: { authorization: `Bearer ${token}` } }
}

beforeEach(() => {
  process.env.SESSION_SIGNING_KEY = KEY
})

afterEach(() => {
  vi.useRealTimers()
})

describe('issueSession', () => {
  it('emite un token verificable', async () => {
    const { token } = await issueSession('user-1')
    const { userId } = await verifySession(bearer(token))
    expect(userId).toBe('user-1')
  })

  it('devuelve la fecha de expiración', async () => {
    const { expiresAt } = await issueSession('user-1')
    expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now())
  })

  it('no incluye datos personales en el payload', async () => {
    const { token } = await issueSession('user-1')
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString()
    )
    // El payload de un JWT es legible por cualquiera: solo debe llevar
    // el identificador y las marcas de tiempo.
    expect(Object.keys(payload).sort()).toEqual(
      ['aud', 'exp', 'iat', 'iss', 'sub'].sort()
    )
  })

  it('rechaza emitir sin userId', async () => {
    await expect(issueSession('')).rejects.toThrow()
  })
})

describe('verifySession — rechazos', () => {
  it('rechaza cuando falta el header', async () => {
    await expect(verifySession({ headers: {} })).rejects.toMatchObject({
      code: 'MISSING_TOKEN',
    })
  })

  it('rechaza un header que no es Bearer', async () => {
    await expect(
      verifySession({ headers: { authorization: 'Basic abc' } })
    ).rejects.toMatchObject({ code: 'MALFORMED_TOKEN' })
  })

  it('rechaza un token firmado con otra llave', async () => {
    process.env.SESSION_SIGNING_KEY = OTRA_KEY
    const { token } = await issueSession('user-1')
    process.env.SESSION_SIGNING_KEY = KEY
    await expect(verifySession(bearer(token))).rejects.toMatchObject({
      code: 'INVALID_TOKEN',
    })
  })

  it('rechaza un token con la firma alterada', async () => {
    const { token } = await issueSession('user-1')
    const [h, p, s] = token.split('.')
    const alterada = s.slice(0, -3) + (s.slice(-3) === 'AAA' ? 'BBB' : 'AAA')
    await expect(
      verifySession(bearer(`${h}.${p}.${alterada}`))
    ).rejects.toMatchObject({ code: 'INVALID_TOKEN' })
  })

  it('rechaza un token expirado', async () => {
    const { token } = await issueSession('user-1', { ttlSeconds: 1 })
    vi.useFakeTimers()
    vi.setSystemTime(Date.now() + 5000)
    await expect(verifySession(bearer(token))).rejects.toMatchObject({
      code: 'EXPIRED_TOKEN',
    })
  })

  it('rechaza un token con alg none', async () => {
    // Ataque clásico: cambiar el algoritmo a "none" para que la firma
    // deje de comprobarse. La lista fija de algoritmos lo impide.
    const payload = Buffer.from(
      JSON.stringify({ sub: 'user-2', iss: 'manana-seguro' })
    ).toString('base64url')
    const header = Buffer.from(
      JSON.stringify({ alg: 'none', typ: 'JWT' })
    ).toString('base64url')
    await expect(
      verifySession(bearer(`${header}.${payload}.`))
    ).rejects.toMatchObject({ code: 'INVALID_TOKEN' })
  })

  it('rechaza un token válido de otro emisor', async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user-3')
      .setIssuer('otro-sistema')
      .setAudience('manana-seguro-app')
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(KEY))
    await expect(verifySession(bearer(token))).rejects.toMatchObject({
      code: 'INVALID_TOKEN',
    })
  })

  it('rechaza un token sin sub', async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('manana-seguro')
      .setAudience('manana-seguro-app')
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(KEY))
    await expect(verifySession(bearer(token))).rejects.toMatchObject({
      code: 'INVALID_TOKEN',
    })
  })
})

describe('withSession', () => {
  it('pasa el userId verificado al handler', async () => {
    const handler = vi.fn(async (_event, userId) => ({
      statusCode: 200,
      body: userId,
    }))
    const { token } = await issueSession('user-42')
    const res = await withSession(handler)(bearer(token))
    expect(res.body).toBe('user-42')
  })

  it('devuelve 401 con código UNAUTHENTICATED sin llamar al handler', async () => {
    const handler = vi.fn()
    const res = await withSession(handler)({ headers: {} })
    expect(res.statusCode).toBe(401)
    expect(JSON.parse(res.body).code).toBe('UNAUTHENTICATED')
    expect(handler).not.toHaveBeenCalled()
  })

  it('el usuario A no puede operar como el usuario B', async () => {
    // El handler solo conoce la identidad que le entrega withSession.
    // Aunque el cuerpo diga otra cosa, no hay forma de suplantar.
    const handler = vi.fn(async (_event, userId) => ({
      statusCode: 200,
      body: userId,
    }))
    const { token } = await issueSession('user-A')
    const res = await withSession(handler)({
      headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify({ usuarioId: 'user-B' }),
    })
    expect(res.body).toBe('user-A')
  })

  it('devuelve 500, no 401, si falta la llave de firma', async () => {
    const handler = vi.fn()
    const { token } = await issueSession('user-1')
    delete process.env.SESSION_SIGNING_KEY
    const res = await withSession(handler)(bearer(token))
    expect(res.statusCode).toBe(500)
  })

  it('rechaza una llave de firma demasiado corta', async () => {
    process.env.SESSION_SIGNING_KEY = 'corta'
    const res = await withSession(vi.fn())({ headers: { authorization: 'Bearer x' } })
    expect(res.statusCode).toBe(500)
  })
})
