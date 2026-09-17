import { describe, it, expect } from 'vitest'
import { traducirErrorContrato, ERRORES_CONTRATO } from './erroresContrato.js'

const CONTRATO_AHORRO = 'CA4M25CNPPXIPLXZLJZQBPAOKY5REKUOFNJVTMGJ4RKK4QYNIYIG6NLP'
const CONTRATO_TOKEN = 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA'

// Salidas reales capturadas en testnet el 15/09/2026. Se conservan
// literales a propósito: son el contrato de facto con el que trabaja el
// traductor, y si el formato cambia estos tests fallan y avisan.
const SIN_TRUSTLINE = `HostError: Error(Contract, #13)

Event log (newest first):
   0: [Diagnostic Event] contract:${CONTRATO_AHORRO}, topics:[error, Error(Contract, #13)], data:"escalating error to VM trap from failed host function call: call"
   2: [Failed Diagnostic Event (not emitted)] contract:${CONTRATO_TOKEN}, topics:[error, Error(Contract, #13)], data:["trustline entry is missing for account", GCVN4GPK]`

const SIN_SALDO = `HostError: Error(Contract, #10)

Event log (newest first):
   0: [Diagnostic Event] contract:${CONTRATO_AHORRO}, topics:[error, Error(Contract, #10)], data:"escalating error to VM trap from failed host function call: call"
   2: [Failed Diagnostic Event (not emitted)] contract:${CONTRATO_TOKEN}, topics:[error, Error(Contract, #10)], data:["resulting balance is not within the allowed range", 0, -20000000, 9223372036854775807]`

function delContratoAhorro(numero) {
  return `HostError: Error(Contract, #${numero})

Event log (newest first):
   0: [Diagnostic Event] contract:${CONTRATO_AHORRO}, topics:[error, Error(Contract, #${numero})], data:"escalating error"`
}

describe('errores del contrato del token', () => {
  it('reconoce la falta de trustline', () => {
    const r = traducirErrorContrato(SIN_TRUSTLINE, CONTRATO_AHORRO)
    expect(r.codigo).toBe('TRUSTLINE_MISSING')
  })

  it('reconoce el saldo insuficiente', () => {
    const r = traducirErrorContrato(SIN_SALDO, CONTRATO_AHORRO)
    expect(r.codigo).toBe('INSUFFICIENT_BALANCE')
  })

  it('no confunde el #10 del token con PrestamoYaLiquidado', () => {
    // El mismo número significa cosas distintas según qué contrato lo
    // emita. Este es el test que protege contra ese error.
    const r = traducirErrorContrato(SIN_SALDO, CONTRATO_AHORRO)
    expect(r.codigo).not.toBe('LOAN_NOT_ELIGIBLE')
  })
})

describe('errores del contrato de ahorro', () => {
  const esperados = {
    1: 'AMOUNT_BELOW_MINIMUM',
    2: 'INVALID_INTENT',
    3: 'INSUFFICIENT_BALANCE',
    4: 'LOCK_ACTIVE',
    5: 'LOAN_NOT_ELIGIBLE',
    6: 'LOAN_NOT_ELIGIBLE',
    7: 'LOAN_NOT_ELIGIBLE',
    8: 'AMOUNT_BELOW_MINIMUM',
    9: 'LOAN_NOT_ELIGIBLE',
    10: 'LOAN_NOT_ELIGIBLE',
    11: 'INVALID_INTENT',
  }

  for (const [numero, codigo] of Object.entries(esperados)) {
    it(`#${numero} (${ERRORES_CONTRATO[numero].nombre}) es ${codigo}`, () => {
      const r = traducirErrorContrato(delContratoAhorro(numero), CONTRATO_AHORRO)
      expect(r.codigo).toBe(codigo)
    })
  }

  it('el detalle nombra el error del contrato', () => {
    const r = traducirErrorContrato(delContratoAhorro(4), CONTRATO_AHORRO)
    expect(r.detalle).toBe('CondicionesRetiroNoCumplidas')
  })
})

describe('lo desconocido no se adivina', () => {
  it('un número fuera del enum queda genérico', () => {
    const r = traducirErrorContrato(delContratoAhorro(99), CONTRATO_AHORRO)
    expect(r.codigo).toBe('SIMULATION_FAILED')
  })

  it('un mensaje sin forma de error queda genérico', () => {
    const r = traducirErrorContrato('algo salió mal', CONTRATO_AHORRO)
    expect(r.codigo).toBe('SIMULATION_FAILED')
  })

  it('un error de un contrato ajeno no se interpreta con nuestro enum', () => {
    const ajeno = `HostError: Error(Contract, #4)

Event log:
   0: [Diagnostic Event] contract:CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC, topics:[error]`
    const r = traducirErrorContrato(ajeno, CONTRATO_AHORRO)
    // Sin esta comprobación se reportaría LOCK_ACTIVE por un fallo que
    // no tiene nada que ver con el bloqueo de fondos.
    expect(r.codigo).toBe('SIMULATION_FAILED')
  })

  it('tolera un mensaje vacío o nulo', () => {
    expect(traducirErrorContrato(null).codigo).toBe('SIMULATION_FAILED')
    expect(traducirErrorContrato('').codigo).toBe('SIMULATION_FAILED')
  })
})
