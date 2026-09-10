import { randomUUID } from 'crypto'

function crearOrdenFalsa() {
    return{
        orderId: randomUUID(),
        amountInFiat: Math.random() * 100,
        amountInTokens: Math.random() * 10,
        }
}


function crearPayload(ordenFalsa, status) {
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

function generaFirma(payload, secret) {
    payload = JSON.stringify(payload)
    const hmac = createHmac('sha256', secret)
    hmac.update(payload, 'utf8')
    return hmac.digest('hex')
}


function enivarWebhook(payload, secret, url) {
    return fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-signature': generaFirma(payload, secret)
        },
        body: JSON.stringify(payload)
    })
}