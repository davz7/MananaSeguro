
async function obtenerOrdenesCompletadas(supabase, log) {
    const { data: ordenes, error } = await supabase
        .from('ordenes')
        .select('*')
        .eq('status', 'completed')

        if (error) {
            log.error('Error obteniendo ordenes completadas', { detail: error.message })
        } else {
            log.info('Ordenes completadas obtenidas exitosamente')
        }
    return ordenes
}


async function consultarTransaccionStellar(hash, log) {
    const response = await fetch(`https://horizon-testnet.stellar.org/transactions/${hash}`)
    let transaccion = null
    if (!response.ok) {
        log.error('Error consultando transaccion Stellar', { hash, status: response.status, statusText: response.statusText })
    }else{
        transaccion = await response.json()
    }
    return transaccion
}

async function consultarMontoOperacion(hash, log) {
    const resultado = await consultarTransaccionStellarOperation(hash, log)

    if (!resultado) return null

    // Una transacción puede traer varias operaciones (ej. ChangeTrust +
    // ClaimClaimableBalance). Buscamos la que realmente entrega el monto,
    // no la primera que aparezca.
    const operacionRelevante = resultado._embedded.records.find(
        op => op.type === 'claim_claimable_balance' || op.type === 'payment'
    )

    return operacionRelevante ? operacionRelevante.amount : null
}


async function reconciliarOrdenes(supabase, log) {
    const ordenes = await obtenerOrdenesCompletadas(supabase, log)
    const reporte = []

    for (const orden of ordenes) {
        const transaccion = await consultarTransaccionStellar(orden.confirmedTxSignature, log)
        const montoOperacion = await consultarMontoOperacion(orden.confirmedTxSignature, log)
        let estado_reconciliacion = 'pendiente' // por defecto, si no se puede determinar el estado
        if (transaccion === null) {
            estado_reconciliacion = 'discrepancia: transacción no encontrada'
        } else if (transaccion.successful === false ) {
            estado_reconciliacion = 'discrepancia: transacción fallida'
        } else if (montoOperacion === null) {
            estado_reconciliacion = 'discrepancia: monto no encontrado'
        } else if (Number(montoOperacion) !== Number(orden.amountInTokens)) {
            estado_reconciliacion = 'discrepancia: montos no coinciden'
        } else {
            estado_reconciliacion = 'reconciliada'
        }
        const entradaReporte = {
            id: orden.orderId,
            status: orden.status,
            estado_reconciliacion: estado_reconciliacion,
            created_at: orden.updated_at,
            source_account: transaccion?.source_account,
            amount: montoOperacion,
            amountInTokens: orden.amountInTokens
        }
        reporte.push(entradaReporte)
    }

    return reporte
}
