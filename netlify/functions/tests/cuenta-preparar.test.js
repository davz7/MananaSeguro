import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { crearHandler } from '../cuenta-preparar.js'
import { issueSession } from '../_lib/session.js'
import { claveDePrueba } from '../_lib/testing/claves.js'

let envOriginal

beforeEach(() => {
  envOriginal = { ...process.env }
  process.env.SESSION_SIGNING_KEY = claveDePrueba()
  process.env.SUPABASE_URL = 'https://example.supabase.co'
  process.env.SUPABASE_SERVICE_KEY = 'service-key'
})

afterEach(() => {
  process.env = envOriginal
})

async function eventoConSesion() {
  const { token } = await issueSession('u-1')
  return { httpMethod: 'POST', headers: { authorization: `Bearer ${token}` }, body: '' }
}

describe('POST /api/cuenta/preparar', () => {
  it('sin sesión responde 401 y no toca dependencias', async () => {
    const deps = vi.fn()
    const r = await crearHandler(deps)({ httpMethod: 'POST', headers: {}, body: '' })
    expect(r.statusCode).toBe(401)
    expect(deps).not.toHaveBeenCalled()
  })

  it('fuera de testnet responde 503 con mensaje genérico y no consulta la red', async () => {
    delete process.env.STELLAR_NETWORK_PASSPHRASE
    const horizon = { root: vi.fn() }
    const handler = crearHandler(() => ({ horizon, rpc: {}, repo: {}, withSeed: vi.fn() }))

    const r = await handler(await eventoConSesion())
    const cuerpo = JSON.parse(r.body)

    expect(r.statusCode).toBe(503)
    expect(cuerpo.code).toBe('NETWORK_NOT_TESTNET')
    expect(cuerpo.message).not.toMatch(/testnet|passphrase/i)
    expect(horizon.root).not.toHaveBeenCalled()
  })
})
