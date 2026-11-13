// src/lib/mappers.js
//
// Traduce entre el formato del backend y el que usan las pantallas.
// El backend mezcla snake_case (metas, lista de órdenes) y camelCase (orden
// individual, auth). Las pantallas solo ven camelCase.

const aNumero = (v) => (v === null || v === undefined || v === '' ? null : Number(v))

//  Metas

/** Fila de /api/metas → objeto de la app. */
export function toMeta(row) {
  if (!row) return null
  return {
    id: row.id,
    nombre: row.nombre ?? '',
    descripcion: row.descripcion ?? null,
    montoObjetivoMxn: aNumero(row.monto_objetivo_mxn ?? row.montoObjetivoMxn),
    ahorroMensualMxn: aNumero(row.ahorro_mensual_mxn ?? row.ahorroMensualMxn),
    anosAlRetiro: aNumero(row.anos_al_retiro ?? row.anosAlRetiro),
    esPrincipal: Boolean(row.es_principal ?? row.esPrincipal),
    createdAt: row.created_at ?? row.createdAt ?? null,
    updatedAt: row.updated_at ?? row.updatedAt ?? null,
  }
}

/** La meta principal del usuario (o la primera, si ninguna está marcada). */
export function elegirMetaPrincipal(metas = []) {
  return metas.find((m) => m.esPrincipal) ?? metas[0] ?? null
}

/**
 * Objeto de la app → body para POST/PATCH /api/metas.
 * Solo incluye los campos presentes, para que PATCH no pise los demás.
 */
export function fromMetaForm(meta = {}) {
  const campos = {
    nombre: meta.nombre,
    descripcion: meta.descripcion,
    monto_objetivo_mxn: meta.montoObjetivoMxn,
    ahorro_mensual_mxn: meta.ahorroMensualMxn,
    anos_al_retiro: meta.anosAlRetiro,
  }
  return Object.fromEntries(Object.entries(campos).filter(([, v]) => v !== undefined))
}

//  Órdenes de depósito

/** Orden de /api/etherfuse/order-status (camelCase o fila cruda) → app. */
export function toOrden(row) {
  if (!row) return null
  return {
    orderId: row.orderId ?? row.order_id,
    status: row.status,
    montoMxn: aNumero(row.montoMxn ?? row.monto_mxn),
    depositClabe: row.depositClabe ?? row.deposit_clabe ?? null,
    createdAt: row.createdAt ?? row.created_at ?? null,
    updatedAt: row.updatedAt ?? row.updated_at ?? null,
  }
}

// Estados de la máquina de estados del backend (_lib/orderStateMachine.js).
// `clave` es la llave i18n en deposits.status.*
export const ESTADOS_ORDEN = {
  created: { clave: 'processing', color: 'bg-yellow-400', final: false },
  funded: { clave: 'funded', color: 'bg-sky-400', final: false },
  completed: { clave: 'completed', color: 'bg-green-500', final: true },
  failed: { clave: 'failed', color: 'bg-red-500', final: true },
  cancelled: { clave: 'cancelled', color: 'bg-white/40', final: true },
}

const ESTADO_DESCONOCIDO = { clave: 'unknown', color: 'bg-white/30', final: false }

export function mapEstadoOrden(status) {
  return ESTADOS_ORDEN[status] ?? ESTADO_DESCONOCIDO
}

export function esEstadoFinal(status) {
  return mapEstadoOrden(status).final
}
