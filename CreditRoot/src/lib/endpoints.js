// src/lib/endpoints.js
//
// Una función por endpoint del backend. Las pantallas importan de aquí y
// nunca arman URLs ni parsean respuestas por su cuenta.

import { apiJson } from './api'
import { fromMetaForm, toMeta, toOrden } from './mappers'

const conId = (base, id) => `${base}?id=${encodeURIComponent(id)}`

//  Auth

/** @returns {Promise<{ usuario, sesion: { token, expiresAt }, esNuevo: boolean }>} */
export function autenticarConGoogle(idToken) {
  return apiJson('/api/auth/google', { method: 'POST', body: { idToken }, auth: false })
}

//  KYC / onboarding Etherfuse

/**
 * Si el KYC ya está aprobado responde { yaCompletado: true, kycStatus, bankAccountStatus }.
 * Si no, { onboardingUrl, expiraEn, kycStatus }.
 */
export function iniciarOnboarding() {
  return apiJson('/api/etherfuse/onboarding', { method: 'POST' })
}

//  Metas
// PATCH y DELETE usan ?id= (el backend no lee el id del path).

export async function listarMetas() {
  const data = await apiJson('/api/metas')
  return (data?.metas ?? []).map(toMeta)
}

export async function crearMeta(meta) {
  const data = await apiJson('/api/metas', { method: 'POST', body: fromMetaForm(meta) })
  return toMeta(data?.meta)
}

export async function actualizarMeta(id, cambios) {
  const data = await apiJson(conId('/api/metas', id), { method: 'PATCH', body: fromMetaForm(cambios) })
  return toMeta(data?.meta)
}

export function eliminarMeta(id) {
  return apiJson(conId('/api/metas', id), { method: 'DELETE' })
}

//  Depósitos SPEI

/**
 * Pide al backend firmar y enviar una intención al contrato (firma custodial).
 * Tipos: deposit {amountUsdc, lockYears} · withdraw · request_loan {amountUsdc} · repay_loan
 * Al reintentar la MISMA operación hay que reusar la misma idempotencyKey.
 * @returns {Promise<{ ok: true, transactionHash: string, intentType: string, replayed?: boolean }>}
 */
export function firmarIntencion(intent, idempotencyKey) {
  return apiJson('/api/sign-intent', { method: 'POST', body: { intent, idempotencyKey } })
}

export function nuevaIdempotencyKey() {
  return globalThis.crypto.randomUUID()
}

/**
 * Crea la orden en Etherfuse y devuelve la CLABE única de esa orden.
 * @param {number} montoMxn
 */
export function crearDeposito(montoMxn) {
  return apiJson('/api/etherfuse/deposit', { method: 'POST', body: { montoMxn: Number(montoMxn) } })
}

export async function obtenerOrden(orderId) {
  const data = await apiJson(`/api/etherfuse/order-status?orderId=${encodeURIComponent(orderId)}`)
  return toOrden(data)
}

export async function listarOrdenes() {
  const data = await apiJson('/api/etherfuse/order-status')
  return {
    ordenes: (data?.ordenes ?? []).map(toOrden),
    totalMxn: Number(data?.totalMxn ?? 0),
    totalCompletadas: Number(data?.totalCompletadas ?? 0),
  }
}
