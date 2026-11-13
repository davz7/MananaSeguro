import { describe, expect, it } from 'vitest'
import es from './es.json'
import en from './en.json'

// Lista "a.b.c" de todas las claves hoja (los arreglos cuentan como hoja)
function claves(obj, prefijo = '') {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v) ? claves(v, `${prefijo}${k}.`) : [`${prefijo}${k}`],
  )
}

function valor(obj, clave) {
  return clave.split('.').reduce((o, p) => o?.[p], obj)
}

describe('traducciones es/en', () => {
  it('tienen exactamente las mismas claves', () => {
    const enEs = new Set(claves(es))
    const enEn = new Set(claves(en))
    expect([...enEs].filter((k) => !enEn.has(k)), 'faltan en en.json').toEqual([])
    expect([...enEn].filter((k) => !enEs.has(k)), 'faltan en es.json').toEqual([])
  })

  it('ningún texto está vacío y los arreglos tienen el mismo tamaño', () => {
    for (const k of claves(es)) {
      const a = valor(es, k)
      const b = valor(en, k)
      if (Array.isArray(a)) {
        expect(Array.isArray(b), k).toBe(true)
        expect(b.length, k).toBe(a.length)
      } else {
        expect(String(a).trim(), `es: ${k}`).not.toBe('')
        expect(String(b).trim(), `en: ${k}`).not.toBe('')
      }
    }
  })

  it('usan las mismas variables de interpolación', () => {
    const vars = (s) => [...String(s).matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort()
    for (const k of claves(es)) {
      const a = valor(es, k)
      if (typeof a !== 'string') continue
      expect(vars(valor(en, k)), k).toEqual(vars(a))
    }
  })
})
