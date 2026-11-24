import { describe, it, expect, vi } from 'vitest'
import * as StellarSdk from '@stellar/stellar-sdk'
import {
  prepararCuenta,
  assertTestnetConfigurado,
  crearRepoSupabase,
  FondeoError,
  ID_TESORERIA,
  MONTO_FONDEO_USDC,
  USDC_TESTNET,
} from './fondeoTestnet.js'
import { crearSupabaseMock } from './testing/supabaseMock.js'

const TESTNET = StellarSdk.Networks.TESTNET
const MAINNET = StellarSdk.Networks.PUBLIC
const ENV_TESTNET = { STELLAR_NETWORK_PASSPHRASE: TESTNET }
const AHORA = Date.parse('2026-11-22T12:00:00Z')

// ─── Dobles de prueba ────────────────────────────────────────────────────────

function lineaUsdc(balance) {
  return {
    asset_type: 'credit_alphanum4',
    asset_code: USDC_TESTNET.getCode(),
    asset_issuer: USDC_TESTNET.getIssuer(),
    balance,
  }
}

function escenario({
  usuarioExtra = {},
  cuentaUsuario = 'no_existe', // 'no_existe' | 'sin_trustline' | 'con_trustline'
  saldoTesoreria = '100',
  tesoreria = true,
  filaInicial = null,
  red = { horizon: TESTNET, rpc: TESTNET },
  txs = {},
} = {}) {
  const kpUsuario = StellarSdk.Keypair.random()
  const kpTesoreria = StellarSdk.Keypair.random()

  const usuario = {
    id: 'u-1',
    stellar_public_key: kpUsuario.publicKey(),
    __kp: kpUsuario,
    ...usuarioExtra,
  }
  const filaTesoreria = tesoreria
    ? { id: ID_TESORERIA, stellar_public_key: kpTesoreria.publicKey(), __kp: kpTesoreria }
    : null

  // Estado de la "red".
  const cuentas = {
    [kpTesoreria.publicKey()]: {
      seq: '1000',
      balances: [{ asset_type: 'native', balance: '10000' }, lineaUsdc(saldoTesoreria)],
    },
  }
  if (cuentaUsuario !== 'no_existe') {
    cuentas[kpUsuario.publicKey()] = {
      seq: '500',
      balances: [
        { asset_type: 'native', balance: '10000' },
        ...(cuentaUsuario === 'con_trustline' ? [lineaUsdc('0')] : []),
      ],
    }
  }

  const enviados = []
  const noEncontrada = () => new StellarSdk.NotFoundError('not found', { status: 404 })
  const horizon = {
    modoEnvio: 'ok', // 'ok' | 'timeout' | 'rechazo'
    root: vi.fn(async () => ({ network_passphrase: red.horizon })),
    loadAccount: vi.fn(async (pk) => {
      const c = cuentas[pk]
      if (!c) throw noEncontrada()
      return Object.assign(new StellarSdk.Account(pk, c.seq), { balances: c.balances })
    }),
    submitTransaction: vi.fn(async (tx) => {
      const hash = Buffer.from(tx.hash()).toString('hex')
      enviados.push({ hash, tx, filaAlEnviar: { ...repo.estado.fila } })
      if (horizon.modoEnvio === 'timeout') throw { response: { status: 504 } }
      if (horizon.modoEnvio === 'rechazo') {
        throw { response: { status: 400, data: { extras: { result_codes: { transaction: 'tx_bad_seq' } } } } }
      }
      txs[hash] = { successful: true }
      for (const op of tx.operations) {
        if (op.type === 'changeTrust') cuentas[tx.source].balances.push(lineaUsdc('0'))
      }
      return { hash }
    }),
    transactions: () => ({
      transaction: (hash) => ({
        call: async () => {
          if (txs[hash]) return txs[hash]
          throw noEncontrada()
        },
      }),
    }),
  }
  const rpc = { getNetwork: vi.fn(async () => ({ passphrase: red.rpc })) }

  const fetchImpl = vi.fn(async (url) => {
    const addr = new URL(url).searchParams.get('addr')
    cuentas[addr] = { seq: '500', balances: [{ asset_type: 'native', balance: '10000' }] }
    return { ok: true, status: 200 }
  })

  const contextosKms = []
  const withSeed = vi.fn(async (registro, contexto, operacion) => {
    contextosKms.push(contexto)
    return operacion(Buffer.from(registro.__kp.rawSecretKey()))
  })

  const repo = {
    estado: { fila: filaInicial ? { ...filaInicial } : null },
    cargarUsuario: vi.fn(async () => usuario),
    cargarTesoreria: vi.fn(async () => filaTesoreria),
    reclamar: vi.fn(async (id, { ahora, leaseMs, montoUsdc }) => {
      const f = repo.estado.fila
      if (!f) {
        repo.estado.fila = {
          usuario_id: id,
          estado: 'en_proceso',
          paso: 'inicio',
          monto_usdc: montoUsdc,
          bloqueado_hasta: ahora + leaseMs,
        }
        return { estado: 'nuevo', fila: { ...repo.estado.fila } }
      }
      if (f.estado === 'completado') return { estado: 'completado', fila: { ...f } }
      if (f.bloqueado_hasta && f.bloqueado_hasta > ahora) return { estado: 'ocupado' }
      f.bloqueado_hasta = ahora + leaseMs
      return { estado: 'reanudado', fila: { ...f } }
    }),
    actualizar: vi.fn(async (id, cambios) => {
      Object.assign(repo.estado.fila, cambios)
    }),
  }

  const deps = { repo, horizon, rpc, fetchImpl, withSeed, ahora: () => AHORA, env: ENV_TESTNET }
  return { deps, repo, horizon, rpc, fetchImpl, withSeed, contextosKms, enviados, usuario, filaTesoreria, cuentas, txs }
}

const pagosDe = (enviados) =>
  enviados.filter((e) => e.tx.operations.some((op) => op.type === 'payment'))

// ─── Red: falla cerrada antes de descifrar nada ──────────────────────────────

describe('red', () => {
  it('sin STELLAR_NETWORK_PASSPHRASE no hace nada', async () => {
    const e = escenario()
    await expect(prepararCuenta('u-1', { ...e.deps, env: {} })).rejects.toMatchObject({
      code: 'NETWORK_NOT_TESTNET',
    })
    expect(e.horizon.root).not.toHaveBeenCalled()
    expect(e.repo.cargarUsuario).not.toHaveBeenCalled()
    expect(e.withSeed).not.toHaveBeenCalled()
  })

  it('con la passphrase de mainnet no hace nada', () => {
    expect(() => assertTestnetConfigurado({ STELLAR_NETWORK_PASSPHRASE: MAINNET })).toThrow(
      FondeoError
    )
  })

  it('si Horizon reporta otra red, no descifra ni envía', async () => {
    const e = escenario({ red: { horizon: MAINNET, rpc: TESTNET } })
    await expect(prepararCuenta('u-1', e.deps)).rejects.toMatchObject({ code: 'NETWORK_NOT_TESTNET' })
    expect(e.withSeed).not.toHaveBeenCalled()
    expect(e.horizon.submitTransaction).not.toHaveBeenCalled()
  })

  it('si SOROBAN_RPC_URL apunta a otra red, no descifra ni envía', async () => {
    const e = escenario({ red: { horizon: TESTNET, rpc: MAINNET } })
    await expect(prepararCuenta('u-1', e.deps)).rejects.toMatchObject({ code: 'NETWORK_NOT_TESTNET' })
    expect(e.withSeed).not.toHaveBeenCalled()
    expect(e.repo.reclamar).not.toHaveBeenCalled()
  })
})

// ─── Camino feliz ────────────────────────────────────────────────────────────

describe('usuario nuevo', () => {
  it('crea la cuenta, la trustline y paga el monto fijo', async () => {
    const e = escenario()
    const r = await prepararCuenta('u-1', e.deps)

    expect(r.ok).toBe(true)
    expect(r.montoUsdc).toBe(MONTO_FONDEO_USDC)
    expect(r.trustlineHash).toMatch(/^[0-9a-f]{64}$/)
    expect(r.pagoHash).toMatch(/^[0-9a-f]{64}$/)
    expect(e.fetchImpl).toHaveBeenCalledTimes(1)

    const [pago] = pagosDe(e.enviados)
    const op = pago.tx.operations[0]
    expect(op.destination).toBe(e.usuario.stellar_public_key)
    expect(op.amount).toBe('5.0000000')
    expect(op.asset.getIssuer()).toBe(USDC_TESTNET.getIssuer())
    expect(e.repo.estado.fila.estado).toBe('completado')
  })

  it('firma la trustline con el contexto del usuario y el pago con el de la tesorería', async () => {
    const e = escenario()
    await prepararCuenta('u-1', e.deps)
    expect(e.contextosKms).toEqual(['u-1', ID_TESORERIA])
  })

  it('guarda el hash y el sobre del pago ANTES de enviarlo', async () => {
    const e = escenario()
    await prepararCuenta('u-1', e.deps)
    const [pago] = pagosDe(e.enviados)
    expect(pago.filaAlEnviar.tx_pago).toBe(pago.hash)
    expect(pago.filaAlEnviar.pago_xdr).toBe(pago.tx.toXDR())
  })

  it('no llama a Friendbot ni crea trustline si la cuenta ya está lista', async () => {
    const e = escenario({ cuentaUsuario: 'con_trustline' })
    await prepararCuenta('u-1', e.deps)
    expect(e.fetchImpl).not.toHaveBeenCalled()
    expect(e.enviados).toHaveLength(1) // solo el pago
    expect(e.contextosKms).toEqual([ID_TESORERIA])
  })
})

// ─── Una sola vez por usuario ────────────────────────────────────────────────

describe('idempotencia por usuario', () => {
  it('una segunda llamada no mueve fondos y devuelve el mismo resultado', async () => {
    const e = escenario()
    const primero = await prepararCuenta('u-1', e.deps)
    const segundo = await prepararCuenta('u-1', e.deps)

    expect(pagosDe(e.enviados)).toHaveLength(1)
    expect(segundo).toMatchObject({ replayed: true, pagoHash: primero.pagoHash })
  })

  it('si otro proceso tiene el lease, responde IN_PROGRESS sin enviar nada', async () => {
    const e = escenario({
      filaInicial: { estado: 'en_proceso', paso: 'inicio', bloqueado_hasta: AHORA + 30_000 },
    })
    await expect(prepararCuenta('u-1', e.deps)).rejects.toMatchObject({ code: 'IN_PROGRESS' })
    expect(e.horizon.submitTransaction).not.toHaveBeenCalled()
    expect(e.withSeed).not.toHaveBeenCalled()
  })
})

// ─── Reanudación del pago (donde se podría pagar dos veces) ──────────────────

describe('reanudación del pago', () => {
  it('si el pago anterior sí entró, completa sin pagar de nuevo', async () => {
    const txs = { abc123: { successful: true } }
    const e = escenario({
      cuentaUsuario: 'con_trustline',
      txs,
      filaInicial: {
        estado: 'en_proceso',
        paso: 'pago_enviado',
        tx_pago: 'abc123',
        pago_xdr: 'xdr',
        pago_vence_en: new Date(AHORA + 30_000).toISOString(),
      },
    })
    const r = await prepararCuenta('u-1', e.deps)
    expect(r.pagoHash).toBe('abc123')
    expect(e.horizon.submitTransaction).not.toHaveBeenCalled()
    expect(e.withSeed).not.toHaveBeenCalled()
  })

  it('si no entró y no ha vencido, reenvía el MISMO sobre sin volver a firmar', async () => {
    // Primer intento: la red no responde a tiempo.
    const e = escenario({ cuentaUsuario: 'con_trustline' })
    e.horizon.modoEnvio = 'timeout'
    await expect(prepararCuenta('u-1', e.deps)).rejects.toMatchObject({ code: 'TIMEOUT' })
    const primero = pagosDe(e.enviados)[0]
    expect(e.repo.estado.fila.tx_pago).toBe(primero.hash)

    // Reintento: se reenvía el mismo hash; la tesorería no firma otra vez.
    e.horizon.modoEnvio = 'ok'
    const firmasAntes = e.withSeed.mock.calls.length
    const r = await prepararCuenta('u-1', e.deps)
    const pagos = pagosDe(e.enviados)
    expect(pagos).toHaveLength(2)
    expect(pagos[1].hash).toBe(primero.hash)
    expect(e.withSeed.mock.calls.length).toBe(firmasAntes)
    expect(r.pagoHash).toBe(primero.hash)
  })

  it('si no entró y ya venció, arma un pago nuevo', async () => {
    const e = escenario({
      cuentaUsuario: 'con_trustline',
      filaInicial: {
        estado: 'en_proceso',
        paso: 'pago_enviado',
        tx_pago: 'viejo',
        pago_xdr: 'xdr',
        pago_vence_en: new Date(AHORA - 60_000).toISOString(),
      },
    })
    const r = await prepararCuenta('u-1', e.deps)
    expect(r.pagoHash).not.toBe('viejo')
    expect(pagosDe(e.enviados)).toHaveLength(1)
  })

  it('un rechazo definitivo de un sobre recién armado permite reintentar enseguida', async () => {
    const e = escenario({ cuentaUsuario: 'con_trustline' })
    e.horizon.modoEnvio = 'rechazo'
    await expect(prepararCuenta('u-1', e.deps)).rejects.toMatchObject({ code: 'SUBMISSION_FAILED' })
    expect(e.repo.estado.fila.tx_pago).toBeNull()

    e.horizon.modoEnvio = 'ok'
    const r = await prepararCuenta('u-1', e.deps)
    expect(r.ok).toBe(true)
  })

  it('un rechazo en la ruta de REENVÍO no borra el hash: espera al vencimiento', async () => {
    const e = escenario({ cuentaUsuario: 'con_trustline' })
    e.horizon.modoEnvio = 'timeout'
    await expect(prepararCuenta('u-1', e.deps)).rejects.toMatchObject({ code: 'TIMEOUT' })
    const hash = e.repo.estado.fila.tx_pago

    e.horizon.modoEnvio = 'rechazo'
    await expect(prepararCuenta('u-1', e.deps)).rejects.toMatchObject({ code: 'SUBMISSION_FAILED' })
    expect(e.repo.estado.fila.tx_pago).toBe(hash)
  })

  it('libera el lease tras un error para que el siguiente intento continúe', async () => {
    const e = escenario({ cuentaUsuario: 'con_trustline' })
    e.horizon.modoEnvio = 'timeout'
    await expect(prepararCuenta('u-1', e.deps)).rejects.toBeTruthy()
    expect(e.repo.estado.fila.bloqueado_hasta).toBeNull()
    expect(e.repo.estado.fila.error_code).toBe('TIMEOUT')
  })
})

// ─── Tesorería ───────────────────────────────────────────────────────────────

describe('tesorería', () => {
  it('sin tesorería configurada responde TREASURY_NOT_CONFIGURED sin pagar', async () => {
    const e = escenario({ tesoreria: false, cuentaUsuario: 'con_trustline' })
    await expect(prepararCuenta('u-1', e.deps)).rejects.toMatchObject({
      code: 'TREASURY_NOT_CONFIGURED',
    })
    expect(pagosDe(e.enviados)).toHaveLength(0)
  })

  it('con saldo menor al monto responde TREASURY_LOW sin firmar ni pagar', async () => {
    const e = escenario({ saldoTesoreria: '4.9999999', cuentaUsuario: 'con_trustline' })
    await expect(prepararCuenta('u-1', e.deps)).rejects.toMatchObject({ code: 'TREASURY_LOW' })
    expect(e.withSeed).not.toHaveBeenCalled()
    expect(pagosDe(e.enviados)).toHaveLength(0)
  })

  it('avisa en los logs cuando el saldo queda bajo', async () => {
    const e = escenario({ saldoTesoreria: '20', cuentaUsuario: 'con_trustline' })
    const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    await prepararCuenta('u-1', { ...e.deps, log })
    expect(log.warn).toHaveBeenCalledWith('Tesorería con saldo bajo', { restante: 15 })
  })
})

// ─── Cuenta del usuario ──────────────────────────────────────────────────────

describe('estado de la cuenta', () => {
  it('una cuenta dada de baja no se fondea', async () => {
    const e = escenario({ usuarioExtra: { deleted_at: '2026-11-01T00:00:00Z' } })
    await expect(prepararCuenta('u-1', e.deps)).rejects.toMatchObject({ code: 'ACCOUNT_DEACTIVATED' })
    expect(e.repo.reclamar).not.toHaveBeenCalled()
  })

  it('una cuenta con material destruido no se fondea', async () => {
    const e = escenario({ usuarioExtra: { key_destroyed_at: '2026-11-01T00:00:00Z' } })
    await expect(prepararCuenta('u-1', e.deps)).rejects.toMatchObject({ code: 'KEY_DESTROYED' })
  })
})

// ─── Repositorio Supabase ────────────────────────────────────────────────────

describe('crearRepoSupabase.reclamar', () => {
  // Respuestas por consulta, en el orden en que se hacen.
  function repoCon(respuestas) {
    let i = 0
    const mock = crearSupabaseMock(() => respuestas[i++])
    return { repo: crearRepoSupabase(mock.cliente), mock }
  }
  const opciones = { ahora: AHORA, leaseMs: 60_000, montoUsdc: '5' }

  it('el primer reclamo inserta y gana', async () => {
    const { repo } = repoCon([{ data: { usuario_id: 'u-1', estado: 'en_proceso' }, error: null }])
    expect((await repo.reclamar('u-1', opciones)).estado).toBe('nuevo')
  })

  it('si ya está completado lo informa', async () => {
    const { repo } = repoCon([
      { data: null, error: { code: '23505' } },
      { data: { estado: 'completado', tx_pago: 'h' } },
    ])
    expect(await repo.reclamar('u-1', opciones)).toMatchObject({ estado: 'completado' })
  })

  it('si el lease está tomado, responde ocupado', async () => {
    const { repo, mock } = repoCon([
      { data: null, error: { code: '23505' } },
      { data: { estado: 'en_proceso' } },
      { data: [], error: null },
    ])
    expect((await repo.reclamar('u-1', opciones)).estado).toBe('ocupado')
    // El UPDATE del lease va condicionado al lease libre o vencido.
    const or = mock.llamadas.find((c) => c.metodo === 'or')
    expect(or.args[0]).toContain('bloqueado_hasta.is.null')
  })

  it('cualquier otro error de inserción se propaga', async () => {
    const { repo } = repoCon([{ data: null, error: { code: '42P01', message: 'no existe la tabla' } }])
    await expect(repo.reclamar('u-1', opciones)).rejects.toThrow('no existe la tabla')
  })
})
