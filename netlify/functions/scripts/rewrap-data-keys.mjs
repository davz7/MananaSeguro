// Job de re-envoltura de data keys.
//
// Uso:
//   node --env-file=../../.env scripts/rewrap-data-keys.mjs --dry-run
//   node --env-file=../../.env scripts/rewrap-data-keys.mjs
//
// Recorre los usuarios con material de custodia y mueve cada data key al
// material actual de la CMK. Cada usuario se verifica antes de escribir:
// si la semilla re-envuelta no reconstruye su llave pública, esa fila se
// deja intacta y el job continúa con las demás.
//
// Es idempotente: volver a correrlo no hace nada sobre las filas que ya
// están en el material actual.

import { createClient } from '@supabase/supabase-js'
import { reenvolverYVerificar } from '../_lib/rewrap.js'

const ensayo = process.argv.includes('--dry-run')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
)

const { data: usuarios, error } = await supabase
  .from('usuarios')
  .select('*')
  .not('data_key_blob', 'is', null)
  .order('created_at', { ascending: true })

if (error) {
  console.error('Error al leer usuarios:', error.message)
  process.exit(1)
}

console.log(`Usuarios con custodia: ${usuarios.length}`)
if (ensayo) console.log('MODO ENSAYO: no se escribe en la base de datos\n')

const resultado = { movidos: 0, alDia: 0, fallidos: [] }

for (const usuario of usuarios) {
  try {
    const r = await reenvolverYVerificar(usuario)

    if (!r) {
      resultado.alDia++
      console.log(`  al día     ${usuario.id}  material ${usuario.key_material_id ?? 'sin registrar'}`)
      continue
    }

    if (ensayo) {
      resultado.movidos++
      console.log(`  movería    ${usuario.id}  → ${r.columnas.key_material_id}`)
      continue
    }

    const { error: errorUpdate } = await supabase
      .from('usuarios')
      .update({ ...r.columnas, rewrapped_at: new Date().toISOString() })
      .eq('id', usuario.id)

    if (errorUpdate) throw new Error(errorUpdate.message)

    resultado.movidos++
    console.log(`  movido     ${usuario.id}  → ${r.columnas.key_material_id}`)
  } catch (err) {
    // Un fallo aislado no detiene el job. Detenerse dejaría la mitad de
    // los usuarios movidos y la otra mitad no, sin registro de cuáles.
    resultado.fallidos.push({ id: usuario.id, error: err.message })
    console.error(`  FALLÓ      ${usuario.id}: ${err.message}`)
  }
}

console.log('\n=== Resumen ===')
console.log('Movidos: ', resultado.movidos)
console.log('Al día:  ', resultado.alDia)
console.log('Fallidos:', resultado.fallidos.length)

for (const f of resultado.fallidos) {
  console.log(`   ${f.id}: ${f.error}`)
}

// Salida distinta de cero si algo falló: permite encadenarlo con otras
// comprobaciones sin que un fallo pase inadvertido.
process.exit(resultado.fallidos.length === 0 ? 0 : 1)
