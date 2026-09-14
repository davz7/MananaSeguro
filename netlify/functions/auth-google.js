// Variables de entorno requeridas:
//   SUPABASE_URL          → URL del proyecto Supabase
//   SUPABASE_SERVICE_KEY  → service_role key (nunca la anon key aquí)
//   SESSION_SIGNING_KEY   → clave de firma de los tokens de sesión
//   KMS_CUSTODY_KEY_ID    → alias o ARN de la CMK de custodia
//   AWS_REGION            → región de la CMK (us-east-1)
//
// La llave global WALLET_ENCRYPTION_KEY quedó retirada: cada usuario tiene
// ahora su propia data key bajo la CMK de KMS. Ver _lib/custody.js.

import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { createLogger, errorBody } from './_lib/logger.js'
import { createCustodialAccount } from './_lib/custody.js'
import { issueSession } from './_lib/session.js'

//  Constantes 

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const GOOGLE_CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs'
const STELLAR_NETWORK = 'TESTNET' // cambiar a 'PUBLIC' para mainnet

//  Custodia de llaves 
//
// La generación del keypair y su cifrado viven en _lib/custody.js, sobre
// AWS KMS con envelope encryption. Esta función ya no manipula material
// de llave: recibe columnas listas para persistir.

//  Helper: verificar token de Google 

/**
 * Verifica el ID token de Google usando su endpoint de tokeninfo.
 * En producción considera usar google-auth-library para verificación local.
 * Retorna el payload del token si es válido, lanza error si no.
 */
async function verificarTokenGoogle(idToken) {
  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`,
    { method: 'GET' }
  )

  if (!res.ok) {
    throw new Error(`Token de Google inválido: HTTP ${res.status}`)
  }

  const payload = await res.json()

  // Validar que el token no haya expirado
  const ahora = Math.floor(Date.now() / 1000)
  if (payload.exp && parseInt(payload.exp) < ahora) {
    throw new Error('Token de Google expirado')
  }

  // Validar audience — el token debe ser para NUESTRA app, no otra
  // ISO 25010 Seguridad: previene ataques de confused deputy
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (clientId && payload.aud !== clientId) {
    throw new Error('Token de Google no corresponde a esta aplicación')
  }

  // Validar que tenga email verificado
  if (!payload.email || payload.email_verified !== 'true') {
    throw new Error('Email de Google no verificado')
  }

  return {
    email: payload.email,
    nombre: payload.name || payload.given_name || payload.email.split('@')[0],
    googleId: payload.sub,
  }
}

//  Handler principal ──

export async function handler(event) {
  const log = createLogger('auth-google')

  // Preflight CORS
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' }
  }

  // Solo acepta POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: errorBody(log, 'Método no permitido'),
    }
  }

  // ── Validar variables de entorno críticas 
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    log.error('Variables de Supabase no configuradas')
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: errorBody(log, 'Error de configuración del servidor'),
    }
  }

  if (!process.env.KMS_CUSTODY_KEY_ID) {
    log.error('KMS_CUSTODY_KEY_ID no configurada')
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: errorBody(log, 'Error de configuración del servidor'),
    }
  }

  if (!process.env.SESSION_SIGNING_KEY) {
    log.error('SESSION_SIGNING_KEY no configurada')
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: errorBody(log, 'Error de configuración del servidor'),
    }
  }

  // ── Parsear body ─
  let idToken
  try {
    const body = JSON.parse(event.body || '{}')
    idToken = body.idToken
    if (!idToken) throw new Error('idToken requerido')
  } catch (err) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: errorBody(log, `Body inválido: ${err.message}`),
    }
  }

  // ── Verificar token de Google 
  let usuarioGoogle
  try {
    usuarioGoogle = await verificarTokenGoogle(idToken)
  } catch (err) {
    log.warn('Token inválido', { detail: err.message })
    return {
      statusCode: 401,
      headers: CORS_HEADERS,
      body: errorBody(log, `Autenticación fallida: ${err.message}`),
    }
  }

  // ── Conectar a Supabase con service_role ─
  // IMPORTANTE: service_role bypasea RLS — solo usarlo en el backend
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  })

  try {
    // ── Buscar usuario existente ──
    const { data: usuarioExistente, error: errorBusqueda } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', usuarioGoogle.email)
      .single()

    if (errorBusqueda && errorBusqueda.code !== 'PGRST116') {
      // PGRST116 = no rows returned — no es un error real
      throw new Error(`Error de base de datos: ${errorBusqueda.message}`)
    }

    // ── Usuario ya existe — devolver sus datos 
    if (usuarioExistente) {
      const sesion = await issueSession(usuarioExistente.id)
      log.info('Usuario existente', { usuarioId: usuarioExistente.id })
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          usuario: {
            id: usuarioExistente.id,
            email: usuarioExistente.email,
            nombre: usuarioExistente.nombre,
            customerId: usuarioExistente.customer_id,
            bankAccountId: usuarioExistente.bank_account_id,
            stellarPublicKey: usuarioExistente.stellar_public_key,
            kycStatus: usuarioExistente.kyc_status,
            bankAccountStatus: usuarioExistente.bank_account_status,
          },
          sesion,
          esNuevo: false,
        }),
      }
    }

    // ── Usuario nuevo — crear wallet Stellar + registro en DB 
    log.info('Creando usuario nuevo', { googleId: usuarioGoogle.googleId })

    // El id se genera aquí y no en la base de datos porque el encryption
    // context de KMS lo necesita ANTES de cifrar. Hacerlo así deja un solo
    // insert atómico, en lugar de crear el usuario y luego actualizarlo con
    // sus llaves, que dejaría una ventana con la cuenta a medio provisionar.
    const usuarioId = randomUUID()
    const custodia = await createCustodialAccount(usuarioId)

    const nuevoUsuario = {
      id: usuarioId,
      email: usuarioGoogle.email,
      nombre: usuarioGoogle.nombre,
      customer_id: randomUUID(),   // ID que daremos a Etherfuse
      bank_account_id: randomUUID(), // ID del banco que daremos a Etherfuse
      kyc_status: 'pending',
      bank_account_status: 'pending',
      ...custodia,
    }

    const { data: usuarioCreado, error: errorCreacion } = await supabase
      .from('usuarios')
      .insert(nuevoUsuario)
      .select()
      .single()

    if (errorCreacion) {
      throw new Error(`Error al crear usuario: ${errorCreacion.message}`)
    }

    log.info('Usuario creado', { usuarioId: usuarioCreado.id })
    const sesion = await issueSession(usuarioCreado.id)

    return {
      statusCode: 201,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        usuario: {
          id: usuarioCreado.id,
          email: usuarioCreado.email,
          nombre: usuarioCreado.nombre,
          customerId: usuarioCreado.customer_id,
          bankAccountId: usuarioCreado.bank_account_id,
          stellarPublicKey: usuarioCreado.stellar_public_key,
          kycStatus: usuarioCreado.kyc_status,
          bankAccountStatus: usuarioCreado.bank_account_status,
        },
        sesion,
        esNuevo: true,
      }),
    }

  } catch (err) {
    log.error('Error inesperado', { detail: err.message })
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: errorBody(log, 'Error interno del servidor'),
    }
  }
}