import * as StellarSdk from '@stellar/stellar-sdk'
import { withSeed } from './custody.js'
import { traducirErrorContrato } from './erroresContrato.js'

/**
 * Construcción, firma y envío de transacciones Soroban del lado del servidor.
 *
 * El cliente manda una INTENCIÓN tipada ({ type, amountUsdc, lockYears }) y
 * el servidor construye la transacción él mismo. Nunca firma un XDR que le
 * llegue de fuera.
 *
 * La alternativa —que el cliente arme el XDR y el servidor solo lo firme—
 * obligaría a validar XDR arbitrario: cuenta origen, tipo de operación,
 * contrato invocado, función, argumentos, ausencia de operaciones extra y
 * de entradas de autorización a favor de terceros. Un hueco en ese parser
 * es pérdida de fondos. Aquí la superficie de entrada es un objeto con dos
 * números, y el servidor no puede ser inducido a firmar otra cosa.
 */

export const CONTRACT_ID =
  process.env.SOROBAN_CONTRACT_ID ||
  'CA4M25CNPPXIPLXZLJZQBPAOKY5REKUOFNJVTMGJ4RKK4QYNIYIG6NLP'

export const STROOP = 10_000_000

const RPC_URL = process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org'
const NETWORK_PASSPHRASE =
  process.env.STELLAR_NETWORK_PASSPHRASE || StellarSdk.Networks.TESTNET

// Límites de la intención. Son validación de entrada, no reglas de negocio:
// las reglas del producto (comisiones, restricciones de retiro) están fuera
// del alcance de este sprint y viven en el contrato.
const MONTO_MAXIMO_USDC = 1_000_000
const ANIOS_MIN = 1
const ANIOS_MAX = 40 // el contrato acepta de 1 a 40; más arriba lo rechaza

const TIMEOUT_TX_SEGUNDOS = 30
const ESPERA_MAX_MS = 30_000
const INTERVALO_SONDEO_MS = 1_000

export class IntentError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'IntentError'
    this.code = code
  }
}

let rpcServer

function rpc() {
  if (!rpcServer) rpcServer = new StellarSdk.rpc.Server(RPC_URL)
  return rpcServer
}

/** Solo para pruebas: permite inyectar un servidor RPC. */
export function _setRpc(servidor) {
  rpcServer = servidor
}

// ---------------------------------------------------------------------
// Intenciones soportadas
//
// Cada entrada declara la función del contrato y cómo se construyen sus
// argumentos. La lista es cerrada: un `type` que no esté aquí se rechaza
// antes de tocar la red.
// ---------------------------------------------------------------------

function montoAStroops(valor, campo) {
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor <= 0) {
    throw new IntentError('INVALID_INTENT', `${campo} debe ser un número mayor que cero`)
  }
  if (valor > MONTO_MAXIMO_USDC) {
    throw new IntentError('INVALID_INTENT', `${campo} excede el máximo permitido`)
  }
  return Math.floor(valor * STROOP)
}

const INTENCIONES = {
  deposit: {
    funcion: 'depositar',
    args: (intent, address) => {
      const stroops = montoAStroops(intent.amountUsdc, 'amountUsdc')
      const anios = intent.lockYears
      if (!Number.isInteger(anios) || anios < ANIOS_MIN || anios > ANIOS_MAX) {
        throw new IntentError(
          'INVALID_INTENT',
          `lockYears debe ser un entero entre ${ANIOS_MIN} y ${ANIOS_MAX}`
        )
      }
      return [
        StellarSdk.nativeToScVal(address, { type: 'address' }),
        StellarSdk.nativeToScVal(stroops, { type: 'i128' }),
        StellarSdk.nativeToScVal(anios, { type: 'u32' }),
      ]
    },
  },
  withdraw: {
    funcion: 'retirar',
    args: (_intent, address) => [
      StellarSdk.nativeToScVal(address, { type: 'address' }),
    ],
  },
  request_loan: {
    funcion: 'solicitar_prestamo',
    args: (intent, address) => [
      StellarSdk.nativeToScVal(address, { type: 'address' }),
      StellarSdk.nativeToScVal(montoAStroops(intent.amountUsdc, 'amountUsdc'), {
        type: 'i128',
      }),
    ],
  },
  repay_loan: {
    funcion: 'pagar_prestamo',
    args: (_intent, address) => [
      StellarSdk.nativeToScVal(address, { type: 'address' }),
    ],
  },
}

export function validarIntent(intent) {
  if (!intent || typeof intent !== 'object') {
    throw new IntentError('INVALID_INTENT', 'Falta la intención')
  }
  const definicion = INTENCIONES[intent.type]
  if (!definicion) {
    throw new IntentError('INVALID_INTENT', `Tipo de intención no soportado`)
  }
  // Nota: el address SIEMPRE sale del registro del usuario, nunca de la
  // intención. Un campo `address` en el cuerpo se ignora por completo.
  return definicion
}

// ---------------------------------------------------------------------
// Ejecución
// ---------------------------------------------------------------------

async function construirYSimular(address, operacion) {
  let cuenta
  try {
    cuenta = await rpc().getAccount(address)
  } catch (err) {
    throw new IntentError(
      'SIMULATION_FAILED',
      `No se pudo cargar la cuenta: ${err.message}`
    )
  }

  const construida = new StellarSdk.TransactionBuilder(cuenta, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(operacion)
    .setTimeout(TIMEOUT_TX_SEGUNDOS)
    .build()

  const simulacion = await rpc().simulateTransaction(construida)

  if (StellarSdk.rpc.Api.isSimulationError(simulacion)) {
    // El contrato rechazó la operación. Se traduce a un código que la
    // interfaz pueda usar; lo que no se reconoce con certeza queda como
    // SIMULATION_FAILED en lugar de adivinarse.
    const { codigo, detalle } = traducirErrorContrato(
      String(simulacion.error),
      CONTRACT_ID
    )
    throw new IntentError(codigo, detalle)
  }

  return StellarSdk.rpc.assembleTransaction(construida, simulacion).build()
}

async function enviarYEsperar(transaccion) {
  let envio
  try {
    envio = await rpc().sendTransaction(transaccion)
  } catch (err) {
    throw new IntentError('SUBMISSION_FAILED', err.message)
  }

  if (envio.status === 'ERROR' || envio.status === 'DUPLICATE') {
    throw new IntentError('SUBMISSION_FAILED', `Envío rechazado: ${envio.status}`)
  }

  const hash = envio.hash
  const limite = Date.now() + ESPERA_MAX_MS

  while (Date.now() < limite) {
    const resultado = await rpc().getTransaction(hash)

    if (resultado.status === 'SUCCESS') return hash
    if (resultado.status === 'FAILED') {
      throw new IntentError('SUBMISSION_FAILED', 'La red rechazó la transacción')
    }

    await new Promise((r) => setTimeout(r, INTERVALO_SONDEO_MS))
  }

  // La transacción PUEDE haberse aplicado. No se reporta como fallo: el
  // hash se devuelve para que el estado se resuelva consultando la red.
  throw new IntentError(
    'TIMEOUT',
    `La transacción no se confirmó a tiempo. Hash: ${hash}`
  )
}

/**
 * Ejecuta una intención: construye, simula, ensambla, firma y envía.
 *
 * @param {{type: string, amountUsdc?: number, lockYears?: number}} intent
 * @param {object} usuario - fila de `usuarios` con llave pública y custodia
 * @returns {Promise<{ hash: string, intentType: string }>}
 */
export async function ejecutarIntent(intent, usuario) {
  const definicion = validarIntent(intent)

  const address = usuario?.stellar_public_key
  if (!address) {
    throw new IntentError('INVALID_INTENT', 'El usuario no tiene cuenta custodial')
  }

  const contrato = new StellarSdk.Contract(CONTRACT_ID)
  const operacion = contrato.call(
    definicion.funcion,
    ...definicion.args(intent, address)
  )

  const transaccion = await construirYSimular(address, operacion)

  // La semilla existe en memoria solo dentro de este callback. withSeed la
  // pone a ceros al salir, también si la firma lanza.
  await withSeed(usuario, usuario.id, (semilla) => {
    const keypair = StellarSdk.Keypair.fromRawEd25519Seed(semilla)
    if (keypair.publicKey() !== address) {
      // La llave descifrada no corresponde a la cuenta registrada. Es
      // corrupción o manipulación de datos, no un fallo transitorio.
      throw new IntentError(
        'INTERNAL',
        'La llave custodial no corresponde a la cuenta del usuario'
      )
    }
    transaccion.sign(keypair)
  })

  const hash = await enviarYEsperar(transaccion)
  return { hash, intentType: intent.type }
}