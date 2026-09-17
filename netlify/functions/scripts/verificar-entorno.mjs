const REQUERIDAS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'SESSION_SIGNING_KEY',
  'KMS_CUSTODY_KEY_ID',
  'MS_AWS_ACCESS_KEY_ID',
  'MS_AWS_SECRET_ACCESS_KEY',
  'MS_AWS_REGION',
  'MS_AWS_ROLE_ARN',
  'MS_AWS_ROLE_EXTERNAL_ID',
]

let faltan = 0
for (const nombre of REQUERIDAS) {
  const valor = process.env[nombre]
  if (!valor) {
    console.log(`FALTA    ${nombre}`)
    faltan++
  } else {
    // Nunca imprimas el valor completo de un secreto, ni en tu propia
    // terminal: las capturas de pantalla acaban en documentos.
    console.log(`ok       ${nombre}  (${valor.length} caracteres)`)
  }
}

if ((process.env.SESSION_SIGNING_KEY?.length ?? 0) < 32) {
  console.log('AVISO    SESSION_SIGNING_KEY mide menos de 32 caracteres')
  faltan++
}
if (!process.env.KMS_CUSTODY_KEY_ID?.includes('manana-seguro-custody-testnet')) {
  console.log('AVISO    KMS_CUSTODY_KEY_ID no parece la llave de testnet')
}

console.log(faltan === 0 ? '\nEntorno completo.' : `\n${faltan} problema(s).`)
process.exit(faltan === 0 ? 0 : 1)