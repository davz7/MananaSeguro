import { describe, it, expect, beforeEach, vi } from 'vitest'
import { issueSession } from './_lib/session.js'
import { crearSupabaseMock } from './_lib/testing/supabaseMock.js'
import { claveDePrueba } from './_lib/testing/claves.js'

let mock
let resolver

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => mock.cliente,
}))

const { handler } = await import('./order-status.js')

const ORDEN = {
  order_id: 'orden-1',
  status: 'completed',
  monto_mxn: 500,
  deposit_clabe: '646180123456789012',
  updated_at: '2026-09-01T00:00:00Z',
}

async function conSesion(userId, query = {}) {
  const { token } = await issueSession(userId)
  return {
    httpMethod: 'GET',
    headers: { authorization: `Bearer ${token}` },
    queryStringParameters: query,
  }
}

beforeEach(() => {
  process.env.SESSION_SIGNING_KEY = claveDePrueba()
  process.env.SUPABASE_URL = 'https://proyecto.supabase.co'
  process.env.SUPABASE_SERVICE_KEY = 'service-role'
  resolver = () => ({ data: [ORDEN], error: null })
  mock = crearSupabaseMock((llamadas) => resolver(llamadas))
})

describe('order-status — sesión', () => {
  it('rechaza con 401 si no hay token', async () => {
    const res = await handler({
      httpMethod: 'GET',
      headers: {},
      queryStringParameters: {},
    })
    expect(res.statusCode).toBe(401)
    expect(JSON.parse(res.body).code).toBe('UNAUTHENTICATED')
  })

  it('responde el preflight OPTIONS sin exigir token', async () => {
    const res = await handler({ httpMethod: 'OPTIONS', headers: {} })
    expect(res.statusCode).toBe(200)
  })

  it('el preflight autoriza el header Authorization', async () => {
    const res = await handler({ httpMethod: 'OPTIONS', headers: {} })
    // Sin esto el navegador bloquea toda petición autenticada y el
    // síntoma aparece en el cliente, no en los logs del backend.
    expect(res.headers['Access-Control-Allow-Headers']).toContain('Authorization')
  })

  it('lista las órdenes del usuario del token', async () => {
    const res = await handler(await conSesion('usuario-A'))
    expect(res.statusCode).toBe(200)
    expect(mock.filtros()).toContainEqual(['usuario_id', 'usuario-A'])
  })

  it('ignora un usuarioId puesto en la query', async () => {
    const res = await handler(await conSesion('usuario-A', { usuarioId: 'usuario-B' }))
    expect(res.statusCode).toBe(200)
    const filtrados = mock.filtros().filter(([col]) => col === 'usuario_id')
    expect(filtrados).toEqual([['usuario_id', 'usuario-A']])
  })
})

describe('order-status — consulta por orderId', () => {
  it('filtra por orden y por usuario a la vez', async () => {
    resolver = () => ({ data: ORDEN, error: null })
    await handler(await conSesion('usuario-A', { orderId: 'orden-1' }))
    expect(mock.filtros()).toContainEqual(['order_id', 'orden-1'])
    expect(mock.filtros()).toContainEqual(['usuario_id', 'usuario-A'])
  })

  it('devuelve 404 para una orden que no es del usuario', async () => {
    // Con el filtro de propiedad, Supabase no devuelve fila.
    resolver = () => ({ data: null, error: { code: 'PGRST116' } })
    const res = await handler(await conSesion('usuario-B', { orderId: 'orden-1' }))
    expect(res.statusCode).toBe(404)
  })

  it('el 404 no revela si la orden existe', async () => {
    resolver = () => ({ data: null, error: { code: 'PGRST116' } })
    const res = await handler(await conSesion('usuario-B', { orderId: 'orden-1' }))
    expect(res.body).not.toContain('646180123456789012')
    expect(res.body).not.toContain('500')
  })
})
