// netlify/functions/_lib/depositValidation.js
//
// Extracted validators from etherfuse-deposit.js for testability.
// No behavior change — same validation rules, same error messages.

const MONTO_MINIMO_MXN = 40
const MONTO_MAXIMO_MXN = 100_000

/**
 * Validate deposit amount.
 * @param {unknown} montoMxn - The deposit amount from the request body.
 * @returns {number} The validated amount as a number.
 * @throws {Error} If the amount is invalid, below min, or above max.
 */
export function validateAmount(montoMxn) {
  const amount = Number(montoMxn)

  if (!amount || isNaN(amount)) {
    throw new Error('montoMxn requerido y debe ser numérico')
  }

  if (amount < MONTO_MINIMO_MXN) {
    throw new Error(`Monto mínimo: $${MONTO_MINIMO_MXN} MXN`)
  }

  if (amount > MONTO_MAXIMO_MXN) {
    throw new Error(`Monto máximo: $${MONTO_MAXIMO_MXN.toLocaleString('es-MX')} MXN`)
  }

  return amount
}

/**
 * Validate that the user's KYC status is approved.
 * @param {string|undefined} kycStatus - The user's KYC status.
 * @throws {Error} If KYC is not approved.
 */
export function validateKyc(kycStatus) {
  if (kycStatus !== 'approved') {
    throw new Error('KYC pendiente')
  }
}

/**
 * Validate that a userId is present.
 * @param {unknown} userId - The user ID from the request body.
 * @throws {Error} If userId is missing.
 */
export function validateUserId(userId) {
  if (!userId) {
    throw new Error('usuarioId requerido')
  }
}
