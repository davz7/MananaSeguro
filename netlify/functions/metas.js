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

/** Entrada del cliente mal formada: siempre 400, nunca 500. */
class EntradaInvalida extends Error {}

/**
 * Lee el cuerpo como objeto JSON. JSON inválido, `null`, arreglos o
 * primitivos son error del cliente.
 */
function leerCuerpo(event) {
  let cuerpo
  try {
    cuerpo = JSON.parse(event.body || '{}')
  } catch {
    throw new EntradaInvalida('El cuerpo de la petición no es JSON válido')
  }
  if (cuerpo === null || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) {
    throw new EntradaInvalida('El cuerpo de la petición debe ser un objeto JSON')
  }
  return cuerpo
}

/**
 * Acepta números o texto numérico ("5000"). Cualquier otra cosa da NaN,
 * que se rechaza explícitamente: NaN pasaría las comparaciones de rango
 * porque toda comparación con NaN es falsa. Tampoco acepta arreglos
 * (Number([5000]) === 5000) ni booleanos.
 */
function aNumero(valor) {
  if (typeof valor === 'number') return valor
  if (typeof valor === 'string' && valor.trim() !== '') return Number(valor)
  return NaN
}

function validarNombre(nombre) {
  if (typeof nombre !== 'string' || nombre.trim().length === 0) {
    throw new EntradaInvalida('El nombre de la meta es requerido')
  }
  const limpio = nombre.trim()
  if (limpio.length > NOMBRES_VALIDOS_MAX) {
    throw new EntradaInvalida(`El nombre no puede exceder ${NOMBRES_VALIDOS_MAX} caracteres`)
  }
  return limpio
}

function validarDescripcion(descripcion) {
  if (descripcion === null) return null
  if (typeof descripcion !== 'string') {
    throw new EntradaInvalida('La descripción debe ser texto')
  }
  return descripcion.trim() || null
}

function validarMonto(valor) {
  const m = aNumero(valor)
  if (!Number.isFinite(m) || m < MONTO_MIN) {
    throw new EntradaInvalida(`El monto objetivo mínimo es $${MONTO_MIN.toLocaleString('es-MX')} MXN`)
  }
  if (m > MONTO_MAX) {
    throw new EntradaInvalida(`El monto objetivo máximo es $${MONTO_MAX.toLocaleString('es-MX')} MXN`)
  }
  return m
}

function validarAhorro(valor) {
  const a = aNumero(valor)
  if (!Number.isFinite(a) || a < AHORRO_MIN) {
    throw new EntradaInvalida(`El ahorro mensual mínimo es $${AHORRO_MIN} MXN`)
  }
  if (a > AHORRO_MAX) {
    throw new EntradaInvalida(`El ahorro mensual máximo es $${AHORRO_MAX.toLocaleString('es-MX')} MXN`)
  }
  return a
}

function validarAnos(valor) {
  const y = aNumero(valor)
  if (!Number.isInteger(y) || y < ANOS_MIN || y > ANOS_MAX) {
    throw new EntradaInvalida(`Los años al retiro deben ser un número entero entre ${ANOS_MIN} y ${ANOS_MAX}`)
  }
  return y
}

/**
 * Valida y normaliza los campos de una meta.
 * - parcial=false (POST): nombre, monto, ahorro y años son obligatorios.
 * - parcial=true (PATCH): solo se validan los campos presentes.
 * Devuelve solo columnas conocidas: cualquier otro campo se ignora.
 */
function validarCampos(cuerpo, { parcial }) {
  const campos = {}
  const presente = (k) => cuerpo[k] !== undefined

  if (!parcial || presente('nombre')) campos.nombre = validarNombre(cuerpo.nombre)
  if (presente('descripcion')) campos.descripcion = validarDescripcion(cuerpo.descripcion)
  if (!parcial || presente('monto_objetivo_mxn')) {
    campos.monto_objetivo_mxn = validarMonto(cuerpo.monto_objetivo_mxn)
  }
  if (!parcial || presente('ahorro_mensual_mxn')) {
    campos.ahorro_mensual_mxn = validarAhorro(cuerpo.ahorro_mensual_mxn)
  }
  if (!parcial || presente('anos_al_retiro')) {
    campos.anos_al_retiro = validarAnos(cuerpo.anos_al_retiro)
  }
  return campos
}

const respuesta400 = (mensaje) => ({ statusCode: 400, body: JSON.stringify({ error: mensaje }) })

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
  let campos
  try {
    campos = validarCampos(leerCuerpo(event), { parcial: false })
  } catch (err) {
    if (err instanceof EntradaInvalida) return respuesta400(err.message)
    throw err
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
      nombre: campos.nombre,
      descripcion: campos.descripcion ?? null,
      monto_objetivo_mxn: campos.monto_objetivo_mxn,
      ahorro_mensual_mxn: campos.ahorro_mensual_mxn,
      anos_al_retiro: campos.anos_al_retiro,
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

  // Solo se validan los campos que vienen en el cuerpo
  let updates
  try {
    updates = validarCampos(leerCuerpo(event), { parcial: true })
  } catch (err) {
    if (err instanceof EntradaInvalida) return respuesta400(err.message)
    throw err
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