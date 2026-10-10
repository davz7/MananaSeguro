import { describe, it, expect, beforeEach, vi } from 'vitest'
import { issueSession } from './_lib/session.js'
import { crearSupabaseMock } from './_lib/testing/supabaseMock.js'
import { claveDePrueba } from './_lib/testing/claves.js'

let mock
let resolver

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => mock.cliente,
}))

const { handler } = await import('./metas.js')

const META_VALIDA = {
  nombre: 'Retiro',
  monto_objetivo_mxn: 500000,
  ahorro_mensual_mxn: 1500,
  anos_al_retiro: 20,
}

async function pet(userId, { method = 'GET', body, query = {} } = {}) {
  const { token } = await issueSession(userId)
  return {
    httpMethod: method,
    headers: { authorization: `Bearer ${token}` },
    queryStringParameters: query,
    body: body ? JSON.stringify(body) : undefined,
  }
}

beforeEach(() => {
  process.env.SESSION_SIGNING_KEY = claveDePrueba()
  process.env.SUPABASE_URL = 'https://proyecto.supabase.co'
  process.env.SUPABASE_SERVICE_KEY = 'service-role'
  resolver = () => ({ data: [], error: null, count: 0 })
  mock = crearSupabaseMock((llamadas) => resolver(llamadas))
})

describe('metas — sesión', () => {
  it('rechaza con 401 sin token', async () => {
    const res = await handler({ httpMethod: 'GET', headers: {}, queryStringParameters: {} })
    expect(res.statusCode).toBe(401)
  })

  it('el preflight pasa sin token y autoriza Authorization', async () => {
    const res = await handler({ httpMethod: 'OPTIONS', headers: {} })
    expect(res.statusCode).toBe(200)
    expect(res.headers['Access-Control-Allow-Headers']).toContain('Authorization')
  })

  it('GET lista solo las metas del usuario del token', async () => {
    const res = await handler(await pet('usuario-A'))
    expect(res.statusCode).toBe(200)
    expect(mock.filtros()).toContainEqual(['usuario_id', 'usuario-A'])
  })

  it('GET ignora un usuarioId en la query', async () => {
    await handler(await pet('usuario-A', { query: { usuarioId: 'usuario-B' } }))
    const porUsuario = mock.filtros().filter(([c]) => c === 'usuario_id')
    expect(porUsuario).toEqual([['usuario_id', 'usuario-A']])
  })
})

describe('metas — creación', () => {
  it('crea la meta a nombre del usuario del token, no del cuerpo', async () => {
    resolver = (llamadas) => {
      const insert = llamadas.find((c) => c.metodo === 'insert')
      if (insert) return { data: { id: 'meta-1', ...insert.args[0] }, error: null }
      return { count: 0, data: [], error: null }
    }
    const res = await handler(
      await pet('usuario-A', {
        method: 'POST',
        body: { ...META_VALIDA, usuarioId: 'usuario-B' },
      })
    )
    expect(res.statusCode).toBe(201)
    const insert = mock.llamadas.find((c) => c.metodo === 'insert')
    expect(insert.args[0].usuario_id).toBe('usuario-A')
  })

  it('sigue validando el contenido de la meta', async () => {
    const res = await handler(
      await pet('usuario-A', {
        method: 'POST',
        body: { ...META_VALIDA, monto_objetivo_mxn: 10 },
      })
    )
    expect(res.statusCode).toBe(400)
  })
})

describe('metas — actualización y borrado', () => {
  it('PATCH filtra por la meta y por el usuario del token', async () => {
    resolver = () => ({ data: { id: 'meta-1', usuario_id: 'usuario-A' }, error: null })
    await handler(
      await pet('usuario-A', {
        method: 'PATCH',
        query: { id: 'meta-1' },
        body: { nombre: 'Nuevo nombre' },
      })
    )
    expect(mock.filtros()).toContainEqual(['id', 'meta-1'])
    expect(mock.filtros()).toContainEqual(['usuario_id', 'usuario-A'])
  })

  it('PATCH de una meta ajena devuelve 404', async () => {
    resolver = () => ({ data: null, error: { code: 'PGRST116' } })
    const res = await handler(
      await pet('usuario-B', {
        method: 'PATCH',
        query: { id: 'meta-1' },
        body: { nombre: 'Secuestrada' },
      })
    )
    expect(res.statusCode).toBe(404)
  })

  it('DELETE ya no necesita usuarioId en el cuerpo', async () => {
    resolver = () => ({ data: null, error: { code: 'PGRST116' } })
    const res = await handler(
      await pet('usuario-A', { method: 'DELETE', query: { id: 'meta-1' } })
    )
    // 404 porque el mock no devuelve la meta; lo relevante es que no
    // responde 400 por falta de usuarioId.
    expect(res.statusCode).toBe(404)
  })

  it('DELETE sin id sigue devolviendo 400', async () => {
    const res = await handler(await pet('usuario-A', { method: 'DELETE' }))
    expect(res.statusCode).toBe(400)
  })
})
