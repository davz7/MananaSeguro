// netlify/functions/cetes-rate.js
import { createLogger, resetRequestId } from './_lib/logger.js'

const log = createLogger('cetes-rate')

const CORS_HEADERS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
const ETHERFUSE_SPREAD = 0.9

export async function handler(event) {
  resetRequestId()
  try {
    const banxicoToken = process.env.BANXICO_TOKEN
    if (!banxicoToken) throw new Error('BANXICO_TOKEN no configurado en .env')

    const res = await fetch(`https://www.banxico.org.mx/SieAPIRest/service/v1/series/SF43936/datos/oportuno?token=${banxicoToken}`, { headers: { 'Accept': 'application/json' } })
    if (!res.ok) throw new Error(`Banxico HTTP ${res.status}`)

    const data = await res.json()
    const serie = data?.bmx?.series?.[0]
    const ultimo = serie?.datos?.[0]
    if (!ultimo || ultimo.dato === 'N/E') throw new Error('Dato no disponible')

    const tasaBruta = parseFloat(ultimo.dato)
    if (isNaN(tasaBruta) || tasaBruta <= 0) throw new Error('Tasa inválida')

    const tasaUsuario = Math.max(0, tasaBruta - ETHERFUSE_SPREAD)
    log.info('Tasa CETES obtenida', { tasaBruta, tasaUsuario, fecha: ultimo.fecha })

    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ rate: parseFloat(tasaBruta.toFixed(2)), tasaBruta: parseFloat(tasaBruta.toFixed(2)), tasaUsuarioEtherfuse: parseFloat(tasaUsuario.toFixed(2)), fecha: ultimo.fecha, source: 'banxico' }) }
  } catch (err) {
    log.warn('Banxico falló, usando fallback', { error: err.message })
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ rate: 6.5, tasaBruta: 6.5, tasaUsuarioEtherfuse: 5.6, source: 'fallback', error: err.message }) }
  }
}
