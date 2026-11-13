// Service Worker de PVPC Tracker. Su trabajo es el **offline del shell**: que el enlace
// guardado en el móvil abra aunque no haya red. GitHub Pages responde el HTML con
// `cache-control: max-age=600`, así que sin SW el documento es stale a los 10 minutos y
// el navegador lo revalida en red: sin red, pantalla de error.
//
// Estrategia: *stale-while-revalidate*. La caché sirve la respuesta al instante y la red
// la refresca en segundo plano, de modo que una publicación nueva llega al móvil en la
// carga siguiente, sin subir la versión del caché ni hacer esperar al usuario.
//
// La API de REE **no** pasa por esta caché: el offline de *datos* es cosa del registro
// PVPC en localStorage, y servir JSON cacheado como si fuera fresco mentiría el estado
// del día (ver GLOSSARY: offline del shell ≠ offline de datos).

// >>>sw-nucleo
// Lógica pura de clasificación de peticiones: sin DOM, sin fetch, sin caches.
// Es el bloque que los tests pueden ejecutar bajo Node (patrón del Núcleo PVPC, ADR 0002).
// `var` a propósito: solo las declaraciones var salen como globales del sandbox.
var CACHE_SHELL = 'pvpc-shell-v1'

// 'shell' → se sirve de la caché con refresco en segundo plano.
// 'red'   → pasa a la red sin tocar la caché (API de REE, y el propio sw.js: Chrome lo
//           revalida por su cuenta y guardársolo congelaría el service worker).
function decidirEstrategia(reqUrl, swUrl) {
    const destino = new URL(reqUrl, swUrl)
    if (destino.origin !== new URL(swUrl).origin) return 'red'
    const ruta = destino.pathname
    if (ruta === new URL(swUrl).pathname) return 'red'
    if (ruta.endsWith('/')) return 'shell'
    return /\.(html?|webmanifest|svg|png|css|js|json)$/.test(ruta) ? 'shell' : 'red'
}

// Clave de caché estable: la raíz del scope y su index.html son la misma entrada, así que
// /pvpc-tracker/ y /pvpc-tracker/index.html comparten respuesta. Sin query ni version.
function claveDeCache(reqUrl, swUrl) {
    const destino = new URL(reqUrl, swUrl)
    const ruta = destino.pathname.endsWith('/') ? destino.pathname + 'index.html' : destino.pathname
    return destino.origin + ruta
}

// Qué se precarga en la instalación, resuelto contra la carpeta del SW.
function listaDePrecarga(swUrl) {
    return ['index.html', 'manifest.webmanifest', 'icono.svg'].map(nombre => new URL(nombre, swUrl).href)
}
// <<<sw-nucleo

// Primera caché: si un recurso falla (p. ej. un icono aún sin publicar) el install no
// se rompe; lo que falte lo rellenará el refresco en segundo plano.
self.addEventListener('install', (evento) => {
    evento.waitUntil(
        (async () => {
            const cache = await caches.open(CACHE_SHELL)
            for (const url of listaDePrecarga(self.location.href)) {
                try {
                    const respuesta = await fetch(url)
                    if (respuesta.ok) await cache.put(claveDeCache(url, self.location.href), respuesta)
                } catch (e) {
                    // sin red durante el install: la precarga se rellena en la primera carga controlada
                }
            }
            await self.skipWaiting()
        })()
    )
})

// Al activar solo queda el caché actual: una publicación con recursos nuevos no deja
// entradas huérfanas de la versión vieja.
self.addEventListener('activate', (evento) => {
    evento.waitUntil(
        (async () => {
            const nombres = await caches.keys()
            await Promise.all(nombres.filter(n => n !== CACHE_SHELL).map(n => caches.delete(n)))
            await self.clients.claim()
        })()
    )
})

self.addEventListener('fetch', (evento) => {
    const req = evento.request
    if (req.method !== 'GET') return
    if (decidirEstrategia(req.url, self.location.href) !== 'shell') return // la API de REE va directa a la red

    const swUrl = self.location.href
    const clave = claveDeCache(req.url, swUrl)
    const abrir = caches.open(CACHE_SHELL)

    // Lectura: manda la caché; la red solo cubre el primer arranque (caché vacía).
    const respuesta = (async () => {
        const cache = await abrir
        const guardado = await cache.match(clave)
        if (guardado) return guardado
        const fresca = await fetch(req)
        if (fresca && fresca.ok) await cache.put(clave, fresca.clone())
        return fresca
    })()

    // Refresco en segundo plano, lanzado en el dispatch para que waitUntil sea legal.
    // Solo cuando ya había caché (si no, la lectura de arriba acaba de rellenarla).
    const refresco = abrir
        .then(cache => cache.match(clave))
        .then(guardado => guardado
            ? fetch(req)
                .then(r => (r && r.ok ? abrir.then(cache => cache.put(clave, r.clone())) : undefined))
                .catch(() => undefined) // modo avión: se conserva lo cacheado
            : undefined)

    evento.waitUntil(Promise.all([respuesta, refresco]).then(() => undefined))
    evento.respondWith(respuesta)
})
