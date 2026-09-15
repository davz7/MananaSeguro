// Variables de entorno requeridas:
//   SUPABASE_URL          → URL del proyecto Supabase
//   SUPABASE_SERVICE_KEY  → service_role key
//   ETHERFUSE_API_KEY     → API key de Etherfuse
//   ETHERFUSE_ENV         → 'sandbox' | 'production'
//   WEBHOOK_URL           → URL pública del webhook (ngrok en dev, netlify en prod)

import { createClient } from '@supabase/supabase-js'
import { createLogger, errorBody } from './_lib/logger.js'
import { withSession } from './_lib/session.js'

//  Constantes 

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const ETHERFUSE_BASE =
  process.env.ETHERFUSE_ENV === 'production'
    ? 'https://api.etherfuse.com'
    : 'https://api.sand.etherfuse.com'

// Timeout para llamadas externas  ISO 25010 Eficiencia
const FETCH_TIMEOUT_MS = 10_000

//  Helper: fetch con timeout 

async function fetchConTimeout(url, options, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    return res
  } finally {
    clearTimeout(timeoutId)
  }
}

//  Helper: llamar a Etherfuse 

async function llamarEtherfuse(path, method, body) {
  const apiKey = process.env.ETHERFUSE_API_KEY
  if (!apiKey) throw new Error('ETHERFUSE_API_KEY no configurada')

  const res = await fetchConTimeout(
    `${ETHERFUSE_BASE}${path}`,
    {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiKey, // sin prefijo Bearer  docs de Etherfuse
      },
      body: body ? JSON.stringify(body) : undefined,
    }
  )

  const data = await res.json()

  if (!res.ok) {
    const msg = data?.message || data?.error || `HTTP ${res.status}`
    throw new Error(`Etherfuse error: ${msg}`)
  }

  return data
}

//  Handler principal 

async function handlerConSesion(event, usuarioId) {
  const log = createLogger('etherfuse-onboarding')

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: errorBody(log, 'Método no permitido'),
    }
  }

  //  Validar env 
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY, ETHERFUSE_API_KEY, WEBHOOK_URL } = process.env

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !ETHERFUSE_API_KEY) {
    log.error('Variables de entorno faltantes')
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: errorBody(log, 'Error de configuración del servidor'),
    }
  }

  // El usuarioId sale del token de sesión. Antes se leía del cuerpo, lo
  // que permitía generar la URL de onboarding KYC de cualquier usuario
  // conociendo su id.

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  })

  try {
    //  Obtener usuario de Supabase 
    const { data: usuario, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', usuarioId)
      .single()

    if (error || !usuario) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: errorBody(log, 'Usuario no encontrado'),
      }
    }

    //  Optimización: si ya tiene KYC aprobado, no re-onboardear 
    if (usuario.kyc_status === 'approved' && usuario.bank_account_status === 'active') {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          yaCompletado: true,
          kycStatus: usuario.kyc_status,
          bankAccountStatus: usuario.bank_account_status,
          mensaje: 'El usuario ya completó el onboarding',
        }),
      }
    }

    //  Generar URL de onboarding en Etherfuse ─
    // POST /ramp/onboarding-url  documentación Etherfuse
    const etherfuseRes = await llamarEtherfuse('/ramp/onboarding-url', 'POST', {
      customerId: usuario.customer_id,
      bankAccountId: usuario.bank_account_id,
      publicKey: usuario.stellar_public_key,
      blockchain: 'stellar',
      userInfo: {
        email: usuario.email,
        displayName: usuario.nombre,
      },
      // redirectUrl: URL a la que Etherfuse redirige al usuario al terminar
      redirectUrl: `${WEBHOOK_URL}/dashboard`,
    })

    if (!etherfuseRes.presigned_url) {
      throw new Error('Etherfuse no devolvió presigned_url')
    }

    log.info('URL de onboarding generada', { usuarioId })

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        onboardingUrl: etherfuseRes.presigned_url,
        // El usuario tiene 15 minutos para completar el onboarding
        expiraEn: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        kycStatus: usuario.kyc_status,
      }),
    }

  } catch (err) {
    log.error('Error generando onboarding', { detail: err.message })
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: errorBody(log, `Error al generar URL de onboarding: ${err.message}`),
    }
  }
}

export async function handler(event, context) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' }
  }
  return withSession(handlerConSesion)(event, context)
}