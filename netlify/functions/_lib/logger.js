// netlify/functions/_lib/logger.js
//
// Structured JSON logger for production log ingestion (Logtail, Better Stack, etc.).
// Replaces ad-hoc console.log/console.error calls across Netlify functions.
//
// Usage:
//   import { log } from './_lib/logger.js'
//   log.info('User created', { userId: 'xxx' })
//   log.error('Deposit failed', { orderId: 'xxx', reason: 'KYC pending' })

// ─── PII sanitization ───────────────────────────────────────────────────────

/**
 * Sanitizes identifiers for safe logging.
 * - Email: first char + "***@..."
 * - Wallet address: last 4 chars only
 * - CLABE: last 4 digits only
 * - UUID: full is OK (not PII)
 */
function sanitize(value) {
  if (typeof value !== 'string') return value

  // Email
  if (value.includes('@')) {
    const [local, domain] = value.split('@')
    return local.charAt(0) + '***@' + domain
  }

  // Wallet address (starts with G, 56 chars)
  if (/^G[A-Z0-9]{55}$/.test(value)) {
    return '****' + value.slice(-4)
  }

  // CLABE (18 digits)
  if (/^\d{18}$/.test(value)) {
    return '****' + value.slice(-4)
  }

  // Default: return as-is (UUIDs, IDs, etc.)
  return value
}

/**
 * Recursively sanitizes an object, masking PII in known fields.
 */
function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj

  const piiFields = ['email', 'depositClabe', 'walletAddress', 'stellarPublicKey',
    'secretKey', 'apiKey', 'token', 'password', 'idToken']

  const sanitized = {}
  for (const [key, value] of Object.entries(obj)) {
    if (piiFields.includes(key) && typeof value === 'string') {
      sanitized[key] = sanitize(value)
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value)
    } else {
      sanitized[key] = value
    }
  }
  return sanitized
}

// ─── Logger factory ─────────────────────────────────────────────────────────

export function createLogger(functionName) {
  return {
    /**
     * Log an informational message with structured metadata.
     */
    info(message, meta = {}) {
      const entry = {
        timestamp: new Date().toISOString(),
        level: 'info',
        function: functionName,
        requestId: meta.requestId || generateRequestId(),
        message,
        ...sanitizeObject(meta),
      }
      console.log(JSON.stringify(entry))
    },

    /**
     * Log a warning.
     */
    warn(message, meta = {}) {
      const entry = {
        timestamp: new Date().toISOString(),
        level: 'warn',
        function: functionName,
        requestId: meta.requestId || generateRequestId(),
        message,
        ...sanitizeObject(meta),
      }
      console.log(JSON.stringify(entry))
    },

    /**
     * Log an error.
     */
    error(message, meta = {}) {
      const entry = {
        timestamp: new Date().toISOString(),
        level: 'error',
        function: functionName,
        requestId: meta.requestId || generateRequestId(),
        message,
        ...sanitizeObject(meta),
      }
      console.log(JSON.stringify(entry))
    },
  }
}

// ─── Request ID generation ──────────────────────────────────────────────────

let _requestId = null

/**
 * Generates or returns the request ID for the current invocation.
 * Netlify reuses the module scope per invocation, so we reset it per handler call.
 */
export function generateRequestId() {
  if (!_requestId) {
    _requestId = crypto.randomUUID ? crypto.randomUUID() :
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
      })
  }
  return _requestId
}

/**
 * Resets the request ID for the next invocation.
 * Call this at the start of each handler.
 */
export function resetRequestId() {
  _requestId = null
  return generateRequestId()
}

// ─── Export shorthand ───────────────────────────────────────────────────────

export const log = {
  create: createLogger,
  sanitize,
  sanitizeObject,
}
