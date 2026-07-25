// Cliente frontend para la Etherfuse Ramp API

const RAMP_PROXY = '/api/etherfuse-ramp'

// Helper interno
async function rampFetch(action, method = 'GET', body = null) {
  const url = `${RAMP_PROXY}?action=${action}`
  const options = { method, headers: { 'Content-Type': 'application/json' } }
  if (body) options.body = JSON.stringify(body)

  const res = await fetch(url, options)
  const data = await res.json()

  if (!res.ok || data.error) {
    throw new Error(data.error || `HTTP ${res.status}`)
  }

  return data
}

// Activos disponibles en Stellar
// Retorna la lista de tokens que Etherfuse puede rampar (MXNe, CETES, USDC, etc.)
export async function getAvailableAssets() {
  return rampFetch('assets', 'GET')
}

// KYC: obtener URL hosted de Etherfuse
// El usuario completa su KYC en la página de Etherfuse, luego regresa a tu app
// Llama esto ANTES de permitirle depositar a un usuario nuevo
export async function getKycUrl(walletAddress, email) {
  return rampFetch('kyc-url', 'POST', { walletAddress, email })
  // Retorna: { url: "https://devnet.etherfuse.com/onboarding/..." }
}

// KYC: verificar estado
// Statuses: 'not_started' | 'proposed' | 'approved' | 'rejected'
export async function getKycStatus(customerId, walletAddress) {
  return rampFetch(`kyc-status&customerId=${customerId}&walletAddress=${walletAddress}`, 'GET')
}

// Cotizar depósito MXN → token en Stellar
// amountMxn: número (ej. 500)
// targetAsset: string en formato CODE:ISSUER (ej. "USDC:GBBD47IF6...")
// o el identifier que viene de getAvailableAssets()
// Retorna: { quoteId, sourceAmount, targetAmount, feeBps, feeAmount, expiresAt }
export async function getDepositQuote({ walletAddress, amountMxn, targetAsset, customerId }) {
  return rampFetch('quote', 'POST', { walletAddress, amountMxn, targetAsset, customerId })
}

// Crear orden y obtener CLABE SPEI
// Retorna la CLABE única a la que el usuario debe mandar el SPEI
// depositClabe: "646180XXXXXXXXXX" , CLABE STP de Etherfuse para este usuario
// IMPORTANTE: el usuario debe mandar EXACTAMENTE el monto del quote, ni un peso más ni menos
export async function createDepositOrder({ quoteId, bankAccountId, cryptoWalletId }) {
  return rampFetch('order', 'POST', { quoteId, bankAccountId, cryptoWalletId })
  // Retorna:
  // {
  // orderId: string,
  // depositClabe: "646180XXXXXXXXXX",
  // depositBankName: "STP",
  // depositAccountHolder: "Etherfuse MX",
  // statusPage: "https://devnet.etherfuse.com/ramp/order/...",
  // status: "created"
  // }
}

// Verificar estado de una orden
// Statuses: 'created' | 'funded' | 'completed'
// Cuando status === 'completed' y la wallet es nueva, viene:
// stellarClaimTransaction: XDR sin firmar , el usuario lo firma con Freighter
export async function getOrderStatus(orderId) {
  return rampFetch(`order-status&orderId=${orderId}`, 'GET')
}

// Flujo completo: polling hasta que la orden se complete
// Llama a esto después de mostrarle la CLABE al usuario
// onStatusChange(status) se llama cada vez que cambia el estado
export async function waitForOrderCompletion(orderId, onStatusChange, timeoutMs = 30 * 60 * 1000) {
  const startTime = Date.now()
  const POLL_INTERVAL = 5000 // 5 segundos

  return new Promise((resolve, reject) => {
    async function poll() {
      if (Date.now() - startTime > timeoutMs) {
        reject(new Error('Tiempo de espera agotado. Verifica tu transferencia SPEI.'))
        return
      }

      try {
        const order = await getOrderStatus(orderId)
        onStatusChange?.(order.status)

        if (order.status === 'completed') {
          resolve(order)
        } else {
          setTimeout(poll, POLL_INTERVAL)
        }
      } catch (err) {
        reject(err)
      }
    }

    poll()
  })
}
