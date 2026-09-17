import { createClient } from '@supabase/supabase-js'
import { withSeed } from '../_lib/custody.js'

const usuarioId = process.argv[2]
if (!usuarioId) {
  console.error('Uso: node scripts/humo-kms.mjs <usuarioId>')
  process.exit(1)
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
)

const { data: usuario, error } = await supabase
  .from('usuarios').select('*').eq('id', usuarioId).single()
if (error) { console.error(error.message); process.exit(1) }

const { Keypair } = await import('@stellar/stellar-sdk')

console.log('1. Descifrando con el contexto correcto...')
const recuperada = await withSeed(usuario, usuarioId, (semilla) =>
  Keypair.fromRawEd25519Seed(semilla).publicKey()
)
console.log('   Llave reconstruida:', recuperada)
console.log('   Coincide con la registrada:', recuperada === usuario.stellar_public_key)

console.log('\n2. Intentando descifrar con la identidad de otro usuario...')
try {
  await withSeed(usuario, 'usuario-que-no-es-el-dueno', () => null)
  console.log('   FALLO DE SEGURIDAD: KMS aceptó un contexto incorrecto')
  process.exit(1)
} catch (err) {
  console.log('   Rechazado correctamente:', err.name)
}

console.log('\n3. Intentando descifrar un ciphertext manipulado...')
const manipulado = Buffer.from(usuario.seed_ciphertext, 'hex')
manipulado[0] ^= 0xff
try {
  await withSeed(
    { ...usuario, seed_ciphertext: manipulado.toString('hex') },
    usuarioId,
    () => null
  )
  console.log('   FALLO: se aceptó un ciphertext alterado')
  process.exit(1)
} catch {
  console.log('   Rechazado correctamente por la etiqueta GCM')
}

console.log('\nTodo correcto.')