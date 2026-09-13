import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { verifySession } from './_lib/session.js'

// ---------------------------------------------------------------------
// Mocks.
//
// No se prueba contra Supabase ni contra Google reales: haría falta un
// token de Google válido, la prueba no sería repetible y dependería de
// una red. Lo que aquí importa es la lógica de la función, no que
// Supabase funcione.
// ---------------------------------------------------------------------

let supabaseState

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => supabaseState.select,
        }),
      }),
      insert: () => ({
        select: () => ({
          single: async () => supabaseState.insert,
        }),
      }),
    }),
  }),
}))

const SEED_FALSA = 'SBRTWWQ4EXAMPLEZ7K3MFAKE5NOTREAL' + 'SEEDXYZ2345ABCDEFGH23456'

vi.mock('@stellar/stellar-sdk', () => ({
  Keypair: {
    random: () => ({
      publicKey: () => 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB',
      secret: () => SEED_FALSA,
    }),
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
  process.env.WALLET_ENCRYPTION_KEY = 'a'.repeat(64)
  process.env.SESSION_SIGNING_KEY = 'clave-de-firma-de-al-menos-32-bytes-larga'
  process.env.GOOGLE_CLIENT_ID = 'client-id.apps.googleusercontent.com'

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
    supabaseState.insert = {
      data: { ...USUARIO_EXISTENTE, id: 'usuario-nuevo-9' },
      error: null,
    }
  })

  it('responde 201 y emite una sesión para el usuario creado', async () => {
    const res = await handler(peticion())
    expect(res.statusCode).toBe(201)
    const { sesion } = JSON.parse(res.body)
    const { userId } = await verifySession(conSesion(sesion.token))
    expect(userId).toBe('usuario-nuevo-9')
  })

  it('la respuesta nunca contiene la semilla en claro', async () => {
    const res = await handler(peticion())
    expect(res.body).not.toContain(SEED_FALSA)
  })

  it('la respuesta no expone la semilla cifrada', async () => {
    const res = await handler(peticion())
    // El ciphertext no le sirve de nada al cliente y no tiene por qué salir.
    expect(res.body).not.toContain('stellar_secret_key_encrypted')
    expect(res.body).not.toContain('iv:tag:ciphertext')
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
