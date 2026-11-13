// src/utils/loan.js
//
// Reglas del autopréstamo ("retiro de emergencia"). Son las del contrato
// Soroban (CreditContract/contracts/score/src/lib.rs):
//   PRESTAMO_MAX_PCT     = 30   → máximo 30% del saldo
//   PRESTAMO_FEE_MENSUAL = 50   → 0.5% de interés mensual (basis points)
//   PRESTAMO_MAX_MESES   = 24   → se paga en 24 cuotas
//   monto mínimo         = 1 USDC
// Si el contrato cambia, hay que cambiar aquí también.

export const PRESTAMO_MAX_PCT = 0.30
export const PRESTAMO_INTERES_MENSUAL = 0.005
export const PRESTAMO_PLAZO_MESES = 24
export const PRESTAMO_MIN_USDC = 1

/** Máximo que se puede pedir, en la misma moneda que el saldo. */
export function disponiblePrestamo(saldo) {
  const s = Number(saldo)
  if (!Number.isFinite(s) || s <= 0) return 0
  return Math.floor(s * PRESTAMO_MAX_PCT * 100) / 100
}

/**
 * Primera cuota, como la calcula pagar_prestamo: capital / meses restantes
 * + interés mensual sobre el saldo pendiente. Las siguientes son menores.
 */
export function primeraCuota(monto) {
  const m = Number(monto)
  if (!Number.isFinite(m) || m <= 0) return 0
  return Math.round((m / PRESTAMO_PLAZO_MESES + m * PRESTAMO_INTERES_MENSUAL) * 100) / 100
}

/**
 * Valida el monto pedido (MXN) contra el disponible (MXN) y el mínimo del
 * contrato (en USDC).
 * @returns {null | 'invalid' | 'min' | 'max' | 'sinSaldo'}
 */
export function validarMontoPrestamo({ montoMxn, disponibleMxn, amountUsdc }) {
  if (!(disponibleMxn > 0)) return 'sinSaldo'
  if (montoMxn === '' || montoMxn === null || montoMxn === undefined) return 'invalid'
  const monto = Number(montoMxn)
  if (!Number.isFinite(monto) || monto <= 0) return 'invalid'
  if (monto > disponibleMxn) return 'max'
  if (amountUsdc !== null && amountUsdc !== undefined && amountUsdc < PRESTAMO_MIN_USDC) return 'min'
  return null
}
