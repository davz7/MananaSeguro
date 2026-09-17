// netlify/functions/_lib/orderStateMachine.js
//
// Maquina de estados de ordenes de depósito.
//
// Estados confirmados:
//   created   → asignado al crear la orden (etherfuse-deposit.js)
//   funded    → asignado por webhook order_updated de Etherfuse
//   completed → asignado por webhook order_updated de Etherfuse

const TRANSICIONES_VALIDAS = {
  null: ['created'],

  created: ['funded', 'failed', 'cancelled'],
  funded: ['completed', 'failed'],

  completed: [],
  failed: [],
  cancelled: [],
}

export function canTransition(estadoActual, estadoNuevo) {
  const destinosValidos = TRANSICIONES_VALIDAS[estadoActual]
  if (!destinosValidos) return false
  return destinosValidos.includes(estadoNuevo)
}

export function applyTransition(estadoActual, estadoNuevo) {
  if (!canTransition(estadoActual, estadoNuevo)) {
    throw new Error(`Transición inválida: ${estadoActual ?? '(nueva)'} → ${estadoNuevo}`)
  }
  return estadoNuevo
}

export const ESTADOS_TERMINALES = ['completed', 'failed', 'cancelled']