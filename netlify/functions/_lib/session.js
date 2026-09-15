import { SignJWT, jwtVerify, errors as joseErrors } from 'jose'

/**
 * Capa de sesión.
 *
 * Sustituye al esquema anterior, en el que el cliente enviaba `usuarioId`
 * como parámetro y el backend le creía. Ese esquema permitía a cualquiera
 * editar el objeto guardado en localStorage y operar como otro usuario.
 *
 * A partir de aquí la identidad del llamante sale EXCLUSIVAMENTE del token
 * firmado. Ninguna función debe volver a leer `usuarioId` del cuerpo ni de
 * la query string, ni siquiera como respaldo: un respaldo es una ruta de
 * evasión, no una red de seguridad.
 */

const ISSUER = 'manana-seguro'
const AUDIENCE = 'manana-seguro-app'
const DEFAULT_TTL_SECONDS = 60 * 60 * 24 // 24 h, sin refresco en este sprint
const MIN_SECRET_BYTES = 32

export class SessionError extends Error {
  /**
   * @param {'MISSING_TOKEN'|'MALFORMED_TOKEN'|'EXPIRED_TOKEN'|'INVALID_TOKEN'} code
   */
  constructor(code, message) {
    super(message)
    this.name = 'SessionError'
    this.code = code
    // Todos los casos se presentan al cliente como UNAUTHENTICATED.
    // El detalle sirve para depurar del lado del servidor, no para que el
    // cliente distinga entre "expirado" y "firma inválida": esa distinción
    // solo le es útil a quien está probando tokens.
    this.publicCode = 'UNAUTHENTICATED'
  }
}

/**
 * La llave de firma vive únicamente en el entorno de despliegue.
 * Se lee en cada llamada y no se cachea en módulo, para que rotarla no
 * requiera esperar a que se reciclen las instancias de la función.
 */
function getSecret() {
  const raw = process.env.SESSION_SIGNING_KEY
  if (!raw) {
    throw new Error('SESSION_SIGNING_KEY no está configurada en el entorno')
  }
  const key = new TextEncoder().encode(raw)
  if (key.length < MIN_SECRET_BYTES) {
    throw new Error(
      `SESSION_SIGNING_KEY debe tener al menos ${MIN_SECRET_BYTES} bytes`
    )
  }
  return key
}

/**
 * Emite un token de sesión. Se llama desde auth-google.js, después de que
 * el token de Google fue validado con éxito.
 *
 * El payload de un JWT está firmado pero NO cifrado: cualquiera puede
 * leerlo. Por eso solo lleva el id del usuario y las marcas de tiempo.
 * Nada de correo, nombre, llave pública ni saldo.
 *
 * @param {string} userId
 * @param {{ ttlSeconds?: number }} [options]
 * @returns {Promise<{ token: string, expiresAt: string }>}
 */
export async function issueSession(userId, options = {}) {
  if (!userId || typeof userId !== 'string') {
    throw new Error('issueSession requiere un userId')
  }

  const ttl = options.ttlSeconds ?? DEFAULT_TTL_SECONDS
  const now = Math.floor(Date.now() / 1000)
  const exp = now + ttl

  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(getSecret())

  return { token, expiresAt: new Date(exp * 1000).toISOString() }
}

/**
 * Extrae el token del header Authorization.
 * Los nombres de header llegan en minúsculas en Netlify, pero se busca en
 * ambas formas para no depender de ese detalle del runtime.
 */
function extractBearer(event) {
  const headers = event?.headers ?? {}
  const raw = headers.authorization ?? headers.Authorization
  if (!raw) throw new SessionError('MISSING_TOKEN', 'Falta el header Authorization')

  const match = /^Bearer\s+(.+)$/i.exec(raw.trim())
  if (!match) {
    throw new SessionError('MALFORMED_TOKEN', 'El header Authorization no es Bearer')
  }
  return match[1].trim()
}

/**
 * Verifica la sesión de una petición entrante.
 *
 * @param {{ headers?: Record<string,string> }} event - evento de Netlify
 * @returns {Promise<{ userId: string }>}
 * @throws {SessionError}
 */
export async function verifySession(event) {
  const token = extractBearer(event)

  // La llave se resuelve ANTES del try. Si se resolviera dentro, un fallo
  // de configuración (llave ausente o corta) quedaría atrapado por el catch
  // y se le presentaría al usuario como "sesión inválida", con lo que un
  // despliegue mal configurado se vería igual que un token manipulado.
  const secret = getSecret()

  let payload
  try {
    ;({ payload } = await jwtVerify(token, secret, {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['HS256'], // fija el algoritmo: sin esto, un token con
      // alg "none" o con otro algoritmo podría aceptarse
    }))
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) {
      throw new SessionError('EXPIRED_TOKEN', 'La sesión expiró')
    }
    throw new SessionError('INVALID_TOKEN', 'Token de sesión inválido')
  }

  if (!payload.sub) {
    throw new SessionError('INVALID_TOKEN', 'El token no identifica a un usuario')
  }

  return { userId: payload.sub }
}

/**
 * Envoltorio para handlers de Netlify.
 *
 * El handler recibe `userId` ya verificado como segundo argumento, de modo
 * que no tiene ninguna razón para volver a mirar el cuerpo de la petición
 * en busca de una identidad.
 *
 * @example
 *   export const handler = withSession(async (event, userId) => { ... })
 */
export function withSession(handler) {
  return async function wrapped(event, context) {
    let session
    try {
      session = await verifySession(event)
    } catch (err) {
      if (err instanceof SessionError) {
        return {
          statusCode: 401,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ok: false,
            code: err.publicCode,
            message: 'Sesión inválida o expirada. Inicia sesión de nuevo.',
          }),
        }
      }
      // Falla de configuración (llave ausente o corta): no es culpa del
      // cliente y no debe presentarse como 401.
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: false, code: 'INTERNAL' }),
      }
    }

    return handler(event, session.userId, context)
  }
}
