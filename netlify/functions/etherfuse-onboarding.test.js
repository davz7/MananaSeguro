import { describe, it, expect, beforeEach, vi } from 'vitest'
import { issueSession } from './_lib/session.js'
import { crearSupabaseMock } from './_lib/testing/supabaseMock.js'
import { claveDePrueba } from './_lib/testing/claves.js'

let mock
let resolver

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => mock.cliente,
}))

const { handler } = await import('./etherfuse-onboarding.js')

const USUARIO = {
  id: 'usuario-A',
  email: 'a@example.com',
  nombre: 'Davor',
  customer_id: 'cust-A',
  bank_account_id: 'bank-A',
  stellar_public_key: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB',
  kyc_status: 'pending',
  bank_account_status: 'pending',
}

async function pet(userId, body = {}) {
  const { token } = await issueSession(userId)
  return {
    httpMethod: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  }
}

beforeEach(() => {
  process.env.SESSION_SIGNING_KEY = claveDePrueba()
  process.env.SUPABASE_URL = 'https://proyecto.supabase.co'
  process.env.SUPABASE_SERVICE_KEY = 'service-role'
  process.env.ETHERFUSE_API_KEY = claveDePrueba()
  process.env.ETHERFUSE_ENV = 'sandbox'
  process.env.WEBHOOK_URL = 'https://app.example.com'

  resolver = () => ({ data: USUARIO, error: null })
  mock = crearSupabaseMock((llamadas) => resolver(llamadas))

  global.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({ presigned_url: 'https://etherfuse.example/onboarding/abc' }),
  }))
})

describe('etherfuse-onboarding — sesión', () => {
  it('rechaza con 401 sin token', async () => {
    const res = await handler({ httpMethod: 'POST', headers: {}, body: '{}' })
    expect(res.statusCode).toBe(401)
  })

  it('no llama a Etherfuse si no hay sesión', async () => {
    await handler({ httpMethod: 'POST', headers: {}, body: '{}' })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('el preflight pasa sin token y autoriza Authorization', async () => {
    const res = await handler({ httpMethod: 'OPTIONS', headers: {} })
    expect(res.statusCode).toBe(200)
    expect(res.headers['Access-Control-Allow-Headers']).toContain('Authorization')
  })
})

describe('etherfuse-onboarding — titularidad', () => {
  it('busca al usuario del token', async () => {
    await handler(await pet('usuario-A'))
    expect(mock.filtros()).toContainEqual(['id', 'usuario-A'])
  })

  it('ignora un usuarioId enviado en el cuerpo', async () => {
    // Antes esto generaba la URL de onboarding KYC de otra persona.
    await handler(await pet('usuario-A', { usuarioId: 'usuario-B' }))
    expect(mock.filtros()).toEqual([['id', 'usuario-A']])
  })

  it('devuelve 404 si el usuario del token no existe', async () => {
    resolver = () => ({ data: null, error: { code: 'PGRST116' } })
    const res = await handler(await pet('usuario-fantasma'))
    expect(res.statusCode).toBe(404)
  })
})

describe('etherfuse-onboarding — comportamiento conservado', () => {
  it('no vuelve a onboardear a quien ya completó KYC', async () => {
    resolver = () => ({
      data: { ...USUARIO, kyc_status: 'approved', bank_account_status: 'active' },
      error: null,
    })
    const res = await handler(await pet('usuario-A'))
    expect(JSON.parse(res.body).yaCompletado).toBe(true)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('devuelve la URL de onboarding generada', async () => {
    const res = await handler(await pet('usuario-A'))
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).onboardingUrl).toContain('etherfuse.example')
  })
})
