// src/lib/api.js
//
// Cliente para las APIs del backend (Netlify Functions bajo /api/*).
// Las protegidas exigen el token de sesión que emite /api/auth/google en el
// header Authorization; sin él responden 401.
//
// El backend todavía responde errores con formas distintas según el endpoint:
//   { error, requestId }                 → errorBody (deposit, onboarding…)
//   { ok:false, code, message }          → sign-intent y withSession (401)
//   { error }                            → validaciones de metas
//   { error, mensaje, kycStatus, … }     → 403 de deposit
// apiJson() los normaliza todos a un ApiError con la misma forma.

const SESION_KEY = 'ms_sesion'
export const SESION_EXPIRADA_EVENT = 'ms:sesion-expirada'

//  Sesión

export function guardarSesion(sesion) {
  if (sesion?.token) localStorage.setItem(SESION_KEY, JSON.stringify(sesion))
}

export function limpiarSesion() {
  try { localStorage.removeItem(SESION_KEY) } catch { /* storage no disponible */ }
}

/** @returns {{ token: string, expiresAt?: string } | null} */
export function leerSesion() {
  try {
    const sesion = JSON.parse(localStorage.getItem(SESION_KEY) || 'null')
    return sesion?.token ? sesion : null
  } catch {
    return null
  }
}

/** true si hay token y no ha pasado su expiresAt. */
export function sesionVigente() {
  const sesion = leerSesion()
  if (!sesion) return false
  if (!sesion.expiresAt) return true
  return new Date(sesion.expiresAt) > new Date()
}

/** Borra la sesión y avisa a la app (AppShell) para que mande al login. */
export function expirarSesion() {
  limpiarSesion()
  window.dispatchEvent(new Event(SESION_EXPIRADA_EVENT))
}

//  Errores

export class ApiError extends Error {
  constructor({ status, code, message, requestId = null, data = null, esDeSistema = false, url = null, method = null }) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.requestId = requestId
    // Cuerpo original: algunos endpoints mandan datos útiles junto al error
    // (p. ej. kycStatus en el 403 de deposit).
    this.data = data
    // true = falla técnica (sin conexión, endpoint inexistente, error 5xx,
    // respuesta sin mensaje). Al usuario se le muestra "error con el sistema"
    // y el detalle técnico va a la consola (ver lib/errores.js).
    this.esDeSistema = esDeSistema
    this.url = url
    this.method = method
  }
}

/** Escribe en consola el tipo de error de una petición fallida. */
function registrarError(err) {
  const destino = [err.method, err.url].filter(Boolean).join(' ')
  const estado = err.status === 0 ? 'sin respuesta' : `HTTP ${err.status}`
  console.error(
    `[API] ${destino} → ${estado} · ${err.code}${err.esDeSistema ? ' · error de sistema' : ''}`,
    { mensaje: err.message, requestId: err.requestId, respuesta: err.data },
  )
}

const CODIGO_POR_STATUS = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  409: 'CONFLICT',
  429: 'RATE_LIMITED',
}

/**
 * Convierte cualquier cuerpo de error del backend en un ApiError.
 * Si la respuesta no era JSON (p. ej. la página HTML de un 404), `body` llega
 * como { textoCrudo } y no se usa como mensaje.
 */
export function normalizarError(status, body, { url = null, method = null } = {}) {
  const b = body && typeof body === 'object' && !('textoCrudo' in body) ? body : {}
  const codigo = b.code
    ?? CODIGO_POR_STATUS[status]
    ?? (status >= 500 ? 'INTERNAL' : 'HTTP_ERROR')
  const mensajeServidor = b.message ?? b.mensaje ?? (typeof b.error === 'string' ? b.error : null)
  return new ApiError({
    status,
    code: codigo,
    message: mensajeServidor ?? `HTTP ${status}`,
    requestId: b.requestId ?? null,
    data: body ?? null,
    // Endpoint inexistente / método mal usado / caída del servidor / sin mensaje
    esDeSistema: status >= 500 || status === 405 || !mensajeServidor,
    url,
    method,
  })
}

//  Peticiones

function obtenerToken() {
  return sesionVigente() ? leerSesion().token : null
}

/**
 * fetch con el token de sesión. Si el backend responde 401 la sesión ya no
 * sirve: se avisa a la app para que cierre sesión y mande al login.
 */
export async function apiFetch(url, options = {}) {
  const headers = new Headers(options.headers)
  const token = obtenerToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(url, { ...options, headers })
  if (res.status === 401) expirarSesion()
  return res
}

async function leerCuerpo(res) {
  const texto = await res.text()
  if (!texto) return null
  try {
    return JSON.parse(texto)
  } catch {
    // No es JSON (página HTML de error, proxy, etc.): se guarda solo para la consola
    return { textoCrudo: texto.slice(0, 500) }
  }
}

/**
 * Petición JSON. Devuelve el cuerpo ya parseado o lanza ApiError.
 *
 * @param {string} url
 * @param {{ method?: string, body?: unknown, headers?: HeadersInit, auth?: boolean }} [opciones]
 *   auth=false para endpoints públicos (no manda token ni dispara el logout en 401).
 */
export async function apiJson(url, { method = 'GET', body, headers, auth = true } = {}) {
  const h = new Headers(headers)
  if (body !== undefined) h.set('Content-Type', 'application/json')
  h.set('Accept', 'application/json')

  const init = {
    method,
    headers: h,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }

  let res
  try {
    res = auth ? await apiFetch(url, init) : await fetch(url, init)
  } catch (err) {
    const errorRed = new ApiError({
      status: 0,
      code: 'NETWORK',
      // Texto técnico para la consola; la pantalla muestra "error con el sistema"
      message: err?.message || 'Network error',
      esDeSistema: true,
      url,
      method,
    })
    registrarError(errorRed)
    throw errorRed
  }

  const data = await leerCuerpo(res)
  if (!res.ok) {
    const error = normalizarError(res.status, data, { url, method })
    registrarError(error)
    throw error
  }
  return data
}
