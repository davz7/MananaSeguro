/**
 * Verificación del ID token de Google.
 *
 * Todas las comprobaciones fallan cerradas: si falta un dato o una pieza de
 * configuración, el token se rechaza. Antes, si GOOGLE_CLIENT_ID no estaba
 * configurada, la comprobación de audiencia se saltaba y se aceptaban tokens
 * emitidos para CUALQUIER aplicación de Google (confused deputy).
 *
 * La app móvil pide el token con el client ID web (`webClientId` en
 * @react-native-google-signin/google-signin), así que su `aud` es el mismo
 * que el de la web y basta con un único client ID.
 */

const TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo'
const EMISORES_VALIDOS = new Set(['accounts.google.com', 'https://accounts.google.com'])

/** Falla de configuración del servidor: no es culpa del cliente (→ 500). */
export class GoogleConfigError extends Error {
  constructor(message) {
    super(message)
    this.name = 'GoogleConfigError'
  }
}

/** Token rechazado (→ 401). */
export class GoogleTokenError extends Error {
  constructor(message) {
    super(message)
    this.name = 'GoogleTokenError'
  }
}

/**
 * Lee el client ID esperado. Se lee en cada llamada, igual que la llave de
 * sesión, para que cambiarlo no dependa de reciclar instancias.
 */
export function clientIdEsperado() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  if (!clientId) {
    throw new GoogleConfigError('GOOGLE_CLIENT_ID no está configurada en el entorno')
  }
  return clientId
}

/**
 * @param {string} idToken
 * @param {{ fetchImpl?: typeof fetch, ahora?: () => number }} [opciones]
 * @returns {Promise<{ email: string, nombre: string, googleId: string }>}
 */
export async function verificarTokenGoogle(idToken, opciones = {}) {
  const fetchImpl = opciones.fetchImpl ?? fetch
  const ahora = opciones.ahora ?? (() => Math.floor(Date.now() / 1000))

  // La configuración se resuelve ANTES de llamar a Google: un despliegue mal
  // configurado no debe llegar a aceptar ni a consultar nada.
  const clientId = clientIdEsperado()

  if (typeof idToken !== 'string' || idToken.trim() === '') {
    throw new GoogleTokenError('idToken vacío')
  }

  const res = await fetchImpl(
    `${TOKENINFO_URL}?id_token=${encodeURIComponent(idToken)}`,
    { method: 'GET' }
  )
  if (!res.ok) {
    throw new GoogleTokenError(`Token de Google inválido: HTTP ${res.status}`)
  }

  const payload = await res.json()

  // Audiencia: el token debe ser para NUESTRA app.
  if (payload.aud !== clientId) {
    throw new GoogleTokenError('Token de Google no corresponde a esta aplicación')
  }

  if (!EMISORES_VALIDOS.has(payload.iss)) {
    throw new GoogleTokenError('Emisor del token de Google no reconocido')
  }

  // Sin `exp` no se puede saber si sigue vigente: se rechaza.
  const exp = Number.parseInt(payload.exp, 10)
  if (!Number.isFinite(exp) || exp <= ahora()) {
    throw new GoogleTokenError('Token de Google expirado')
  }

  // tokeninfo devuelve 'true' como texto; se acepta también el booleano.
  const verificado = payload.email_verified === 'true' || payload.email_verified === true
  if (!payload.email || !verificado) {
    throw new GoogleTokenError('Email de Google no verificado')
  }

  if (!payload.sub) {
    throw new GoogleTokenError('El token de Google no identifica a un usuario')
  }

  return {
    email: payload.email,
    nombre: payload.name || payload.given_name || payload.email.split('@')[0],
    googleId: payload.sub,
  }
}
