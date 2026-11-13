// src/utils/currency.js
//
// Conversión MXN ↔ USDC y validación de montos.
// Regla: toda variable de monto lleva la moneda en el nombre (montoMxn,
// amountUsdc). Los depósitos SPEI van en MXN; las intenciones on-chain
// (sign-intent) van en USDC.

// Mismos límites que netlify/functions/_lib/depositValidation.js
export const DEPOSITO_MIN_MXN = 40
export const DEPOSITO_MAX_MXN = 100_000

// Stellar maneja 7 decimales
const DECIMALES_USDC = 7

/**
 * MXN → USDC. Redondea hacia abajo para no prometer más de lo que llega.
 * @returns {number|null} null si no hay tipo de cambio válido
 */
export function mxnToUsdc(montoMxn, usdMxn) {
  const mxn = Number(montoMxn)
  const tc = Number(usdMxn)
  if (!Number.isFinite(mxn) || !Number.isFinite(tc) || tc <= 0) return null
  const factor = 10 ** DECIMALES_USDC
  return Math.floor((mxn / tc) * factor) / factor
}

/** USDC → MXN, redondeado a centavos. */
export function usdcToMxn(amountUsdc, usdMxn) {
  const usdc = Number(amountUsdc)
  const tc = Number(usdMxn)
  if (!Number.isFinite(usdc) || !Number.isFinite(tc) || tc <= 0) return null
  return Math.round(usdc * tc * 100) / 100
}

/**
 * Valida un monto de depósito en MXN.
 * @returns {null | 'invalid' | 'min' | 'max'} null si es válido
 */
export function validarMontoDeposito(montoMxn) {
  if (montoMxn === '' || montoMxn === null || montoMxn === undefined) return 'invalid'
  const monto = Number(montoMxn)
  if (!Number.isFinite(monto) || monto <= 0) return 'invalid'
  if (monto < DEPOSITO_MIN_MXN) return 'min'
  if (monto > DEPOSITO_MAX_MXN) return 'max'
  // SPEI no acepta fracciones de centavo
  // (con tolerancia: 40.1 * 100 da 4010.0000000000005 en coma flotante)
  if (Math.abs(Math.round(monto * 100) - monto * 100) > 1e-6) return 'invalid'
  return null
}

const usdcFmt = new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function formatUsdc(amountUsdc) {
  return amountUsdc === null || amountUsdc === undefined ? '—' : `${usdcFmt.format(amountUsdc)} USDC`
}
