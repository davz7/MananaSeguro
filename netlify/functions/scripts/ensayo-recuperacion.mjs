// Ensayo de recuperación de capacidad de firma.
//
// Uso:
//   node --env-file=../../.env scripts/ensayo-recuperacion.mjs <usuarioId>
//
// SOLO CON USUARIOS DE PRUEBA. El paso 3 destruye material de llave de
// verdad; si el proceso se interrumpiera entre el paso 3 y el 5, esa
// cuenta quedaría irrecuperable de forma permanente.
//
// Cubre el criterio de D1: "a user's signing capability restored from
// backup in a controlled test".

import { createClient } from '@supabase/supabase-js'
import { withSeed } from '../_lib/custody.js'

const usuarioId = process.argv[2]
if (!usuarioId) {
  console.error('Uso: node scripts/ensayo-recuperacion.mjs <usuarioId>')
  process.exit(1)
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
)

const COLUMNAS = [
  'seed_ciphertext',
  'seed_iv',
  'seed_auth_tag',
  'data_key_blob',
  'key_scheme_version',
  'key_material_id',
]

async function cargar() {
  const { data, error } = await supabase
    .from('usuarios').select('*').eq('id', usuarioId).single()
  if (error) {
    console.error(`No se encontró el usuario ${usuarioId}`)
    console.error('Detalle:', error.message)
    process.exit(1)
  }
  return data
}

/** Devuelve la llave pública reconstruida, o null si no se puede firmar. */
async function puedeFirmar(usuario) {
  const { Keypair } = await import('@stellar/stellar-sdk')
  try {
    return await withSeed(usuario, usuarioId, (semilla) =>
      Keypair.fromRawEd25519Seed(semilla).publicKey()
    )
  } catch {
    return null
  }
}

console.log('=== Ensayo de recuperación ===')
console.log('Usuario:', usuarioId, '\n')

// ── 1. Instantánea, como la tomaría un respaldo ──────────────────────────
const original = await cargar()
const instantanea = Object.fromEntries(COLUMNAS.map((c) => [c, original[c]]))
console.log('1. Instantánea tomada.')
console.log('   Llave pública registrada:', original.stellar_public_key)

// ── 2. Estado inicial ────────────────────────────────────────────────────
const antes = await puedeFirmar(original)
if (antes !== original.stellar_public_key) {
  console.error('2. El usuario NO puede firmar antes de empezar. Se aborta.')
  console.error('   No tiene sentido ensayar una recuperación desde un estado roto.')
  process.exit(1)
}
console.log('2. Puede firmar antes del ensayo.')

// ── 3. Destrucción del material ──────────────────────────────────────────
const vacio = Object.fromEntries(COLUMNAS.map((c) => [c, null]))
const { error: errorDestruccion } = await supabase
  .from('usuarios').update(vacio).eq('id', usuarioId)

if (errorDestruccion) {
  console.error('3. No se pudo destruir el material:', errorDestruccion.message)
  process.exit(1)
}
console.log('3. Material de custodia destruido.')

// ── 4. Comprobar que la pérdida es real ──────────────────────────────────
//
// Sin este paso el ensayo no probaría nada: un "funciona" al final podría
// significar que nunca se perdió nada.
const durante = await puedeFirmar(await cargar())
if (durante !== null) {
  console.error('4. FALLO: sigue pudiendo firmar tras destruir el material.')
  console.error('   La destrucción no fue efectiva. Restaurando y abortando.')
  await supabase.from('usuarios').update(instantanea).eq('id', usuarioId)
  process.exit(1)
}
console.log('4. Confirmado: ya no puede firmar.')

// ── 5. Restauración desde la instantánea ─────────────────────────────────
const { error: errorRestauracion } = await supabase
  .from('usuarios').update(instantanea).eq('id', usuarioId)

if (errorRestauracion) {
  console.error('5. FALLO EN LA RESTAURACIÓN:', errorRestauracion.message)
  console.error('   La cuenta quedó sin material. Instantánea para recuperarla:')
  console.error(JSON.stringify(instantanea, null, 2))
  process.exit(1)
}
console.log('5. Restaurado desde la instantánea.')

// ── 6. Verificación final ────────────────────────────────────────────────
const despues = await puedeFirmar(await cargar())
if (despues !== original.stellar_public_key) {
  console.error('6. FALLO: no recuperó la capacidad de firma.')
  process.exit(1)
}

console.log('6. Capacidad de firma recuperada.')
console.log('   Llave reconstruida:', despues)
console.log('\nEnsayo completado correctamente.')
