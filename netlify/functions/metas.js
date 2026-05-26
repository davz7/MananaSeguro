// netlify/functions/metas.js
import { createClient } from '@supabase/supabase-js'
import { createLogger, resetRequestId } from './_lib/logger.js'

const log = createLogger('metas')

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const NOMBRES_VALIDOS_MAX = 60
const MONTO_MIN = 1000
const MONTO_MAX = 50_000_000
const ANOS_MIN = 1
const ANOS_MAX = 40
const AHORRO_MIN = 40
const AHORRO_MAX = 100_000

function validarMeta({ nombre, monto_objetivo_mxn, ahorro_mensual_mxn, anos_al_retiro }) {
  if (!nombre || typeof nombre !== 'string' || nombre.trim().length === 0) return 'El nombre de la meta es requerido'
  if (nombre.length > NOMBRES_VALIDOS_MAX) return `El nombre no puede exceder ${NOMBRES_VALIDOS_MAX} caracteres`
  if (!monto_objetivo_mxn || Number(monto_objetivo_mxn) < MONTO_MIN) return `El monto objetivo mínimo es $${MONTO_MIN.toLocaleString('es-MX')} MXN`
  if (Number(monto_objetivo_mxn) > MONTO_MAX) return `El monto objetivo máximo es $${MONTO_MAX.toLocaleString('es-MX')} MXN`
  if (!ahorro_mensual_mxn || Number(ahorro_mensual_mxn) < AHORRO_MIN) return `El ahorro mensual mínimo es $${AHORRO_MIN} MXN`
  if (Number(ahorro_mensual_mxn) > AHORRO_MAX) return `El ahorro mensual máximo es $${AHORRO_MAX.toLocaleString('es-MX')} MXN`
  if (!anos_al_retiro || Number(anos_al_retiro) < ANOS_MIN || Number(anos_al_retiro) > ANOS_MAX) return `Los años al retiro deben estar entre ${ANOS_MIN} y ${ANOS_MAX}`
  return null
}

function getSupabase() {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) throw new Error('Variables de Supabase no configuradas')
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })
}

async function handleGet(event) {
  const { usuarioId } = event.queryStringParameters || {}
  if (!usuarioId) return { statusCode: 400, body: JSON.stringify({ error: 'usuarioId requerido' }) }

  const supabase = getSupabase()
  const { data, error } = await supabase.from('metas').select('id, nombre, descripcion, monto_objetivo_mxn, ahorro_mensual_mxn, anos_al_retiro, es_principal, created_at, updated_at').eq('usuario_id', usuarioId).order('created_at', { ascending: true })
  if (error) throw new Error(error.message)

  log.info('Metas listadas', { userId: usuarioId, count: data?.length ?? 0 })
  return { statusCode: 200, body: JSON.stringify({ metas: data ?? [] }) }
}

async function handlePost(event) {
  const body = JSON.parse(event.body || '{}')
  const { usuarioId, nombre, descripcion, monto_objetivo_mxn, ahorro_mensual_mxn, anos_al_retiro } = body

  if (!usuarioId) return { statusCode: 400, body: JSON.stringify({ error: 'usuarioId requerido' }) }
  const errorValidacion = validarMeta({ nombre, monto_objetivo_mxn, ahorro_mensual_mxn, anos_al_retiro })
  if (errorValidacion) return { statusCode: 400, body: JSON.stringify({ error: errorValidacion }) }

  const supabase = getSupabase()
  const { count } = await supabase.from('metas').select('id', { count: 'exact', head: true }).eq('usuario_id', usuarioId)
  const esPrincipal = (count ?? 0) === 0

  const { data, error } = await supabase.from('metas').insert({
    usuario_id: usuarioId, nombre: nombre.trim(), descripcion: descripcion?.trim() || null, monto_objetivo_mxn: Number(monto_objetivo_mxn), ahorro_mensual_mxn: Number(ahorro_mensual_mxn), anos_al_retiro: Number(anos_al_retiro), es_principal: esPrincipal
  }).select().single()

  if (error) {
    if (error.code === '23505') return { statusCode: 409, body: JSON.stringify({ error: 'Ya existe una meta principal para este usuario' }) }
    throw new Error(error.message)
  }

  log.info('Meta creada', { userId: usuarioId, metaId: data?.id, nombre })
  return { statusCode: 201, body: JSON.stringify({ meta: data }) }
}

async function handlePatch(event) {
  const { id } = event.queryStringParameters || {}
  if (!id) return { statusCode: 400, body: JSON.stringify({ error: 'id de meta requerido' }) }

  const body = JSON.parse(event.body || '{}')
  const { usuarioId, nombre, descripcion, monto_objetivo_mxn, ahorro_mensual_mxn, anos_al_retiro } = body
  if (!usuarioId) return { statusCode: 400, body: JSON.stringify({ error: 'usuarioId requerido' }) }

  const updates = {}
  if (nombre !== undefined) {
    if (!nombre || nombre.trim().length === 0) return { statusCode: 400, body: JSON.stringify({ error: 'El nombre no puede estar vacío' }) }
    if (nombre.length > NOMBRES_VALIDOS_MAX) return { statusCode: 400, body: JSON.stringify({ error: `Nombre máximo ${NOMBRES_VALIDOS_MAX} caracteres` }) }
    updates.nombre = nombre.trim()
  }
  if (descripcion !== undefined) updates.descripcion = descripcion?.trim() || null
  if (monto_objetivo_mxn !== undefined) {
    const m = Number(monto_objetivo_mxn)
    if (m < MONTO_MIN || m > MONTO_MAX) return { statusCode: 400, body: JSON.stringify({ error: `Monto entre $${MONTO_MIN} and $${MONTO_MAX} MXN` }) }
    updates.monto_objetivo_mxn = m
  }
  if (ahorro_mensual_mxn !== undefined) {
    const a = Number(ahorro_mensual_mxn)
    if (a < AHORRO_MIN || a > AHORRO_MAX) return { statusCode: 400, body: JSON.stringify({ error: `Ahorro entre $${AHORRO_MIN} and $${AHORRO_MAX} MXN` }) }
    updates.ahorro_mensual_mxn = a
  }
  if (anos_al_retiro !== undefined) {
    const y = Number(anos_al_retiro)
    if (y < ANOS_MIN || y > ANOS_MAX) return { statusCode: 400, body: JSON.stringify({ error: `Años entre ${ANOS_MIN} and ${ANOS_MAX}` }) }
    updates.anos_al_retiro = y
  }

  if (Object.keys(updates).length === 0) return { statusCode: 400, body: JSON.stringify({ error: 'No hay campos para actualizar' }) }

  const supabase = getSupabase()
  const { data: metaExistente, error: errorBusqueda } = await supabase.from('metas').select('id, usuario_id').eq('id', id).eq('usuario_id', usuarioId).single()
  if (errorBusqueda || !metaExistente) return { statusCode: 404, body: JSON.stringify({ error: 'Meta no encontrada' }) }

  const { data, error } = await supabase.from('metas').update(updates).eq('id', id).select().single()
  if (error) throw new Error(error.message)

  log.info('Meta actualizada', { userId: usuarioId, metaId: id })
  return { statusCode: 200, body: JSON.stringify({ meta: data }) }
}

async function handleDelete(event) {
  const { id } = event.queryStringParameters || {}
  const body = JSON.parse(event.body || '{}')
  const { usuarioId } = body

  if (!id || !usuarioId) return { statusCode: 400, body: JSON.stringify({ error: 'id y usuarioId requeridos' }) }

  const supabase = getSupabase()
  const { data: meta, error: errorBusqueda } = await supabase.from('metas').select('id, usuario_id, es_principal').eq('id', id).eq('usuario_id', usuarioId).single()
  if (errorBusqueda || !meta) return { statusCode: 404, body: JSON.stringify({ error: 'Meta no encontrada' }) }

  const { count } = await supabase.from('metas').select('id', { count: 'exact', head: true }).eq('usuario_id', usuarioId)
  if ((count ?? 0) <= 1) return { statusCode: 409, body: JSON.stringify({ error: 'No puedes eliminar tu única meta. Crea otra primero.' }) }

  if (meta.es_principal) {
    const { data: siguiente } = await supabase.from('metas').select('id').eq('usuario_id', usuarioId).neq('id', id).order('created_at', { ascending: true }).limit(1).single()
    if (siguiente) await supabase.from('metas').update({ es_principal: true }).eq('id', siguiente.id)
  }

  const { error } = await supabase.from('metas').delete().eq('id', id)
  if (error) throw new Error(error.message)

  log.info('Meta eliminada', { userId: usuarioId, metaId: id })
  return { statusCode: 200, body: JSON.stringify({ eliminado: true }) }
}

export async function handler(event) {
  resetRequestId()
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' }

  try {
    let result
    switch (event.httpMethod) {
      case 'GET': result = await handleGet(event); break
      case 'POST': result = await handlePost(event); break
      case 'PATCH': result = await handlePatch(event); break
      case 'DELETE': result = await handleDelete(event); break
      default: return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Método no permitido' }) }
    }
    return { ...result, headers: CORS_HEADERS }
  } catch (err) {
    log.error('Error inesperado', { error: err.message })
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Error interno del servidor', detalle: process.env.ETHERFUSE_ENV === 'sandbox' ? err.message : undefined }) }
  }
}
