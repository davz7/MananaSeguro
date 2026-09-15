import { randomUUID } from 'crypto'

const PII_KEY_PATTERN = /email|nombre|displayname/i

const IDENTIFIER_KEY_PATTERN =
  /(^id$|id$|key$|address$|clabe$|wallet|customer|order|quote|usuario|google|stellar|public)/i

/**
 * Campos que contienen material criptográfico o credenciales.
 *
 * Estos NO se truncan: se eliminan por completo. La diferencia importa.
 * Truncar una semilla de Stellar a sus últimos 4 caracteres sigue filtrando
 * 4 caracteres de material secreto en cada línea de log, y los logs se
 * agregan, se retienen y se exportan a terceros.
 *
 * Se sustituyen por un marcador en lugar de borrarse en silencio, para que
 * al depurar se vea que el campo existía y fue redactado, no que faltaba.
 */
const SECRET_KEY_PATTERN =
  /(seed|secret|private|passw|passphrase|mnemonic|credential|authorization|bearer|signature|datakey|data_key|ciphertext|plaintext|token|xdr)/i

/**
 * Semilla secreta de Stellar: 56 caracteres base32, "S" seguida de A-D.
 *
 * Esta es la última red de seguridad y la más importante. Las reglas por
 * nombre de campo fallan en cuanto alguien llama a la variable "valor",
 * "data" o "payload". Esta regla no depende del nombre: busca la forma del
 * secreto en cualquier cadena, venga de donde venga.
 */
const STELLAR_SEED_PATTERN = /\bS[A-D][A-Z2-7]{54}\b/

const REDACTED = '[REDACTED]'
const MAX_DEPTH = 5

/**
 * Redacts identifiers to the last 4 characters for log safety.
 */
export function redactIdentifier(value) {
  if (value == null) return value
  const s = String(value)
  if (s.length <= 4) return '****'
  return `***${s.slice(-4)}`
}

/**
 * Sanea una cadena suelta: si contiene una semilla con forma válida, se
 * descarta entera. No se intenta recortar la parte "limpia" porque una
 * cadena que contiene una semilla no tiene parte limpia que valga el riesgo.
 */
function sanitizeString(value) {
  return STELLAR_SEED_PATTERN.test(value) ? REDACTED : value
}

/**
 * Removes PII, redacts key material, and truncates identifiers before logging.
 *
 * @param {unknown} meta
 * @param {number} [depth]
 * @param {WeakSet} [seen] - protege contra referencias circulares
 */
export function sanitizeMeta(meta, depth = 0, seen = new WeakSet()) {
  if (meta == null) return {}
  if (typeof meta !== 'object' || Array.isArray(meta)) return {}
  if (depth > MAX_DEPTH) return {}
  if (seen.has(meta)) return {}
  seen.add(meta)

  const out = {}

  for (const [key, value] of Object.entries(meta)) {
    // 1. Material criptográfico: fuera, sin importar la forma del valor.
    if (SECRET_KEY_PATTERN.test(key)) {
      out[key] = REDACTED
      continue
    }

    // 2. PII: se descarta el campo completo.
    if (PII_KEY_PATTERN.test(key)) continue

    // 3. Arrays: se sanea elemento por elemento.
    //    Antes caían al final del bucle y se emitían tal cual, así que
    //    { seeds: ["S..."] } pasaba íntegro. Este era el hueco más grave.
    if (Array.isArray(value)) {
      out[key] = value.map((item) => {
        if (typeof item === 'string') return sanitizeString(item)
        if (item != null && typeof item === 'object') {
          return sanitizeMeta(item, depth + 1, seen)
        }
        return item
      })
      continue
    }

    // 4. Error: sus propiedades no son enumerables, así que hay que
    //    extraerlas a mano o se pierde el mensaje. El stack no se emite:
    //    suele arrastrar argumentos de función.
    if (value instanceof Error) {
      out[key] = { name: value.name, message: sanitizeString(value.message) }
      continue
    }

    if (value != null && typeof value === 'object') {
      out[key] = sanitizeMeta(value, depth + 1, seen)
      continue
    }

    if (typeof value === 'string') {
      // 5. Detección por forma, independiente del nombre del campo.
      if (STELLAR_SEED_PATTERN.test(value)) {
        out[key] = REDACTED
        continue
      }

      if (
        IDENTIFIER_KEY_PATTERN.test(key) ||
        value.includes('@') ||
        value.startsWith('G')
      ) {
        if (value.includes('@')) continue
        out[key] = redactIdentifier(value)
        continue
      }
    }

    out[key] = value
  }

  return out
}

function emit(level, functionName, requestId, message, meta) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    function: functionName,
    requestId,
    // El mensaje también se sanea. Un `log.error(\`fallo con ${seed}\`)`
    // es un error fácil de cometer y el saneo de meta no lo cubriría.
    message: typeof message === 'string' ? sanitizeString(message) : message,
    ...sanitizeMeta(meta),
  }
  console.log(JSON.stringify(entry))
}

/**
 * Creates a per-invocation logger with a unique requestId for support traceability.
 *
 * @param {string} functionName - Netlify function name (e.g. etherfuse-webhook)
 * @returns {{ requestId: string, info: Function, warn: Function, error: Function }}
 */
export function createLogger(functionName) {
  const requestId = randomUUID()

  return {
    requestId,
    info(message, meta = {}) {
      emit('info', functionName, requestId, message, meta)
    },
    warn(message, meta = {}) {
      emit('warn', functionName, requestId, message, meta)
    },
    error(message, meta = {}) {
      emit('error', functionName, requestId, message, meta)
    },
  }
}

/**
 * Builds a JSON error response body including requestId for client support.
 *
 * El cuerpo de error viaja al cliente, así que se sanea igual que un log.
 */
export function errorBody(log, error, extra = {}) {
  return JSON.stringify({
    error: typeof error === 'string' ? sanitizeString(error) : error,
    requestId: log.requestId,
    ...sanitizeMeta(extra),
  })
}

/**
 * Adds requestId to error response bodies returned by inner handlers.
 */
export function withRequestId(log, result) {
  if (result.statusCode >= 400 && result.body) {
    try {
      const body = JSON.parse(result.body)
      body.requestId = log.requestId
      return { ...result, body: JSON.stringify(body) }
    } catch {
      return result
    }
  }
  return result
}
