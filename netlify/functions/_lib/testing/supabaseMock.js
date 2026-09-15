/**
 * Mock encadenable de Supabase para pruebas.
 *
 * El cliente real encadena (`.from().select().eq().single()`) y el punto
 * donde se resuelve la promesa cambia según la consulta. En lugar de
 * simular cada forma, este mock devuelve siempre el mismo objeto
 * encadenable, registra cada llamada, y delega en un `resolver` que decide
 * qué responder mirando esas llamadas.
 *
 * Eso permite además afirmar sobre los filtros aplicados, que es justo lo
 * que interesa comprobar: que toda consulta lleva el usuario de la sesión.
 */
export function crearSupabaseMock(resolver) {
  const llamadas = []

  function encadenable() {
    const objetivo = {
      // Registra y sigue encadenando.
      ...Object.fromEntries(
        [
          'from', 'select', 'insert', 'update', 'delete',
          'eq', 'neq', 'order', 'limit',
        ].map((metodo) => [
          metodo,
          (...args) => {
            llamadas.push({ metodo, args })
            return objetivo
          },
        ])
      ),
      single: (...args) => {
        llamadas.push({ metodo: 'single', args })
        return objetivo
      },
      // Thenable: await en cualquier punto de la cadena resuelve aquí.
      then(onFulfilled, onRejected) {
        return Promise.resolve(resolver(llamadas)).then(onFulfilled, onRejected)
      },
    }
    return objetivo
  }

  return {
    cliente: { from: (...args) => encadenable().from(...args) },
    llamadas,
    /** Filtros `.eq(columna, valor)` aplicados, para afirmar sobre ellos. */
    filtros: () =>
      llamadas.filter((c) => c.metodo === 'eq').map((c) => c.args),
  }
}
