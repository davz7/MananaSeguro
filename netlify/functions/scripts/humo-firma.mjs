import { createClient } from '@supabase/supabase-js'
import { ejecutarIntent } from '../_lib/soroban.js'

const usuarioId = process.argv[2]
const tipo = process.argv[3] || 'deposit'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
)

const { data: usuario, error } = await supabase
  .from('usuarios').select('*').eq('id', usuarioId).single()
if (error) { console.error(error.message); process.exit(1) }

const intents = {
  deposit:      { type: 'deposit', amountUsdc: 2, lockYears: 20 },
  withdraw:     { type: 'withdraw' },
  request_loan: { type: 'request_loan', amountUsdc: 2 },
  repay_loan:   { type: 'repay_loan' },
}

const intent = intents[tipo]
console.log('Cuenta:   ', usuario.stellar_public_key)
console.log('Intención:', JSON.stringify(intent))

try {
  const inicio = Date.now()
  const r = await ejecutarIntent(intent, usuario)
  console.log('Hash:      ', r.hash)
  console.log('Duración:  ', Date.now() - inicio, 'ms')
  console.log('Explorador: https://stellar.expert/explorer/testnet/tx/' + r.hash)
} catch (err) {
  // El mensaje del contrato es lo más valioso de este paso: es lo que
  // permite convertir SIMULATION_FAILED en algo que el usuario entienda.
  console.error('Código: ', err.code ?? 'sin código')
  console.error('Mensaje:', err.message)
  process.exit(1)
}