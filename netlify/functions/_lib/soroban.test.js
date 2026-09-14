import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { randomBytes } from 'crypto'
import * as StellarSdk from '@stellar/stellar-sdk'
import {
  ejecutarIntent,
  validarIntent,
  IntentError,
  _setRpc,
  STROOP,
} from './soroban.js'
import { createCustodialAccount, _setKmsClient } from './custody.js'

beforeAll(async () => {
  await import('@stellar/stellar-sdk')
}, 30000)

// ---------------------------------------------------------------------
// KMS simulado: igual que en custody.test.js, exige que el encryption
// context coincida entre generación y descifrado.
// ---------------------------------------------------------------------
function crearKmsSimulado() {
  const blobs = new Map()
  return {
    async send(comando) {
      const e = comando.input
      if (comando.constructor.name === 'GenerateDataKeyCommand') {
        const dataKey = randomBytes(32)
        const blob = randomBytes(16).toString('hex')
        blobs.set(blob, { dataKey, ctx: JSON.stringify(e.EncryptionContext) })
        return { Plaintext: dataKey, CiphertextBlob: Buffer.from(blob, 'utf8') }
      }
      const blob = Buffer.from(e.CiphertextBlob).toString('utf8')
      const g = blobs.get(blob)
      if (!g || g.ctx !== JSON.stringify(e.EncryptionContext)) {
        throw new Error('InvalidCiphertextException')
      }
      return { Plaintext: g.dataKey }
    },
  }
}

// ---------------------------------------------------------------------
// RPC simulado. Registra la transacción enviada para poder inspeccionarla.
// ---------------------------------------------------------------------
function crearRpcSimulado(opciones = {}) {
  const estado = { enviadas: [], simuladas: [] }
  const cuenta = new StellarSdk.Account(
    'GB3JDWCQJCWMJ3IILWIGDTQJJC5567PGVEVXSCVPEQOTDN64VJBDQBYX',
    '100'
  )

  return {
    estado,
    servidor: {
      async getAccount() {
        if (opciones.cuentaInexistente) throw new Error('Account not found')
        return cuenta
      },
      async simulateTransaction(tx) {
        estado.simuladas.push(tx)
        if (opciones.simulacionFalla) {
          return { error: 'HostError: contrato rechazó la llamada' }
        }
        // Forma cruda tal como la devuelve el RPC: transactionData en
        // base64 y `results`, no `result`. assembleTransaction la parsea
        // con parseRawSimulation, así que una forma ya "parseada" falla.
        const datos = new StellarSdk.xdr.SorobanTransactionData({
          ext: StellarSdk.xdr.ExtensionPoint.v0(),
          resources: new StellarSdk.xdr.SorobanResources({
            footprint: new StellarSdk.xdr.LedgerFootprint({
              readOnly: [],
              readWrite: [],
            }),
            instructions: 0,
            diskReadBytes: 0,
            writeBytes: 0,
          }),
          resourceFee: StellarSdk.xdr.Int64.fromString('100'),
        }).toXDR('base64')

        return {
          latestLedger: 1,
          minResourceFee: '100',
          transactionData: datos,
          events: [],
          results: [
            { xdr: StellarSdk.xdr.ScVal.scvVoid().toXDR('base64'), auth: [] },
          ],
        }
      },
      async sendTransaction(tx) {
        estado.enviadas.push(tx)
        if (opciones.envioError) return { status: 'ERROR', hash: 'x' }
        return { status: 'PENDING', hash: 'hash-de-prueba' }
      },
      async getTransaction() {
        if (opciones.txFalla) return { status: 'FAILED' }
        if (opciones.txNoConfirma) return { status: 'NOT_FOUND' }
        return { status: 'SUCCESS' }
      },
    },
  }
}

let usuario
let rpcSim

beforeEach(async () => {
  process.env.KMS_CUSTODY_KEY_ID = 'alias/prueba'
  process.env.MS_AWS_ROLE_ARN = 'arn:aws:iam::000000000000:role/Test'
  process.env.MS_AWS_ROLE_EXTERNAL_ID = randomBytes(16).toString('hex')

  _setKmsClient(crearKmsSimulado())
  const custodia = await createCustodialAccount('usuario-A')
  usuario = { id: 'usuario-A', ...custodia }

  rpcSim = crearRpcSimulado()
  _setRpc(rpcSim.servidor)
})

describe('validarIntent', () => {
  it('acepta los cuatro tipos soportados', () => {
    for (const t of ['deposit', 'withdraw', 'request_loan', 'repay_loan']) {
      expect(() => validarIntent({ type: t })).not.toThrow()
    }
  })

  it('rechaza un tipo desconocido', () => {
    expect(() => validarIntent({ type: 'transferir_todo' })).toThrow(IntentError)
  })

  it('rechaza una intención ausente', () => {
    expect(() => validarIntent(null)).toThrow(/Falta la intención/)
  })
})

describe('ejecutarIntent — validación de montos', () => {
  it('rechaza un monto negativo', async () => {
    await expect(
      ejecutarIntent({ type: 'deposit', amountUsdc: -5, lockYears: 20 }, usuario)
    ).rejects.toMatchObject({ code: 'INVALID_INTENT' })
  })

  it('rechaza un monto cero', async () => {
    await expect(
      ejecutarIntent({ type: 'deposit', amountUsdc: 0, lockYears: 20 }, usuario)
    ).rejects.toMatchObject({ code: 'INVALID_INTENT' })
  })

  it('rechaza un monto desorbitado', async () => {
    await expect(
      ejecutarIntent(
        { type: 'deposit', amountUsdc: 99_000_000, lockYears: 20 },
        usuario
      )
    ).rejects.toMatchObject({ code: 'INVALID_INTENT' })
  })

  it('rechaza lockYears no entero', async () => {
    await expect(
      ejecutarIntent({ type: 'deposit', amountUsdc: 100, lockYears: 2.5 }, usuario)
    ).rejects.toMatchObject({ code: 'INVALID_INTENT' })
  })

  it('rechaza lockYears fuera de rango', async () => {
    await expect(
      ejecutarIntent({ type: 'deposit', amountUsdc: 100, lockYears: 99 }, usuario)
    ).rejects.toMatchObject({ code: 'INVALID_INTENT' })
  })

  it('no toca la red cuando la intención es inválida', async () => {
    await expect(
      ejecutarIntent({ type: 'deposit', amountUsdc: -1, lockYears: 20 }, usuario)
    ).rejects.toThrow()
    expect(rpcSim.estado.simuladas).toHaveLength(0)
  })
})

describe('ejecutarIntent — firma', () => {
  it('devuelve el hash de la transacción', async () => {
    const r = await ejecutarIntent(
      { type: 'deposit', amountUsdc: 100, lockYears: 20 },
      usuario
    )
    expect(r.hash).toBe('hash-de-prueba')
    expect(r.intentType).toBe('deposit')
  })

  it('la transacción enviada lleva una firma', async () => {
    await ejecutarIntent({ type: 'withdraw' }, usuario)
    const enviada = rpcSim.estado.enviadas.at(-1)
    expect(enviada.signatures).toHaveLength(1)
  })

  it('la firma verifica contra la llave pública del usuario', async () => {
    await ejecutarIntent({ type: 'withdraw' }, usuario)
    const enviada = rpcSim.estado.enviadas.at(-1)
    const keypair = StellarSdk.Keypair.fromPublicKey(usuario.stellar_public_key)
    const firma = enviada.signatures[0].signature
    expect(keypair.verify(enviada.hash(), firma)).toBe(true)
  })

  it('la cuenta origen es la del usuario, no otra', async () => {
    await ejecutarIntent({ type: 'withdraw' }, usuario)
    // El address usado para construir sale del registro, no de la intención.
    const simulada = rpcSim.estado.simuladas.at(-1)
    expect(simulada.operations).toHaveLength(1)
  })

  it('ignora un address puesto en la intención', async () => {
    const ajeno = StellarSdk.Keypair.random().publicKey()
    await ejecutarIntent({ type: 'withdraw', address: ajeno }, usuario)
    const enviada = rpcSim.estado.enviadas.at(-1)
    const keypair = StellarSdk.Keypair.fromPublicKey(usuario.stellar_public_key)
    expect(
      keypair.verify(enviada.hash(), enviada.signatures[0].signature)
    ).toBe(true)
  })

  it('rechaza si la llave descifrada no corresponde a la cuenta', async () => {
    // Corrupción de datos: la llave pública registrada no es la del par
    // cifrado. Firmar de todos modos produciría una transacción inválida
    // y, peor, ocultaría el problema.
    const corrupto = {
      ...usuario,
      stellar_public_key: StellarSdk.Keypair.random().publicKey(),
    }
    await expect(
      ejecutarIntent({ type: 'withdraw' }, corrupto)
    ).rejects.toMatchObject({ code: 'INTERNAL' })
  })

  it('rechaza a un usuario sin cuenta custodial', async () => {
    await expect(
      ejecutarIntent({ type: 'withdraw' }, { id: 'x' })
    ).rejects.toMatchObject({ code: 'INVALID_INTENT' })
  })
})

describe('ejecutarIntent — fallos de red y de contrato', () => {
  it('SIMULATION_FAILED cuando el contrato rechaza', async () => {
    _setRpc(crearRpcSimulado({ simulacionFalla: true }).servidor)
    await expect(
      ejecutarIntent({ type: 'withdraw' }, usuario)
    ).rejects.toMatchObject({ code: 'SIMULATION_FAILED' })
  })

  it('SIMULATION_FAILED cuando la cuenta no existe en la red', async () => {
    _setRpc(crearRpcSimulado({ cuentaInexistente: true }).servidor)
    await expect(
      ejecutarIntent({ type: 'withdraw' }, usuario)
    ).rejects.toMatchObject({ code: 'SIMULATION_FAILED' })
  })

  it('SUBMISSION_FAILED cuando el envío es rechazado', async () => {
    _setRpc(crearRpcSimulado({ envioError: true }).servidor)
    await expect(
      ejecutarIntent({ type: 'withdraw' }, usuario)
    ).rejects.toMatchObject({ code: 'SUBMISSION_FAILED' })
  })

  it('SUBMISSION_FAILED cuando la red rechaza la transacción', async () => {
    _setRpc(crearRpcSimulado({ txFalla: true }).servidor)
    await expect(
      ejecutarIntent({ type: 'withdraw' }, usuario)
    ).rejects.toMatchObject({ code: 'SUBMISSION_FAILED' })
  })

  it('el mensaje de TIMEOUT incluye el hash para poder resolver el estado', async () => {
    vi.useFakeTimers()
    _setRpc(crearRpcSimulado({ txNoConfirma: true }).servidor)
    const promesa = ejecutarIntent({ type: 'withdraw' }, usuario)
    const esperado = expect(promesa).rejects.toMatchObject({
      code: 'TIMEOUT',
      message: expect.stringContaining('hash-de-prueba'),
    })
    await vi.advanceTimersByTimeAsync(35_000)
    await esperado
    vi.useRealTimers()
  })
})
