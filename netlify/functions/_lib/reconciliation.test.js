import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { crearSupabaseMock } from './testing/supabaseMock.js'
import { reconciliarOrdenes, clasificarOrigen } from './reconciliation.js'

// Made-up data: no hash or account corresponds to anything real.
const HASH_OK = 'a'.repeat(64)
const HASH_404 = 'b'.repeat(64)
const HASH_FALLIDA = 'c'.repeat(64)
const CUENTA = 'GFALSA0000000000000000000000000000000000000000000000000000'

function orden(extra) {
  return {
    id: 1,
    usuario_id: 'usuario-inventado-123',
    order_id: 'orden-inventada',
    monto_mxn: 500,
    deposit_clabe: '000000000000000000',
    status: 'completed',
    etherfuse_quote_id: 'quote-inventada',
    created_at: '2026-10-01T10:00:00Z',
    updated_at: '2026-10-01T10:05:00Z',
    stellar_tx_hash: null,
    ...extra,
  }
}

function respuesta(status, cuerpo) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 404 ? 'Not Found' : 'OK',
    json: async () => cuerpo,
  }
}

// Simulated Horizon: responds based on the requested hash and path.
const fetchFalso = vi.fn(async (url) => {
  const esOperaciones = url.endsWith('/operations')
  if (url.includes(HASH_404)) return respuesta(404, { status: 404 })
  if (url.includes(HASH_OK)) {
    return esOperaciones
      ? respuesta(200, { _embedded: { records: [{ type: 'change_trust' }, { type: 'payment', amount: '25.0000000' }] } })
      : respuesta(200, { successful: true, source_account: CUENTA })
  }
  if (url.includes(HASH_FALLIDA)) {
    return esOperaciones
      ? respuesta(200, {})
      : respuesta(200, { successful: false, source_account: CUENTA })
  }
  throw new Error(`Unexpected URL in test: ${url}`)
})

// Non-ok Horizon response with its real status text.
function respuestaError(status, statusText) {
  return { ok: false, status, statusText, json: async () => ({ status }) }
}

const logFalso = () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })

function supabaseCon(ordenes, error = null) {
  return crearSupabaseMock(() => ({ data: error ? null : ordenes, error }))
}

beforeEach(() => {
  fetchFalso.mockClear()
  vi.stubGlobal('fetch', fetchFalso)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('reconciliarOrdenes', () => {
  it('(a) order without hash: "sin hash" status and Horizon is not queried', async () => {
    const { cliente } = supabaseCon([orden({ stellar_tx_hash: null }), orden({ stellar_tx_hash: '' })])
    const reporte = await reconciliarOrdenes(cliente, logFalso())

    expect(reporte).toHaveLength(2)
    for (const entrada of reporte) {
      expect(entrada.estado_reconciliacion).toBe('sin hash: la orden no tiene transacción de Stellar registrada')
      expect(entrada.amount).toBeNull()
      expect(entrada.source_account).toBeNull()
    }
    expect(fetchFalso).not.toHaveBeenCalled()
  })

  it('(b) hash with successful transaction: reconciled, amount not verified', async () => {
    const { cliente } = supabaseCon([orden({ stellar_tx_hash: HASH_OK })])
    const [entrada] = await reconciliarOrdenes(cliente, logFalso())

    expect(entrada.estado_reconciliacion).toBe('reconciliada: transacción existe, monto no verificado')
    expect(entrada.source_account).toBe(CUENTA)
    expect(entrada.amount).toBe('25.0000000')
    expect(entrada).toMatchObject({
      id: 'orden-inventada',
      status: 'completed',
      created_at: '2026-10-01T10:00:00Z',
      updated_at: '2026-10-01T10:05:00Z',
      monto_mxn: 500,
      origen: 'otras',
    })
    expect(fetchFalso).toHaveBeenCalledWith(`https://horizon-testnet.stellar.org/transactions/${HASH_OK}`)
    expect(fetchFalso).toHaveBeenCalledWith(`https://horizon-testnet.stellar.org/transactions/${HASH_OK}/operations`)
  })

  it('(c) Horizon responds 404: discrepancy, transaction not found', async () => {
    const { cliente } = supabaseCon([orden({ stellar_tx_hash: HASH_404 })])
    const [entrada] = await reconciliarOrdenes(cliente, logFalso())

    expect(entrada.estado_reconciliacion).toBe('discrepancia: transacción no encontrada')
    expect(entrada.amount).toBeNull()
  })

  it('(d) successful=false: discrepancy, failed transaction (tolerates response without _embedded)', async () => {
    const { cliente } = supabaseCon([orden({ stellar_tx_hash: HASH_FALLIDA })])
    const [entrada] = await reconciliarOrdenes(cliente, logFalso())

    expect(entrada.estado_reconciliacion).toBe('discrepancia: transacción fallida')
    expect(entrada.amount).toBeNull()
  })

  it('fetch throwing for one order marks only that order and the report continues', async () => {
    // First call (tx of the first order) fails at the network level.
    fetchFalso.mockRejectedValueOnce(new TypeError('fetch failed'))
    const { cliente } = supabaseCon([
      orden({ order_id: 'orden-red-caida', stellar_tx_hash: HASH_OK }),
      orden({ order_id: 'orden-ok', stellar_tx_hash: HASH_OK }),
    ])
    const reporte = await reconciliarOrdenes(cliente, logFalso())

    expect(reporte).toHaveLength(2)
    expect(reporte[0]).toMatchObject({
      id: 'orden-red-caida',
      estado_reconciliacion: 'error de consulta: no se pudo consultar Horizon',
      source_account: null,
      amount: null,
    })
    expect(reporte[1]).toMatchObject({
      id: 'orden-ok',
      estado_reconciliacion: 'reconciliada: transacción existe, monto no verificado',
    })
  })

  it('ok response with unreadable JSON marks the order as a query error', async () => {
    fetchFalso.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => { throw new SyntaxError('Unexpected token <') },
    })
    const { cliente } = supabaseCon([orden({ stellar_tx_hash: HASH_OK })])
    const [entrada] = await reconciliarOrdenes(cliente, logFalso())

    expect(entrada.estado_reconciliacion).toBe('error de consulta: no se pudo consultar Horizon')
  })

  it('/operations failing does not change the state: reconciled with amount null', async () => {
    // Tx call answers normally; the following /operations call fails.
    fetchFalso
      .mockImplementationOnce(fetchFalso.getMockImplementation())
      .mockRejectedValueOnce(new TypeError('fetch failed'))
    const { cliente } = supabaseCon([orden({ stellar_tx_hash: HASH_OK })])
    const [entrada] = await reconciliarOrdenes(cliente, logFalso())

    expect(entrada.estado_reconciliacion).toBe('reconciliada: transacción existe, monto no verificado')
    expect(entrada.source_account).toBe(CUENTA)
    expect(entrada.amount).toBeNull()
  })

  it.each([
    [503, 'Service Unavailable'],
    [429, 'Too Many Requests'],
    [400, 'Bad Request'],
  ])('Horizon responds %i: query error, not "transaction not found"', async (status, statusText) => {
    fetchFalso.mockResolvedValueOnce(respuestaError(status, statusText))
    const { cliente } = supabaseCon([orden({ stellar_tx_hash: HASH_OK })])
    const [entrada] = await reconciliarOrdenes(cliente, logFalso())

    expect(entrada.estado_reconciliacion).toBe('error de consulta: no se pudo consultar Horizon')
    expect(entrada.source_account).toBeNull()
    expect(entrada.amount).toBeNull()
  })

  it('/operations responding 503 does not change the state: reconciled with amount null', async () => {
    // Tx call answers normally; the following /operations call returns 503.
    fetchFalso
      .mockImplementationOnce(fetchFalso.getMockImplementation())
      .mockResolvedValueOnce(respuestaError(503, 'Service Unavailable'))
    const { cliente } = supabaseCon([orden({ stellar_tx_hash: HASH_OK })])
    const [entrada] = await reconciliarOrdenes(cliente, logFalso())

    expect(entrada.estado_reconciliacion).toBe('reconciliada: transacción existe, monto no verificado')
    expect(entrada.source_account).toBe(CUENTA)
    expect(entrada.amount).toBeNull()
  })

  it('(e) if Supabase returns an error, throws a clear Error with the original message', async () => {
    const log = logFalso()
    const { cliente } = supabaseCon([], { message: 'fallo simulado' })

    // The exact message tells this Error apart from the TypeError the old code
    // threw when iterating over null.
    await expect(reconciliarOrdenes(cliente, log)).rejects.toThrow(
      /^No se pudieron obtener las órdenes completadas de Supabase: fallo simulado$/
    )
    expect(log.error).toHaveBeenCalledWith('Error obteniendo ordenes completadas', { detail: 'fallo simulado' })
    expect(fetchFalso).not.toHaveBeenCalled()
  })

  it('only runs a select filtered by status completed', async () => {
    const mock = supabaseCon([])
    await reconciliarOrdenes(mock.cliente, logFalso())

    const metodos = mock.llamadas.map((c) => c.metodo)
    expect(metodos).toEqual(['from', 'select', 'eq'])
    expect(mock.filtros()).toEqual([['status', 'completed']])
  })

  it('(g) no report entry contains usuario_id', async () => {
    const { cliente } = supabaseCon([
      orden({ stellar_tx_hash: null }),
      orden({ stellar_tx_hash: HASH_OK }),
      orden({ stellar_tx_hash: HASH_404 }),
      orden({ stellar_tx_hash: HASH_FALLIDA }),
    ])
    const reporte = await reconciliarOrdenes(cliente, logFalso())

    expect(reporte).toHaveLength(4)
    for (const entrada of reporte) {
      expect(entrada).not.toHaveProperty('usuario_id')
      expect(JSON.stringify(entrada)).not.toContain('usuario-inventado-123')
    }
  })
})

describe('(f) clasificarOrigen', () => {
  it('load test', () => {
    expect(clasificarOrigen({ order_id: 'load-001', etherfuse_quote_id: 'q' })).toBe('sintética: load test')
  })
  it('out-of-order scripts', () => {
    expect(clasificarOrigen({ order_id: 'abc', etherfuse_quote_id: 'fuera-de-orden-7' })).toBe('sintética: scripts fuera de orden')
  })
  it('old pre-sprint test', () => {
    expect(clasificarOrigen({ order_id: 'test_order_42', etherfuse_quote_id: null })).toBe('prueba antigua previa al sprint')
  })
  it('other', () => {
    expect(clasificarOrigen({ order_id: 'ord-xyz', etherfuse_quote_id: 'q-1' })).toBe('otras')
  })
})
