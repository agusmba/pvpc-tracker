import { test } from 'node:test'
import assert from 'node:assert/strict'
import { núcleo } from './nucleo.mjs'

// Seam: calendario de la ventana navegable · hoy/manana/esHoy/esManana/etiquetaTab.
// Los esperados son ejemplos trabajados a mano (2020-01-01 fue miércoles), no
// recalculados como hace el código.
test('la ventana navegable empieza en mañana y cubre ocho días', () => {
    const { getNavigableDays, manana } = núcleo()
    const days = getNavigableDays()
    assert.equal(days.length, 8)
    assert.equal(days[0], manana())
})

test('esHoy y esManana no se solapan', () => {
    const { hoy, manana, esHoy, esManana } = núcleo()
    assert.ok(esHoy(hoy()))
    assert.ok(!esManana(hoy()))
    assert.ok(esManana(manana()))
    assert.ok(!esHoy(manana()))
})

test('etiquetaTab: mañana y hoy tienen vocablos propios', () => {
    const { etiquetaTab, manana, hoy } = núcleo()
    assert.equal(etiquetaTab(manana()), 'Mañana 🗓️')
    assert.equal(etiquetaTab(hoy()), 'Hoy 🏠')
})

test('etiquetaTab: día pasado usa weekday corto en español', () => {
    const { etiquetaTab } = núcleo()
    // 1 de enero de 2020 fue miércoles (calculado a mano, no por el código)
    assert.equal(etiquetaTab('01-01-2020'), 'Mié 01/01')
})
