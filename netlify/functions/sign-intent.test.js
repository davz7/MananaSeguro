import { describe, it, expect, beforeEach, vi } from 'vitest'
import { randomUUID } from 'crypto'
import { issueSession } from './_lib/session.js'
import { claveDePrueba } from './_lib/testing/claves.js'

// ---------------------------------------------------------------------
// Supabase simulado con estado por tabla, suficiente para ejercitar la
// idempotencia: el insert falla con 23505 si la clave ya existe.
// ---------------------------------------------------------------------
let intentos
let usuarioFila

function tabla(nombre) {
  const filtros = {}
  const api = {
    select: () => api,
    eq: (col, val) => {
      filtros[col] = val
      return api
    },
    gte: () => api,
    insert: (fila) => {
      if (nombre !== 'intentos_firma') return { error: null }
      if (intentos.has(fila.idempotency_key)) {
        return { error: { code: '23505', message: 'duplicate key' } }
      }
      intentos.set(fila.idempotency_key, { ...fila })
      return { error: null }
    },
    update: (cambios) => ({
      eq: (_c, key) => {
        const previo = intentos.get(key)
        if (previo) intentos.set(key, { ...previo, ...cambios })
        return { error: null }
      },
    }),
    single: async () => {
      if (nombre === 'usuarios') {
        return usuarioFila
          ? { data: usuarioFila, error: null }
          : { data: null, error: { code: 'PGRST116' } }
      }
      const fila = intentos.get(filtros.idempotency_key)
      if (!fila || (filtros.usuario_id && fila.usuario_id !== filtros.usuario_id)) {
        return { data: null, error: { code: 'PGRST116' } }
      }
      return { data: fila, error: null }
    },
    then(res) {
      // Para el conteo del límite de tasa.
      return Promise.resolve({ count: intentos.size, error: null }).then(res)
    },
  }
  return api
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: tabla }),
}))

// La ejecución Soroban se prueba en _lib/soroban.test.js. Aquí solo
// interesa el contrato del endpoint: idempotencia, códigos y sesión.
let ejecutar
vi.mock('./_lib/soroban.js', async () => {
  const real = await vi.importActual('./_lib/soroban.js')
  return {
    ...real,
    ejecutarIntent: (...args) => ejecutar(...args),
  }
})

const { handler } = await import('./sign-intent.js')
const { IntentError } = await import('./_lib/soroban.js')

const INTENT = { type: 'deposit', amountUsdc: 500, lockYears: 20 }

async function pet(userId, cuerpo) {
  const { token } = await issueSession(userId)
  return {
    httpMethod: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify(cuerpo),
  }
}

beforeEach(() => {
  process.env.SESSION_SIGNING_KEY = claveDePrueba()
  process.env.SUPABASE_URL = 'https://proyecto.supabase.co'
  process.env.SUPABASE_SERVICE_KEY = 'service-role'
  intentos = new Map()
  usuarioFila = { id: 'usuario-A', stellar_public_key: 'G...' }
  ejecutar = vi.fn(async () => ({ hash: 'hash-1', intentType: 'deposit' }))
})

describe('sign-intent — sesión', () => {
  it('rechaza con 401 sin token', async () => {
    const res = await handler({ httpMethod: 'POST', headers: {}, body: '{}' })
    expect(res.statusCode).toBe(401)
  })

  it('no firma nada sin sesión', async () => {
    await handler({ httpMethod: 'POST', headers: {}, body: '{}' })
    expect(ejecutar).not.toHaveBeenCalled()
  })

  it('el preflight pasa y autoriza Authorization', async () => {
    const res = await handler({ httpMethod: 'OPTIONS', headers: {} })
    expect(res.statusCode).toBe(200)
    expect(res.headers['Access-Control-Allow-Headers']).toContain('Authorization')
  })
})

describe('sign-intent — clave de idempotencia', () => {
  it('exige idempotencyKey', async () => {
    const res = await handler(await pet('usuario-A', { intent: INTENT }))
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).code).toBe('INVALID_INTENT')
  })

  it('exige que sea un UUID', async () => {
    const res = await handler(
      await pet('usuario-A', { intent: INTENT, idempotencyKey: 'abc' })
    )
    expect(res.statusCode).toBe(400)
  })

  it('firma y devuelve el hash', async () => {
    const res = await handler(
      await pet('usuario-A', { intent: INTENT, idempotencyKey: randomUUID() })
    )
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).transactionHash).toBe('hash-1')
  })
})

describe('sign-intent — reintentos', () => {
  it('el reintento con la misma clave NO vuelve a firmar', async () => {
    const key = randomUUID()
    await handler(await pet('usuario-A', { intent: INTENT, idempotencyKey: key }))
    const res = await handler(
      await pet('usuario-A', { intent: INTENT, idempotencyKey: key })
    )
    // Esto es lo que evita el doble depósito.
    expect(ejecutar).toHaveBeenCalledTimes(1)
    expect(JSON.parse(res.body).transactionHash).toBe('hash-1')
    expect(JSON.parse(res.body).replayed).toBe(true)
  })

  it('una clave distinta sí firma de nuevo', async () => {
    await handler(await pet('usuario-A', { intent: INTENT, idempotencyKey: randomUUID() }))
    await handler(await pet('usuario-A', { intent: INTENT, idempotencyKey: randomUUID() }))
    expect(ejecutar).toHaveBeenCalledTimes(2)
  })

  it('el reintento de una intención fallida devuelve el mismo código', async () => {
    ejecutar = vi.fn(async () => {
      throw new IntentError('SIMULATION_FAILED', 'saldo insuficiente')
    })
    const key = randomUUID()
    const primera = await handler(await pet('usuario-A', { intent: INTENT, idempotencyKey: key }))
    const segunda = await handler(await pet('usuario-A', { intent: INTENT, idempotencyKey: key }))
    expect(primera.statusCode).toBe(422)
    expect(segunda.statusCode).toBe(422)
    expect(ejecutar).toHaveBeenCalledTimes(1)
  })

  it('un usuario no puede leer la clave de otro', async () => {
    const key = randomUUID()
    await handler(await pet('usuario-A', { intent: INTENT, idempotencyKey: key }))
    const res = await handler(await pet('usuario-B', { intent: INTENT, idempotencyKey: key }))
    // No revela que la clave existe ni su resultado.
    expect(res.statusCode).toBe(400)
    expect(res.body).not.toContain('hash-1')
  })
})

describe('sign-intent — códigos de error', () => {
  const casos = [
    ['INVALID_INTENT', 400],
    ['SIMULATION_FAILED', 422],
    ['SUBMISSION_FAILED', 502],
    ['TIMEOUT', 504],
    ['INTERNAL', 500],
  ]

  for (const [codigo, http] of casos) {
    it(`${codigo} responde ${http}`, async () => {
      ejecutar = vi.fn(async () => {
        throw new IntentError(codigo, 'detalle interno')
      })
      const res = await handler(
        await pet('usuario-A', { intent: INTENT, idempotencyKey: randomUUID() })
      )
      expect(res.statusCode).toBe(http)
      expect(JSON.parse(res.body).code).toBe(codigo)
    })
  }

  it('TIMEOUT deja la intención en proceso, no fallida', async () => {
    ejecutar = vi.fn(async () => {
      throw new IntentError('TIMEOUT', 'no confirmó. Hash: abc')
    })
    const key = randomUUID()
    await handler(await pet('usuario-A', { intent: INTENT, idempotencyKey: key }))
    // Marcarla como fallida permitiría que un reintento volviera a firmar
    // una operación que quizá sí se aplicó.
    expect(intentos.get(key).estado).toBe('en_proceso')
  })

  it('el mensaje al usuario no filtra el detalle interno', async () => {
    ejecutar = vi.fn(async () => {
      throw new IntentError('SIMULATION_FAILED', 'HostError#42 en linea 88')
    })
    const res = await handler(
      await pet('usuario-A', { intent: INTENT, idempotencyKey: randomUUID() })
    )
    expect(JSON.parse(res.body).message).not.toContain('HostError')
  })
})
