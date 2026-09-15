// netlify/functions/order-status.js
// Consulta el estado de órdenes en Supabase
// Soporta dos modos:
//   ?orderId=xxx  → estado de una orden específica (polling del DepositFlow)
//   sin parámetro → todas las órdenes del usuario autenticado (dashboard)
//
// La identidad sale del token de sesión. El parámetro usuarioId fue
// eliminado. La consulta por orderId también filtra por usuario: antes
// cualquiera con un orderId veía monto y CLABE de la orden de otro.

import { createClient } from '@supabase/supabase-js'
import { createLogger, errorBody } from './_lib/logger.js'
import { withSession } from './_lib/session.js'

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

async function handlerConSesion(event, usuarioId) {
  const log = createLogger('order-status')

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: CORS_HEADERS, body: errorBody(log, 'Método no permitido') }
  }

  const { orderId } = event.queryStringParameters || {}

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    { auth: { persistSession: false } }
  )

  //  Modo 1: consulta por orderId 
  if (orderId) {
    log.info('Consulta por orderId', { orderId })
    const { data, error } = await supabase
      .from('ordenes')
      .select('order_id, status, monto_mxn, deposit_clabe, updated_at')
      .eq('order_id', orderId)
      // Filtro de propiedad: sin él, cualquier sesión válida podría
      // consultar la orden de otro usuario conociendo su orderId.
      .eq('usuario_id', usuarioId)
      .single()

    if (error || !data) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: errorBody(log, 'Orden no encontrada'),
      }
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        orderId: data.order_id,
        status: data.status,
        montoMxn: data.monto_mxn,
        updatedAt: data.updated_at,
      }),
    }
  }

  //  Modo 2: consulta por usuarioId 
  log.info('Consulta por usuarioId', { usuarioId })
  const { data, error } = await supabase
    .from('ordenes')
    .select('order_id, status, monto_mxn, deposit_clabe, created_at, updated_at')
    .eq('usuario_id', usuarioId)
    .order('created_at', { ascending: false })

  if (error) {
    log.error('Error consultando órdenes', { usuarioId, detail: error.message })
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: errorBody(log, error.message),
    }
  }

  // Calcular totales
  const completadas = (data ?? []).filter(o => o.status === 'completed')
  const totalMxn = completadas.reduce((sum, o) => sum + Number(o.monto_mxn), 0)

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      ordenes: data ?? [],
      totalMxn,
      totalCompletadas: completadas.length,
    }),
  }
}

export async function handler(event, context) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' }
  }
  return withSession(handlerConSesion)(event, context)
}