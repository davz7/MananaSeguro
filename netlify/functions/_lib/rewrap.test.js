import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { randomBytes } from 'crypto'
import { reenvolverDataKey, reenvolverYVerificar } from './rewrap.js'
import { createCustodialAccount, _setKmsClient } from './custody.js'

beforeAll(async () => {
  await import('@stellar/stellar-sdk')
}, 30000)

/**
 * KMS simulado con materiales de llave.
 *
 * Reproduce lo que importa: cada blob recuerda con qué material fue
 * envuelto, ReEncrypt lo mueve al material actual, y el contexto de
 * cifrado debe coincidir para poder abrirlo.
 */
function crearKmsSimulado() {
  const blobs = new Map()
  const estado = { material: 'material-1', llamadas: [] }

  return {
    estado,
    cliente: {
      async send(comando) {
        const e = comando.input
        const tipo = comando.constructor.name
        estado.llamadas.push({ tipo, entrada: e })

        if (tipo === 'GenerateDataKeyCommand') {
          const dataKey = randomBytes(32)
          const blob = randomBytes(16).toString('hex')
          blobs.set(blob, {
            dataKey,
            ctx: JSON.stringify(e.EncryptionContext),
            material: estado.material,
          })
          return {
            Plaintext: dataKey,
            CiphertextBlob: Buffer.from(blob, 'utf8'),
            KeyMaterialId: estado.material,
          }
        }

        if (tipo === 'DecryptCommand') {
          const blob = Buffer.from(e.CiphertextBlob).toString('utf8')
          const g = blobs.get(blob)
          if (!g || g.ctx !== JSON.stringify(e.EncryptionContext)) {
            throw new Error('InvalidCiphertextException')
          }
          return { Plaintext: g.dataKey, KeyMaterialId: g.material }
        }

        if (tipo === 'ReEncryptCommand') {
          const blob = Buffer.from(e.CiphertextBlob).toString('utf8')
          const g = blobs.get(blob)
          if (!g) throw new Error('InvalidCiphertextException')
          if (g.ctx !== JSON.stringify(e.SourceEncryptionContext)) {
            throw new Error('IncorrectKeyException')
          }
          const nuevo = randomBytes(16).toString('hex')
          blobs.set(nuevo, {
            dataKey: g.dataKey,
            ctx: JSON.stringify(e.DestinationEncryptionContext),
            material: estado.material,
          })
          return {
            CiphertextBlob: Buffer.from(nuevo, 'utf8'),
            DestinationKeyMaterialId: estado.material,
          }
        }

        throw new Error('Comando no soportado: ' + tipo)
      },
    },
  }
}

let kms
let usuario

beforeEach(async () => {
  process.env.KMS_CUSTODY_KEY_ID = 'alias/prueba'
  process.env.MS_AWS_ROLE_ARN = 'arn:aws:iam::000000000000:role/Test'
  process.env.MS_AWS_ROLE_EXTERNAL_ID = randomBytes(16).toString('hex')

  kms = crearKmsSimulado()
  _setKmsClient(kms.cliente)

  const custodia = await createCustodialAccount('usuario-A')
  usuario = { id: 'usuario-A', key_material_id: 'material-1', ...custodia }
})

describe('reenvolverDataKey', () => {
  it('mueve el blob al material actual tras una rotación', async () => {
    kms.estado.material = 'material-2'
    const r = await reenvolverDataKey(usuario)
    expect(r.key_material_id).toBe('material-2')
    expect(r.data_key_blob).not.toBe(usuario.data_key_blob)
  })

  it('usa el mismo contexto en origen y destino', async () => {
    kms.estado.material = 'material-2'
    await reenvolverDataKey(usuario)
    const re = kms.estado.llamadas.find((c) => c.tipo === 'ReEncryptCommand')
    // La key policy solo restringe el contexto de destino, así que la
    // igualdad tiene que garantizarla la aplicación.
    expect(re.entrada.SourceEncryptionContext).toEqual({ userId: 'usuario-A' })
    expect(re.entrada.DestinationEncryptionContext).toEqual({ userId: 'usuario-A' })
  })

  it('no escribe nada si el material no cambió', async () => {
    // Sin rotación previa, re-envolver sería ruido: dejaría rewrapped_at
    // marcado sin que nada se hubiera movido.
    const r = await reenvolverDataKey(usuario)
    expect(r).toBeNull()
  })

  it('rechaza un usuario sin data_key_blob', async () => {
    await expect(
      reenvolverDataKey({ id: 'x', data_key_blob: null })
    ).rejects.toThrow(/data_key_blob/)
  })
})

describe('reenvolverYVerificar', () => {
  it('el blob re-envuelto sigue abriendo la misma semilla', async () => {
    kms.estado.material = 'material-2'
    const r = await reenvolverYVerificar(usuario)
    expect(r.verificado).toBe(true)
    expect(r.columnas.key_material_id).toBe('material-2')
  })

  it('devuelve null cuando no hay nada que mover', async () => {
    expect(await reenvolverYVerificar(usuario)).toBeNull()
  })

  it('no acepta el resultado si la semilla deja de reconstruir la llave', async () => {
    kms.estado.material = 'material-2'
    // Simula el peor caso: ReEncrypt "funciona" pero el blob resultante
    // no abre la semilla. Escribirlo dejaría la cuenta irrecuperable.
    const corrupto = { ...usuario, stellar_public_key: 'GOTRACOSA' }
    await expect(reenvolverYVerificar(corrupto)).rejects.toThrow(
      /Verificación fallida/
    )
  })

  it('el mensaje de fallo dice que no se escribió nada', async () => {
    kms.estado.material = 'material-2'
    const corrupto = { ...usuario, stellar_public_key: 'GOTRACOSA' }
    await expect(reenvolverYVerificar(corrupto)).rejects.toThrow(
      /No se escribe nada/
    )
  })
})

describe('los blobs viejos siguen funcionando tras rotar', () => {
  it('descifra un blob de material anterior sin re-envolver', async () => {
    kms.estado.material = 'material-2'
    const { Keypair } = await import('@stellar/stellar-sdk')
    const { withSeed } = await import('./custody.js')

    // Este es el comportamiento de AWS que hace insuficiente la rotación
    // automática como evidencia: nada se rompe, y por eso nadie se entera
    // de que los datos siguen atados al material anterior.
    const publica = await withSeed(usuario, 'usuario-A', (semilla) =>
      Keypair.fromRawEd25519Seed(semilla).publicKey()
    )
    expect(publica).toBe(usuario.stellar_public_key)
  })
})
