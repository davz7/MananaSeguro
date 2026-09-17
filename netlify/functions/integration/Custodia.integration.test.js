/**
 * Tests de integración — D1.
 *
 * Corren contra los servicios REALES: la CMK de KMS y Stellar testnet.
 * No sustituyen a los unitarios, los complementan: los unitarios prueban
 * la lógica con simuladores, estos prueban que los supuestos sobre AWS y
 * Stellar son ciertos.
 *
 * NO corren con `npm test`. Necesitan credenciales y red, crean usuarios
 * de verdad y gastan llamadas a KMS:
 *
 *   RUN_INTEGRATION=1 npx vitest run integration/
 *
 * Cada usuario creado se borra al final, también si un test falla.
 */

import {
  describe, it, expect, beforeAll, afterAll,
} from 'vitest'
import { randomUUID } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { KMSClient, GenerateDataKeyCommand } from '@aws-sdk/client-kms'
import * as StellarSdk from '@stellar/stellar-sdk'

import { createCustodialAccount, withSeed, _resetKmsClient } from '../_lib/custody.js'
import { reenvolverYVerificar } from '../_lib/rewrap.js'
import { ejecutarIntent } from '../_lib/soroban.js'

const ACTIVO = process.env.RUN_INTEGRATION === '1'
const d = ACTIVO ? describe : describe.skip

let _supabase

function db() {
  // Perezoso a propósito: si se creara al importar el módulo, se
  // ejecutaría incluso cuando los tests están saltados, y arrastraría
  // al CI las dependencias de runtime del cliente de Supabase.
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY,
      { auth: { persistSession: false } }
    )
  }
  return _supabase
}

const creados = []

/** Crea un usuario custodial completo y lo registra para limpieza. */
async function crearUsuario() {
  const id = randomUUID()
  const custodia = await createCustodialAccount(id)
  const fila = {
    id,
    email: `int-${Date.now()}-${id.slice(0, 8)}@mananaseguro.test`,
    nombre: 'Integración',
    customer_id: randomUUID(),
    bank_account_id: randomUUID(),
    kyc_status: 'pending',
    bank_account_status: 'pending',
    ...custodia,
  }
  const { error } = await db().from('usuarios').insert(fila)
  if (error) throw new Error(`No se pudo crear el usuario: ${error.message}`)
  creados.push(id)
  return fila
}

async function llavePublicaDesdeSemilla(usuario) {
  const { Keypair } = await import('@stellar/stellar-sdk')
  return withSeed(usuario, usuario.id, (s) =>
    Keypair.fromRawEd25519Seed(s).publicKey()
  )
}

beforeAll(async () => {
  if (!ACTIVO) return
  await import('@stellar/stellar-sdk')
}, 60_000)

afterAll(async () => {
  if (!ACTIVO || creados.length === 0) return
  // La limpieza respeta el orden de las claves foráneas.
  await db().from('intentos_firma').delete().in('usuario_id', creados)
  await db().from('usuarios').delete().in('id', creados)
})

d('INT-1 · Alta de cuenta custodial contra la CMK real', () => {
  it('genera, cifra y persiste material utilizable', async () => {
    const usuario = await crearUsuario()

    expect(usuario.stellar_public_key).toMatch(/^G[A-Z2-7]{55}$/)
    expect(usuario.key_scheme_version).toBe(1)

    const { data } = await db()
      .from('usuarios').select('*').eq('id', usuario.id).single()

    // Lo que quedó en la base no contiene ninguna semilla en claro.
    expect(JSON.stringify(data)).not.toMatch(/\bS[A-D][A-Z2-7]{54}\b/)
    expect(data.seed_ciphertext).toBeTruthy()
    expect(data.data_key_blob).toBeTruthy()
  }, 60_000)
})

d('INT-2 · Firma de una invocación Soroban en testnet', () => {
  it('produce un hash verificable en la red', async () => {
    const usuario = await crearUsuario()

    // Fondear: una cuenta Stellar no existe hasta recibir fondos.
    const r = await fetch(
      `https://friendbot.stellar.org/?addr=${usuario.stellar_public_key}`
    )
    expect(r.ok).toBe(true)

    // Sin trustline ni saldo USDC, el contrato rechaza en simulación.
    // Lo que este test comprueba es que la ruta llega hasta el contrato
    // con una firma válida, no que el depósito prospere.
    await expect(
      ejecutarIntent({ type: 'deposit', amountUsdc: 2, lockYears: 20 }, usuario)
    ).rejects.toMatchObject({
      code: expect.stringMatching(/TRUSTLINE_MISSING|INSUFFICIENT_BALANCE/),
    })
  }, 120_000)
})

d('INT-3 · Rechazo de descifrado cruzado entre usuarios', () => {
  it('el registro de A no se abre con la identidad de B', async () => {
    const a = await crearUsuario()
    const b = await crearUsuario()

    // El encryption context ata cada blob a su dueño. Este es el control
    // central del modelo y se comprueba contra KMS real, no simulado.
    await expect(withSeed(a, b.id, () => null)).rejects.toThrow()
    expect(await llavePublicaDesdeSemilla(a)).toBe(a.stellar_public_key)
  }, 60_000)
})

d('INT-4 · Rechazo sin los permisos del rol de firma', () => {
  it('la credencial base no puede usar la CMK por sí sola', async () => {
    // El usuario cuya access key vive en el entorno NO tiene permisos de
    // KMS: solo puede asumir el rol. Si este test pasara, ese salto no
    // estaría aportando nada.
    const sinRol = new KMSClient({
      region: process.env.MS_AWS_REGION,
      credentials: {
        accessKeyId: process.env.MS_AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.MS_AWS_SECRET_ACCESS_KEY,
      },
    })

    await expect(
      sinRol.send(
        new GenerateDataKeyCommand({
          KeyId: process.env.KMS_CUSTODY_KEY_ID,
          KeySpec: 'AES_256',
          EncryptionContext: { userId: 'no-deberia-funcionar' },
        })
      )
    ).rejects.toThrow(/not authorized/i)
  }, 30_000)
})

d('INT-5 · Rechazo de la CMK sin encryption context', () => {
  it('el rol de firma no puede operar sin el userId', async () => {
    const { kmsClient } = await import('../_lib/custody.js')

    // La condición vive en la key policy, no en el código. Sin este test
    // una política mal escrita se vería idéntica a una correcta.
    await expect(
      kmsClient().send(
        new GenerateDataKeyCommand({
          KeyId: process.env.KMS_CUSTODY_KEY_ID,
          KeySpec: 'AES_256',
        })
      )
    ).rejects.toThrow(/not authorized/i)
  }, 30_000)
})

d('INT-6 · Re-envoltura tras rotación', () => {
  it('el blob re-envuelto sigue abriendo la misma semilla', async () => {
    const usuario = await crearUsuario()

    const r = await reenvolverYVerificar(usuario)

    if (r === null) {
      // Ya estaba en el material actual: es el resultado correcto cuando
      // no ha habido rotación entre la creación y ahora.
      expect(await llavePublicaDesdeSemilla(usuario)).toBe(
        usuario.stellar_public_key
      )
      return
    }

    const movido = { ...usuario, ...r.columnas }
    expect(await llavePublicaDesdeSemilla(movido)).toBe(usuario.stellar_public_key)
  }, 60_000)
})

d('INT-7 · Recuperación desde respaldo', () => {
  it('una fila restaurada recupera la capacidad de firma', async () => {
    const usuario = await crearUsuario()

    const COLUMNAS = [
      'seed_ciphertext', 'seed_iv', 'seed_auth_tag',
      'data_key_blob', 'key_scheme_version', 'key_material_id',
    ]
    const instantanea = Object.fromEntries(COLUMNAS.map((c) => [c, usuario[c]]))

    // Pérdida
    await db()
      .from('usuarios')
      .update(Object.fromEntries(COLUMNAS.map((c) => [c, null])))
      .eq('id', usuario.id)

    const { data: roto } = await db()
      .from('usuarios').select('*').eq('id', usuario.id).single()

    // Comprobar que la pérdida es real. Sin este paso, el éxito final
    // podría significar que nunca se perdió nada.
    await expect(withSeed(roto, usuario.id, () => null)).rejects.toThrow()

    // Restauración
    await db().from('usuarios').update(instantanea).eq('id', usuario.id)

    const { data: restaurado } = await db()
      .from('usuarios').select('*').eq('id', usuario.id).single()

    expect(await llavePublicaDesdeSemilla(restaurado)).toBe(
      usuario.stellar_public_key
    )
  }, 60_000)
})

d('INT-8 · Límite de tasa en la firma de intenciones', () => {
  it('rechaza con RATE_LIMITED tras superar el umbral', async () => {
    const { handler } = await import('../sign-intent.js')
    const { issueSession } = await import('../_lib/session.js')

    const usuario = await crearUsuario()
    const { token } = await issueSession(usuario.id)

    const peticion = () => ({
      httpMethod: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify({
        intent: { type: 'deposit', amountUsdc: 2, lockYears: 20 },
        idempotencyKey: randomUUID(),
      }),
    })

    const codigos = []
    for (let i = 0; i < 13; i++) {
      const res = await handler(peticion())
      codigos.push(JSON.parse(res.body).code)
    }

    // Las primeras fallan por el contrato (sin trustline); a partir del
    // umbral el límite corta antes de llegar a la red.
    expect(codigos).toContain('RATE_LIMITED')
  }, 180_000)
})