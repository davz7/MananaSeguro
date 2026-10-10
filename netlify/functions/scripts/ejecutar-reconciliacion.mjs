/**
 * Ejecuta la reconciliación fiat↔Stellar y guarda el resultado como evidencia.
 *
 * Solo lectura: consulta la tabla ordenes (select) y Horizon testnet.
 * Lee las credenciales de process.env; ejecútalo desde la raíz del repo con:
 *
 *   node --env-file=.env netlify/functions/scripts/ejecutar-reconciliacion.mjs
 */
import { readFile, writeFile } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import { createLogger } from '../_lib/logger.js'
import { reconciliarOrdenes, consultarTransaccionStellar } from '../_lib/reconciliation.js'

const DIR_SCRIPT = path.dirname(fileURLToPath(import.meta.url))
const DIR_EVIDENCIA = path.resolve(DIR_SCRIPT, '../../../docs/evidencia')
const ARCHIVO_HASHES = path.join(DIR_EVIDENCIA, 'testnet-hashes.json')
const ARCHIVO_RESULTADO = path.join(DIR_EVIDENCIA, 'reconciliacion-resultado.json')

const PAUSA_MS = 300

const pausa = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const abreviar = (hash) => `${String(hash).slice(0, 8)}…`

function contarPor(lista, campo) {
  const conteo = {}
  for (const item of lista) {
    conteo[item[campo]] = (conteo[item[campo]] ?? 0) + 1
  }
  return conteo
}

async function parteA(supabase, log) {
  const reporte = await reconciliarOrdenes(supabase, log)
  const porEstado = contarPor(reporte, 'estado_reconciliacion')
  const porOrigen = contarPor(reporte, 'origen')

  console.log('\n=== Parte A: órdenes completed en Supabase ===')
  console.log(`Total de órdenes completed: ${reporte.length}`)
  console.log('Por estado_reconciliacion:')
  console.table(porEstado)
  console.log('Por origen:')
  console.table(porOrigen)

  return { total: reporte.length, por_estado: porEstado, por_origen: porOrigen, reporte }
}

async function parteB(log) {
  const evidencia = JSON.parse(await readFile(ARCHIVO_HASHES, 'utf8'))
  const transacciones = evidencia.transacciones ?? []
  const detalle = []

  for (const { hash } of transacciones) {
    const tx = await consultarTransaccionStellar(hash, log)
    detalle.push({
      hash: abreviar(hash),
      existe: tx !== null,
      successful: tx?.successful ?? null,
      source_account: tx?.source_account ?? null,
      created_at: tx?.created_at ?? null,
    })
    await pausa(PAUSA_MS)
  }

  const existentes = detalle.filter((d) => d.existe)
  const exitosas = detalle.filter((d) => d.successful === true)
  const cuentas = new Set(existentes.map((d) => d.source_account).filter(Boolean))
  const fechas = existentes.map((d) => d.created_at).filter(Boolean).sort()
  const rango = fechas.length
    ? { desde: fechas[0], hasta: fechas[fechas.length - 1] }
    : null

  console.log('\n=== Parte B: hashes de evidencia en Horizon testnet ===')
  console.table(detalle.map(({ hash, existe, successful, created_at }) => ({ hash, existe, successful, created_at })))
  console.log(`Existen: ${existentes.length} de ${transacciones.length}`)
  console.log(`Con successful=true: ${exitosas.length}`)
  console.log(`Cuentas de origen distintas: ${cuentas.size}`)
  console.log(rango
    ? `Rango de created_at (Horizon): ${rango.desde} → ${rango.hasta}`
    : 'Rango de created_at (Horizon): sin datos')

  return {
    total: transacciones.length,
    existen: existentes.length,
    successful_true: exitosas.length,
    cuentas_origen_distintas: cuentas.size,
    rango_created_at: rango,
    detalle,
  }
}

async function main() {
  const faltantes = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY'].filter((nombre) => !process.env[nombre])
  if (faltantes.length > 0) {
    // Solo el nombre, nunca el valor.
    for (const nombre of faltantes) console.log(`FALTA    ${nombre}`)
    process.exit(1)
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
  const log = createLogger('ejecutar-reconciliacion')

  const resultadoA = await parteA(supabase, log)
  const resultadoB = await parteB(log)

  const resultado = {
    fecha_ejecucion: new Date().toISOString(),
    parte_a_ordenes: resultadoA,
    parte_b_hashes_testnet: resultadoB,
  }
  await writeFile(ARCHIVO_RESULTADO, JSON.stringify(resultado, null, 2) + '\n', 'utf8')
  console.log(`\nResultado guardado en ${path.relative(process.cwd(), ARCHIVO_RESULTADO)}`)
}

main().catch((err) => {
  console.error('La reconciliación falló:', err.message)
  process.exit(1)
})
