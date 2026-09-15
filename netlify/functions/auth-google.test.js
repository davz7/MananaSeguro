import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { verifySession } from './_lib/session.js'
import { claveDePrueba } from './_lib/testing/claves.js'
import { randomBytes } from 'crypto'

// Mocks.
//
// No se prueba contra Supabase ni contra Google reales: haría falta un
// token de Google válido, la prueba no sería repetible y dependería de
// una red. Lo que aquí importa es la lógica de la función, no que
// Supabase funcione.

let supabaseState

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => supabaseState.select,
        }),
      }),
      insert: (fila) => {
        supabaseState.insertadoEn = fila
        return {
          select: () => ({
            single: async () =>
            supabaseState.devolverInsertado
              ? { data: supabaseState.insertadoEn, error: null }
              : supabaseState.insert,
          }),
        }
      },
    }),
  }),
}))

// La custodia se mockea: su comportamiento criptográfico se prueba en
// _lib/custody.test.js. Aquí solo interesa que auth-google la invoque con
// el id correcto y que persista lo que devuelve sin alterarlo.
//
// Los valores se generan en cada corrida en lugar de ir escritos. Dos
// razones: ninguna cadena del repositorio parece un secreto, y nadie puede
// copiar este mock como plantilla y heredar un IV de ceros, que es
// justamente el peor valor posible en cifrado real.
const custodiaLlamadas = []
const custodiaDevuelta = []

vi.mock('./_lib/custody.js', () => ({
  createCustodialAccount: async (userId) => {
    custodiaLlamadas.push(userId)
    const columnas = {
      stellar_public_key: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB',
      seed_ciphertext: randomBytes(32).toString('hex'),
      seed_iv: randomBytes(12).toString('hex'),
      seed_auth_tag: randomBytes(16).toString('hex'),
      data_key_blob: randomBytes(24).toString('base64'),
      key_scheme_version: 1,
    }
    custodiaDevuelta.push(columnas)
    return columnas
  },
}))

const { handler } = await import('./auth-google.js')

function peticion(body = { idToken: 'token-de-google' }) {
  return { httpMethod: 'POST', body: JSON.stringify(body) }
}

function conSesion(token) {
  return { headers: { authorization: `Bearer ${token}` } }
}

beforeEach(() => {
  process.env.SUPABASE_URL = 'https://proyecto.supabase.co'
  process.env.SUPABASE_SERVICE_KEY = 'service-role-de-prueba'
  process.env.KMS_CUSTODY_KEY_ID = 'alias/manana-seguro-custody-testnet'
  process.env.SESSION_SIGNING_KEY = claveDePrueba()
  process.env.GOOGLE_CLIENT_ID = 'client-id.apps.googleusercontent.com'
  custodiaLlamadas.length = 0
  custodiaDevuelta.length = 0

  supabaseState = {
    select: { data: null, error: { code: 'PGRST116' } },
    insert: { data: null, error: null },
  }

  // Respuesta de Google por defecto: token válido.
  global.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({
      email: 'davor@example.com',
      email_verified: 'true',
      name: 'Davor',
      sub: 'google-123',
      aud: 'client-id.apps.googleusercontent.com',
      exp: String(Math.floor(Date.now() / 1000) + 3600),
    }),
  }))
})

afterEach(() => {
  vi.restoreAllMocks()
})

const USUARIO_EXISTENTE = {
  id: 'usuario-existente-1',
  email: 'davor@example.com',
  nombre: 'Davor',
  customer_id: 'cust-1',
  bank_account_id: 'bank-1',
  stellar_public_key: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB',
  stellar_secret_key_encrypted: 'iv:tag:ciphertext',
  kyc_status: 'pending',
  bank_account_status: 'pending',
}

describe('auth-google — usuario existente', () => {
  beforeEach(() => {
    supabaseState.select = { data: USUARIO_EXISTENTE, error: null }
  })

  it('responde 200 y emite una sesión', async () => {
    const res = await handler(peticion())
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.sesion.token).toBeTruthy()
    expect(body.sesion.expiresAt).toBeTruthy()
  })

  it('el token emitido identifica al usuario correcto', async () => {
    const res = await handler(peticion())
    const { sesion } = JSON.parse(res.body)
    const { userId } = await verifySession(conSesion(sesion.token))
    expect(userId).toBe('usuario-existente-1')
  })

  it('la fecha de expiración es futura', async () => {
    const res = await handler(peticion())
    const { sesion } = JSON.parse(res.body)
    expect(new Date(sesion.expiresAt).getTime()).toBeGreaterThan(Date.now())
  })
})

describe('auth-google — usuario nuevo', () => {
  beforeEach(() => {
    supabaseState.select = { data: null, error: { code: 'PGRST116' } }
    supabaseState.insert = { data: null, error: null }
    // El id lo genera auth-google, así que la fila devuelta es la insertada.
    supabaseState.devolverInsertado = true
  })

  it('responde 201 y emite una sesión para el usuario creado', async () => {
    const res = await handler(peticion())
    expect(res.statusCode).toBe(201)
    const { sesion, usuario } = JSON.parse(res.body)
    const { userId } = await verifySession(conSesion(sesion.token))
    expect(userId).toBe(usuario.id)
  })

  it('la respuesta nunca contiene una semilla en claro', async () => {
    const res = await handler(peticion())
    expect(res.body).not.toMatch(/\bS[A-D][A-Z2-7]{54}\b/)
  })

  it('la respuesta no expone material de custodia', async () => {
    const res = await handler(peticion())
    const custodia = custodiaDevuelta.at(-1)
    // Ni los nombres de las columnas ni sus valores le sirven al cliente.
    expect(res.body).not.toContain('seed_ciphertext')
    expect(res.body).not.toContain('data_key_blob')
    expect(res.body).not.toContain(custodia.seed_ciphertext)
    expect(res.body).not.toContain(custodia.data_key_blob)
    expect(res.body).not.toContain(custodia.seed_auth_tag)
  })

  it('cifra con el mismo id con el que crea al usuario', async () => {
    const res = await handler(peticion())
    const { usuario } = JSON.parse(res.body)
    // Si no coincidieran, el encryption context de KMS no abriría nunca
    // el blob de ese usuario y su cuenta quedaría irrecuperable.
    expect(custodiaLlamadas).toEqual([usuario.id])
  })

  it('persiste las cinco columnas de custodia sin alterarlas', async () => {
    await handler(peticion())
    const custodia = custodiaDevuelta.at(-1)
    const insertado = supabaseState.insertadoEn
    for (const col of [
      'seed_ciphertext', 'seed_iv', 'seed_auth_tag',
      'data_key_blob', 'key_scheme_version',
    ]) {
      // Se compara contra el valor devuelto, no solo su presencia: así
      // un recorte o una transformación accidental también falla.
      expect(insertado[col]).toBe(custodia[col])
    }
  })

  it('devuelve 500 si falta KMS_CUSTODY_KEY_ID', async () => {
    delete process.env.KMS_CUSTODY_KEY_ID
    const res = await handler(peticion())
    expect(res.statusCode).toBe(500)
  })
})

describe('auth-google — rechazos', () => {
  it('devuelve 500 si falta SESSION_SIGNING_KEY', async () => {
    delete process.env.SESSION_SIGNING_KEY
    const res = await handler(peticion())
    expect(res.statusCode).toBe(500)
    expect(res.body).not.toContain('SESSION_SIGNING_KEY')
  })

  it('devuelve 401 y ninguna sesión si Google rechaza el token', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 401 }))
    const res = await handler(peticion())
    expect(res.statusCode).toBe(401)
    expect(JSON.parse(res.body).sesion).toBeUndefined()
  })

  it('devuelve 401 si el email de Google no está verificado', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        email: 'davor@example.com',
        email_verified: 'false',
        sub: 'google-123',
        aud: 'client-id.apps.googleusercontent.com',
      }),
    }))
    const res = await handler(peticion())
    expect(res.statusCode).toBe(401)
  })

  it('devuelve 401 si el token es para otra aplicación', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        email: 'davor@example.com',
        email_verified: 'true',
        sub: 'google-123',
        aud: 'otra-app.apps.googleusercontent.com',
      }),
    }))
    const res = await handler(peticion())
    expect(res.statusCode).toBe(401)
  })

  it('devuelve 400 si falta el idToken', async () => {
    const res = await handler(peticion({}))
    expect(res.statusCode).toBe(400)
  })

  it('devuelve 405 si el método no es POST', async () => {
    const res = await handler({ httpMethod: 'GET' })
    expect(res.statusCode).toBe(405)
  })
})