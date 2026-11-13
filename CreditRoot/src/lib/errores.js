// src/lib/errores.js
//
// Texto de error para mostrar en pantalla, en el idioma del usuario.
//
//  1. Errores de sistema (sin conexión, endpoint inexistente como un 404 sin
//     mensaje, 5xx, respuesta que no es JSON, o un fallo inesperado del código):
//     al usuario se le muestra apiErrors.SYSTEM ("error con el sistema").
//     El detalle técnico ya quedó en la consola (lib/api.js → registrarError).
//  2. Códigos que el backend define de forma cerrada (sign-intent, sesión):
//     se traducen desde apiErrors.<CODE>.
//  3. Errores de negocio con mensaje del backend (p. ej. "Monto mínimo: $40 MXN")
//     o validaciones del propio front ({ message }): se muestran tal cual.

import { ApiError } from './api'

const CODIGOS_TRADUCIDOS = new Set([
  'UNAUTHENTICATED',
  'INVALID_INTENT',
  'INSUFFICIENT_BALANCE',
  'AMOUNT_BELOW_MINIMUM',
  'TRUSTLINE_MISSING',
  'LOCK_ACTIVE',
  'LOAN_NOT_ELIGIBLE',
  'IN_PROGRESS',
  'ACCOUNT_DEACTIVATED',
  'KEY_DESTROYED',
  'ACCOUNT_NOT_FOUND',
  'SIMULATION_FAILED',
  'RATE_LIMITED',
  'SUBMISSION_FAILED',
  'TIMEOUT',
])

/**
 * @param {unknown} err  ApiError, Error o { message } (validación local)
 * @param {(key: string) => string} t
 */
export function mensajeDeError(err, t) {
  if (!err) return ''

  if (err instanceof ApiError) {
    if (err.esDeSistema) return t('apiErrors.SYSTEM')
    if (err.code && CODIGOS_TRADUCIDOS.has(err.code)) return t(`apiErrors.${err.code}`)
    return err.message || t('apiErrors.SYSTEM')
  }

  // Excepción inesperada del código (TypeError, Error lanzado a mano…):
  // no se le enseña al usuario; se deja el tipo en consola.
  if (err instanceof Error) {
    console.error(`[App] ${err.name}: ${err.message}`, err)
    return t('apiErrors.SYSTEM')
  }

  // Validaciones del front: { message } con texto ya traducido
  return err.message || t('apiErrors.SYSTEM')
}
