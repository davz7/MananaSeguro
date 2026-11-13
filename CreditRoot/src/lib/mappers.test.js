import { describe, expect, it } from 'vitest'
import { esEstadoFinal, fromMetaForm, mapEstadoOrden, toMeta, toOrden } from './mappers'

describe('metas', () => {
  it('toMeta convierte snake_case a camelCase y números', () => {
    expect(toMeta({
      id: 'm1',
      nombre: 'Retiro',
      monto_objetivo_mxn: '500000',
      ahorro_mensual_mxn: 1000,
      anos_al_retiro: 20,
      es_principal: true,
      created_at: '2026-01-01',
    })).toMatchObject({
      id: 'm1',
      nombre: 'Retiro',
      montoObjetivoMxn: 500000,
      ahorroMensualMxn: 1000,
      anosAlRetiro: 20,
      esPrincipal: true,
      createdAt: '2026-01-01',
    })
  })

  it('fromMetaForm solo incluye los campos presentes (PATCH parcial)', () => {
    expect(fromMetaForm({ anosAlRetiro: 15 })).toEqual({ anos_al_retiro: 15 })
    expect(fromMetaForm({ nombre: 'X', montoObjetivoMxn: 1000, ahorroMensualMxn: 50 })).toEqual({
      nombre: 'X',
      monto_objetivo_mxn: 1000,
      ahorro_mensual_mxn: 50,
    })
  })
})

describe('órdenes', () => {
  it('toOrden acepta la fila cruda de la lista', () => {
    expect(toOrden({ order_id: 'o1', status: 'created', monto_mxn: '1000', deposit_clabe: '646180000000000001', created_at: 'c' }))
      .toEqual({ orderId: 'o1', status: 'created', montoMxn: 1000, depositClabe: '646180000000000001', createdAt: 'c', updatedAt: null })
  })

  it('toOrden acepta la respuesta camelCase de ?orderId=', () => {
    expect(toOrden({ orderId: 'o1', status: 'funded', montoMxn: 50, updatedAt: 'u' }))
      .toMatchObject({ orderId: 'o1', status: 'funded', montoMxn: 50, updatedAt: 'u' })
  })

  it('mapEstadoOrden cubre todos los estados del backend', () => {
    expect(mapEstadoOrden('created').clave).toBe('processing')
    expect(mapEstadoOrden('funded').clave).toBe('funded')
    expect(mapEstadoOrden('completed').clave).toBe('completed')
    expect(mapEstadoOrden('failed').clave).toBe('failed')
    expect(mapEstadoOrden('cancelled').clave).toBe('cancelled')
    expect(mapEstadoOrden('raro').clave).toBe('unknown')
  })

  it('esEstadoFinal detiene el polling solo en estados finales', () => {
    expect(esEstadoFinal('created')).toBe(false)
    expect(esEstadoFinal('funded')).toBe(false)
    expect(esEstadoFinal('completed')).toBe(true)
    expect(esEstadoFinal('failed')).toBe(true)
    expect(esEstadoFinal('cancelled')).toBe(true)
  })
})
