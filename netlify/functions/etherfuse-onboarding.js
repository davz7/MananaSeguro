// netlify/functions/etherfuse-onboarding.js
import { createClient } from '@supabase/supabase-js'
import { createLogger, resetRequestId } from './_lib/logger.js'

const log = createLogger('etherfuse-onboarding')

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const ETHERFUSE_BASE = process.env.ETHERFUSE_ENV === 'production' ? 'https://api.etherfuse.com' : 'https://api.sand.etherfuse.com'
const FETCH_TIMEOUT_MS = 10_000

async function fetchConTimeout(url, options, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try { return await fetch(url, { ...options, signal: controller.signal }) } finally { clearTimeout(timeoutId) }
}

async function llamarEtherfuse(path, method, body) {
  const apiKey = process.env.ETHERFUSE_API_KEY
  if (!apiKey) throw new Error('ETHERFUSE_API_KEY no configurada')
  const res = await fetchConTimeout(`${ETHERFUSE_BASE}${path}`, { method, headers: { 'Content-Type': 'application/json', 'Authorization': apiKey }, body: body ? JSON.stringify(body) : undefined })
  const data = await res.json()
  if (!res.ok) throw new Error(`Etherfuse error: ${data?.message || data?.error || `HTTP ${res.status}`}`)
  return data
}

export async function handler(event) {
  resetRequestId()
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Método no permitido' }) }

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY, ETHERFUSE_API_KEY } = process.env
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !ETHERFUSE_API_KEY) {
    log.error('Variables de entorno faltantes')
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Error de configuración del servidor' }) }
  }

  let usuarioId
  try {
    const body = JSON.parse(event.body || '{}')
    usuarioId = body.usuarioId
    if (!usuarioId) throw new Error('usuarioId requerido')
  } catch (err) { return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: `Body inválido: ${err.message}` }) } }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })

  try {
    const { data: usuario, error } = await supabase.from('usuarios').select('*').eq('id', usuarioId).single()
    if (error || !usuario) return { statusCode: 404, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Usuario no encontrado' }) }

    if (usuario.kyc_status === 'approved' && usuario.bank_account_status === 'active') {
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ yaCompletado: true, kycStatus: usuario.kyc_status, bankAccountStatus: usuario.bank_account_status, mensaje: 'El usuario ya completó el onboarding' }) }
    }

    const etherfuseRes = await llamarEtherfuse('/ramp/onboarding-url', 'POST', {
      customerId: usuario.customer_id, bankAccountId: usuario.bank_account_id, publicKey: usuario.stellar_public_key, blockchain: 'stellar', userInfo: { email: usuario.email, displayName: usuario.nombre }, redirectUrl: `${process.env.WEBHOOK_URL}/dashboard`
    })

    if (!etherfuseRes.presigned_url) throw new Error('Etherfuse no devolvió presigned_url')
    log.info('URL generada', { userId: usuarioId, email: usuario.email })

    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ onboardingUrl: etherfuseRes.presigned_url, expiraEn: new Date(Date.now() + 15 * 60 * 1000).toISOString(), kycStatus: usuario.kyc_status }) }
  } catch (err) {
    log.error('Error al generar URL de onboarding', { error: err.message })
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: `Error al generar URL de onboarding: ${err.message}` }) }
  }
}
