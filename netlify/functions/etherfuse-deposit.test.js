import { describe, it, expect, beforeEach, vi } from 'vitest'
import { issueSession } from './_lib/session.js'
import { crearSupabaseMock } from './_lib/testing/supabaseMock.js'
import { claveDePrueba } from './_lib/testing/claves.js'

let mock
let resolver

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => mock.cliente,
}))

const { handler } = await import('./etherfuse-deposit.js')

const USUARIO_OK = {
  id: 'usuario-A',
  email: 'a@example.com',
  customer_id: 'cust-A',
  bank_account_id: 'bank-A',
  stellar_public_key: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB',
  kyc_status: 'approved',
  bank_account_status: 'active',
}

async function pet(userId, body = { montoMxn: 500 }) {
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
  process.env.ETHERFUSE_API_KEY = 'api-key-de-prueba'
  process.env.ETHERFUSE_ENV = 'sandbox'

  resolver = () => ({ data: USUARIO_OK, error: null })
  mock = crearSupabaseMock((llamadas) => resolver(llamadas))

  // Etherfuse: quote y luego order.
  let n = 0
  global.fetch = vi.fn(async () => ({
    ok: true,
    json: async () =>
      n++ === 0
        ? { quoteId: 'quote-1', targetAmount: '26', feeAmount: '5' }
        : { onramp: { depositClabe: '646180000000000001', depositBankName: 'STP' } },
  }))
})

describe('etherfuse-deposit — sesión', () => {
  it('rechaza con 401 sin token', async () => {
    const res = await handler({ httpMethod: 'POST', headers: {}, body: '{}' })
    expect(res.statusCode).toBe(401)
  })

  it('no llama a Etherfuse si no hay sesión', async () => {
    await handler({ httpMethod: 'POST', headers: {}, body: '{}' })
    // Importante: una petición sin autenticar no debe poder provocar
    // llamadas a un proveedor externo que se cobran o se registran.
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('el preflight pasa sin token y autoriza Authorization', async () => {
    const res = await handler({ httpMethod: 'OPTIONS', headers: {} })
    expect(res.statusCode).toBe(200)
    expect(res.headers['Access-Control-Allow-Headers']).toContain('Authorization')
  })
})

describe('etherfuse-deposit — titularidad de la orden', () => {
  it('busca al usuario del token', async () => {
    await handler(await pet('usuario-A'))
    expect(mock.filtros()).toContainEqual(['id', 'usuario-A'])
  })

  it('ignora un usuarioId enviado en el cuerpo', async () => {
    await handler(await pet('usuario-A', { montoMxn: 500, usuarioId: 'usuario-B' }))
    const porId = mock.filtros().filter(([c]) => c === 'id')
    expect(porId).toEqual([['id', 'usuario-A']])
  })

  it('guarda la orden a nombre del usuario del token', async () => {
    await handler(await pet('usuario-A', { montoMxn: 500, usuarioId: 'usuario-B' }))
    const insert = mock.llamadas.find((c) => c.metodo === 'insert')
    expect(insert.args[0].usuario_id).toBe('usuario-A')
  })
})

describe('etherfuse-deposit — validaciones que se conservan', () => {
  it('bloquea el depósito si el KYC no está aprobado', async () => {
    resolver = () => ({ data: { ...USUARIO_OK, kyc_status: 'pending' }, error: null })
    const res = await handler(await pet('usuario-A'))
    expect(res.statusCode).toBe(403)
  })

  it('bloquea si la cuenta bancaria no está activa', async () => {
    resolver = () => ({
      data: { ...USUARIO_OK, bank_account_status: 'pending' },
      error: null,
    })
    const res = await handler(await pet('usuario-A'))
    expect(res.statusCode).toBe(403)
  })

  it('rechaza un monto inválido', async () => {
    const res = await handler(await pet('usuario-A', { montoMxn: -1 }))
    expect(res.statusCode).toBe(400)
  })

  it('devuelve 404 si el usuario del token ya no existe', async () => {
    resolver = () => ({ data: null, error: { code: 'PGRST116' } })
    const res = await handler(await pet('usuario-fantasma'))
    expect(res.statusCode).toBe(404)
  })
})
