/**
 * Estado de la cuenta.
 *
 * La comprobación vive aquí y no en `verifySession` a propósito: hacerla
 * en la verificación de sesión obligaría a una consulta a la base de datos
 * en CADA petición, incluidas las de solo lectura. En su lugar se aplica
 * donde la fila del usuario ya se cargó de todos modos, que son las rutas
 * que mueven dinero.
 *
 * Consecuencia que conviene tener presente: un token emitido antes de la
 * baja sigue siendo criptográficamente válido hasta que expire, a las 24
 * horas. Lo que impide operar no es el token sino esta comprobación, así
 * que toda ruta que mueva fondos tiene que llamarla.
 */

export class CuentaInactivaError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'CuentaInactivaError'
    this.code = code
  }
}

/**
 * Lanza si la cuenta no puede operar.
 *
 * @param {object} usuario - fila de `usuarios`
 * @throws {CuentaInactivaError}
 */
export function assertPuedeOperar(usuario) {
  if (!usuario) {
    throw new CuentaInactivaError('ACCOUNT_NOT_FOUND', 'La cuenta no existe')
  }

  // El orden importa: la destrucción de material es más específica y más
  // definitiva que la baja, así que se informa esa primero. Decirle a
  // alguien "tu cuenta está dada de baja" cuando en realidad sus llaves
  // fueron destruidas le haría creer que es reversible.
  if (usuario.key_destroyed_at) {
    throw new CuentaInactivaError(
      'KEY_DESTROYED',
      'El material de llave de esta cuenta fue destruido'
    )
  }

  if (usuario.deleted_at) {
    throw new CuentaInactivaError('ACCOUNT_DEACTIVATED', 'La cuenta está dada de baja')
  }
}
