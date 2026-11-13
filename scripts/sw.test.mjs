import { test } from 'node:test'
import assert from 'node:assert/strict'
import { núcleoSW } from './nucleo-sw.mjs'

// Fixture: la URL publicada (GitHub Pages sirve docs/ de main en /pvpc-tracker/).
const SW = 'https://agusmba.github.io/pvpc-tracker/sw.js'
const n = núcleoSW()

test('el núcleo del SW es lógica pura: se evalúa sin navegador', () => {
    assert.equal(typeof n.decidirEstrategia, 'function', 'falta decidirEstrategia (qué se cachea)')
    assert.equal(typeof n.claveDeCache, 'function', 'falta claveDeCache (clave estable de la caché)')
    assert.equal(typeof n.listaDePrecarga, 'function', 'falta listaDePrecarga (qué se precarga)')
    assert.equal(typeof n.CACHE_SHELL, 'string', 'falta CACHE_SHELL (nombre del caché del shell)')
    assert.ok(!('document' in n) && !('window' in n) && !('fetch' in n) && !('caches' in n))
})

test('el shell se cachea: raíz, index.html, manifest e icono', () => {
    for (const url of [
        'https://agusmba.github.io/pvpc-tracker/',
        'https://agusmba.github.io/pvpc-tracker/index.html',
        'https://agusmba.github.io/pvpc-tracker/manifest.webmanifest',
        'https://agusmba.github.io/pvpc-tracker/icono.svg'
    ]) {
        assert.equal(n.decidirEstrategia(url, SW), 'shell', `${url} debería ser shell`)
    }
})

test('la API de REE no pasa por la caché del SW (el offline de datos es del registro)', () => {
    const api = 'https://apidatos.ree.es/es/datos/mercados/precios-mercados-tiempo-real?start_date=2026-11-13T00:00&end_date=2026-11-13T23:59&time_trunc=hour'
    assert.equal(n.decidirEstrategia(api, SW), 'red', 'la API de REE debe ir directa a la red')
})

test('el propio sw.js va a la red: Chrome lo revalida solo y guardársolo lo congelaría', () => {
    assert.equal(n.decidirEstrategia(SW, SW), 'red')
})

test('la raíz y su index.html comparten clave de caché', () => {
    const raiz = n.claveDeCache('https://agusmba.github.io/pvpc-tracker/', SW)
    assert.equal(raiz, 'https://agusmba.github.io/pvpc-tracker/index.html')
    assert.equal(n.claveDeCache('https://agusmba.github.io/pvpc-tracker/index.html', SW), raiz)
    // El scope relativo del manifest y el enlace guardado con query caen en la misma entrada.
    assert.equal(n.claveDeCache('https://agusmba.github.io/pvpc-tracker/?utm_source=bookmark', SW), raiz)
})

test('un marcador sin barra final es la misma carpeta del scope (sin red no hay 301 de Pages)', () => {
    assert.equal(n.decidirEstrategia('https://agusmba.github.io/pvpc-tracker', SW), 'shell')
    assert.equal(n.claveDeCache('https://agusmba.github.io/pvpc-tracker', SW),
        'https://agusmba.github.io/pvpc-tracker/index.html')
    // La raíz del dominio (carpeta vacía) no se confunde con un path suelto.
    const swRaiz = 'https://example.com/sw.js'
    assert.equal(n.decidirEstrategia('https://example.com/otro-sitio', swRaiz), 'red')
    assert.equal(n.decidirEstrategia('https://example.com/', swRaiz), 'shell')
})

test('la precarga cubre shell, manifest e icono dentro del scope', () => {
    // El array sale del realm del sandbox (otro prototipo de Array): se extiende para
    // comparar contenidos, no el prototipo del realm.
    const precarga = [...n.listaDePrecarga(SW)]
    assert.deepEqual(precarga, [
        'https://agusmba.github.io/pvpc-tracker/index.html',
        'https://agusmba.github.io/pvpc-tracker/manifest.webmanifest',
        'https://agusmba.github.io/pvpc-tracker/icono.svg'
    ])
})
