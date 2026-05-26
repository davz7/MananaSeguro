// netlify/functions/etherfuse-ramp.js
import { createLogger, resetRequestId } from './_lib/logger.js'

const log = createLogger('etherfuse-ramp')

const SANDBOX_URL = 'https://api.sand.etherfuse.com'
const PROD_URL    = 'https://api.etherfuse.com'
const BASE_URL = process.env.ETHERFUSE_ENV === 'production' ? PROD_URL : SANDBOX_URL

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

async function callRampApi(path, method = 'GET', body = null) {
  const apiKey = process.env.ETHERFUSE_API_KEY
  if (!apiKey) throw new Error('ETHERFUSE_API_KEY no configurada')

  const options = {
    method,
    headers: { 'Content-Type': 'application/json', 'Authorization': apiKey },
  }
  if (body) options.body = JSON.stringify(body)

  const res = await fetch(`${BASE_URL}${path}`, options)
  const data = await res.json()

  if (!res.ok) throw new Error(data.message || data.error || `HTTP ${res.status}`)

  return data
}

export async function handler(event) {
  resetRequestId()
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' }

  const { action } = event.queryStringParameters || {}

  try {
    let result

    if (action === 'assets' && event.httpMethod === 'GET') {
      const res = await fetch(`${BASE_URL}/ramp/assets?blockchain=stellar`, { headers: { 'Authorization': process.env.ETHERFUSE_API_KEY, 'Content-Type': 'application/json' } })
      const text = await res.text()
      log.info('Assets fetched', { raw: text.substring(0, 200) })
      result = JSON.parse(text)
    }
    else if (action === 'quote' && event.httpMethod === 'POST') {
      const { walletAddress, amountMxn, targetAsset, customerId } = JSON.parse(event.body)
      if (!walletAddress || !amountMxn || !targetAsset || !customerId) {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Faltan campos: walletAddress, amountMxn, targetAsset, customerId' }) }
      }
      result = await callRampApi('/ramp/quote', 'POST', { quoteId: crypto.randomUUID(), customerId, blockchain: 'stellar', quoteAssets: { type: 'onramp', sourceAsset: 'MXN', targetAsset }, sourceAmount: String(amountMxn), walletAddress })
      log.info('Quote created', { customerId, amountMxn, targetAsset })
    }
    else if (action === 'order' && event.httpMethod === 'POST') {
      const { quoteId, bankAccountId, cryptoWalletId } = JSON.parse(event.body)
      if (!quoteId || !bankAccountId || !cryptoWalletId) {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Faltan campos: quoteId, bankAccountId, cryptoWalletId' }) }
      }
      result = await callRampApi('/ramp/order', 'POST', { orderId: crypto.randomUUID(), bankAccountId, cryptoWalletId, quoteId })
      log.info('Order created', { quoteId })
    }
    else if (action === 'order-status' && event.httpMethod === 'GET') {
      const { orderId } = event.queryStringParameters
      if (!orderId) return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Falta orderId' }) }
      result = await callRampApi(`/ramp/order/${orderId}`)
      log.info('Order status checked', { orderId, status: result.status })
    }
    else if (action === 'kyc-url' && event.httpMethod === 'POST') {
      const { walletAddress, email } = JSON.parse(event.body)
      if (!walletAddress || !email) return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Faltan campos: walletAddress, email' }) }
      result = await callRampApi('/ramp/onboarding/hosted', 'POST', { walletPublicKey: walletAddress, email, blockchain: 'stellar', redirectUrl: process.env.URL + '/dashboard' })
      log.info('KYC URL generated', { email })
    }
    else if (action === 'kyc-status' && event.httpMethod === 'GET') {
      const { customerId, walletAddress } = event.queryStringParameters
      if (!customerId || !walletAddress) return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Faltan campos: customerId, walletAddress' }) }
      result = await callRampApi(`/ramp/customer/${customerId}/kyc/${walletAddress}`)
    }
    else {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Acción no válida', acciones_disponibles: ['assets', 'quote', 'order', 'order-status', 'kyc-url', 'kyc-status'] }) }
    }

    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(result) }
  } catch (err) {
    log.error('Ramp API error', { error: err.message })
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) }
  }
}
