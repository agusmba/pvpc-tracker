/**
 * offline.mjs — smoke de **offline del shell** por CDP (ADR 0004).
 *
 * Simula el garaje con la geometría real de GitHub Pages:
 *   1. un servidor local sirve la publicación bajo su carpeta (/pvpc-tracker/) con las
 *      cabeceras de Pages (`cache-control: max-age=600`) y deja una API en otro origen;
 *   2. lanzamiento A (con red): el Service Worker se instala, precarga el shell y refresca
 *      en segundo plano. Un navegador de prueba que no registre SW sale con SKIP + aviso,
 *      no con FAIL;
 *   3. lanzamiento B (mismo perfil, servidor caído y modo avión por CDP, caché HTTP
 *      desactivada): la página sigue abriendo. Dos lanzamientos distintos prueban que el caché
 *      del SW **persiste en disco**, que es el caso real: el móvil se apaga entre usos.
 *
 * Invariantes: la página está controlada por el SW y renderiza el registro local; una
 * petición de otro origen no entra en la caché; un día sin datos guardados en modo avión
 * dice `sin conexión`; la publicación llega en la carga siguiente.
 *
 * La caché HTTP del navegador está desactivada en el lanzamiento B: con ella activa el
 * documento podría servir el navegador sin intervención del SW y el test sería un
 * verde-falso. En el lanzamiento A va activa a propósito, porque Pages manda max-age=600 y
 * esa es la trampa que el `cache: 'reload'` del refresco tiene que sortear.
 *
 * Uso: chromium=(chrome|path) node scripts/offline.mjs
 *      (usa el Chrome completo: el headless shell no registra Service Workers)
 */
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { núcleo } from './nucleo.mjs'
import { fixtureRegistros } from './fixture-registro.mjs'

const RAIZ = new URL('..', import.meta.url).pathname.replace(/\/$/, '')

/**
 * Devuelve el HTML bajo la carpeta del scope, como lo sirve Pages: el path de la URL
 * publica es /pvpc-tracker/ y los URLs relativos del documento se resuelven ahí.
 */
export function htmlBajoScope(html, prefijo = '/pvpc-tracker') {
    return html.replace(/<base href="(\/[^"]*)"/, `<base href="${prefijo}/"`).replace(/<head>/, `<head><base href="${prefijo}/">`)
}

function buscarChromeCompleto() {
    // Mis variables de entorno que el smoke de geometría (ADR 0002), más `chromium`,
    // que es la que usa offline.sh.
    for (const env of ['PVPC_CHROME', 'chromium']) if (process.env[env] && existsSync(process.env[env])) return process.env[env]
    const candidatos = [
        '/home/agustin/Fuentes/precio-luz/.cache/chrome-linux64/chrome',
        join(RAIZ, '.cache', 'chrome-linux64', 'chrome'),
        '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'
    ]
    for (const c of candidatos) if (existsSync(c)) return c
    for (const dir of (process.env.PATH || '').split(':')) {
        for (const n of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
            const p = join(dir, n)
            if (existsSync(p)) return p
        }
    }
    for (const base of [join(RAIZ, 'node_modules'), join(process.env.HOME || '', '.cache')]) {
        for (const n of ['chromium-1208', 'chromium-1207', 'chromium']) {
            const p = join(base, 'playwright', 'chromium', n, 'chrome-linux64', 'chrome')
            if (existsSync(p)) return p
        }
    }
    return null
}

/** El espejo de Pages: la publicación bajo /pvpc-tracker/ con sus cabeceras, y un recurso
 *  en otro origen (otra *máquina*: localhost vs 127.0.0.1 son orígenes distintos). */
const SERVIDOR = {
    puerto: 0,
    servidor: null,
    htmlPublicado: '',
    recursos: {},
    inicio() {
        this.htmlPublicado = htmlBajoScope(readFileSync(join(RAIZ, 'docs', 'index.html'), 'utf8'))
        this.recursos = {
            'manifest.webmanifest': readFileSync(join(RAIZ, 'docs', 'manifest.webmanifest'), 'utf8'),
            'icono.svg': readFileSync(join(RAIZ, 'docs', 'icono.svg'), 'utf8')
        }
        this.servidor = createServer((req, res) => {
            const url = new URL(req.url, 'http://localhost')
            if (url.pathname === '/pvpc-tracker/sw.js') {
                res.writeHead(200, {
                    'content-type': 'text/javascript; charset=utf-8',
                    'cache-control': 'no-cache',
                    'service-worker-allowed': '/'
                })
                res.end(readFileSync(join(RAIZ, 'docs', 'sw.js'), 'utf8'))
                return
            }
            if (url.pathname.startsWith('/pvpc-tracker/')) {
                const relativo = url.pathname.slice('/pvpc-tracker/'.length)
                if (!relativo || relativo === 'index.html') {
                    // Pages manda el HTML con max-age=600: la trampa que el refresco del SW
                    // tiene que sortear con cache: 'reload'.
                    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'max-age=600' })
                    res.end(this.htmlPublicado)
                    return
                }
                if (this.recursos[relativo]) {
                    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'max-age=600' })
                    res.end(this.recursos[relativo])
                    return
                }
                res.writeHead(404)
                res.end('no existe')
                return
            }
            if (url.pathname === '/cross-origin/precios.json') {
                // Otro origen: si la estrategia del SW se rompe y cachea cross-origin, esta
                // entrada aparece en la caché y el aserto correspondiente se pone rojo.
                res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' })
                res.end('{"datos":true}')
                return
            }
            res.writeHead(404)
            res.end()
        })
        this.servidor.listen(0, '127.0.0.1')
        return new Promise(terminada => this.servidor.once('listening', () => {
            this.puerto = this.servidor.address().port
            terminada()
        }))
    },
    /** Publica un cambio en el shell (equivale a un push a main en Pages). */
    publicar(marcador) {
        this.htmlPublicado = this.htmlPublicado.replace(/<\/title>/, marcador + '</title>')
    },
    cerrar() {
        if (this.servidor) this.servidor.closeAllConnections?.()
        if (this.servidor) this.servidor.close()
    }
}

const URL_APP = () => `http://localhost:${SERVIDOR.puerto}/pvpc-tracker/`
const URL_API = () => `http://127.0.0.1:${SERVIDOR.puerto}/cross-origin/precios.json`

/** Lanzamiento de navegador con un perfil dado. `cachéHTTP` activa o desactivada. */
async function lanzar({ perfil, puertoCDP, cacheDisabled, offline = false, argsExtra = [] }) {
    const exe = buscarChromeCompleto()
    const proc = spawn(exe, [
        '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
        '--no-first-run', '--no-default-browser-check', '--disable-extensions',
        '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        // La API de REE no se resuelve: la verificación no depende de la red externa.
        '--host-resolver-rules=MAP apidatos.ree.es ~NOTFOUND',
        `--user-data-dir=${perfil}`,
        `--remote-debugging-port=${puertoCDP}`,
        ...argsExtra
    ], { stdio: ['ignore', 'ignore', 'pipe'] })

    let stderr = ''
    proc.stderr.on('data', b => { stderr += b.toString() })

    let diana = null
    for (let i = 0; i < 40 && !diana; i++) {
        try {
            const dianas = await (await fetch(`http://127.0.0.1:${puertoCDP}/json/list`)).json()
            diana = dianas.find(d => d.type === 'page' && d.webSocketDebuggerUrl)
        } catch { await new Promise(r => setTimeout(r, 500)) }
    }
    if (!diana) { proc.kill(); throw new Error(`Chrome no expuso su diana CDP en :${puertoCDP}\n${stderr.split('\n').slice(-4).join(' / ')}`) }

    const ws = new WebSocket(diana.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })

    let seq = 0
    const pendientes = new Map()
    const eventos = []
    ws.onmessage = ev => {
        const m = JSON.parse(ev.data)
        if (m.id && pendientes.has(m.id)) {
            const p = pendientes.get(m.id)
            pendientes.delete(m.id)
            m.error ? p.j(new Error(m.error.message)) : p.r(m.result)
            return
        }
        for (const e of eventos) if (e.method === m.method && !e.hecho) { e.hecho = true; e.r(m.params || {}) }
    }
    const send = (method, params = {}) => new Promise((r, j) => {
        const id = ++seq
        pendientes.set(id, { r, j })
        ws.send(JSON.stringify({ id, method, params }))
    })
    const esperar = (method, ms) => new Promise(r => {
        const e = { method, hecho: false, r }
        eventos.push(e)
        setTimeout(() => { if (!e.hecho) { e.hecho = true; r(null) } }, ms)
    })
    const evaluar = async (expr, ms = 8000) => {
        // En una página de error (puerto cerrado sin SW) puede no existir contexto de
        // ejecución y `Runtime.evaluate` cuelga: se acota para que el aserto salga rojo.
        const r = await Promise.race([
            send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }),
            new Promise(res => setTimeout(() => res(null), ms))
        ])
        if (!r || r.exceptionDetails) return undefined
        return r.result?.value
    }

    await send('Page.enable')
    await send('Runtime.enable')
    await send('Network.enable')
    await send('Network.setCacheDisabled', { cacheDisabled })
    // Modo avión de verdad: `navigator.onLine` pasa a false y las peticiones caen. Sin esto
    // el harness solo bloquea DNS y la app diría `error-ree`, no `sin-conexion`.
    if (offline) await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 })

    const navegar = async url => {
        const carga = esperar('Page.loadEventFired', 15000)
        // `Page.navigate` puede no resolver si la navegación falla (puerto cerrado sin SW
        // que responda): se acota para que el aserto se ponga rojo y no cuelgue el harness.
        const enviado = Promise.race([send('Page.navigate', { url }), new Promise(r => setTimeout(() => r('sin respuesta'), 12000))])
        await Promise.resolve(enviado).catch(() => 'rechazada')
        const llegado = await carga
        await new Promise(r => setTimeout(r, 2500))
        return !!llegado
    }

    const cerrar = async () => {
        ws.close()
        proc.kill()
        // Chrome tarda unos instantes en soltar el perfil; el siguiente lanzamiento lo usa.
        await new Promise(r => setTimeout(r, 1500))
    }

    return { navegar, evaluar, send, cerrar, stderr }
}

async function esperaSW(ctx, ms = 8000) {
    const hasta = Date.now() + ms
    let estado = 'none'
    while (Date.now() < hasta) {
        estado = await ctx.evaluar('navigator.serviceWorker.getRegistration().then(r => r ? (r.active ? "active" : r.waiting ? "waiting" : "installing") : "none")')
        if (estado === 'active') return estado
        await new Promise(r => setTimeout(r, 700))
    }
    return estado
}

async function main() {
    const logica = núcleo(join(RAIZ, 'docs', 'index.html'))
    let alta = 0, falla = 0, omite = 0
    const pas = (msg) => { alta++; console.log(`  PASS ${msg}`) }
    const flo = (msg) => { falla++; console.log(`  FAIL ${msg}`) }
    const skp = (msg) => { omite++; console.log(`  SKIP ${msg}`) }

    const exe = buscarChromeCompleto()
    if (!exe) {
        skp('sin navegador a mano: chromium=<path> o bash scripts/get-chromium.sh full')
        console.log(`\n${alta} PASS, ${falla} FAIL, ${omite} SKIP`)
        return falla === 0
    }

    await SERVIDOR.inicio()
    const perfil = mkdtempSync(join(tmpdir(), 'pvpc-perfil-'))
    const fijado = fixtureRegistros(logica)[logica.STORAGE_KEY]
    let ctx = null
    try {
        // ---------- lanzamiento A: con el espejo arriba ----------
        ctx = await lanzar({ perfil, puertoCDP: 9391, cacheDisabled: false })
        await ctx.navegar(URL_APP())
        const estado = await esperaSW(ctx)
        if (estado !== 'active') {
            skp(`este navegador no activa el Service Worker (estado: ${estado}): el offline del shell no se puede verificar aquí`)
            console.log('    el chrome-headless-shell no registra SW; prueba con bash scripts/get-chromium.sh full')
            console.log(`\n${alta} PASS, ${falla} FAIL, ${omite} SKIP`)
            return falla === 0
        }
        pas('SW activo y controlando la página')

        await ctx.evaluar(`localStorage.setItem(${JSON.stringify(logica.STORAGE_KEY)}, ${JSON.stringify(fijado)}); 'ok'`)
        await ctx.navegar(URL_APP())
        const llaves = await ctx.evaluar('caches.open("pvpc-shell-v1").then(c => c.keys()).then(k => k.map(r => new URL(r.url).pathname))')
        if (Array.isArray(llaves) && llaves.some(p => p === '/pvpc-tracker/index.html') && llaves.some(p => p.endsWith('.webmanifest'))) {
            pas(`precarga del shell: ${llaves.join(', ')}`)
        } else flo(`precarga incompleta: ${JSON.stringify(llaves)}`)

        // Petición a otro origen (localhost vs 127.0.0.1): si el SW cacheara cross-origin —
        // la API de REE entre ellas — esta entrada aparecería en la caché.
        await ctx.evaluar(`fetch(${JSON.stringify(URL_API())}).then(r => r.status).catch(() => 'error')`)
        await new Promise(r => setTimeout(r, 800))
        const entradas = await ctx.evaluar('caches.open("pvpc-shell-v1").then(c => c.keys()).then(k => k.map(r => r.url))')
        if (Array.isArray(entradas) && entradas.every(u => new URL(u).host === `localhost:${SERVIDOR.puerto}`)) {
            pas('una petición de otro origen no entra en la caché (la API de REE tampoco: mismo criterio)')
        } else flo(`la caché guarda entradas de otro origen: ${JSON.stringify(entradas)}`)

        // Publicación: refresco en segundo plano de la carga siguiente. La caché HTTP del
        // navegador sigue activa aquí (como en un móvil): si el refresco no mandara
        // cache: 'reload', el fetch devolvería el documento stale de max-age=600 y se
        // re-cachea sin el marcador.
        SERVIDOR.publicar(' <!--MARCADOR-PUBLICACION-->')
        await ctx.navegar(URL_APP())
        const guardado = await ctx.evaluar('caches.open("pvpc-shell-v1").then(c => c.match("/pvpc-tracker/index.html")).then(r => r ? r.text() : "")')
        if (typeof guardado === 'string' && guardado.includes('MARCADOR-PUBLICACION')) {
            pas('la publicación llega a la caché en la carga siguiente')
        } else flo('el refresco en segundo plano no actualizó la caché')
        await ctx.cerrar()
        ctx = null

        // ---------- lanzamiento B: mismo perfil, servidor caído ----------
        SERVIDOR.cerrar()
        ctx = await lanzar({ perfil, puertoCDP: 9392, cacheDisabled: true, offline: true })
        const llegado = await ctx.navegar(URL_APP())
        const controlada = await ctx.evaluar('!!(navigator.serviceWorker && navigator.serviceWorker.controller)')
        const titulo = await ctx.evaluar('document.title')
        const tarjetas = await ctx.evaluar('document.querySelectorAll(".hour-card").length')
        const tabs = await ctx.evaluar('document.querySelectorAll("#dayTabs > *").length')
        if (controlada) pas('el SW sigue controlando tras reiniciar el navegador (caché persistido en disco)')
        else flo('sin SW controlando la página: ' + JSON.stringify({ llegado, titulo }))
        if (typeof titulo === 'string' && titulo.includes('PVPC')) pas('la página se renderiza sin conectividad (título)')
        else flo(`sin título con el servidor caído (llegado=${llegado}, título=${JSON.stringify(titulo)})`)
        if (tarjetas > 0 && tabs > 0) pas(`registro local renderizado en offline (${tarjetas} tarjetas, ${tabs} tabs)`)
        else flo(`render vacío en offline (tarjetas=${tarjetas}, tabs=${tabs})`)

        // Modo avión sobre un día sin datos guardados: el estado debe decir sin conexión,
        // no quedarse en "Cargando datos de REE...".
        await ctx.evaluar(`localStorage.removeItem(${JSON.stringify(logica.STORAGE_KEY)}); 'ok'`)
        await ctx.navegar(URL_APP())
        const estadoSinDatos = await ctx.evaluar('document.getElementById("status")?.innerText || ""')
        if (typeof estadoSinDatos === 'string' && estadoSinDatos.includes('Sin conexión')) {
            pas('en modo avión, un día sin datos guardados dice sin conexión')
        } else flo(`estado inesperado sin datos y sin red: ${JSON.stringify(estadoSinDatos)}`)

        console.log(`\n${alta} PASS, ${falla} FAIL, ${omite} SKIP`)
        return falla === 0
    } catch (e) {
        const detalle = ctx ? `\n${(ctx.stderr || '').split('\n').slice(-6).join(' / ')}` : ''
        throw new Error(`${e.message}${detalle}`)
    } finally {
        if (ctx) await ctx.cerrar().catch(() => {})
        SERVIDOR.cerrar()
        rmSync(perfil, { recursive: true, force: true })
    }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
    main().then(ok => process.exit(ok ? 0 : 1)).catch(e => { console.error('ERROR offline:', e.message); process.exit(1) })
}
