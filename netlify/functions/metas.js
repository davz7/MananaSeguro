// netlify/functions/metas.js
//
//  ISO 25010 
// Seguridad:      Valida usuarioId en cada operación. Nunca expone datos de
//                 otros usuarios. service_role solo en backend.
// Fiabilidad:     Errores tipados. Validación de campos antes de tocar la BD.
//                 Unique constraint en BD previene duplicados de meta principal.
// Mantenibilidad: Un handler por método HTTP. Helpers separados por operación.
// Eficiencia:     Queries mínimas — no trae campos innecesarios.
// Seguridad:      La identidad del llamante sale EXCLUSIVAMENTE del token de
//                 sesión. El parámetro usuarioId fue eliminado: aceptarlo,
//                 aunque fuera como respaldo, reabriría la suplantación.
// Funcionalidad:  GET /api/metas          — listar metas del usuario
//                 POST /api/metas       — crear meta
//                 PATCH /api/metas/:id  — actualizar meta
//                 DELETE /api/metas/:id — eliminar meta (no la principal si es única)

import { createClient } from '@supabase/supabase-js'
import { createLogger, errorBody, withRequestId } from './_lib/logger.js'
import { withSession } from './_lib/session.js'

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

//  Validaciones ─

const NOMBRES_VALIDOS_MAX = 60
const MONTO_MIN = 1000
const MONTO_MAX = 50_000_000
const ANOS_MIN = 1
const ANOS_MAX = 40
const AHORRO_MIN = 40
const AHORRO_MAX = 100_000

function validarMeta({ nombre, monto_objetivo_mxn, ahorro_mensual_mxn, anos_al_retiro }) {
  if (!nombre || typeof nombre !== 'string' || nombre.trim().length === 0) {
    return 'El nombre de la meta es requerido'
  }
  if (nombre.length > NOMBRES_VALIDOS_MAX) {
    return `El nombre no puede exceder ${NOMBRES_VALIDOS_MAX} caracteres`
  }
  if (!monto_objetivo_mxn || Number(monto_objetivo_mxn) < MONTO_MIN) {
    return `El monto objetivo mínimo es $${MONTO_MIN.toLocaleString('es-MX')} MXN`
  }
  if (Number(monto_objetivo_mxn) > MONTO_MAX) {
    return `El monto objetivo máximo es $${MONTO_MAX.toLocaleString('es-MX')} MXN`
  }
  if (!ahorro_mensual_mxn || Number(ahorro_mensual_mxn) < AHORRO_MIN) {
    return `El ahorro mensual mínimo es $${AHORRO_MIN} MXN`
  }
  if (Number(ahorro_mensual_mxn) > AHORRO_MAX) {
    return `El ahorro mensual máximo es $${AHORRO_MAX.toLocaleString('es-MX')} MXN`
  }
  if (!anos_al_retiro || Number(anos_al_retiro) < ANOS_MIN || Number(anos_al_retiro) > ANOS_MAX) {
    return `Los años al retiro deben estar entre ${ANOS_MIN} y ${ANOS_MAX}`
  }
  return null
}

//  Supabase client factory ──

function getSupabase() {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Variables de Supabase no configuradas')
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  })
}

//  Handlers por método 

// GET /api/metas — metas del usuario autenticado
async function handleGet(event, usuarioId) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('metas')
    .select('id, nombre, descripcion, monto_objetivo_mxn, ahorro_mensual_mxn, anos_al_retiro, es_principal, created_at, updated_at')
    .eq('usuario_id', usuarioId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)

  return { statusCode: 200, body: JSON.stringify({ metas: data ?? [] }) }
}

// POST /api/metas — crear meta
async function handlePost(event, usuarioId) {
  const body = JSON.parse(event.body || '{}')
  const { nombre, descripcion, monto_objetivo_mxn, ahorro_mensual_mxn, anos_al_retiro } = body

  const errorValidacion = validarMeta({ nombre, monto_objetivo_mxn, ahorro_mensual_mxn, anos_al_retiro })
  if (errorValidacion) {
    return { statusCode: 400, body: JSON.stringify({ error: errorValidacion }) }
  }

  const supabase = getSupabase()

  // Verificar cuántas metas tiene ya el usuario
  const { count } = await supabase
    .from('metas')
    .select('id', { count: 'exact', head: true })
    .eq('usuario_id', usuarioId)

  // La primera meta siempre es principal
  const esPrincipal = (count ?? 0) === 0

  const { data, error } = await supabase
    .from('metas')
    .insert({
      usuario_id: usuarioId,
      nombre: nombre.trim(),
      descripcion: descripcion?.trim() || null,
      monto_objetivo_mxn: Number(monto_objetivo_mxn),
      ahorro_mensual_mxn: Number(ahorro_mensual_mxn),
      anos_al_retiro: Number(anos_al_retiro),
      es_principal: esPrincipal,
    })
    .select()
    .single()

  if (error) {
    // Error de constraint único — ya tiene meta principal
    if (error.code === '23505') {
      return { statusCode: 409, body: JSON.stringify({ error: 'Ya existe una meta principal para este usuario' }) }
    }
    throw new Error(error.message)
  }

  return { statusCode: 201, body: JSON.stringify({ meta: data }) }
}

// PATCH /api/metas?id=xxx — actualizar meta
async function handlePatch(event, usuarioId) {
  const { id } = event.queryStringParameters || {}
  if (!id) {
    return { statusCode: 400, body: JSON.stringify({ error: 'id de meta requerido' }) }
  }

  const body = JSON.parse(event.body || '{}')
  const { nombre, descripcion, monto_objetivo_mxn, ahorro_mensual_mxn, anos_al_retiro } = body

  // Solo validar campos que vienen en el body
  const updates = {}
  if (nombre !== undefined) {
    if (!nombre || nombre.trim().length === 0) return { statusCode: 400, body: JSON.stringify({ error: 'El nombre no puede estar vacío' }) }
    if (nombre.length > NOMBRES_VALIDOS_MAX) return { statusCode: 400, body: JSON.stringify({ error: `Nombre máximo ${NOMBRES_VALIDOS_MAX} caracteres` }) }
    updates.nombre = nombre.trim()
  }
  if (descripcion !== undefined) updates.descripcion = descripcion?.trim() || null
  if (monto_objetivo_mxn !== undefined) {
    const m = Number(monto_objetivo_mxn)
    if (m < MONTO_MIN || m > MONTO_MAX) return { statusCode: 400, body: JSON.stringify({ error: `Monto entre $${MONTO_MIN} y $${MONTO_MAX} MXN` }) }
    updates.monto_objetivo_mxn = m
  }
  if (ahorro_mensual_mxn !== undefined) {
    const a = Number(ahorro_mensual_mxn)
    if (a < AHORRO_MIN || a > AHORRO_MAX) return { statusCode: 400, body: JSON.stringify({ error: `Ahorro entre $${AHORRO_MIN} y $${AHORRO_MAX} MXN` }) }
    updates.ahorro_mensual_mxn = a
  }
  if (anos_al_retiro !== undefined) {
    const y = Number(anos_al_retiro)
    if (y < ANOS_MIN || y > ANOS_MAX) return { statusCode: 400, body: JSON.stringify({ error: `Años entre ${ANOS_MIN} y ${ANOS_MAX}` }) }
    updates.anos_al_retiro = y
  }

  if (Object.keys(updates).length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'No hay campos para actualizar' }) }
  }

  const supabase = getSupabase()

  // Verificar que la meta pertenece al usuario (ISO 25010 Seguridad)
  const { data: metaExistente, error: errorBusqueda } = await supabase
    .from('metas')
    .select('id, usuario_id')
    .eq('id', id)
    .eq('usuario_id', usuarioId)
    .single()

  if (errorBusqueda || !metaExistente) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Meta no encontrada' }) }
  }

  const { data, error } = await supabase
    .from('metas')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)

  return { statusCode: 200, body: JSON.stringify({ meta: data }) }
}

// DELETE /api/metas?id=xxx — eliminar meta
async function handleDelete(event, usuarioId) {
  const { id } = event.queryStringParameters || {}

  if (!id) {
    return { statusCode: 400, body: JSON.stringify({ error: 'id de meta requerido' }) }
  }

  const supabase = getSupabase()

  // Verificar que la meta pertenece al usuario
  const { data: meta, error: errorBusqueda } = await supabase
    .from('metas')
    .select('id, usuario_id, es_principal')
    .eq('id', id)
    .eq('usuario_id', usuarioId)
    .single()

  if (errorBusqueda || !meta) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Meta no encontrada' }) }
  }

  // No permitir eliminar la única meta del usuario
  const { count } = await supabase
    .from('metas')
    .select('id', { count: 'exact', head: true })
    .eq('usuario_id', usuarioId)

  if ((count ?? 0) <= 1) {
    return {
      statusCode: 409,
      body: JSON.stringify({ error: 'No puedes eliminar tu única meta. Crea otra primero.' }),
    }
  }

  // Si era principal, asignar la siguiente como principal
  if (meta.es_principal) {
    const { data: siguiente } = await supabase
      .from('metas')
      .select('id')
      .eq('usuario_id', usuarioId)
      .neq('id', id)
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (siguiente) {
      await supabase.from('metas').update({ es_principal: true }).eq('id', siguiente.id)
    }
  }

  const { error } = await supabase.from('metas').delete().eq('id', id)
  if (error) throw new Error(error.message)

  return { statusCode: 200, body: JSON.stringify({ eliminado: true }) }
}

//  Handler principal ──

async function handlerConSesion(event, usuarioId) {
  const log = createLogger('metas')

  try {
    let result

    switch (event.httpMethod) {
      case 'GET':    result = await handleGet(event, usuarioId);    break
      case 'POST':   result = await handlePost(event, usuarioId);   break
      case 'PATCH':  result = await handlePatch(event, usuarioId);  break
      case 'DELETE': result = await handleDelete(event, usuarioId); break
      default:
        return {
          statusCode: 405,
          headers: CORS_HEADERS,
          body: errorBody(log, 'Método no permitido'),
        }
    }

    return { ...withRequestId(log, result), headers: CORS_HEADERS }

  } catch (err) {
    log.error('Error inesperado', { detail: err.message })
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: errorBody(log, 'Error interno del servidor', {
        detalle: process.env.ETHERFUSE_ENV === 'sandbox' ? err.message : undefined,
      }),
    }
  }
}

// El preflight CORS no lleva credenciales. Si pasara por withSession
// respondería 401 y el navegador bloquearía toda petición real después.
export async function handler(event, context) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' }
  }
  return withSession(handlerConSesion)(event, context)
}