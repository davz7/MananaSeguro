// netlify/functions/etherfuse-deposit.js
//
// ─── ISO 25010 ───────────────────────────────────────────────────────────────
// Seguridad:      Verifica KYC aprobado antes de crear orden. Valida montos.
// Fiabilidad:     Timeout en llamadas externas. Guarda la orden en Supabase
//                 antes de responder — si el cliente cae, la orden persiste.
// Mantenibilidad: Helpers separados para quote y order. Errores descriptivos.
// Eficiencia:     Una sola transacción Supabase al final.
// Usabilidad:     Mensajes de error claros y accionables para el frontend.
// ─────────────────────────────────────────────────────────────────────────────
//
// Responsabilidad: crear una orden de depósito (quote + order) en Etherfuse
// y guardarla en Supabase. Devuelve la CLABE de depósito al frontend.
//
// Variables de entorno requeridas:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, ETHERFUSE_API_KEY, ETHERFUSE_ENV

import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { validateAmount, validateKyc, validateBankAccount, validateUserId } from './_lib/depositValidation.js'
import { createLogger, resetRequestId } from './_lib/logger.js'

const { MONTO_MINIMO_MXN, MONTO_MAXIMO_MXN } = await import('./_lib/depositValidation.js')

// ─── Logger ──────────────────────────────────────────────────────────────────

const log = createLogger('etherfuse-deposit')

// ─── Constantes ───────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const ETHERFUSE_BASE =
  process.env.ETHERFUSE_ENV === 'production'
    ? 'https://api.etherfuse.com'
    : 'https://api.sand.etherfuse.com'

const FETCH_TIMEOUT_MS = 10_000

// Identificador del activo CETES en Stellar
const CETES_ASSET_STELLAR = 'CETES:GC3CW7EDYRTWQ635VDIGY6S4ZUF5L6TQ7AA4MWS7LEQDBLUSZXV7UPS4'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchConTimeout(url, options, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(id)
  }
}

async function llamarEtherfuse(path, method, body) {
  const apiKey = process.env.ETHERFUSE_API_KEY
  if (!apiKey) throw new Error('ETHERFUSE_API_KEY no configurada')

  const res = await fetchConTimeout(`${ETHERFUSE_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': apiKey,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await res.json()

  if (!res.ok) {
    const msg = data?.message || data?.error || `HTTP ${res.status}`
    throw new Error(`Etherfuse: ${msg}`)
  }

  return data
}

// ─── Handler principal ────────────────────────────────────────────────────────

export async function handler(event) {
  resetRequestId()

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Método no permitido' }),
    }
  }

  // ── Validar env ───────────────────────────────────────────────────────────
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY || !process.env.ETHERFUSE_API_KEY) {
    log.error('Variables de entorno faltantes')
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Error de configuración del servidor' }),
    }
  }

  // ── Parsear y validar body ────────────────────────────────────────────────
  let usuarioId, montoMxn
  try {
    const body = JSON.parse(event.body || '{}')
    usuarioId = body.usuarioId
    montoMxn = Number(body.montoMxn)

    const userIdResult = validateUserId(usuarioId)
    if (!userIdResult.valid) throw new Error(userIdResult.error)

    const amountResult = validateAmount(montoMxn)
    if (!amountResult.valid) throw new Error(amountResult.error)
  } catch (err) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: err.message }),
    }
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    { auth: { persistSession: false } }
  )

  try {
    // ── Verificar usuario y estado de KYC ────────────────────────────────
    const { data: usuario, error: errorUsuario } = await supabase
      .from('usuarios')
      .select('id, customer_id, bank_account_id, stellar_public_key, kyc_status, bank_account_status')
      .eq('id', usuarioId)
      .single()

    if (errorUsuario || !usuario) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Usuario no encontrado' }),
      }
    }

    // ── Seguridad: bloquear depósito si KYC no está aprobado ─────────────
    const kycResult = validateKyc(usuario.kyc_status)
    if (!kycResult.valid) {
      log.warn('KYC no aprobado', { userId: usuarioId, kycStatus: usuario.kyc_status })
      return { statusCode: 403, headers: CORS_HEADERS, body: JSON.stringify(kycResult) }
    }

    const bankResult = validateBankAccount(usuario.bank_account_status)
    if (!bankResult.valid) {
      log.warn('Cuenta bancaria no activa', { userId: usuarioId, bankStatus: usuario.bank_account_status })
      return { statusCode: 403, headers: CORS_HEADERS, body: JSON.stringify(bankResult) }
    }

    // ── Paso 1: crear quote en Etherfuse ──────────────────────────────────
    const quoteId = randomUUID()
    const quote = await llamarEtherfuse('/ramp/quote', 'POST', {
      quoteId,
      customerId: usuario.customer_id,
      blockchain: 'stellar',
      quoteAssets: {
        type: 'onramp',
        sourceAsset: 'MXN',
        targetAsset: CETES_ASSET_STELLAR,
      },
      sourceAmount: String(montoMxn),
      walletAddress: usuario.stellar_public_key,
    })

    log.info('Quote creado', { quoteId, montoMxn })

    // ── Paso 2: crear orden en Etherfuse ──────────────────────────────────
    const orderId = randomUUID()
    const orden = await llamarEtherfuse('/ramp/order', 'POST', {
      orderId,
      bankAccountId: usuario.bank_account_id,
      publicKey: usuario.stellar_public_key,
      quoteId: quote.quoteId || quoteId,
    })

    const ordenData = orden.onramp || orden
    const depositClabe = ordenData.depositClabe

    if (!depositClabe) {
      throw new Error('Etherfuse no devolvió depositClabe')
    }

    log.info('Orden creada', { orderId })

    // ── Paso 3: guardar orden en Supabase ─────────────────────────────────
    const { error: errorOrden } = await supabase
      .from('ordenes')
      .insert({
        usuario_id: usuarioId,
        order_id: orderId,
        monto_mxn: montoMxn,
        deposit_clabe: depositClabe,
        status: 'created',
        etherfuse_quote_id: quote.quoteId || quoteId,
      })

    if (errorOrden) {
      log.error('Error al guardar orden', { orderId, error: errorOrden.message })
    }

    // ── Respuesta al frontend ─────────────────────────────────────────────
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        orderId,
        depositClabe,
        depositBankName: ordenData.depositBankName || 'STP',
        depositAccountHolder: ordenData.depositAccountHolder || 'Etherfuse MX',
        montoExactoMxn: montoMxn,
        targetAmount: quote.targetAmount,
        feeAmount: quote.feeAmount,
        status: 'created',
        instruccion: `Transfiere exactamente $${montoMxn.toLocaleString('es-MX')} MXN desde tu banco a la CLABE indicada. El monto debe ser exacto.`,
      }),
    }

  } catch (err) {
    log.error('Error inesperado', { error: err.message })
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: 'No se pudo crear la orden de depósito',
        detalle: process.env.ETHERFUSE_ENV === 'sandbox' ? err.message : undefined,
      }),
    }
  }
}
