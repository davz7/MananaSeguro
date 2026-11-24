import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { crearSupabaseMock } from './_lib/testing/supabaseMock.js'
import { issueSession } from './_lib/session.js'
import { claveDePrueba } from './_lib/testing/claves.js'

// Supabase simulado: cada consulta responde según la tabla y la operación.
let mock
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => mock.cliente,
}))

const { handler } = await import('./metas.js')

const META = {
  id: 'm-1',
  nombre: 'Retiro',
  monto_objetivo_mxn: 500000,
  ahorro_mensual_mxn: 1500,
  anos_al_retiro: 20,
}

function supabaseFeliz() {
  return crearSupabaseMock((llamadas) => {
    const ultimoFrom = llamadas.map((c) => c.metodo).lastIndexOf('from')
    const consulta = llamadas.slice(ultimoFrom).map((c) => c.metodo)
    if (consulta.includes('insert')) return { data: META, error: null }
    if (consulta.includes('update')) return { data: META, error: null }
    if (consulta.includes('single')) return { data: { id: 'm-1', usuario_id: 'u-1' }, error: null }
    return { data: [], count: 0, error: null }
  })
}

let envOriginal

beforeEach(() => {
  envOriginal = { ...process.env }
  process.env.SESSION_SIGNING_KEY = claveDePrueba()
  process.env.SUPABASE_URL = 'https://example.supabase.co'
  process.env.SUPABASE_SERVICE_KEY = 'service-key'
  mock = supabaseFeliz()
})

afterEach(() => {
  process.env = envOriginal
})

async function llamar(metodo, body, query) {
  const { token } = await issueSession('u-1')
  const r = await handler({
    httpMethod: metodo,
    headers: { authorization: `Bearer ${token}` },
    body,
    queryStringParameters: query,
  })
  return { status: r.statusCode, cuerpo: JSON.parse(r.body) }
}

const valido = {
  nombre: 'Retiro',
  monto_objetivo_mxn: 500000,
  ahorro_mensual_mxn: 1500,
  anos_al_retiro: 20,
}
const tocoBaseDeDatos = () => mock.llamadas.some((c) => c.metodo === 'from')

// ─── POST: entradas mal formadas → 400, sin tocar la base de datos ───────────

describe('POST /api/metas con entrada inválida', () => {
  const casos = [
    ['JSON inválido', '{nombre: "Retiro"'],
    ['cuerpo null', 'null'],
    ['cuerpo arreglo', JSON.stringify([valido])],
    ['cuerpo número', '42'],
    ['monto no numérico', JSON.stringify({ ...valido, monto_objetivo_mxn: 'abc' })],
    ['monto como arreglo', JSON.stringify({ ...valido, monto_objetivo_mxn: [500000] })],
    ['monto booleano', JSON.stringify({ ...valido, monto_objetivo_mxn: true })],
    ['monto texto vacío', JSON.stringify({ ...valido, monto_objetivo_mxn: '  ' })],
    ['ahorro no numérico', JSON.stringify({ ...valido, ahorro_mensual_mxn: 'mil' })],
    ['años con decimales', JSON.stringify({ ...valido, anos_al_retiro: 2.5 })],
    ['años no numéricos', JSON.stringify({ ...valido, anos_al_retiro: 'veinte' })],
    ['nombre numérico', JSON.stringify({ ...valido, nombre: 123 })],
    ['nombre solo espacios', JSON.stringify({ ...valido, nombre: '   ' })],
    ['nombre demasiado largo', JSON.stringify({ ...valido, nombre: 'x'.repeat(61) })],
    ['descripción numérica', JSON.stringify({ ...valido, descripcion: 5 })],
    ['falta el monto', JSON.stringify({ nombre: 'Retiro', ahorro_mensual_mxn: 1500, anos_al_retiro: 20 })],
    ['monto bajo el mínimo', JSON.stringify({ ...valido, monto_objetivo_mxn: 999 })],
    ['monto sobre el máximo', JSON.stringify({ ...valido, monto_objetivo_mxn: 50_000_001 })],
  ]

  it.each(casos)('%s → 400', async (_nombre, body) => {
    const r = await llamar('POST', body)
    expect(r.status).toBe(400)
    expect(typeof r.cuerpo.error).toBe('string')
    expect(tocoBaseDeDatos()).toBe(false)
  })
})

describe('POST /api/metas con entrada válida', () => {
  it('crea la meta y guarda números, no texto', async () => {
    const r = await llamar(
      'POST',
      JSON.stringify({
        nombre: '  Retiro  ',
        monto_objetivo_mxn: '500000',
        ahorro_mensual_mxn: 1500,
        anos_al_retiro: '20',
        descripcion: '  ',
      })
    )
    expect(r.status).toBe(201)
    const insert = mock.llamadas.find((c) => c.metodo === 'insert').args[0]
    expect(insert).toMatchObject({
      usuario_id: 'u-1',
      nombre: 'Retiro',
      descripcion: null,
      monto_objetivo_mxn: 500000,
      ahorro_mensual_mxn: 1500,
      anos_al_retiro: 20,
    })
  })

  it('ignora usuarioId en el cuerpo: la identidad sale del token', async () => {
    await llamar('POST', JSON.stringify({ ...valido, usuarioId: 'otro-usuario' }))
    const insert = mock.llamadas.find((c) => c.metodo === 'insert').args[0]
    expect(insert.usuario_id).toBe('u-1')
  })
})

// ─── PATCH ──────────────────────────────────────────────────────────────────

describe('PATCH /api/metas', () => {
  const casos = [
    ['JSON inválido', 'no es json'],
    ['cuerpo null', 'null'],
    ['nombre numérico', JSON.stringify({ nombre: 123 })],
    ['descripción objeto', JSON.stringify({ descripcion: { a: 1 } })],
    ['monto no numérico', JSON.stringify({ monto_objetivo_mxn: 'abc' })],
    ['años con decimales', JSON.stringify({ anos_al_retiro: 10.5 })],
    ['sin campos', JSON.stringify({})],
    ['solo campos desconocidos', JSON.stringify({ es_principal: true })],
  ]

  it.each(casos)('%s → 400', async (_nombre, body) => {
    const r = await llamar('PATCH', body, { id: 'm-1' })
    expect(r.status).toBe(400)
    expect(tocoBaseDeDatos()).toBe(false)
  })

  it('actualiza solo los campos presentes', async () => {
    const r = await llamar('PATCH', JSON.stringify({ ahorro_mensual_mxn: '2000' }), { id: 'm-1' })
    expect(r.status).toBe(200)
    const update = mock.llamadas.find((c) => c.metodo === 'update').args[0]
    expect(update).toEqual({ ahorro_mensual_mxn: 2000 })
  })

  it('descripción null la borra', async () => {
    const r = await llamar('PATCH', JSON.stringify({ descripcion: null }), { id: 'm-1' })
    expect(r.status).toBe(200)
    const update = mock.llamadas.find((c) => c.metodo === 'update').args[0]
    expect(update).toEqual({ descripcion: null })
  })

  it('sin id → 400', async () => {
    const r = await llamar('PATCH', JSON.stringify({ nombre: 'X' }), {})
    expect(r.status).toBe(400)
  })
})

// ─── Los errores reales del servidor siguen siendo 500 ──────────────────────

describe('errores del servidor', () => {
  it('una falla de la base de datos sigue respondiendo 500', async () => {
    mock = crearSupabaseMock(() => ({ data: null, error: { message: 'conexión perdida' } }))
    const r = await llamar('GET')
    expect(r.status).toBe(500)
  })
})
