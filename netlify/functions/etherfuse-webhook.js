// netlify/functions/etherfuse-webhook.js
import { createClient } from '@supabase/supabase-js'
import { createHmac, timingSafeEqual } from 'crypto'
import { createLogger, resetRequestId } from './_lib/logger.js'

const log = createLogger('etherfuse-webhook')

const CORS_HEADERS = { 'Content-Type': 'application/json' }

function verificarFirma(body, firmaRecibida, secreto) {
  if (!firmaRecibida || !secreto) return false
  try {
    const firmaEsperada = createHmac('sha256', secreto).update(body, 'utf8').digest('hex')
    return timingSafeEqual(Buffer.from(firmaEsperada, 'hex'), Buffer.from(firmaRecibida, 'hex'))
  } catch { return false }
}

async function handleKycUpdated(payload, supabase) {
  const { customerId, kycStatus, bankAccountStatus } = payload
  if (!customerId) { log.warn('kyc_updated sin customerId'); return }

  const updates = { kyc_status: kycStatus, updated_at: new Date().toISOString() }
  if (bankAccountStatus) updates.bank_account_status = bankAccountStatus

  const { error } = await supabase.from('usuarios').update(updates).eq('customer_id', customerId)
  if (error) log.error('Error actualizando KYC', { customerId, error: error.message })
  else log.info('KYC actualizado', { customerId, kycStatus })
}

async function handleOrderUpdated(payload, supabase) {
  const { orderId, status, stellarClaimTransaction } = payload
  if (!orderId) { log.warn('order_updated sin orderId'); return }

  const updates = { status, updated_at: new Date().toISOString() }
  if (stellarClaimTransaction) updates.stellar_claim_transaction = stellarClaimTransaction

  const { error } = await supabase.from('ordenes').update(updates).eq('order_id', orderId)
  if (error) log.error('Error actualizando orden', { orderId, error: error.message })
  else log.info('Orden actualizada', { orderId, status })
}

export async function handler(event) {
  resetRequestId()
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Método no permitido' }) }

  const firma = event.headers['x-signature'] || event.headers['X-Signature']
  const secreto1 = process.env.WEBHOOK_SECRET
  const secreto2 = process.env.WEBHOOK_SECRET_2

  if (!secreto1) { log.error('WEBHOOK_SECRET no configurado'); return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Error de configuración' }) } }

  const bodyRaw = event.body || ''
  const firmaValida = verificarFirma(bodyRaw, firma, secreto1) || (secreto2 && verificarFirma(bodyRaw, firma, secreto2))

  if (!firmaValida) { log.warn('Firma inválida'); return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Firma inválida' }) } }

  let payload
  try { payload = JSON.parse(bodyRaw) } catch { return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Body inválido' }) } }

  const { type, data } = payload
  if (!type) return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Falta campo "type"' }) }

  log.info('Evento recibido', { type })

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })

  try {
    switch (type) {
      case 'kyc_updated': await handleKycUpdated(data || payload, supabase); break
      case 'order_updated': await handleOrderUpdated(data || payload, supabase); break
      default: log.info('Evento no manejado', { type })
    }
  } catch (err) { log.error('Error procesando evento', { type, error: err.message }) }

  return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ received: true }) }
}
