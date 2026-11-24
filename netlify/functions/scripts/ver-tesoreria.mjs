// Muestra el saldo de la cuenta tesorera y cuántos fondeos alcanza a cubrir.
//
//   node scripts/ver-tesoreria.mjs

import { createClient } from '@supabase/supabase-js'
import * as StellarSdk from '@stellar/stellar-sdk'
import {
  HORIZON_TESTNET,
  ID_TESORERIA,
  MONTO_FONDEO_USDC,
  USDC_TESTNET,
} from '../_lib/fondeoTestnet.js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
})
const { data } = await supabase
  .from('cuentas_sistema')
  .select('stellar_public_key')
  .eq('id', ID_TESORERIA)
  .maybeSingle()
if (!data) {
  console.error('No existe la tesorería. Créala con scripts/crear-tesoreria.mjs')
  process.exit(1)
}

const cuenta = await new StellarSdk.Horizon.Server(HORIZON_TESTNET).loadAccount(
  data.stellar_public_key
)
const usdc = cuenta.balances.find(
  (b) => b.asset_code === USDC_TESTNET.getCode() && b.asset_issuer === USDC_TESTNET.getIssuer()
)
const xlm = cuenta.balances.find((b) => b.asset_type === 'native')

const { count } = await supabase
  .from('fondeos_testnet')
  .select('usuario_id', { count: 'exact', head: true })
  .eq('estado', 'completado')

console.log('Tesorería:', data.stellar_public_key)
console.log('XLM:      ', xlm?.balance ?? '0')
console.log('USDC:     ', usdc?.balance ?? 'sin trustline')
console.log('Alcanza para', Math.floor(Number(usdc?.balance ?? 0) / Number(MONTO_FONDEO_USDC)), 'fondeos más')
console.log('Fondeos completados:', count ?? 0)
