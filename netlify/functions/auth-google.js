// netlify/functions/auth-google.js
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { createLogger, resetRequestId } from './_lib/logger.js'

const log = createLogger('auth-google')

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const GOOGLE_CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs'
const STELLAR_NETWORK = 'TESTNET'

function cifrar(texto) {
  const key = Buffer.from(process.env.WALLET_ENCRYPTION_KEY, 'hex')
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

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

async function generarWalletStellar() {
  const { Keypair } = await import('@stellar/stellar-sdk')
  const keypair = Keypair.random()
  return { publicKey: keypair.publicKey(), secretKey: keypair.secret() }
}

async function verificarTokenGoogle(idToken) {
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`, { method: 'GET' })
  if (!res.ok) throw new Error(`Token de Google inválido: HTTP ${res.status}`)
  const payload = await res.json()
  const ahora = Math.floor(Date.now() / 1000)
  if (payload.exp && parseInt(payload.exp) < ahora) throw new Error('Token de Google expirado')
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (clientId && payload.aud !== clientId) throw new Error('Token de Google no corresponde a esta aplicación')
  if (!payload.email || payload.email_verified !== 'true') throw new Error('Email de Google no verificado')
  return { email: payload.email, nombre: payload.name || payload.given_name || payload.email.split('@')[0], googleId: payload.sub }
}

export async function handler(event) {
  resetRequestId()
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Método no permitido' }) }

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY, WALLET_ENCRYPTION_KEY } = process.env
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    log.error('Variables de Supabase no configuradas')
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Error de configuración del servidor' }) }
  }
  if (!WALLET_ENCRYPTION_KEY || WALLET_ENCRYPTION_KEY.length !== 64) {
    log.error('WALLET_ENCRYPTION_KEY inválida')
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Error de configuración del servidor' }) }
  }

  let idToken
  try {
    const body = JSON.parse(event.body || '{}')
    idToken = body.idToken
    if (!idToken) throw new Error('idToken requerido')
  } catch (err) { return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: `Body inválido: ${err.message}` }) } }

  let usuarioGoogle
  try { usuarioGoogle = await verificarTokenGoogle(idToken) }
  catch (err) {
    log.warn('Token inválido', { error: err.message })
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: `Autenticación fallida: ${err.message}` }) }
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })

  try {
    const { data: usuarioExistente, error: errorBusqueda } = await supabase.from('usuarios').select('*').eq('email', usuarioGoogle.email).single()
    if (errorBusqueda && errorBusqueda.code !== 'PGRST116') throw new Error(`Error de base de datos: ${errorBusqueda.message}`)

    if (usuarioExistente) {
      log.info('Usuario existente', { email: usuarioExistente.email })
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ usuario: { id: usuarioExistente.id, email: usuarioExistente.email, nombre: usuarioExistente.nombre, customerId: usuarioExistente.customer_id, bankAccountId: usuarioExistente.bank_account_id, stellarPublicKey: usuarioExistente.stellar_public_key, kycStatus: usuarioExistente.kyc_status, bankAccountStatus: usuarioExistente.bank_account_status }, esNuevo: false }) }
    }

    log.info('Creando usuario nuevo', { email: usuarioGoogle.email })
    const wallet = await generarWalletStellar()
    const secretKeyCifrada = cifrar(wallet.secretKey)
    const nuevoUsuario = { email: usuarioGoogle.email, nombre: usuarioGoogle.nombre, customer_id: randomUUID(), bank_account_id: randomUUID(), stellar_public_key: wallet.publicKey, stellar_secret_key_encrypted: secretKeyCifrada, kyc_status: 'pending', bank_account_status: 'pending' }
    const { data: usuarioCreado, error: errorCreacion } = await supabase.from('usuarios').insert(nuevoUsuario).select().single()
    if (errorCreacion) throw new Error(`Error al crear usuario: ${errorCreacion.message}`)

    log.info('Usuario creado', { email: usuarioCreado.email })
    return { statusCode: 201, headers: CORS_HEADERS, body: JSON.stringify({ usuario: { id: usuarioCreado.id, email: usuarioCreado.email, nombre: usuarioCreado.nombre, customerId: usuarioCreado.customer_id, bankAccountId: usuarioCreado.bank_account_id, stellarPublicKey: usuarioCreado.stellar_public_key, kycStatus: usuarioCreado.kyc_status, bankAccountStatus: usuarioCreado.bank_account_status }, esNuevo: true }) }
  } catch (err) {
    log.error('Error inesperado', { error: err.message })
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Error interno del servidor' }) }
  }
}
