import { test } from 'node:test'
import assert from 'node:assert/strict'
import { núcleo } from './nucleo.mjs'

// Seam: cuando se redibuja la gráfica. Los navegadores móviles disparan `resize`
// durante el scroll (la barra de URL cambia la ALTURA del viewport); redibujar en
// esos eventos mueve el scroll de sitio. Solo el ANCHO debe provocar un redibujado.
// Los esperados salen del contrato ("cambia el ancho real de la tarjeta"), no del código.
test('un resize que solo cambia la altura no redibuja', () => {
    const { requiereRedibujar } = núcleo()
    assert.equal(requiereRedibujar(300, 300), false)
})

test('un cambio de ancho de 2px o menos es ruido, no redibuja', () => {
    const { requiereRedibujar } = núcleo()
    assert.equal(requiereRedibujar(300, 302), false)
    assert.equal(requiereRedibujar(300, 298), false)
})

test('un cambio de ancho real redibuja', () => {
    const { requiereRedibujar } = núcleo()
    assert.equal(requiereRedibujar(300, 340), true)
    assert.equal(requiereRedibujar(300, 260), true)
})

test('la primera vez no hay ancho guardado y hay que redibujar', () => {
    const { requiereRedibujar } = núcleo()
    // -1 es el sentinel de "todavía no se dibujó la gráfica"
    assert.equal(requiereRedibujar(-1, 300), true)
})
