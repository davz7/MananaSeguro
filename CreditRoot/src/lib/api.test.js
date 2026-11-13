import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  SESION_EXPIRADA_EVENT,
  apiJson,
  guardarSesion,
  leerSesion,
  normalizarError,
  sesionVigente,
} from './api'

function respuesta(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body)),
  }
}

const futuro = () => new Date(Date.now() + 60_000).toISOString()
const pasado = () => new Date(Date.now() - 60_000).toISOString()

describe('normalizarError', () => {
  it('errorBody → { error, requestId }', () => {
    const e = normalizarError(404, { error: 'Orden no encontrada', requestId: 'r1' })
    expect(e).toBeInstanceOf(ApiError)
    expect(e).toMatchObject({ status: 404, code: 'NOT_FOUND', message: 'Orden no encontrada', requestId: 'r1' })
  })

  it('sign-intent → { ok:false, code, message }', () => {
    const e = normalizarError(409, { ok: false, code: 'LOCK_ACTIVE', message: 'Bloqueado' })
    expect(e).toMatchObject({ status: 409, code: 'LOCK_ACTIVE', message: 'Bloqueado' })
  })

  it('403 de deposit prefiere `mensaje` y conserva los datos extra', () => {
    const e = normalizarError(403, { error: 'KYC pendiente', mensaje: 'Completa tu KYC', kycStatus: 'pending' })
    expect(e.message).toBe('Completa tu KYC')
    expect(e.code).toBe('FORBIDDEN')
    expect(e.data.kycStatus).toBe('pending')
  })

  it('sin cuerpo usa el status', () => {
    const e = normalizarError(502, null)
    expect(e).toMatchObject({ code: 'INTERNAL', message: 'HTTP 502', requestId: null })
  })
})

describe('sesión', () => {
  beforeEach(() => localStorage.clear())

  it('sesionVigente respeta expiresAt', () => {
    expect(sesionVigente()).toBe(false)
    guardarSesion({ token: 't', expiresAt: futuro() })
    expect(sesionVigente()).toBe(true)
    guardarSesion({ token: 't', expiresAt: pasado() })
    expect(sesionVigente()).toBe(false)
  })

  it('no guarda sesiones sin token', () => {
    guardarSesion({ expiresAt: futuro() })
    expect(leerSesion()).toBeNull()
  })
})

describe('apiJson', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('fetch', vi.fn())
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('manda el token y serializa el body', async () => {
    guardarSesion({ token: 'abc', expiresAt: futuro() })
    fetch.mockResolvedValue(respuesta(200, { ok: true }))

    const data = await apiJson('/api/x', { method: 'POST', body: { a: 1 } })

    expect(data).toEqual({ ok: true })
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('/api/x')
    expect(init.headers.get('Authorization')).toBe('Bearer abc')
    expect(init.headers.get('Content-Type')).toBe('application/json')
    expect(init.body).toBe('{"a":1}')
  })

  it('no manda un token vencido', async () => {
    guardarSesion({ token: 'viejo', expiresAt: pasado() })
    fetch.mockResolvedValue(respuesta(200, {}))
    await apiJson('/api/x')
    expect(fetch.mock.calls[0][1].headers.has('Authorization')).toBe(false)
  })

  it('auth=false no manda token', async () => {
    guardarSesion({ token: 'abc', expiresAt: futuro() })
    fetch.mockResolvedValue(respuesta(200, {}))
    await apiJson('/api/auth/google', { method: 'POST', body: {}, auth: false })
    expect(fetch.mock.calls[0][1].headers.has('Authorization')).toBe(false)
  })

  it('401 limpia la sesión y avisa a la app', async () => {
    guardarSesion({ token: 'abc', expiresAt: futuro() })
    fetch.mockResolvedValue(respuesta(401, { ok: false, code: 'UNAUTHENTICATED', message: 'Sesión inválida' }))
    const listener = vi.fn()
    window.addEventListener(SESION_EXPIRADA_EVENT, listener)

    await expect(apiJson('/api/metas')).rejects.toMatchObject({ status: 401, code: 'UNAUTHENTICATED' })
    expect(listener).toHaveBeenCalledTimes(1)
    expect(leerSesion()).toBeNull()

    window.removeEventListener(SESION_EXPIRADA_EVENT, listener)
  })

  it('error de red → ApiError NETWORK', async () => {
    fetch.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(apiJson('/api/x')).rejects.toMatchObject({ status: 0, code: 'NETWORK' })
  })

  it('cuerpo no JSON en error → error de sistema (el texto crudo no se usa como mensaje)', async () => {
    fetch.mockResolvedValue(respuesta(500, 'Internal Server Error'))
    await expect(apiJson('/api/x')).rejects.toMatchObject({ status: 500, message: 'HTTP 500', esDeSistema: true })
  })

  it('404 sin mensaje (endpoint inexistente) → error de sistema', async () => {
    fetch.mockResolvedValue(respuesta(404, '<!doctype html><title>Not found</title>'))
    await expect(apiJson('/api/no-existe')).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND', esDeSistema: true })
  })

  it('404 con mensaje del backend → error de negocio', async () => {
    fetch.mockResolvedValue(respuesta(404, { error: 'Orden no encontrada', requestId: 'r9' }))
    await expect(apiJson('/api/etherfuse/order-status?orderId=x'))
      .rejects.toMatchObject({ status: 404, message: 'Orden no encontrada', esDeSistema: false })
  })

  it('escribe en consola el tipo de error con método, url y status', async () => {
    fetch.mockResolvedValue(respuesta(404, ''))
    await expect(apiJson('/api/metas', { method: 'PATCH', body: {} })).rejects.toBeInstanceOf(ApiError)
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('[API] PATCH /api/metas → HTTP 404 · NOT_FOUND · error de sistema'),
      expect.any(Object),
    )
  })
})
