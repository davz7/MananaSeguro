import {
  KMSClient,
  GenerateDataKeyCommand,
  DecryptCommand,
} from '@aws-sdk/client-kms'
import { fromTemporaryCredentials } from '@aws-sdk/credential-providers'
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

/**
 * Custodia de llaves con envelope encryption sobre AWS KMS.
 *
 * Modelo:
 *
 *   CMK de KMS (nunca sale de KMS)
 *     └─ data key por usuario (GenerateDataKey, contexto { userId })
 *          └─ semilla Ed25519 de Stellar (AES-256-GCM)
 *
 * Solo se persiste el ciphertext de la semilla y el blob de la data key.
 * Comprometer la base de datos no basta: hace falta además poder invocar a
 * KMS con el encryption context correcto, y ese contexto ata cada blob a
 * su usuario, de modo que la data key de A no descifra nada de B.
 *
 * KMS no firma Ed25519, así que la semilla existe en claro en memoria
 * durante la firma. Esa ventana es inherente a esta arquitectura y está
 * declarada en el modelo de amenazas (T6). Aquí se acota a lo mínimo:
 * la semilla vive en Buffer (nunca en String, que es inmutable y no se
 * puede sobrescribir) y se pone a ceros en un bloque finally.
 */

export const KEY_SCHEME_VERSION = 1

const ALGORITMO = 'aes-256-gcm'
const IV_BYTES = 12 // 96 bits, el tamaño recomendado para GCM

let clienteKms

/**
 * Credenciales de KMS.
 *
 * El usuario cuya access key vive en el entorno de despliegue
 * (`manana-seguro-app`) NO tiene permisos de KMS: solo puede asumir el rol
 * `MananaSeguro-CustodySigner`. Ese salto es deliberado. Si la credencial
 * de larga vida se filtrara, por sí sola no descifra nada: hay que asumir
 * el rol activamente, cada asunción queda registrada en CloudTrail, y la
 * relación de confianza se corta con una sola llamada sin tener que rotar
 * nada en el entorno de despliegue.
 *
 * Las variables llevan prefijo MS_ porque Lambda define AWS_ACCESS_KEY_ID
 * y AWS_SECRET_ACCESS_KEY para su propio rol de ejecución, y usar esos
 * nombres provocaría un choque silencioso.
 */
function credenciales() {
  const { MS_AWS_ROLE_ARN, MS_AWS_ROLE_EXTERNAL_ID } = process.env

  if (!MS_AWS_ROLE_ARN) throw new Error('MS_AWS_ROLE_ARN no está configurada')
  if (!MS_AWS_ROLE_EXTERNAL_ID) {
    throw new Error('MS_AWS_ROLE_EXTERNAL_ID no está configurada')
  }

  return fromTemporaryCredentials({
    masterCredentials: {
      accessKeyId: process.env.MS_AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.MS_AWS_SECRET_ACCESS_KEY,
    },
    params: {
      RoleArn: MS_AWS_ROLE_ARN,
      RoleSessionName: 'manana-seguro-custody',
      ExternalId: MS_AWS_ROLE_EXTERNAL_ID,
      // Sesión corta: las credenciales temporales se renuevan solas y una
      // filtrada caduca pronto.
      DurationSeconds: 900,
    },
  })
}

export function kmsClient() {
  return kms()
}

function kms() {
  if (!clienteKms) {
    clienteKms = new KMSClient({
      region: process.env.MS_AWS_REGION || 'us-east-1',
      credentials: credenciales(),
    })
  }
  return clienteKms
}

/** Solo para pruebas: permite inyectar un cliente. */
export function _setKmsClient(cliente) {
  clienteKms = cliente
}

/** Solo para pruebas: fuerza la reconstrucción del cliente. */
export function _resetKmsClient() {
  clienteKms = undefined
}

export function idDeLlave() {
  const id = process.env.KMS_CUSTODY_KEY_ID
  if (!id) throw new Error('KMS_CUSTODY_KEY_ID no está configurada')
  return id
}

/**
 * Sobrescribe un buffer con ceros.
 *
 * No garantiza que el sistema operativo no haya copiado la página a swap,
 * pero reduce la ventana en la que un volcado de memoria del proceso
 * contendría material de llave.
 */
function borrar(...buffers) {
  for (const b of buffers) {
    if (Buffer.isBuffer(b)) b.fill(0)
  }
}

/**
 * Crea una cuenta custodial: genera el keypair, lo cifra y devuelve las
 * columnas listas para persistir.
 *
 * La semilla en claro NO sale de esta función. Lo que se devuelve es
 * únicamente material cifrado más la llave pública.
 *
 * @param {string} userId
 * @returns {Promise<{
 *   stellar_public_key: string,
 *   seed_ciphertext: string,
 *   seed_iv: string,
 *   seed_auth_tag: string,
 *   data_key_blob: string,
 *   key_scheme_version: number
 * }>}
 */
export async function createCustodialAccount(userId) {
  if (!userId || typeof userId !== 'string') {
    throw new Error('createCustodialAccount requiere un userId')
  }

  const { Keypair } = await import('@stellar/stellar-sdk')

  const respuesta = await kms().send(
    new GenerateDataKeyCommand({
      KeyId: idDeLlave(),
      KeySpec: 'AES_256',
      // El contexto ata criptográficamente la data key a este usuario.
      // Sin él, un blob podría descifrarse reclamando ser otro usuario.
      EncryptionContext: { userId },
    })
  )

  const dataKey = Buffer.from(respuesta.Plaintext)
  let semilla

  try {
    const keypair = Keypair.random()
    const publicKey = keypair.publicKey()
    semilla = Buffer.from(keypair.rawSecretKey())

    const iv = randomBytes(IV_BYTES)
    const cipher = createCipheriv(ALGORITMO, dataKey, iv)
    const ciphertext = Buffer.concat([cipher.update(semilla), cipher.final()])
    const authTag = cipher.getAuthTag()

    return {
      stellar_public_key: publicKey,
      seed_ciphertext: ciphertext.toString('hex'),
      seed_iv: iv.toString('hex'),
      seed_auth_tag: authTag.toString('hex'),
      data_key_blob: Buffer.from(respuesta.CiphertextBlob).toString('base64'),
      key_scheme_version: KEY_SCHEME_VERSION,
    }
  } finally {
    borrar(dataKey, semilla)
  }
}

/**
 * Ejecuta una operación con la semilla descifrada y la borra al terminar.
 *
 * Se expone esta forma en lugar de un `decryptSeed` que devuelva la
 * semilla, porque devolverla dejaría el borrado en manos de quien llama, y
 * ese es exactamente el descuido que acaba filtrando material de llave.
 * Aquí el `finally` corre aunque la operación lance.
 *
 * @param {object} registro - fila de usuarios con las columnas de custodia
 * @param {string} userId
 * @param {(semilla: Buffer) => Promise<T>|T} operacion
 * @returns {Promise<T>}
 */
export async function withSeed(registro, userId, operacion) {
  if (!userId) throw new Error('withSeed requiere un userId')

  const faltantes = [
    'seed_ciphertext',
    'seed_iv',
    'seed_auth_tag',
    'data_key_blob',
    'key_scheme_version',
  ].filter((c) => registro?.[c] == null)

  if (faltantes.length) {
    throw new Error(`Registro de custodia incompleto: faltan ${faltantes.join(', ')}`)
  }

  if (registro.key_scheme_version !== KEY_SCHEME_VERSION) {
    throw new Error(
      `Esquema de cifrado no soportado: ${registro.key_scheme_version}`
    )
  }

  const respuesta = await kms().send(
    new DecryptCommand({
      CiphertextBlob: Buffer.from(registro.data_key_blob, 'base64'),
      KeyId: idDeLlave(),
      // El mismo contexto que en la generación. KMS rechaza la operación
      // si no coincide, de modo que el blob de un usuario no se abre
      // reclamando ser otro.
      EncryptionContext: { userId },
    })
  )

  const dataKey = Buffer.from(respuesta.Plaintext)
  let semilla

  try {
    const decipher = createDecipheriv(
      ALGORITMO,
      dataKey,
      Buffer.from(registro.seed_iv, 'hex')
    )
    decipher.setAuthTag(Buffer.from(registro.seed_auth_tag, 'hex'))

    // Si el ciphertext o la etiqueta fueron manipulados, final() lanza.
    // Eso no es un error cualquiera: es manipulación, y debe tratarse
    // como incidente y no como fallo transitorio.
    semilla = Buffer.concat([
      decipher.update(Buffer.from(registro.seed_ciphertext, 'hex')),
      decipher.final(),
    ])

    return await operacion(semilla)
  } finally {
    borrar(dataKey, semilla)
  }
}