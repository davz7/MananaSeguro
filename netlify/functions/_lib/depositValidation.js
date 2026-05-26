// ─── Pure validation helpers extracted from etherfuse-deposit.js ──────────────
// These functions contain no API calls — they can be unit-tested without
// Supabase or Etherfuse credentials.

export const MONTO_MINIMO_MXN = 40
export const MONTO_MAXIMO_MXN = 100_000

/**
 * Validates the deposit amount.
 * @param {number|string} montoMxn - Amount in Mexican pesos
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateAmount(montoMxn) {
  if (montoMxn === undefined || montoMxn === null || montoMxn === '') {
    return { valid: false, error: 'montoMxn requerido y debe ser numérico' }
  }

  const monto = Number(montoMxn)

  if (isNaN(monto)) {
    return { valid: false, error: 'montoMxn requerido y debe ser numérico' }
  }

  if (monto < MONTO_MINIMO_MXN) {
    return { valid: false, error: `Monto mínimo: $${MONTO_MINIMO_MXN} MXN` }
  }

  if (monto > MONTO_MAXIMO_MXN) {
    return { valid: false, error: `Monto máximo: $${MONTO_MAXIMO_MXN.toLocaleString('es-MX')} MXN` }
  }

  return { valid: true }
}

/**
 * Validates the user's KYC status.
 * @param {string} kycStatus - Current KYC status
 * @returns {{ valid: boolean, error?: string, mensaje?: string, kycStatus?: string }}
 */
export function validateKyc(kycStatus) {
  if (!kycStatus || kycStatus !== 'approved') {
    return {
      valid: false,
      error: 'KYC pendiente',
      mensaje: 'Debes completar la verificación de identidad antes de depositar.',
      kycStatus: kycStatus || 'missing',
    }
  }
  return { valid: true }
}

/**
 * Validates the bank account status.
 * @param {string} bankAccountStatus - Current bank account status
 * @returns {{ valid: boolean, error?: string, mensaje?: string, bankAccountStatus?: string }}
 */
export function validateBankAccount(bankAccountStatus) {
  if (!bankAccountStatus || bankAccountStatus !== 'active') {
    return {
      valid: false,
      error: 'Cuenta bancaria pendiente',
      mensaje: 'Tu cuenta bancaria aún está en verificación. Intenta en unos minutos.',
      bankAccountStatus: bankAccountStatus || 'missing',
    }
  }
  return { valid: true }
}

/**
 * Validates the user ID.
 * @param {string} usuarioId - User ID
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateUserId(usuarioId) {
  if (!usuarioId) {
    return { valid: false, error: 'usuarioId requerido' }
  }
  return { valid: true }
}
