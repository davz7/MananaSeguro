// netlify/functions/order-status.js
import { createClient } from '@supabase/supabase-js'
import { createLogger, resetRequestId } from './_lib/logger.js'

const log = createLogger('order-status')

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function handler(event) {
  resetRequestId()
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' }
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Método no permitido' }) }

  const { orderId, usuarioId } = event.queryStringParameters || {}
  if (!orderId && !usuarioId) return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'orderId o usuarioId requerido' }) }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })

  if (orderId) {
    const { data, error } = await supabase.from('ordenes').select('order_id, status, monto_mxn, deposit_clabe, updated_at').eq('order_id', orderId).single()
    if (error || !data) {
      log.warn('Orden no encontrada', { orderId })
      return { statusCode: 404, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Orden no encontrada' }) }
    }
    log.info('Orden consultada', { orderId, status: data.status })
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ orderId: data.order_id, status: data.status, montoMxn: data.monto_mxn, updatedAt: data.updated_at }) }
  }

  const { data, error } = await supabase.from('ordenes').select('order_id, status, monto_mxn, deposit_clabe, created_at, updated_at').eq('usuario_id', usuarioId).order('created_at', { ascending: false })
  if (error) {
    log.error('Error consultando órdenes', { userId: usuarioId, error: error.message })
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: error.message }) }
  }

  const completadas = (data ?? []).filter(o => o.status === 'completed')
  const totalMxn = completadas.reduce((sum, o) => sum + Number(o.monto_mxn), 0)
  log.info('Órdenes consultadas', { userId: usuarioId, total: data.length, completadas: completadas.length })

  return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ ordenes: data ?? [], totalMxn, totalCompletadas: completadas.length }) }
}
