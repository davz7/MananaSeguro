import { randomUUID, createHmac  } from 'crypto'

//Crea una orden falsa para simular el webhook
function crearOrdenFalsa() {
    return{
        orderId: randomUUID(),
        amountInFiat: Math.random() * 100,
        amountInTokens: Math.random() * 10,
        }
}

// Arma el payload del webhook según el estado de la orden
function armarPayload(ordenFalsa, status) {
    const payload = {
        orderId: ordenFalsa.orderId,
        amountInFiat: ordenFalsa.amountInFiat,
        amountInTokens: ordenFalsa.amountInTokens,
        status: status,
        updatedAt: new Date().toISOString()
    }

    if(status === 'completed'){
        payload.stellarClaimTransaction = randomUUID()
        payload.confirmedTxSignature = randomUUID()
    }

    return payload
}

// Genera la firma HMAC-SHA256 del payload con el secreto compartido
function generaFirma(payload, secret) {
    payload = JSON.stringify(payload)
    const hmac = createHmac('sha256', secret)
    hmac.update(payload, 'utf8')
    return hmac.digest('hex')
}

// Envía el webhook a la URL especificada con la firma en el header
function enviarWebhook(payload, secret, url) {
    return fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-signature': generaFirma(payload, secret)
        },
        body: JSON.stringify(payload)
    })
}

// Simula el flujo normal completo: created → funded → completed
async function simularFlujoNormal(secret, url) {
  const ordenFalsa = crearOrdenFalsa()
  await enviarWebhook(armarPayload(ordenFalsa, 'created'), secret, url)
  await enviarWebhook(armarPayload(ordenFalsa, 'funded'), secret, url)
  await enviarWebhook(armarPayload(ordenFalsa, 'completed'), secret, url)
  return ordenFalsa
}

// Simula un webhook duplicado: mismo evento 'funded' enviado dos veces
async function simularDuplicado(secret, url) {
  const ordenFalsa = crearOrdenFalsa()
  const payload = armarPayload(ordenFalsa, 'funded')
  await enviarWebhook(payload, secret, url)
  await enviarWebhook(payload, secret, url)
  return ordenFalsa
}

// Simula una respuesta tardía/fuera de orden: 'completed' antes que 'funded'
async function simularRespuestaTardia(secret, url) {
  const ordenFalsa = crearOrdenFalsa()
  await enviarWebhook(armarPayload(ordenFalsa, 'completed'), secret, url)
  await enviarWebhook(armarPayload(ordenFalsa, 'funded'), secret, url)
  return ordenFalsa
}

export {
  crearOrdenFalsa,
  armarPayload,
  generaFirma,
  enviarWebhook,
  simularFlujoNormal,
  simularDuplicado,
  simularRespuestaTardia,
}