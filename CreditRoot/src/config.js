// src/config.js
//
// Único lugar donde el frontend lee variables de entorno. Pasar de testnet a
// mainnet es cambiar VITE_STELLAR_NETWORK (y el resto de variables del
// backend) en Netlify, sin tocar código.

const env = import.meta.env

const NETWORK = env.VITE_STELLAR_NETWORK === 'public' ? 'public' : 'testnet'

export const config = {
  googleClientId: env.VITE_GOOGLE_CLIENT_ID ?? '',
  stellarNetwork: NETWORK,
  esTestnet: NETWORK === 'testnet',
  stellarExplorer: (env.VITE_STELLAR_EXPLORER || `https://stellar.expert/explorer/${NETWORK}`)
    .replace(/\/+$/, ''),
}

/** Link al explorador para una transacción de Stellar. */
export function explorerTxUrl(hash) {
  return hash ? `${config.stellarExplorer}/tx/${hash}` : null
}
