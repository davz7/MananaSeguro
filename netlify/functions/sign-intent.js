// Firma custodial de intenciones Soroban.
//
// Variables de entorno requeridas:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY
//   SESSION_SIGNING_KEY
//   KMS_CUSTODY_KEY_ID, MS_AWS_* (ver _lib/custody.js)
//
// Seguridad:  la identidad sale del token de sesión. El cuerpo solo aporta
//             la intención y la clave de idempotencia; un usuarioId o un
//             address en el cuerpo se ignoran por completo.

import { createClient } from '@supabase/supabase-js'
import { createLogger, errorBody } from './_lib/logger.js'
import { withSession } from './_lib/session.js'
import { ejecutarIntent, IntentError } from './_lib/soroban.js'
import { assertPuedeOperar, CuentaInactivaError } from './_lib/cuenta.js'

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// Mapa de código de error a estado HTTP. La lista es la misma que recibió
// el frontend en el contrato de la interfaz de firma.
const HTTP_POR_CODIGO = {
  INVALID_INTENT: 400,
  INSUFFICIENT_BALANCE: 400,
  AMOUNT_BELOW_MINIMUM: 400,
  TRUSTLINE_MISSING: 409,
  LOCK_ACTIVE: 409,
  LOAN_NOT_ELIGIBLE: 409,
  IN_PROGRESS: 409,
  ACCOUNT_DEACTIVATED: 403,
  KEY_DESTROYED: 403,
  ACCOUNT_NOT_FOUND: 404,
  SIMULATION_FAILED: 422,
  RATE_LIMITED: 429,
  SUBMISSION_FAILED: 502,
  TIMEOUT: 504,
  INTERNAL: 500,
}

const MENSAJES = {
  INVALID_INTENT: 'La operación solicitada no es válida.',
  INSUFFICIENT_BALANCE: 'Saldo insuficiente para completar la operación.',
  AMOUNT_BELOW_MINIMUM: 'El monto es menor al mínimo permitido.',
  TRUSTLINE_MISSING: 'Tu cuenta aún no está lista para recibir este activo.',
  LOCK_ACTIVE: 'Tus fondos siguen bloqueados hasta la fecha de retiro.',
  LOAN_NOT_ELIGIBLE: 'No cumples las condiciones para este préstamo.',
  IN_PROGRESS: 'Esta operación ya se está procesando.',
  ACCOUNT_DEACTIVATED: 'Esta cuenta está dada de baja.',
  KEY_DESTROYED: 'Esta cuenta ya no puede operar.',
  ACCOUNT_NOT_FOUND: 'No encontramos la cuenta.',
  SIMULATION_FAILED: 'La operación fue rechazada. Revisa los datos e intenta de nuevo.',
  RATE_LIMITED: 'Demasiadas operaciones seguidas. Espera un momento.',
  SUBMISSION_FAILED: 'No se pudo enviar la operación a la red. Puedes reintentar.',
  TIMEOUT: 'La operación no se confirmó a tiempo. Estamos verificando su estado.',
  INTERNAL: 'Ocurrió un error inesperado.',
}

const LIMITE_POR_MINUTO = 10
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function respuesta(statusCode, cuerpo) {
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify(cuerpo) }
}

function error(codigo, detalle) {
  return respuesta(HTTP_POR_CODIGO[codigo] ?? 500, {
    ok: false,
    code: codigo,
    message: MENSAJES[codigo] ?? MENSAJES.INTERNAL,
    ...(detalle ? { detail: detalle } : {}),
  })
}

async function handlerConSesion(event, usuarioId) {
  const log = createLogger('sign-intent')

  if (event.httpMethod !== 'POST') {
    return respuesta(405, { ok: false, code: 'INVALID_INTENT' })
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    log.error('Variables de Supabase no configuradas')
    return error('INTERNAL')
  }

  let intent, idempotencyKey
  try {
    const body = JSON.parse(event.body || '{}')
    intent = body.intent
    idempotencyKey = body.idempotencyKey
  } catch {
    return error('INVALID_INTENT', 'Cuerpo malformado')
  }

  if (!idempotencyKey || !UUID.test(idempotencyKey)) {
    return error('INVALID_INTENT', 'idempotencyKey debe ser un UUID')
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  })

  //  Reclamar la clave de idempotencia 
  //
  // El insert es la operación que reclama: la clave primaria garantiza que
  // solo una petición gane, incluso si llegan dos a la vez. Comprobar
  // primero y luego insertar dejaría una ventana entre ambas.
  const { error: errorReclamo } = await supabase.from('intentos_firma').insert({
    idempotency_key: idempotencyKey,
    usuario_id: usuarioId,
    intent_type: intent?.type ?? 'desconocido',
    estado: 'en_proceso',
  })

  if (errorReclamo) {
    // 23505 = violación de unicidad: la clave ya existe.
    if (errorReclamo.code !== '23505') {
      log.error('Error al reclamar idempotencyKey', { detail: errorReclamo.message })
      return error('INTERNAL')
    }

    const { data: previo } = await supabase
      .from('intentos_firma')
      .select('estado, tx_hash, error_code, intent_type')
      .eq('idempotency_key', idempotencyKey)
      // Acotado al usuario: sin esto, alguien podría sondear claves ajenas
      // y deducir qué operaciones hizo otra persona.
      .eq('usuario_id', usuarioId)
      .single()

    if (!previo) return error('INVALID_INTENT', 'idempotencyKey en uso')

    if (previo.estado === 'completado') {
      log.info('Reintento idempotente', { idempotencyKey })
      return respuesta(200, {
        ok: true,
        transactionHash: previo.tx_hash,
        intentType: previo.intent_type,
        replayed: true,
      })
    }
    if (previo.estado === 'fallido') return error(previo.error_code)
    return error('IN_PROGRESS')
  }

  //  Límite de tasa 
  const desde = new Date(Date.now() - 60_000).toISOString()
  const { count } = await supabase
    .from('intentos_firma')
    .select('idempotency_key', { count: 'exact', head: true })
    .eq('usuario_id', usuarioId)
    .gte('created_at', desde)

  if (count != null && count > LIMITE_POR_MINUTO) {
    await marcarFallido(supabase, idempotencyKey, 'RATE_LIMITED')
    return error('RATE_LIMITED')
  }

  //  Cargar al usuario con su material de custodia 
  const { data: usuario, error: errorUsuario } = await supabase
    .from('usuarios')
    .select('*')
    .eq('id', usuarioId)
    .single()

  if (errorUsuario || !usuario) {
    await marcarFallido(supabase, idempotencyKey, 'ACCOUNT_NOT_FOUND')
    return error('ACCOUNT_NOT_FOUND')
  }

  // Una cuenta dada de baja o con su material destruido no firma, aunque
  // presente un token válido emitido antes de la baja.
  try {
    assertPuedeOperar(usuario)
  } catch (err) {
    if (err instanceof CuentaInactivaError) {
      await marcarFallido(supabase, idempotencyKey, err.code)
      return error(err.code)
    }
    throw err
  }

  //  Ejecutar 
  try {
    const { hash, intentType } = await ejecutarIntent(intent, usuario)

    await supabase
      .from('intentos_firma')
      .update({ estado: 'completado', tx_hash: hash, updated_at: new Date().toISOString() })
      .eq('idempotency_key', idempotencyKey)

    log.info('Intención firmada', { idempotencyKey, intentType })
    return respuesta(200, { ok: true, transactionHash: hash, intentType })
  } catch (err) {
    const codigo = err instanceof IntentError ? err.code : 'INTERNAL'

    // TIMEOUT es distinto: la transacción PUEDE haberse aplicado. Se deja
    // en proceso, no como fallida, para que un reintento con la misma
    // clave no vuelva a firmar mientras el estado real se resuelve.
    if (codigo !== 'TIMEOUT') {
      await marcarFallido(supabase, idempotencyKey, codigo)
    }

    log.warn('Intención no completada', { idempotencyKey, code: codigo })
    return error(codigo)
  }
}

async function marcarFallido(supabase, idempotencyKey, codigo) {
  await supabase
    .from('intentos_firma')
    .update({
      estado: 'fallido',
      error_code: codigo,
      updated_at: new Date().toISOString(),
    })
    .eq('idempotency_key', idempotencyKey)
}

export async function handler(event, context) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' }
  }
  return withSession(handlerConSesion)(event, context)
}