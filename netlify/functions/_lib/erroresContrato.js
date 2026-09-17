/**
 * Traducción de errores del contrato a códigos de la API.
 *
 * La simulación de Soroban devuelve una cadena de diagnóstico, no un error
 * estructurado. Interpretarla es frágil por naturaleza: si el contrato se
 * recompila o el SDK cambia el formato, estas cadenas cambian.
 *
 * Por eso el diseño es conservador: lo que no se reconoce con certeza sale
 * como SIMULATION_FAILED. Es preferible un mensaje genérico a uno concreto
 * y equivocado — decirle a alguien "saldo insuficiente" cuando el problema
 * era otro le hace perder el tiempo y desconfiar del producto.
 *
 * Hay dos fuentes de error distintas y el número por sí solo es ambiguo:
 *
 *   - El contrato del token (SAC de USDC): falta de trustline, saldo.
 *   - El contrato de ahorro: su propio enum, del 1 al 11.
 *
 * Un `Error(Contract, #10)` del token significa "saldo fuera de rango" y
 * del contrato de ahorro significa "préstamo ya liquidado". Por eso se
 * identifica primero la fuente y solo después el número.
 */

/** Enum del contrato de ahorro, en `CreditContract/contracts/score/src/lib.rs`. */
export const ERRORES_CONTRATO = {
  1: { nombre: 'MontoBajoMinimo', codigo: 'AMOUNT_BELOW_MINIMUM' },
  2: { nombre: 'AniosBloqueoInvalidos', codigo: 'INVALID_INTENT' },
  3: { nombre: 'SinSaldo', codigo: 'INSUFFICIENT_BALANCE' },
  4: { nombre: 'CondicionesRetiroNoCumplidas', codigo: 'LOCK_ACTIVE' },
  5: { nombre: 'PrestamoPendiente', codigo: 'LOAN_NOT_ELIGIBLE' },
  6: { nombre: 'PrestamoActivo', codigo: 'LOAN_NOT_ELIGIBLE' },
  7: { nombre: 'ExcedeLimitePrestamo', codigo: 'LOAN_NOT_ELIGIBLE' },
  8: { nombre: 'MontoPrestamoBajoMinimo', codigo: 'AMOUNT_BELOW_MINIMUM' },
  9: { nombre: 'NoTienePrestamoActivo', codigo: 'LOAN_NOT_ELIGIBLE' },
  10: { nombre: 'PrestamoYaLiquidado', codigo: 'LOAN_NOT_ELIGIBLE' },
  11: { nombre: 'MetaInvalida', codigo: 'INVALID_INTENT' },
}

/**
 * Frases del contrato del token. Se reconocen por texto y no por número
 * porque el número colisiona con el enum del contrato de ahorro.
 */
const FRASES_TOKEN = [
  { frase: 'trustline entry is missing', codigo: 'TRUSTLINE_MISSING' },
  { frase: 'resulting balance is not within the allowed range', codigo: 'INSUFFICIENT_BALANCE' },
]

/**
 * Traduce el mensaje de una simulación fallida.
 *
 * @param {string} mensaje - cadena de diagnóstico completa
 * @param {string} [contratoAhorro] - id del contrato de ahorro
 * @returns {{ codigo: string, detalle: string }}
 */
export function traducirErrorContrato(mensaje, contratoAhorro) {
  const texto = String(mensaje ?? '')

  // 1. El token primero: sus fallos son los más frecuentes y sus frases
  //    son inequívocas, así que no dependen del número.
  for (const { frase, codigo } of FRASES_TOKEN) {
    if (texto.includes(frase)) {
      return { codigo, detalle: frase }
    }
  }

  // 2. El contrato de ahorro. Solo se interpreta el número si el error
  //    proviene de él; si no se puede determinar la fuente, no se adivina.
  const coincidencia = /Error\(Contract,\s*#(\d+)\)/.exec(texto)
  if (!coincidencia) return { codigo: 'SIMULATION_FAILED', detalle: texto }

  const numero = Number(coincidencia[1])

  // Si la cadena nombra otro contrato como origen del fallo y no el de
  // ahorro, el número pertenece a ese otro contrato y no a nuestro enum.
  const mencionaOtroContrato = /contract:C[A-Z2-7]{55}/.test(texto)
  const mencionaElNuestro = contratoAhorro ? texto.includes(contratoAhorro) : true

  if (mencionaOtroContrato && !mencionaElNuestro) {
    return { codigo: 'SIMULATION_FAILED', detalle: texto }
  }

  const conocido = ERRORES_CONTRATO[numero]
  if (!conocido) return { codigo: 'SIMULATION_FAILED', detalle: texto }

  return { codigo: conocido.codigo, detalle: conocido.nombre }
}
