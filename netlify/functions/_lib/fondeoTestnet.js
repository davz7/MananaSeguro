import * as StellarSdk from '@stellar/stellar-sdk'
import { assertPuedeOperar, CuentaInactivaError } from './cuenta.js'

/**
 * Preparación de la cuenta de un usuario en testnet (T03).
 *
 * Deja la cuenta custodial lista para depositar en el contrato:
 *   1. Cuenta creada y con XLM (Friendbot).
 *   2. Trustline a USDC de Circle, firmada con la llave custodial del usuario.
 *   3. MONTO_FONDEO_USDC enviados desde la cuenta tesorera del sistema.
 *
 * Es dinero que sale de una cuenta compartida, así que:
 *   - Solo opera en testnet, comprobado ANTES de descifrar cualquier llave:
 *     primero la variable de entorno y después preguntándole a Horizon y al
 *     RPC en qué red están. Cifrar con KMS protege dónde se guarda la llave,
 *     no impide usarla en otra red.
 *   - Una sola vez por usuario y con monto fijo. La fila de fondeos_testnet
 *     tiene al usuario como clave primaria.
 *   - El pago es idempotente aunque el proceso muera a mitad: el XDR firmado
 *     y su hash se guardan ANTES de enviarlo. Al reintentar se busca ese
 *     hash en la red; si no está y la transacción no ha vencido, se reenvía
 *     el MISMO sobre (mismo número de secuencia, no puede aplicarse dos
 *     veces). Solo se arma un pago nuevo cuando el anterior ya no puede
 *     entrar al ledger porque pasó su límite de tiempo.
 *   - Si la tesorería no tiene saldo suficiente se rechaza sin enviar nada.
 */

export const ID_TESORERIA = 'tesoreria-testnet'
export const MONTO_FONDEO_USDC = '5'
/** USDC de Circle en testnet (guía del backend para móvil, §6). */
export const USDC_TESTNET = new StellarSdk.Asset(
  'USDC',
  'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'
)
/** Por debajo de este saldo se avisa en los logs: alcanza para 5 usuarios. */
export const UMBRAL_ALERTA_USDC = 25

// Fijos a testnet a propósito: no se leen del entorno para que una variable
// mal puesta no pueda apuntarlos a mainnet.
export const HORIZON_TESTNET = 'https://horizon-testnet.stellar.org'
export const FRIENDBOT_URL = 'https://friendbot.stellar.org'

const TESTNET = StellarSdk.Networks.TESTNET
const LEASE_MS = 60_000
const TIMEOUT_PAGO_S = 60
/** Margen tras el vencimiento del pago antes de darlo por imposible. */
const MARGEN_VENCIMIENTO_MS = 15_000

export class FondeoError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'FondeoError'
    this.code = code
  }
}

// ─── Red ──────────────────────────────────────────────────────────────────────

/** Comprobación de configuración. Síncrona y sin red: corta lo antes posible. */
export function assertTestnetConfigurado(env = process.env) {
  if (env.STELLAR_NETWORK_PASSPHRASE !== TESTNET) {
    throw new FondeoError(
      'NETWORK_NOT_TESTNET',
      'STELLAR_NETWORK_PASSPHRASE no es la de testnet: la cuenta tesorera solo opera en testnet'
    )
  }
}

/**
 * Pregunta a los servidores en qué red están. Cubre el caso de que
 * SOROBAN_RPC_URL apunte a mainnet aunque la passphrase diga testnet.
 */
export async function verificarRedTestnet({ horizon, rpc }) {
  const [raiz, red] = await Promise.all([horizon.root(), rpc.getNetwork()])
  if (raiz?.network_passphrase !== TESTNET) {
    throw new FondeoError('NETWORK_NOT_TESTNET', 'Horizon no está en testnet')
  }
  if (red?.passphrase !== TESTNET) {
    throw new FondeoError('NETWORK_NOT_TESTNET', 'SOROBAN_RPC_URL no apunta a testnet')
  }
}

// ─── Utilidades de Horizon ───────────────────────────────────────────────────

async function cargarCuentaOpcional(horizon, publicKey) {
  try {
    return await horizon.loadAccount(publicKey)
  } catch (err) {
    if (err instanceof StellarSdk.NotFoundError || err?.response?.status === 404) return null
    throw err
  }
}

function saldoUsdc(cuenta) {
  const linea = cuenta.balances?.find(
    (b) => b.asset_code === USDC_TESTNET.getCode() && b.asset_issuer === USDC_TESTNET.getIssuer()
  )
  return linea ? Number(linea.balance) : null
}

/** 'exitosa' | 'fallida' | 'no_encontrada' */
async function estadoTransaccion(horizon, hash) {
  try {
    const tx = await horizon.transactions().transaction(hash).call()
    return tx.successful ? 'exitosa' : 'fallida'
  } catch (err) {
    if (err instanceof StellarSdk.NotFoundError || err?.response?.status === 404) {
      return 'no_encontrada'
    }
    throw err
  }
}

/**
 * Envía y clasifica el resultado. Un rechazo con result_codes es definitivo
 * (no entró al ledger). Sin respuesta o con 504 de Horizon, no se sabe:
 * la transacción puede haberse aplicado.
 */
async function enviar(horizon, tx) {
  try {
    const r = await horizon.submitTransaction(tx)
    return r.hash
  } catch (err) {
    const status = err?.response?.status
    if (err?.response?.data?.extras?.result_codes) {
      throw new FondeoError(
        'SUBMISSION_FAILED',
        `Rechazada por la red: ${JSON.stringify(err.response.data.extras.result_codes)}`
      )
    }
    if (status === 504 || status === undefined) {
      throw new FondeoError('TIMEOUT', 'No se confirmó a tiempo; se verificará al reintentar')
    }
    throw new FondeoError('SUBMISSION_FAILED', `Horizon respondió ${status}`)
  }
}

// ─── Proceso ─────────────────────────────────────────────────────────────────

/**
 * @param {object} deps
 * @param {object} deps.repo       ver crearRepoSupabase
 * @param {object} deps.horizon    StellarSdk.Horizon.Server (testnet)
 * @param {object} deps.rpc        StellarSdk.rpc.Server
 * @param {typeof fetch} deps.fetchImpl
 * @param {Function} deps.withSeed (registro, contexto, operacion) => Promise
 * @param {object} [deps.log]
 * @param {() => number} [deps.ahora]
 * @param {object} [deps.env]
 */
export async function prepararCuenta(usuarioId, deps) {
  const {
    repo,
    horizon,
    rpc,
    fetchImpl,
    withSeed,
    log = { info() {}, warn() {}, error() {} },
    ahora = Date.now,
    env = process.env,
  } = deps

  // 1. Red: antes de tocar la base de datos o cualquier llave.
  assertTestnetConfigurado(env)
  await verificarRedTestnet({ horizon, rpc })

  // 2. Usuario.
  const usuario = await repo.cargarUsuario(usuarioId)
  try {
    assertPuedeOperar(usuario)
  } catch (err) {
    if (err instanceof CuentaInactivaError) throw new FondeoError(err.code, err.message)
    throw err
  }
  if (!usuario.stellar_public_key) {
    throw new FondeoError('ACCOUNT_NOT_FOUND', 'El usuario no tiene cuenta custodial')
  }

  // 3. Reclamar el fondeo (una vez por usuario, con lease contra concurrencia).
  const reclamo = await repo.reclamar(usuarioId, {
    ahora: ahora(),
    leaseMs: LEASE_MS,
    montoUsdc: MONTO_FONDEO_USDC,
  })
  if (reclamo.estado === 'completado') {
    return resultado(usuario, reclamo.fila, true)
  }
  if (reclamo.estado === 'ocupado') {
    throw new FondeoError('IN_PROGRESS', 'La preparación de la cuenta ya está en curso')
  }

  let fila = reclamo.fila
  const actualizar = async (cambios) => {
    fila = { ...fila, ...cambios }
    await repo.actualizar(usuarioId, cambios)
  }

  try {
    // 4. Cuenta en la red.
    let cuenta = await cargarCuentaOpcional(horizon, usuario.stellar_public_key)
    if (!cuenta) {
      const res = await fetchImpl(
        `${FRIENDBOT_URL}?addr=${encodeURIComponent(usuario.stellar_public_key)}`
      )
      if (!res.ok) throw new FondeoError('SUBMISSION_FAILED', `Friendbot respondió ${res.status}`)
      cuenta = await horizon.loadAccount(usuario.stellar_public_key)
    }
    await actualizar({ paso: 'cuenta' })

    // 5. Trustline a USDC, firmada por el usuario.
    if (saldoUsdc(cuenta) === null) {
      const tx = new StellarSdk.TransactionBuilder(cuenta, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: TESTNET,
      })
        .addOperation(StellarSdk.Operation.changeTrust({ asset: USDC_TESTNET }))
        .setTimeout(TIMEOUT_PAGO_S)
        .build()
      await withSeed(usuario, usuarioId, (semilla) => {
        tx.sign(StellarSdk.Keypair.fromRawEd25519Seed(semilla))
      })
      const hash = await enviar(horizon, tx)
      await actualizar({ paso: 'trustline', tx_trustline: hash })
    } else if (fila.paso === 'inicio' || fila.paso === 'cuenta') {
      await actualizar({ paso: 'trustline' })
    }

    // 6. Pago desde la tesorería.
    const hashPago = await pagar({ fila, usuario, repo, horizon, withSeed, actualizar, ahora, log })

    await actualizar({
      estado: 'completado',
      paso: 'completado',
      tx_pago: hashPago,
      pago_xdr: null,
      bloqueado_hasta: null,
      error_code: null,
    })
    log.info('Cuenta testnet preparada', { usuarioId })
    return resultado(usuario, fila, false)
  } catch (err) {
    const code = err instanceof FondeoError ? err.code : 'INTERNAL'
    // Se libera el lease para que el siguiente intento pueda continuar.
    // La fila queda en_proceso: cada paso es reanudable.
    await repo.actualizar(usuarioId, { bloqueado_hasta: null, error_code: code }).catch(() => {})
    throw err instanceof FondeoError ? err : new FondeoError('INTERNAL', err?.message)
  }
}

async function pagar({ fila, usuario, repo, horizon, withSeed, actualizar, ahora, log }) {
  // 6a. ¿Ya hubo un intento de pago? Resolver su estado real antes de nada.
  if (fila.tx_pago) {
    const estado = await estadoTransaccion(horizon, fila.tx_pago)
    if (estado === 'exitosa') return fila.tx_pago

    const vence = fila.pago_vence_en ? Date.parse(fila.pago_vence_en) : 0
    const aunPuedeEntrar = ahora() <= vence + MARGEN_VENCIMIENTO_MS
    if (estado === 'no_encontrada' && aunPuedeEntrar && fila.pago_xdr) {
      // Reenviar el MISMO sobre: si el primero ya entró, este se rechaza
      // por secuencia; si no entró, entra una sola vez.
      const tx = StellarSdk.TransactionBuilder.fromXDR(fila.pago_xdr, TESTNET)
      return enviar(horizon, tx)
    }
    if (estado === 'no_encontrada' && aunPuedeEntrar) {
      // Hay hash pero no XDR: no hay forma segura de reenviar ni de armar
      // uno nuevo todavía. Esperar a que venza.
      throw new FondeoError('IN_PROGRESS', 'Pago pendiente de confirmar')
    }
    // 'fallida' (no movió fondos) o vencida sin entrar: es seguro armar otro.
  }

  // 6b. Tesorería.
  const tesoreria = await repo.cargarTesoreria()
  if (!tesoreria?.stellar_public_key) {
    throw new FondeoError('TREASURY_NOT_CONFIGURED', 'No existe la cuenta tesorera')
  }
  const cuentaTesoreria = await cargarCuentaOpcional(horizon, tesoreria.stellar_public_key)
  const disponible = cuentaTesoreria ? saldoUsdc(cuentaTesoreria) : null
  if (disponible === null || disponible < Number(MONTO_FONDEO_USDC)) {
    log.error('Tesorería sin saldo suficiente', { disponible })
    throw new FondeoError('TREASURY_LOW', 'La tesorería no tiene USDC suficientes')
  }

  // 6c. Armar, firmar y GUARDAR antes de enviar.
  const tx = new StellarSdk.TransactionBuilder(cuentaTesoreria, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: TESTNET,
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: usuario.stellar_public_key,
        asset: USDC_TESTNET,
        amount: MONTO_FONDEO_USDC,
      })
    )
    .addMemo(StellarSdk.Memo.text('fondeo-testnet'))
    .setTimeout(TIMEOUT_PAGO_S)
    .build()

  await withSeed(tesoreria, ID_TESORERIA, (semilla) => {
    tx.sign(StellarSdk.Keypair.fromRawEd25519Seed(semilla))
  })

  // tx.hash() es Uint8Array: sin Buffer.from, toString('hex') da "1,2,3...".
  const hash = Buffer.from(tx.hash()).toString('hex')
  const venceEn = new Date(Number(tx.timeBounds.maxTime) * 1000).toISOString()
  // Si esto falla, se lanza y el pago NO se envía.
  await actualizar({ paso: 'pago_enviado', tx_pago: hash, pago_xdr: tx.toXDR(), pago_vence_en: venceEn })

  let enviado
  try {
    enviado = await enviar(horizon, tx)
  } catch (err) {
    // Rechazo definitivo de un sobre RECIÉN armado: no entró al ledger (o
    // entró como fallido, sin mover fondos) y su secuencia ya no sirve, así
    // que es seguro permitir uno nuevo en el siguiente intento. Esto NO se
    // hace en la ruta de reenvío: ahí el original podría estar por entrar,
    // y solo el vencimiento lo descarta.
    if (err instanceof FondeoError && err.code === 'SUBMISSION_FAILED') {
      await actualizar({ tx_pago: null, pago_xdr: null, pago_vence_en: null })
    }
    throw err
  }

  const restante = disponible - Number(MONTO_FONDEO_USDC)
  if (restante < UMBRAL_ALERTA_USDC) {
    log.warn('Tesorería con saldo bajo', { restante })
  }
  return enviado
}

function resultado(usuario, fila, replayed) {
  return {
    ok: true,
    cuenta: usuario.stellar_public_key,
    montoUsdc: MONTO_FONDEO_USDC,
    trustlineHash: fila?.tx_trustline ?? null,
    pagoHash: fila?.tx_pago ?? null,
    ...(replayed ? { replayed: true } : {}),
  }
}

// ─── Persistencia (Supabase) ─────────────────────────────────────────────────

/**
 * Acceso a las tablas. Separado para poder probar el proceso con un
 * repositorio en memoria.
 *
 * reclamar() devuelve:
 *   { estado: 'nuevo' | 'reanudado', fila }  → este proceso tiene el lease
 *   { estado: 'completado', fila }           → ya se hizo antes
 *   { estado: 'ocupado' }                    → otro proceso lo tiene
 */
export function crearRepoSupabase(supabase) {
  return {
    async cargarUsuario(usuarioId) {
      const { data } = await supabase.from('usuarios').select('*').eq('id', usuarioId).single()
      return data ?? null
    },

    async cargarTesoreria() {
      const { data } = await supabase
        .from('cuentas_sistema')
        .select('*')
        .eq('id', ID_TESORERIA)
        .maybeSingle()
      return data ?? null
    },

    async reclamar(usuarioId, { ahora, leaseMs, montoUsdc }) {
      const hasta = new Date(ahora + leaseMs).toISOString()

      // El insert reclama: la clave primaria garantiza un solo ganador.
      const { data: nueva, error } = await supabase
        .from('fondeos_testnet')
        .insert({
          usuario_id: usuarioId,
          estado: 'en_proceso',
          paso: 'inicio',
          monto_usdc: montoUsdc,
          bloqueado_hasta: hasta,
        })
        .select()
        .single()

      if (!error) return { estado: 'nuevo', fila: nueva }
      if (error.code !== '23505') throw new Error(`No se pudo reclamar el fondeo: ${error.message}`)

      const { data: previa } = await supabase
        .from('fondeos_testnet')
        .select('*')
        .eq('usuario_id', usuarioId)
        .single()
      if (previa?.estado === 'completado') return { estado: 'completado', fila: previa }

      // Tomar el lease solo si está libre o vencido. Es un UPDATE con
      // condición: atómico por fila, así que solo un proceso lo obtiene.
      const ahoraIso = new Date(ahora).toISOString()
      const { data: tomadas, error: errorLease } = await supabase
        .from('fondeos_testnet')
        .update({ bloqueado_hasta: hasta, updated_at: ahoraIso })
        .eq('usuario_id', usuarioId)
        .eq('estado', 'en_proceso')
        .or(`bloqueado_hasta.is.null,bloqueado_hasta.lt.${ahoraIso}`)
        .select()
      if (errorLease) throw new Error(`No se pudo tomar el lease: ${errorLease.message}`)
      if (!tomadas?.length) return { estado: 'ocupado' }
      return { estado: 'reanudado', fila: tomadas[0] }
    },

    async actualizar(usuarioId, cambios) {
      const { error } = await supabase
        .from('fondeos_testnet')
        .update({ ...cambios, updated_at: new Date().toISOString() })
        .eq('usuario_id', usuarioId)
      if (error) throw new Error(`No se pudo actualizar el fondeo: ${error.message}`)
    },
  }
}
