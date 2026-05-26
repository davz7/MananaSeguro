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
import { validateAmount, validateKyc, validateUserId } from './_lib/depositValidation.js'

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
// Formato: CODE:ISSUER — verificar en docs de Etherfuse para producción
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
    console.error('[etherfuse-deposit] Variables de entorno faltantes')
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

    validateUserId(usuarioId)
    montoMxn = validateAmount(body.montoMxn)
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
      .select('id, email, customer_id, bank_account_id, stellar_public_key, kyc_status, bank_account_status')
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
    try {
      validateKyc(usuario.kyc_status)
    } catch (err) {
      return {
        statusCode: 403,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: 'KYC pendiente',
          mensaje: 'Debes completar la verificación de identidad antes de depositar.',
          kycStatus: usuario.kyc_status,
        }),
      }
    }

    if (usuario.bank_account_status !== 'active') {
      return {
        statusCode: 403,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: 'Cuenta bancaria pendiente',
          mensaje: 'Tu cuenta bancaria aún está en verificación. Intenta en unos minutos.',
          bankAccountStatus: usuario.bank_account_status,
        }),
      }
    }

    // ── Paso 1: crear quote en Etherfuse ──────────────────────────────────
    // POST /ramp/quote — MXN → CETES en Stellar
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

    console.info('[etherfuse-deposit] Quote creado:', quoteId, '| Monto:', montoMxn, 'MXN')

    // ── Paso 2: crear orden en Etherfuse ──────────────────────────────────
    // POST /ramp/order — devuelve depositClabe (CLABE única por orden)
    const orderId = randomUUID()
    const orden = await llamarEtherfuse('/ramp/order', 'POST', {
      orderId,
      bankAccountId: usuario.bank_account_id,
      // Usamos publicKey directamente en lugar de cryptoWalletId
      // según docs: one or the other is required
      publicKey: usuario.stellar_public_key,
      quoteId: quote.quoteId || quoteId,
    })

    // La respuesta viene anidada bajo "onramp"
    const ordenData = orden.onramp || orden
    const depositClabe = ordenData.depositClabe

    if (!depositClabe) {
      throw new Error('Etherfuse no devolvió depositClabe')
    }

    console.info('[etherfuse-deposit] Orden creada:', orderId, '| CLABE:', depositClabe)

    // ── Paso 3: guardar orden en Supabase ─────────────────────────────────
    // Guardamos ANTES de responder al cliente — si el cliente cae, la orden
    // persiste y podemos recuperarla por webhook
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
      console.error('[etherfuse-deposit] Error al guardar orden:', errorOrden.message)
      // No es fatal — la orden existe en Etherfuse aunque falle Supabase
      // El webhook la recuperará cuando llegue el SPEI
    }

    // ── Respuesta al frontend ─────────────────────────────────────────────
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        orderId,
        // La CLABE a la que el usuario hace el SPEI — única por orden
        depositClabe,
        depositBankName: ordenData.depositBankName || 'STP',
        depositAccountHolder: ordenData.depositAccountHolder || 'Etherfuse MX',
        // El usuario debe transferir EXACTAMENTE este monto
        montoExactoMxn: montoMxn,
        // Cuánto CETES recibirá (estimado del quote)
        targetAmount: quote.targetAmount,
        // Fee de Etherfuse
        feeAmount: quote.feeAmount,
        // Estado inicial
        status: 'created',
        // Instrucción clara para el usuario
        instruccion: `Transfiere exactamente $${montoMxn.toLocaleString('es-MX')} MXN desde tu banco a la CLABE indicada. El monto debe ser exacto.`,
      }),
    }

  } catch (err) {
    console.error('[etherfuse-deposit] Error:', err.message)
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
