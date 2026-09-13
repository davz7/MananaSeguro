// Variables de entorno requeridas:
//   SUPABASE_URL          → URL del proyecto Supabase
//   SUPABASE_SERVICE_KEY  → service_role key (nunca la anon key aquí)
//   WALLET_ENCRYPTION_KEY → clave AES-256 en hex (64 chars) para cifrar llaves
//
// Generar WALLET_ENCRYPTION_KEY:
//   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { createLogger, errorBody } from './_lib/logger.js'
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

//  Helpers de cifrado (ISO 25010 — Seguridad) ─

/**
 * Cifra texto plano con AES-256-GCM.
 * Retorna: iv:authTag:ciphertext en hex, separados por ":"
 * El IV es aleatorio por cada cifrado — nunca se reutiliza.
 */
function cifrar(texto) {
  const key = Buffer.from(process.env.WALLET_ENCRYPTION_KEY, 'hex')
  const iv = randomBytes(12) // 96 bits recomendado para GCM
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

/**
 * Descifra un texto cifrado con cifrar().
 * Lanza error si el authTag no coincide (integridad comprometida).
 */
function descifrar(textoCifrado) {
  const [ivHex, authTagHex, encryptedHex] = textoCifrado.split(':')
  const key = Buffer.from(process.env.WALLET_ENCRYPTION_KEY, 'hex')
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const encrypted = Buffer.from(encryptedHex, 'hex')
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

//  Helper: generar keypair Stellar ──

/**
 * Genera un keypair Stellar usando el SDK.
 * En producción: usar un HSM o KMS (AWS KMS, GCP Cloud KMS).
 * Para MVP: generación local con cifrado AES-256-GCM.
 */
async function generarWalletStellar() {
  // Importación dinámica — el SDK de Stellar es ESM
  const { Keypair } = await import('@stellar/stellar-sdk')
  const keypair = Keypair.random()
  return {
    publicKey: keypair.publicKey(),
    secretKey: keypair.secret(), // se cifra antes de guardar
  }
}

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
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY, WALLET_ENCRYPTION_KEY } = process.env

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    log.error('Variables de Supabase no configuradas')
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: errorBody(log, 'Error de configuración del servidor'),
    }
  }

  if (!WALLET_ENCRYPTION_KEY || WALLET_ENCRYPTION_KEY.length !== 64) {
    log.error('WALLET_ENCRYPTION_KEY inválida')
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

    const wallet = await generarWalletStellar()
    const secretKeyCifrada = cifrar(wallet.secretKey)

    const nuevoUsuario = {
      email: usuarioGoogle.email,
      nombre: usuarioGoogle.nombre,
      customer_id: randomUUID(),   // ID que daremos a Etherfuse
      bank_account_id: randomUUID(), // ID del banco que daremos a Etherfuse
      stellar_public_key: wallet.publicKey,
      stellar_secret_key_encrypted: secretKeyCifrada,
      kyc_status: 'pending',
      bank_account_status: 'pending',
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
