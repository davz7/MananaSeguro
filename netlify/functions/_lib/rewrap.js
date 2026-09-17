import { ReEncryptCommand } from '@aws-sdk/client-kms'
import { kmsClient, idDeLlave, withSeed } from './custody.js'

/**
 * Re-envoltura de data keys tras una rotación de la CMK.
 *
 * Cuando la CMK rota, AWS conserva el material anterior y sigue
 * descifrando los blobs viejos de forma transparente. Eso es cómodo y es
 * justo lo que hace insuficiente la rotación automática como evidencia:
 * mientras nadie re-envuelva, TODOS los usuarios siguen dependiendo del
 * material que se quiso retirar.
 *
 * Este job es lo que convierte "la llave rotó" en "los datos ya no dependen
 * del material anterior".
 */

/**
 * Re-envuelve la data key de un usuario contra el material actual.
 *
 * Devuelve las columnas a persistir, o null si el blob ya estaba en el
 * material actual. NO escribe en la base de datos: quien llama decide.
 *
 * @param {object} usuario - fila con las columnas de custodia
 * @returns {Promise<{data_key_blob: string, key_material_id: string}|null>}
 */
export async function reenvolverDataKey(usuario) {
  if (!usuario?.data_key_blob) {
    throw new Error(`El usuario ${usuario?.id} no tiene data_key_blob`)
  }

  const contexto = { userId: usuario.id }

  const respuesta = await kmsClient().send(
    new ReEncryptCommand({
      CiphertextBlob: Buffer.from(usuario.data_key_blob, 'base64'),
      // Se declaran AMBOS contextos y son idénticos.
      //
      // Esto importa más de lo que parece: las condiciones
      // kms:EncryptionContext de la key policy se aplican al contexto de
      // DESTINO, no al de origen. Es decir, la política por sí sola no
      // impide re-envolver el blob de un usuario bajo el contexto de otro.
      // La igualdad tiene que asegurarla la aplicación, y es lo que hace
      // esta línea. Está declarado como limitación conocida en el
      // documento de diseño.
      SourceEncryptionContext: contexto,
      DestinationEncryptionContext: contexto,
      DestinationKeyId: idDeLlave(),
    })
  )

  const nuevoBlob = Buffer.from(respuesta.CiphertextBlob).toString('base64')
  const materialNuevo = respuesta.DestinationKeyMaterialId ?? null

  // Si el material no cambió, no hay nada que escribir. Escribir de todos
  // modos generaría ruido en rewrapped_at y haría imposible distinguir
  // "ya estaba al día" de "se movió".
  if (materialNuevo && materialNuevo === usuario.key_material_id) return null

  return { data_key_blob: nuevoBlob, key_material_id: materialNuevo }
}

/**
 * Re-envuelve y verifica antes de aceptar el resultado.
 *
 * La verificación es end-to-end: con el blob nuevo se descifra la semilla
 * y se comprueba que reconstruye la misma llave pública registrada. Un
 * ReEncrypt que "funciona" pero produce un blob que no abre la semilla
 * dejaría la cuenta irrecuperable, y nadie se enteraría hasta el siguiente
 * intento de firma.
 *
 * @param {object} usuario
 * @returns {Promise<{columnas: object, verificado: true}|null>}
 */
export async function reenvolverYVerificar(usuario) {
  const columnas = await reenvolverDataKey(usuario)
  if (!columnas) return null

  const candidato = { ...usuario, ...columnas }

  const { Keypair } = await import('@stellar/stellar-sdk')
  const publica = await withSeed(candidato, usuario.id, (semilla) =>
    Keypair.fromRawEd25519Seed(semilla).publicKey()
  )

  if (publica !== usuario.stellar_public_key) {
    throw new Error(
      `Verificación fallida para ${usuario.id}: la semilla re-envuelta no ` +
        'reconstruye la llave pública registrada. No se escribe nada.'
    )
  }

  return { columnas, verificado: true }
}
