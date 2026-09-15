import { randomBytes } from 'crypto'

/**
 * Genera una clave de firma desechable para pruebas.
 *
 * Existe para que ningún archivo del repositorio contenga una cadena con
 * forma de secreto. Escribir claves literales en los tests obliga a añadir
 * excepciones al escáner, y cada excepción es un punto donde un secreto
 * real podría pasar sin que nadie lo vea. Generándolas aquí, el allowlist
 * se queda vacío y la regla conserva todo su filo.
 *
 * Cada llamada devuelve un valor distinto, lo cual además sirve para
 * probar que un token firmado con una clave no se valida con otra.
 */
export function claveDePrueba() {
  return randomBytes(32).toString('hex')
}
