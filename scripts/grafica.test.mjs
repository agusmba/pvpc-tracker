import { test } from 'node:test'
import assert from 'node:assert/strict'
import { núcleo } from './nucleo.mjs'

// Seam: gráfica del día · markupGrafica(dayData, ancho, horaActual) y resumenDelDia.
// Los esperados son RELACIONES del contrato (escala 1:1, monotonía, franjas distintas),
// no coordenadas golden: un tweak de padding o de paleta no debe romper estos tests.
const díaCincoHoras = [
    { hour: '00-01', hourNum: 0, price: 0.1000 },
    { hour: '01-02', hourNum: 1, price: 0.2000 },
    { hour: '02-03', hourNum: 2, price: 0.3000 },
    { hour: '03-04', hourNum: 3, price: 0.4000 },
    { hour: '04-05', hourNum: 4, price: 0.5000 }
]

function puntos(markup) {
    return Array.from(markup.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="(\d)" fill="([^"]+)"/g))
        .map(m => ({ cx: parseFloat(m[1]), cy: parseFloat(m[2]), r: parseInt(m[3]), fill: m[4] }))
}

test('el SVG se dibuja con el ancho pasado (escala 1:1 de los ejes)', () => {
    const { markupGrafica } = núcleo()
    for (const ancho of [400, 500, 600, 800]) {
        const markup = markupGrafica(díaCincoHoras, ancho, null)
        assert.match(markup, new RegExp(`viewBox="0 0 ${ancho} `))
        assert.match(markup, new RegExp(`width="${ancho}"`))
    }
})

test('la geometría es monotónica: x crece con la hora, y crece con el precio', () => {
    const { markupGrafica } = núcleo()
    const pts = puntos(markupGrafica(díaCincoHoras, 600, null))
    assert.equal(pts.length, díaCincoHoras.length)
    for (let i = 1; i < pts.length; i++) {
        assert.ok(pts[i].cx > pts[i - 1].cx, 'x debe crecer con la hora')
        // precio creciente ⇒ y decreciente (el eje Y del SVG va hacia abajo)
        assert.ok(pts[i].cy < pts[i - 1].cy, 'y debe decrecer con el precio')
    }
})

test('el span de la gráfica crece con el ancho (dentro de la misma categoría)', () => {
    const { markupGrafica } = núcleo()
    // 500 y 600 son ambos anchos "no estrechos": el span-x debe crecer con el ancho
    const span500 = puntos(markupGrafica(díaCincoHoras, 500, null))
    const span600 = puntos(markupGrafica(díaCincoHoras, 600, null))
    const ancho500 = span500[span500.length - 1].cx - span500[0].cx
    const ancho600 = span600[span600.length - 1].cx - span600[0].cx
    assert.ok(ancho600 > ancho500, `span ${ancho600} debe superar a ${ancho500}`)
})

test('el tamaño de letra de los ejes es real: 12 en ≥600, 11 en estrecho', () => {
    const { markupGrafica } = núcleo()
    assert.match(markupGrafica(díaCincoHoras, 600, null), /font-size="12"/)
    assert.match(markupGrafica(díaCincoHoras, 500, null), /font-size="11"/)
})

test('las tres franjas de precio usan colores distintos', () => {
    const { markupGrafica } = núcleo()
    // Sin nombrar vars de la paleta: el contrato es que barata/media/cara no compartan color.
    const pts = puntos(markupGrafica(díaCincoHoras, 600, null))
    const barata = pts[0].fill                          // precio mínimo
    const media = pts[Math.floor(pts.length / 2)].fill  // precio central
    const cara = pts[pts.length - 1].fill               // precio máximo
    assert.equal(new Set([barata, media, cara]).size, 3)
})

test('la hora actual se agranda en la misma posición; null no genera punto grande', () => {
    const { markupGrafica } = núcleo()
    const normal = puntos(markupGrafica(díaCincoHoras, 600, null))
    assert.equal(normal.filter(p => p.r === 5).length, 0)

    const conActual = puntos(markupGrafica(díaCincoHoras, 600, 2))
    const grandes = conActual.filter(p => p.r === 5)
    assert.equal(grandes.length, 1)
    // Misma posición que el punto normal de esa hora, solo agrandado
    assert.equal(grandes[0].cx, normal[2].cx)
    assert.equal(grandes[0].cy, normal[2].cy)
    assert.match(markupGrafica(díaCincoHoras, 600, 2), /r="5"[^>]*stroke=/)
})

test('estrecho dibuja las etiquetas del eje Y dentro; ancho fuera', () => {
    const { markupGrafica } = núcleo()
    assert.match(markupGrafica(díaCincoHoras, 400, null), /text-anchor="start"/)
    assert.match(markupGrafica(díaCincoHoras, 600, null), /text-anchor="end"/)
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
