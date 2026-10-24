import { test } from 'node:test'
import assert from 'node:assert/strict'
import { núcleo } from './nucleo.mjs'

// Seam: gráfica del día · markupGrafica(dayData, ancho, horaActual) y resumenDelDia.
// Los esperados se calculan a mano desde la geometría (padding y escala), no como
// el código hace: un redibujado que ignore el ancho pasado acaba aquí, no en navegador.
const díaCincoHoras = [
    { hour: '00-01', hourNum: 0, price: 0.1000 },
    { hour: '01-02', hourNum: 1, price: 0.2000 },
    { hour: '02-03', hourNum: 2, price: 0.3000 },
    { hour: '03-04', hourNum: 3, price: 0.4000 },
    { hour: '04-05', hourNum: 4, price: 0.5000 }
]

test('el SVG se dibuja con el ancho pasado (escala 1:1 de los ejes)', () => {
    const { markupGrafica } = núcleo()
    const ancho = markupGrafica(díaCincoHoras, 600, null)
    assert.match(ancho, /viewBox="0 0 600 190"/)
    assert.match(ancho, /width="600"/)
    // Última hora en el borde derecho: paddingLeft 58 + 4 tramos de 132.5 = 588.0
    assert.match(ancho, /L 588\.0/)
})

test('un ancho estrecho usa geometría estrecha (etiquetas dentro)', () => {
    const { markupGrafica } = núcleo()
    const estrecho = markupGrafica(díaCincoHoras, 400, null)
    assert.match(estrecho, /viewBox="0 0 400 210"/)
    assert.match(estrecho, /width="400"/)
    // Estrecho: padding 10/10, graphWidth 380 → última hora en 390.0
    assert.match(estrecho, /L 390\.0/)
    // Las etiquetas del eje Y van dentro (start) en estrecho, fuera (end) en ancho
    assert.match(estrecho, /text-anchor="start"/)
    assert.match(markupGrafica(díaCincoHoras, 600, null), /text-anchor="end"/)
})

test('el tamaño de letra de los ejes es real: 12 en ≥600, 11 en estrecho', () => {
    const { markupGrafica } = núcleo()
    assert.match(markupGrafica(díaCincoHoras, 600, null), /font-size="12"/)
    assert.match(markupGrafica(díaCincoHoras, 500, null), /font-size="11"/)
})

test('los puntos se colorean por franja de precio (barata verde, cara roja)', () => {
    const { markupGrafica } = núcleo()
    const markup = markupGrafica(díaCincoHoras, 600, null)
    // Rango 0,1–0,5 (0,4): tercio bajo ≤0,232 (horas 0 y 1 baratas), tercio alto ≥0,368 (horas 3 y 4 caras)
    assert.equal(markup.split('fill="var(--green)"').length - 1, 2)
    assert.equal(markup.split('fill="var(--orange)"').length - 1, 1)
    assert.equal(markup.split('fill="var(--red)"').length - 1, 2)
})

test('la hora actual se agranda y contornea; null no genera punto grande', () => {
    const { markupGrafica } = núcleo()
    const conActual = markupGrafica(díaCincoHoras, 600, 2)
    assert.equal(conActual.split('r="5"').length - 1, 1)
    assert.match(conActual, /cy="88\.0"[^>]*stroke="var\(--text-color\)/)
    const sinActual = markupGrafica(díaCincoHoras, 600, null)
    assert.equal(sinActual.split('r="5"').length - 1, 0)
})

test('resumenDelDia calcula mínimo, máximo, media y sus horas una vez', () => {
    const { resumenDelDia } = núcleo()
    const r = resumenDelDia(díaCincoHoras)
    assert.equal(r.min, 0.1000)
    assert.equal(r.max, 0.5000)
    assert.equal(r.avg, 0.3000)
    assert.equal(r.minHour, '00-01')
    assert.equal(r.maxHour, '04-05')
})
