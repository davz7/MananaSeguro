import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  verificarTokenGoogle,
  GoogleConfigError,
  GoogleTokenError,
} from './googleToken.js'

const CLIENT_ID = 'web-client-id.apps.googleusercontent.com'
const AHORA = 1_800_000_000

function payloadValido(cambios = {}) {
  return {
    aud: CLIENT_ID,
    iss: 'https://accounts.google.com',
    exp: String(AHORA + 3600),
    email: 'ana@example.com',
    email_verified: 'true',
    sub: 'google-sub-1',
    name: 'Ana',
    ...cambios,
  }
}

function fetchQueDevuelve(payload, status = 200) {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  }))
}

const opciones = (fetchImpl) => ({ fetchImpl, ahora: () => AHORA })

let clientIdOriginal

beforeEach(() => {
  clientIdOriginal = process.env.GOOGLE_CLIENT_ID
  process.env.GOOGLE_CLIENT_ID = CLIENT_ID
})

afterEach(() => {
  if (clientIdOriginal === undefined) delete process.env.GOOGLE_CLIENT_ID
  else process.env.GOOGLE_CLIENT_ID = clientIdOriginal
})

describe('verificarTokenGoogle — configuración (falla cerrada)', () => {
  it('rechaza si GOOGLE_CLIENT_ID no está configurada, sin consultar a Google', async () => {
    delete process.env.GOOGLE_CLIENT_ID
    const fetchImpl = fetchQueDevuelve(payloadValido())
    await expect(verificarTokenGoogle('tok', opciones(fetchImpl))).rejects.toBeInstanceOf(
      GoogleConfigError
    )
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('trata un GOOGLE_CLIENT_ID vacío o con espacios como no configurado', async () => {
    process.env.GOOGLE_CLIENT_ID = '   '
    const fetchImpl = fetchQueDevuelve(payloadValido({ aud: '   ' }))
    await expect(verificarTokenGoogle('tok', opciones(fetchImpl))).rejects.toBeInstanceOf(
      GoogleConfigError
    )
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('verificarTokenGoogle — token', () => {
  it('acepta un token válido y devuelve los datos del usuario', async () => {
    const r = await verificarTokenGoogle('tok', opciones(fetchQueDevuelve(payloadValido())))
    expect(r).toEqual({ email: 'ana@example.com', nombre: 'Ana', googleId: 'google-sub-1' })
  })

  it('acepta el emisor sin https', async () => {
    const f = fetchQueDevuelve(payloadValido({ iss: 'accounts.google.com' }))
    await expect(verificarTokenGoogle('tok', opciones(f))).resolves.toBeTruthy()
  })

  it('rechaza un token emitido para otra aplicación', async () => {
    const f = fetchQueDevuelve(payloadValido({ aud: 'otra-app.apps.googleusercontent.com' }))
    await expect(verificarTokenGoogle('tok', opciones(f))).rejects.toThrow(
      'Token de Google no corresponde a esta aplicación'
    )
  })

  it('rechaza un token sin audiencia', async () => {
    const f = fetchQueDevuelve(payloadValido({ aud: undefined }))
    await expect(verificarTokenGoogle('tok', opciones(f))).rejects.toBeInstanceOf(
      GoogleTokenError
    )
  })

  it('rechaza un emisor que no es Google', async () => {
    const f = fetchQueDevuelve(payloadValido({ iss: 'https://evil.example.com' }))
    await expect(verificarTokenGoogle('tok', opciones(f))).rejects.toThrow('Emisor')
  })

  it('rechaza un token expirado', async () => {
    const f = fetchQueDevuelve(payloadValido({ exp: String(AHORA - 1) }))
    await expect(verificarTokenGoogle('tok', opciones(f))).rejects.toThrow('expirado')
  })

  it('rechaza un token sin exp', async () => {
    const f = fetchQueDevuelve(payloadValido({ exp: undefined }))
    await expect(verificarTokenGoogle('tok', opciones(f))).rejects.toThrow('expirado')
  })

  it('rechaza un email no verificado', async () => {
    const f = fetchQueDevuelve(payloadValido({ email_verified: 'false' }))
    await expect(verificarTokenGoogle('tok', opciones(f))).rejects.toThrow('no verificado')
  })

  it('rechaza un token sin sub', async () => {
    const f = fetchQueDevuelve(payloadValido({ sub: undefined }))
    await expect(verificarTokenGoogle('tok', opciones(f))).rejects.toBeInstanceOf(
      GoogleTokenError
    )
  })

  it('rechaza cuando tokeninfo responde con error', async () => {
    const f = fetchQueDevuelve({ error: 'invalid_token' }, 400)
    await expect(verificarTokenGoogle('tok', opciones(f))).rejects.toThrow('HTTP 400')
  })

  it('rechaza un idToken vacío sin consultar a Google', async () => {
    const f = fetchQueDevuelve(payloadValido())
    await expect(verificarTokenGoogle('', opciones(f))).rejects.toBeInstanceOf(GoogleTokenError)
    expect(f).not.toHaveBeenCalled()
  })

  it('codifica el token en la URL para que no pueda inyectar parámetros', async () => {
    const f = fetchQueDevuelve(payloadValido())
    await verificarTokenGoogle('abc&access_token=x', opciones(f))
    const url = f.mock.calls[0][0]
    expect(url).toContain('id_token=abc%26access_token%3Dx')
    expect(url).not.toContain('&access_token=')
  })
})
