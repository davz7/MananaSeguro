import { randomUUID } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { createCustodialAccount } from '../_lib/custody.js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
)

// El id se genera aquí porque el encryption context de KMS lo necesita
// antes de cifrar. Es el mismo orden que sigue auth-google.js.
const usuarioId = randomUUID()
const marca = Date.now()

console.log('Generando material de custodia para', usuarioId)
const custodia = await createCustodialAccount(usuarioId)

const fila = {
  id: usuarioId,
  // El prefijo hace trivial encontrarlo y borrarlo después.
  email: `prueba-${marca}@mananaseguro.test`,
  nombre: 'Usuario de prueba',
  customer_id: randomUUID(),
  bank_account_id: randomUUID(),
  kyc_status: 'pending',
  bank_account_status: 'pending',
  ...custodia,
}

const { error } = await supabase.from('usuarios').insert(fila)
if (error) {
  console.error('Error al insertar:', error.message)
  process.exit(1)
}

console.log('\n=== Usuario creado ===')
console.log('USUARIO_ID     ', usuarioId)
console.log('LLAVE_PUBLICA  ', custodia.stellar_public_key)
console.log('email          ', fila.email)