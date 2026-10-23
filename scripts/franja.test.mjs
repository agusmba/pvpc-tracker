import { test } from 'node:test'
import assert from 'node:assert/strict'
import { núcleo } from './nucleo.mjs'

// Seam: franja de precio · clasificación de una hora según su posición en el rango del día.
// Los esperados son ejemplos trabajados a mano desde la especificación de tercios
// (33% abajo, 33% arriba), no recalculados como hace el código.
test('hora en el tercio bajo es franja barata', () => {
    const { getPriceClass } = núcleo()
    // Día de 0,1000 a 0,4000 €/kWh: tercio bajo termina en 0,1990
    assert.equal(getPriceClass(0.1000, 0.1000, 0.4000), 'cheap')
    assert.equal(getPriceClass(0.1500, 0.1000, 0.4000), 'cheap')
    assert.equal(getPriceClass(0.1990, 0.1000, 0.4000), 'cheap')
})

test('hora en el centro del rango es franja media', () => {
    const { getPriceClass } = núcleo()
    assert.equal(getPriceClass(0.2000, 0.1000, 0.4000), 'medium')
    assert.equal(getPriceClass(0.2500, 0.1000, 0.4000), 'medium')
    assert.equal(getPriceClass(0.2999, 0.1000, 0.4000), 'medium')
})

test('hora en el tercio alto es franja cara', () => {
    const { getPriceClass } = núcleo()
    // Tercio alto empieza en 0,3010
    assert.equal(getPriceClass(0.3010, 0.1000, 0.4000), 'expensive')
    assert.equal(getPriceClass(0.4000, 0.1000, 0.4000), 'expensive')
})

test('las tres franjas son vocablos distintos', () => {
    const { getPriceClass } = núcleo()
    const franja = getPriceClass(0.1000, 0.1000, 0.4000)
    const media = getPriceClass(0.2500, 0.1000, 0.4000)
    const cara = getPriceClass(0.4000, 0.1000, 0.4000)
    // Un vocablo repetido es el bug que solo se cazaba en navegador: dos franjas
    // con el mismo identificador acaban pintando del mismo color en la gráfica.
    assert.equal(new Set([franja, media, cara]).size, 3)
})
