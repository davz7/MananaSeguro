
// Columna de la tabla ordenes donde el webhook guarda el hash de la
// transacción de Stellar después de acreditar el depósito.
const COLUMNA_HASH = 'stellar_tx_hash'

const HORIZON_TESTNET = 'https://horizon-testnet.stellar.org'

async function obtenerOrdenesCompletadas(supabase, log) {
    const { data: ordenes, error } = await supabase
        .from('ordenes')
        .select('*')
        .eq('status', 'completed')

        if (error) {
            log.error('Error obteniendo ordenes completadas', { detail: error.message })
            throw new Error(`No se pudieron obtener las órdenes completadas de Supabase: ${error.message}`)
        }
        log.info('Ordenes completadas obtenidas exitosamente')
    return ordenes ?? []
}


// Consulta una ruta de Horizon y devuelve el JSON, o null si Horizon
// responde 404 (el recurso no existe). Cualquier otra respuesta no exitosa
// (429, 5xx, 400, 401, 403...) lanza un Error: no se pudo saber si existe.
async function consultarHorizon(ruta, hash, log) {
    const response = await fetch(`${HORIZON_TESTNET}${ruta}`)

    // Solo un 404 significa que el recurso no existe.
    if (response.status === 404) {
        log.error('Error consultando Horizon', { hash, ruta, status: response.status, statusText: response.statusText })
        return null
    }

    // El mensaje no incluye el hash para no repetirlo completo en los logs.
    if (!response.ok) {
        throw new Error(`Horizon respondió ${response.status} ${response.statusText}`)
    }

    return response.json()
}

async function consultarTransaccionStellar(hash, log) {
    return consultarHorizon(`/transactions/${hash}`, hash, log)
}

async function consultarTransaccionStellarOperation(hash, log) {
    return consultarHorizon(`/transactions/${hash}/operations`, hash, log)
}

async function consultarMontoOperacion(hash, log) {
    const resultado = await consultarTransaccionStellarOperation(hash, log)

    // Toleramos respuestas sin _embedded.records: el monto queda en null.
    const operaciones = resultado?._embedded?.records
    if (!Array.isArray(operaciones)) return null

    // Una transacción puede traer varias operaciones (ej. ChangeTrust +
    // ClaimClaimableBalance). Buscamos la que realmente entrega el monto,
    // no la primera que aparezca.
    const operacionRelevante = operaciones.find(
        op => op.type === 'claim_claimable_balance' || op.type === 'payment'
    )

    return operacionRelevante?.amount ?? null
}

function clasificarOrigen(orden) {
    const orderId = orden.order_id ?? ''
    const quoteId = orden.etherfuse_quote_id ?? ''
    if (orderId.startsWith('load-')) return 'sintética: load test'
    if (quoteId.startsWith('fuera-de-orden-')) return 'sintética: scripts fuera de orden'
    if (orderId.startsWith('test_order_')) return 'prueba antigua previa al sprint'
    return 'otras'
}


async function reconciliarOrdenes(supabase, log) {
    const ordenes = await obtenerOrdenesCompletadas(supabase, log)
    const reporte = []

    for (const orden of ordenes) {
        const hash = orden[COLUMNA_HASH]
        let transaccion = null
        let montoOperacion = null
        let estado_reconciliacion
        let errorConsulta = false

        if (!hash) {
            // Sin hash no hay nada que buscar en Horizon.
            estado_reconciliacion = 'sin hash: la orden no tiene transacción de Stellar registrada'
        } else {
            // Un fallo de red o una respuesta ilegible marca solo esta orden;
            // el reporte sigue con las demás.
            try {
                transaccion = await consultarTransaccionStellar(hash, log)
            } catch (err) {
                log.error('No se pudo consultar Horizon', { orderId: orden.order_id, detail: err.message })
                errorConsulta = true
            }

            if (errorConsulta) {
                estado_reconciliacion = 'error de consulta: no se pudo consultar Horizon'
            } else if (transaccion === null) {
                estado_reconciliacion = 'discrepancia: transacción no encontrada'
            } else {
                // El monto es solo informativo para el reporte: si /operations
                // falla, amount queda en null y el estado no cambia.
                try {
                    montoOperacion = await consultarMontoOperacion(hash, log)
                } catch (err) {
                    log.warn('No se pudo leer el monto de la operación', { orderId: orden.order_id, detail: err.message })
                }
                if (transaccion.successful !== true) {
                    estado_reconciliacion = 'discrepancia: transacción fallida'
                } else {
                    // TODO: falta definir contra qué monto comparar. La tabla solo
                    // guarda monto_mxn, no el monto en tokens que se acredita
                    // on-chain, así que por ahora el monto no se verifica.
                    estado_reconciliacion = 'reconciliada: transacción existe, monto no verificado'
                }
            }
        }

        const entradaReporte = {
            id: orden.order_id,
            status: orden.status,
            estado_reconciliacion: estado_reconciliacion,
            created_at: orden.created_at,
            updated_at: orden.updated_at,
            monto_mxn: orden.monto_mxn,
            source_account: transaccion?.source_account ?? null,
            amount: montoOperacion,
            origen: clasificarOrigen(orden)
        }
        reporte.push(entradaReporte)
    }

    return reporte
}

export {
    obtenerOrdenesCompletadas,
    consultarTransaccionStellar,
    consultarTransaccionStellarOperation,
    clasificarOrigen,
    reconciliarOrdenes
}
