import { test } from 'node:test'
import assert from 'node:assert/strict'
import { núcleo } from './nucleo.mjs'

// Seam: normalización del payload REE a registro PVPC (horas en €/kWh).
// El esperado se escribe a mano desde el formato real de la API de REE
// (€/MWh en el campo value, datetime ISO con hora), no recalculado como el código.
const payloadREE = [
    { datetime: '2026-10-23T00:00:00.000Z', value: 65.1 },
    { datetime: '2026-10-23T13:00:00.000Z', value: 120.5 },
    { datetime: '2026-10-23T23:00:00.000Z', value: 90.0 }
]

test('el registro PVPC normaliza €/MWh de REE a €/kWh', () => {
    const { normalizarRegistroPvpc } = núcleo()
    const horas = normalizarRegistroPvpc(payloadREE)
    // Comparamos a 4 decimales, la precisión con la que se muestra el registro.
    assert.deepEqual(horas.map(h => h.price.toFixed(4)), ['0.0651', '0.1205', '0.0900'])
})

test('cada hora lleva etiqueta de rango y número de hora', () => {
    const { normalizarRegistroPvpc } = núcleo()
    const horas = normalizarRegistroPvpc(payloadREE)
    const conRango = horas.map(h => ({ hour: h.hour, hourNum: h.hourNum, price: h.price.toFixed(4) }))
    assert.deepEqual(conRango[0], { hour: '00-01', hourNum: 0, price: '0.0651' })
    assert.deepEqual(conRango[1], { hour: '13-14', hourNum: 13, price: '0.1205' })
    // La última hora del día se etiqueta 23-24, no 23-00
    assert.deepEqual(conRango[2], { hour: '23-24', hourNum: 23, price: '0.0900' })
})

test('la normalización conserva el orden y el número de entradas', () => {
    const { normalizarRegistroPvpc } = núcleo()
    const horas = normalizarRegistroPvpc(payloadREE)
    assert.equal(horas.length, 3)
    assert.deepEqual(horas.map(h => h.hourNum), [0, 13, 23])
})
