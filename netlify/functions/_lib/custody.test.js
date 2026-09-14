import { describe, it, expect, beforeEach, vi } from 'vitest'
import { randomBytes } from 'crypto'
import {
  createCustodialAccount,
  withSeed,
  _setKmsClient,
  _resetKmsClient,
  KEY_SCHEME_VERSION,
} from './custody.js'

/**
 * KMS simulado.
 *
 * Reproduce lo que importa del comportamiento real: devuelve una data key
 * aleatoria, y al descifrar exige que el encryption context coincida
 * exactamente con el de la generación. Esa comprobación es el núcleo del
 * modelo: sin ella, el blob de un usuario abriría la semilla de otro.
 */
function crearKmsSimulado() {
  const blobs = new Map()
  const llamadas = []

  return {
    llamadas,
    cliente: {
      async send(comando) {
        const entrada = comando.input
        llamadas.push({ tipo: comando.constructor.name, entrada })

        if (comando.constructor.name === 'GenerateDataKeyCommand') {
          const dataKey = randomBytes(32)
          const blob = randomBytes(16).toString('hex')
          blobs.set(blob, {
            dataKey,
            contexto: JSON.stringify(entrada.EncryptionContext),
          })
          return {
            Plaintext: dataKey,
            CiphertextBlob: Buffer.from(blob, 'utf8'),
          }
        }

        if (comando.constructor.name === 'DecryptCommand') {
          const blob = Buffer.from(entrada.CiphertextBlob).toString('utf8')
          const guardado = blobs.get(blob)
          if (!guardado) throw new Error('InvalidCiphertextException')
          if (guardado.contexto !== JSON.stringify(entrada.EncryptionContext)) {
            // Es lo que devuelve KMS cuando el contexto no coincide.
            throw new Error('InvalidCiphertextException')
          }
          return { Plaintext: guardado.dataKey }
        }

        throw new Error('Comando no soportado por el simulador')
      },
    },
  }
}

let kms

beforeEach(() => {
  process.env.KMS_CUSTODY_KEY_ID = 'alias/manana-seguro-custody-testnet'
  process.env.MS_AWS_ROLE_ARN = 'arn:aws:iam::000000000000:role/Test'
  process.env.MS_AWS_ROLE_EXTERNAL_ID = 'external-id-de-prueba'
  kms = crearKmsSimulado()
  _setKmsClient(kms.cliente)
})

describe('createCustodialAccount — generación', () => {
  it('devuelve una llave pública Stellar válida', async () => {
    const r = await createCustodialAccount('usuario-A')
    expect(r.stellar_public_key).toMatch(/^G[A-Z2-7]{55}$/)
  })

  it('genera un keypair distinto en cada llamada', async () => {
    const a = await createCustodialAccount('usuario-A')
    const b = await createCustodialAccount('usuario-A')
    expect(a.stellar_public_key).not.toBe(b.stellar_public_key)
  })

  it('pide la data key con el userId en el encryption context', async () => {
    await createCustodialAccount('usuario-A')
    const gen = kms.llamadas.find((c) => c.tipo === 'GenerateDataKeyCommand')
    expect(gen.entrada.EncryptionContext).toEqual({ userId: 'usuario-A' })
  })

  it('pide una data key de 256 bits', async () => {
    await createCustodialAccount('usuario-A')
    const gen = kms.llamadas.find((c) => c.tipo === 'GenerateDataKeyCommand')
    expect(gen.entrada.KeySpec).toBe('AES_256')
  })

  it('rechaza generar sin userId', async () => {
    await expect(createCustodialAccount('')).rejects.toThrow()
  })
})

describe('createCustodialAccount — cifrado en reposo', () => {
  it('no devuelve la semilla en claro en ningún campo', async () => {
    const r = await createCustodialAccount('usuario-A')
    const serializado = JSON.stringify(r)
    // Una semilla de Stellar en formato strkey jamás debe aparecer.
    expect(serializado).not.toMatch(/\bS[A-D][A-Z2-7]{54}\b/)
  })

  it('devuelve exactamente las columnas del esquema, sin extras', async () => {
    const r = await createCustodialAccount('usuario-A')
    expect(Object.keys(r).sort()).toEqual(
      [
        'data_key_blob',
        'key_scheme_version',
        'seed_auth_tag',
        'seed_ciphertext',
        'seed_iv',
        'stellar_public_key',
      ].sort()
    )
  })

  it('usa un IV de 96 bits distinto en cada cifrado', async () => {
    const a = await createCustodialAccount('usuario-A')
    const b = await createCustodialAccount('usuario-A')
    expect(a.seed_iv).toHaveLength(24) // 12 bytes en hex
    expect(a.seed_iv).not.toBe(b.seed_iv)
  })

  it('persiste la etiqueta de autenticación', async () => {
    const r = await createCustodialAccount('usuario-A')
    expect(r.seed_auth_tag).toHaveLength(32) // 16 bytes en hex
  })

  it('marca la versión del esquema de cifrado', async () => {
    const r = await createCustodialAccount('usuario-A')
    expect(r.key_scheme_version).toBe(KEY_SCHEME_VERSION)
  })

  it('cada usuario obtiene una data key propia', async () => {
    const a = await createCustodialAccount('usuario-A')
    const b = await createCustodialAccount('usuario-B')
    expect(a.data_key_blob).not.toBe(b.data_key_blob)
  })
})

describe('withSeed — descifrado', () => {
  it('recupera la semilla que reconstruye la misma llave pública', async () => {
    const r = await createCustodialAccount('usuario-A')
    const { Keypair } = await import('@stellar/stellar-sdk')

    const publica = await withSeed(r, 'usuario-A', (semilla) =>
      Keypair.fromRawEd25519Seed(semilla).publicKey()
    )
    expect(publica).toBe(r.stellar_public_key)
  })

  it('pasa el encryption context correcto a KMS', async () => {
    const r = await createCustodialAccount('usuario-A')
    await withSeed(r, 'usuario-A', () => null)
    const dec = kms.llamadas.find((c) => c.tipo === 'DecryptCommand')
    expect(dec.entrada.EncryptionContext).toEqual({ userId: 'usuario-A' })
  })

  it('no descifra el registro de un usuario con la identidad de otro', async () => {
    const r = await createCustodialAccount('usuario-A')
    // El usuario B presenta el registro de A. KMS rechaza por contexto.
    await expect(withSeed(r, 'usuario-B', () => null)).rejects.toThrow()
  })

  it('rechaza un ciphertext manipulado', async () => {
    const r = await createCustodialAccount('usuario-A')
    const alterado = { ...r }
    const b = Buffer.from(r.seed_ciphertext, 'hex')
    b[0] ^= 0xff
    alterado.seed_ciphertext = b.toString('hex')
    await expect(withSeed(alterado, 'usuario-A', () => null)).rejects.toThrow()
  })

  it('rechaza una etiqueta de autenticación manipulada', async () => {
    const r = await createCustodialAccount('usuario-A')
    const b = Buffer.from(r.seed_auth_tag, 'hex')
    b[0] ^= 0xff
    await expect(
      withSeed({ ...r, seed_auth_tag: b.toString('hex') }, 'usuario-A', () => null)
    ).rejects.toThrow()
  })

  it('rechaza un registro incompleto nombrando lo que falta', async () => {
    const r = await createCustodialAccount('usuario-A')
    await expect(
      withSeed({ ...r, data_key_blob: null }, 'usuario-A', () => null)
    ).rejects.toThrow(/data_key_blob/)
  })

  it('rechaza una versión de esquema desconocida', async () => {
    const r = await createCustodialAccount('usuario-A')
    await expect(
      withSeed({ ...r, key_scheme_version: 99 }, 'usuario-A', () => null)
    ).rejects.toThrow(/99/)
  })
})

describe('withSeed — borrado de memoria', () => {
  it('pone la semilla a ceros al terminar', async () => {
    const r = await createCustodialAccount('usuario-A')
    let referencia
    await withSeed(r, 'usuario-A', (semilla) => {
      referencia = semilla
      expect(semilla.some((b) => b !== 0)).toBe(true)
    })
    // Fuera del callback la semilla ya no debe existir en memoria.
    expect(referencia.every((b) => b === 0)).toBe(true)
  })

  it('pone la semilla a ceros aunque la operación lance', async () => {
    const r = await createCustodialAccount('usuario-A')
    let referencia
    await expect(
      withSeed(r, 'usuario-A', (semilla) => {
        referencia = semilla
        throw new Error('fallo al firmar')
      })
    ).rejects.toThrow('fallo al firmar')
    // Este es el caso que un finally mal puesto se salta.
    expect(referencia.every((b) => b === 0)).toBe(true)
  })
})

describe('credenciales de KMS', () => {
  it('exige el ARN del rol', async () => {
    _resetKmsClient()
    delete process.env.MS_AWS_ROLE_ARN
    await expect(createCustodialAccount('usuario-A')).rejects.toThrow(
      /MS_AWS_ROLE_ARN/
    )
  })

  it('exige el external id', async () => {
    _resetKmsClient()
    process.env.MS_AWS_ROLE_ARN = 'arn:aws:iam::000000000000:role/Test'
    delete process.env.MS_AWS_ROLE_EXTERNAL_ID
    await expect(createCustodialAccount('usuario-A')).rejects.toThrow(
      /MS_AWS_ROLE_EXTERNAL_ID/
    )
  })
})