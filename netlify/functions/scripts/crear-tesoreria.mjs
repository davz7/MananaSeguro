// Crea la cuenta tesorera de testnet (T03). Se corre UNA vez.
//
//   node scripts/crear-tesoreria.mjs
//
// Necesita las mismas variables que el backend (Supabase, KMS, MS_AWS_*) y
// STELLAR_NETWORK_PASSPHRASE con la passphrase de testnet.
//
// Qué hace:
//   1. Comprueba que todo apunte a testnet ANTES de generar o usar llaves.
//   2. Se niega si ya existe una tesorería (no sobrescribe nunca).
//   3. Genera la llave con la misma custodia KMS que los usuarios, con
//      encryption context { userId: 'tesoreria-testnet' }, y la guarda en
//      cuentas_sistema ANTES de fondear, para no perder una cuenta con saldo.
//   4. Fondea con XLM (Friendbot) y crea la trustline a USDC.
//
// Después hay que mandarle USDC de testnet a mano desde el faucet de Circle.

import { createClient } from '@supabase/supabase-js'
import * as StellarSdk from '@stellar/stellar-sdk'
import { createCustodialAccount, withSeed } from '../_lib/custody.js'
import {
  assertTestnetConfigurado,
  verificarRedTestnet,
  FRIENDBOT_URL,
  HORIZON_TESTNET,
  ID_TESORERIA,
  USDC_TESTNET,
} from '../_lib/fondeoTestnet.js'

assertTestnetConfigurado()
const horizon = new StellarSdk.Horizon.Server(HORIZON_TESTNET)
const rpc = new StellarSdk.rpc.Server(
  process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org'
)
await verificarRedTestnet({ horizon, rpc })

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
})

const { data: existente } = await supabase
  .from('cuentas_sistema')
  .select('id, stellar_public_key')
  .eq('id', ID_TESORERIA)
  .maybeSingle()
if (existente) {
  console.error(`Ya existe la tesorería: ${existente.stellar_public_key}. No se sobrescribe.`)
  process.exit(1)
}

const columnas = await createCustodialAccount(ID_TESORERIA)
const { error } = await supabase.from('cuentas_sistema').insert({ id: ID_TESORERIA, ...columnas })
if (error) {
  console.error('No se pudo guardar la tesorería:', error.message)
  process.exit(1)
}
const publicKey = columnas.stellar_public_key
console.log('Tesorería guardada:', publicKey)

const res = await fetch(`${FRIENDBOT_URL}?addr=${encodeURIComponent(publicKey)}`)
if (!res.ok) {
  console.error(`Friendbot respondió ${res.status}. Reintenta solo este paso.`)
  process.exit(1)
}

const cuenta = await horizon.loadAccount(publicKey)
const tx = new StellarSdk.TransactionBuilder(cuenta, {
  fee: StellarSdk.BASE_FEE,
  networkPassphrase: StellarSdk.Networks.TESTNET,
})
  .addOperation(StellarSdk.Operation.changeTrust({ asset: USDC_TESTNET }))
  .setTimeout(60)
  .build()

const { data: fila } = await supabase
  .from('cuentas_sistema')
  .select('*')
  .eq('id', ID_TESORERIA)
  .single()
await withSeed(fila, ID_TESORERIA, (semilla) => {
  tx.sign(StellarSdk.Keypair.fromRawEd25519Seed(semilla))
})
const r = await horizon.submitTransaction(tx)

console.log('Trustline a USDC creada:', r.hash)
console.log('')
console.log('Siguiente paso: manda USDC de testnet a esta dirección desde el faucet de Circle:')
console.log(`  ${publicKey}`)
console.log(`  https://stellar.expert/explorer/testnet/account/${publicKey}`)
