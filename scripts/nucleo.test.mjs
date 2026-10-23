import { test } from 'node:test'
import assert from 'node:assert/strict'
import { núcleo } from './nucleo.mjs'

// Seam: el bloque de lógica pura del HTML de la SPA, extraíble a Node.
// Sin DOM ni localStorage ni fetch: si el núcleo necesita el navegador, este test va red.
test('el núcleo PVPC es lógica pura: se evalúa sin navegador', () => {
    const n = núcleo()
    assert.ok(typeof n.getFormattedDate === 'function', 'falta getFormattedDate (fecha de día)')
    assert.ok(typeof n.getApiDateParam === 'function', 'falta getApiDateParam (fecha para la API de REE)')
    assert.ok(typeof n.getNavigableDays === 'function', 'falta getNavigableDays (día navegable)')
    assert.ok(typeof n.franjaDePrecio === 'function', 'falta franjaDePrecio (franja de precio)')
    assert.ok(typeof n.normalizarRegistroPvpc === 'function', 'falta normalizarRegistroPvpc (normalización del payload REE)')
    assert.ok(typeof n.requiereRedibujar === 'function', 'falta requiereRedibujar (decisión de redibujado por ancho)')
    assert.ok(typeof n.STORAGE_KEY === 'string', 'falta STORAGE_KEY (clave del registro PVPC)')
    // El sandbox no tiene document, window, localStorage ni fetch: cualquier referencia lanza.
    assert.ok(!('document' in n) && !('window' in n) && !('localStorage' in n))
})
