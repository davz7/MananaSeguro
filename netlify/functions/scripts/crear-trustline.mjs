import { createClient } from '@supabase/supabase-js'
import * as StellarSdk from '@stellar/stellar-sdk'
import { withSeed } from '../_lib/custody.js'

const [usuarioId, codigo, emisor] = process.argv.slice(2)
if (!emisor) {
  console.error('Uso: node scripts/crear-trustline.mjs <usuarioId> <CODIGO> <EMISOR>')
  process.exit(1)
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
)

const { data: usuario } = await supabase
  .from('usuarios').select('*').eq('id', usuarioId).single()

// La trustline es una operación clásica de Stellar, no Soroban: va por
// Horizon y no necesita simulación ni ensamblado.
const horizon = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org')
const cuenta = await horizon.loadAccount(usuario.stellar_public_key)

const tx = new StellarSdk.TransactionBuilder(cuenta, {
  fee: StellarSdk.BASE_FEE,
  networkPassphrase: StellarSdk.Networks.TESTNET,
})
  .addOperation(
    StellarSdk.Operation.changeTrust({
      asset: new StellarSdk.Asset(codigo, emisor),
    })
  )
  .setTimeout(30)
  .build()

await withSeed(usuario, usuarioId, (semilla) => {
  tx.sign(StellarSdk.Keypair.fromRawEd25519Seed(semilla))
})

const r = await horizon.submitTransaction(tx)
console.log('Trustline creada. Hash:', r.hash)