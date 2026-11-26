import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { handler } from '../auth-google.js'

// Solo se prueba la ruta de configuración: el handler debe negarse a
// operar sin GOOGLE_CLIENT_ID antes de consultar a Google o a Supabase.

const ENV_BASE = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_KEY: 'service-key',
  KMS_CUSTODY_KEY_ID: 'alias/prueba',
  SESSION_SIGNING_KEY: 'x'.repeat(32),
}

const evento = {
  httpMethod: 'POST',
  headers: {},
  body: JSON.stringify({ idToken: 'tok' }),
}

let envOriginal

beforeEach(() => {
  envOriginal = { ...process.env }
  Object.assign(process.env, ENV_BASE)
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  process.env = envOriginal
  vi.unstubAllGlobals()
})

describe('auth-google sin GOOGLE_CLIENT_ID', () => {
  it('responde 500 de configuración y no consulta a Google', async () => {
    delete process.env.GOOGLE_CLIENT_ID
    const r = await handler(evento)
    expect(r.statusCode).toBe(500)
    expect(JSON.parse(r.body).error).toBe('Error de configuración del servidor')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('trata un valor vacío igual que ausente', async () => {
    process.env.GOOGLE_CLIENT_ID = ''
    const r = await handler(evento)
    expect(r.statusCode).toBe(500)
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('auth-google con GOOGLE_CLIENT_ID', () => {
  it('responde 401 si el token es de otra aplicación', async () => {
    process.env.GOOGLE_CLIENT_ID = 'web-client-id'
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        aud: 'otra-app',
        iss: 'https://accounts.google.com',
        exp: String(Math.floor(Date.now() / 1000) + 3600),
        email: 'ana@example.com',
        email_verified: 'true',
        sub: '1',
      }),
    })
    const r = await handler(evento)
    expect(r.statusCode).toBe(401)
  })
})
