// Prepara la cuenta testnet del usuario de la sesión (T03).
//
// POST /api/cuenta/preparar   (sin cuerpo)
//
// La app lo llama después del primer login. Es idempotente por usuario:
// llamarlo de nuevo, tras éxito, devuelve el mismo resultado con
// `replayed: true` y no mueve fondos.
//
// Variables de entorno requeridas:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY
//   SESSION_SIGNING_KEY
//   KMS_CUSTODY_KEY_ID, MS_AWS_* (ver _lib/custody.js)
//   STELLAR_NETWORK_PASSPHRASE = passphrase de testnet (obligatoria: sin ella
//                                el endpoint se niega a operar)
//   SOROBAN_RPC_URL (opcional; si se define, debe ser un RPC de testnet)

import { createClient } from '@supabase/supabase-js'
import * as StellarSdk from '@stellar/stellar-sdk'
import { createLogger } from './_lib/logger.js'
import { withSession } from './_lib/session.js'
import { withSeed } from './_lib/custody.js'
import {
  crearRepoSupabase,
  FondeoError,
  HORIZON_TESTNET,
  prepararCuenta,
} from './_lib/fondeoTestnet.js'

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export const HTTP_POR_CODIGO = {
  IN_PROGRESS: 409,
  ACCOUNT_NOT_FOUND: 404,
  ACCOUNT_DEACTIVATED: 403,
  KEY_DESTROYED: 403,
  NETWORK_NOT_TESTNET: 503,
  TREASURY_NOT_CONFIGURED: 503,
  TREASURY_LOW: 503,
  SUBMISSION_FAILED: 502,
  TIMEOUT: 504,
  INTERNAL: 500,
}

const MENSAJES = {
  IN_PROGRESS: 'Tu cuenta se está preparando. Espera un momento.',
  ACCOUNT_NOT_FOUND: 'No encontramos la cuenta.',
  ACCOUNT_DEACTIVATED: 'Esta cuenta está dada de baja.',
  KEY_DESTROYED: 'Esta cuenta ya no puede operar.',
  // Los tres de configuración se muestran igual al usuario: no es algo que
  // pueda resolver él y no conviene revelar el detalle.
  NETWORK_NOT_TESTNET: 'La preparación de cuentas no está disponible en este momento.',
  TREASURY_NOT_CONFIGURED: 'La preparación de cuentas no está disponible en este momento.',
  TREASURY_LOW: 'La preparación de cuentas no está disponible en este momento.',
  SUBMISSION_FAILED: 'No se pudo completar en la red. Puedes reintentar.',
  TIMEOUT: 'No se confirmó a tiempo. Estamos verificando; reintenta en un momento.',
  INTERNAL: 'Ocurrió un error inesperado.',
}

function respuesta(statusCode, cuerpo) {
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify(cuerpo) }
}

function error(codigo) {
  return respuesta(HTTP_POR_CODIGO[codigo] ?? 500, {
    ok: false,
    code: codigo,
    message: MENSAJES[codigo] ?? MENSAJES.INTERNAL,
  })
}

/** Dependencias reales. Se exporta para poder sustituirlas en pruebas. */
export function dependenciasReales() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  })
  return {
    repo: crearRepoSupabase(supabase),
    horizon: new StellarSdk.Horizon.Server(HORIZON_TESTNET),
    rpc: new StellarSdk.rpc.Server(
      process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org'
    ),
    fetchImpl: fetch,
    withSeed,
  }
}

export function crearHandler(obtenerDependencias = dependenciasReales) {
  async function handlerConSesion(event, usuarioId) {
    const log = createLogger('cuenta-preparar')

    if (event.httpMethod !== 'POST') {
      return respuesta(405, { ok: false, code: 'INTERNAL' })
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      log.error('Variables de Supabase no configuradas')
      return error('INTERNAL')
    }

    try {
      const r = await prepararCuenta(usuarioId, { ...obtenerDependencias(), log })
      return respuesta(200, r)
    } catch (err) {
      const codigo = err instanceof FondeoError ? err.code : 'INTERNAL'
      if (HTTP_POR_CODIGO[codigo] >= 500) {
        log.error('Preparación de cuenta fallida', { code: codigo, detail: err?.message })
      } else {
        log.warn('Preparación de cuenta no completada', { code: codigo })
      }
      return error(codigo)
    }
  }

  return async function handler(event, context) {
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 200, headers: CORS_HEADERS, body: '' }
    }
    return withSession(handlerConSesion)(event, context)
  }
}

export const handler = crearHandler()
