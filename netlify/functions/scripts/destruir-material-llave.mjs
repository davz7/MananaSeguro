// Destrucción de material de llave custodial.
//
// OPERACIÓN IRREVERSIBLE. Sin la data key no hay forma de reconstruir la
// semilla, ni siquiera con acceso total a KMS. Los fondos de esa cuenta
// quedan inalcanzables para siempre.
//
// Uso:
//   node --env-file=../../.env scripts/destruir-material-llave.mjs \
//     --usuario <id> --autor "nombre" --motivo "texto"
//
// La confirmación se hace escribiendo la LLAVE PÚBLICA de la cuenta, no
// su id. Es deliberado: un id copiado de la fila equivocada se pega sin
// notarlo, mientras que teclear la llave pública obliga a mirar de qué
// cuenta se trata. El objetivo no es la seguridad criptográfica, es
// forzar una pausa consciente.

import { createInterface } from 'readline/promises'
import { stdin, stdout } from 'process'
import { createClient } from '@supabase/supabase-js'

function arg(nombre) {
  const i = process.argv.indexOf(`--${nombre}`)
  return i === -1 ? null : process.argv[i + 1]
}

const usuarioId = arg('usuario')
const autor = arg('autor')
const motivo = arg('motivo')

if (!usuarioId || !autor || !motivo) {
  console.error('Faltan argumentos.')
  console.error('Uso: --usuario <id> --autor "nombre" --motivo "texto"')
  console.error('\nEl autor y el motivo quedan registrados y son obligatorios:')
  console.error('una destrucción sin constancia de quién y por qué no se puede')
  console.error('auditar después.')
  process.exit(1)
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
)

const { data: usuario, error } = await supabase
  .from('usuarios').select('*').eq('id', usuarioId).single()

if (error) {
  console.error(`No se encontró el usuario ${usuarioId}`)
  console.error('Detalle:', error.message)
  process.exit(1)
}

if (usuario.key_destroyed_at) {
  console.log('Este usuario ya tiene su material destruido.')
  console.log('  Fecha: ', usuario.key_destroyed_at)
  console.log('  Autor: ', usuario.key_destroyed_by)
  console.log('  Motivo:', usuario.key_destroyed_reason)
  process.exit(0)
}

if (!usuario.data_key_blob) {
  console.error('El usuario no tiene material de custodia, pero tampoco está')
  console.error('marcado como destruido. Ese estado es inconsistente y hay que')
  console.error('revisarlo antes de escribir nada.')
  process.exit(1)
}

// ── Lo que se va a destruir, a la vista ──────────────────────────────────
console.log('\n' + '='.repeat(60))
console.log('DESTRUCCIÓN DE MATERIAL DE LLAVE — IRREVERSIBLE')
console.log('='.repeat(60))
console.log('Usuario:       ', usuario.id)
console.log('Correo:        ', usuario.email)
console.log('Llave pública: ', usuario.stellar_public_key)
console.log('Dado de baja:  ', usuario.deleted_at ?? 'NO')
console.log('Autor:         ', autor)
console.log('Motivo:        ', motivo)
console.log('='.repeat(60))
console.log('\nTras esto, los fondos de esta cuenta serán inalcanzables de forma')
console.log('permanente. El historial financiero NO se borra.\n')

if (!usuario.deleted_at) {
  console.log('AVISO: este usuario no está dado de baja. Lo habitual es dar de')
  console.log('baja primero y destruir el material después.\n')
}

// ── Confirmación ─────────────────────────────────────────────────────────
const rl = createInterface({ input: stdin, output: stdout })

const respuesta = await rl.question(
  'Escribe la LLAVE PÚBLICA completa para confirmar:\n> '
)
rl.close()

if (respuesta.trim() !== usuario.stellar_public_key) {
  console.error('\nNo coincide. No se destruyó nada.')
  process.exit(1)
}

// ── Ejecución ────────────────────────────────────────────────────────────
const { error: errorDestruccion } = await supabase
  .from('usuarios')
  .update({
    seed_ciphertext: null,
    seed_iv: null,
    seed_auth_tag: null,
    data_key_blob: null,
    key_scheme_version: null,
    key_material_id: null,
    key_destroyed_at: new Date().toISOString(),
    key_destroyed_by: autor,
    key_destroyed_reason: motivo,
  })
  .eq('id', usuarioId)

if (errorDestruccion) {
  console.error('\nError al destruir:', errorDestruccion.message)
  process.exit(1)
}

console.log('\nMaterial destruido y registro guardado.')
console.log('El historial financiero del usuario permanece intacto.')
