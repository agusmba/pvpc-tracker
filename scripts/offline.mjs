// Smoke de **offline real** (solo desarrollo; cero dependencias npm).
// Seam: scripts/offline.sh → un comando, líneas PASS/FAIL/SKIP y exit code agregado.
//
// Qué prueba: que el shell (la página publicada) abre sin red. Sirve una copia temporal de
// docs/ bajo /pvpc-tracker/ —espejo de GitHub Pages—, deja que el Service Worker instale y
// cachee, y vuelve a navegar con el servidor **caído**: si la SPA renderiza con el registro
// local, el offline del shell funciona. Si el SW no intercepta, la navegación da
// ERR_CONNECTION_REFUSED y el test va red.
//
// Motor: Chrome completo (headless=new) manejado por CDP con el WebSocket global de Node.
// El CLI de chromium (--dump-dom) del smoke de geometría no vale aquí: el headless shell no
// registra service workers, así que una prueba de offline con él no probaría nada (ADR 0003).
import { mkdtempSync, mkdirSync, rmSync, existsSync, readdirSync, readFileSync, copyFileSync, appendFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { spawn, execFileSync } from 'node:child_process'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { núcleo } from './nucleo.mjs'
import { núcleoSW } from './nucleo-sw.mjs'
import { fixtureRegistros } from './fixture-registro.mjs'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PUBLICADOS = ['index.html', 'sw.js', 'manifest.webmanifest', 'icono.svg']
const BASE = '/pvpc-tracker' // espejo del path donde Pages sirve docs/
const ESPERA_EVENTO = 10000

const TIPOS = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.webmanifest': 'application/manifest+json',
    '.svg': 'image/svg+xml'
}

// Solo navegadores que registran service workers: Chrome completo, no chrome-headless-shell.
function buscarChromeCompleto() {
    const candidatos = [
        process.env.PVPC_CHROME,
        path.join(raiz, '.cache', 'chrome-linux64', 'chrome'),
        'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'
    ].filter(Boolean)
    for (const c of candidatos) {
        if (path.isAbsolute(c)) {
            if (existsSync(c)) return c
            continue
        }
        try {
            execFileSync('which', [c], { stdio: 'pipe' })
            return c
        } catch {
            // no está en PATH
        }
    }
    // Un chromium de Playwright también serve (solo los completos, no el headless shell).
    const playwright = path.join(os.homedir(), '.cache', 'ms-playwright')
    if (existsSync(playwright)) {
        for (const build of readdirSync(playwright)) {
            if (!build.startsWith('chromium-')) continue
            const bin = path.join(playwright, build, 'chrome-linux', 'chrome')
            if (existsSync(bin)) return bin
        }
    }
    return null
}

async function puertoLibre() {
    return new Promise((res, rej) => {
        const s = net.createServer()
        s.on('error', rej)
        s.listen(0, '127.0.0.1', () => {
            const p = s.address().port
            s.close(() => res(p))
        })
    })
}

// Servidor estático del sitio espejo: close() es lo que simula "no hay red" para ese host.
function servidor(dirSitio) {
    return createServer((req, res) => {
        const url = new URL(req.url, 'http://127.0.0.1')
        if (url.pathname === '/' || url.pathname === BASE) {
            res.writeHead(301, { location: BASE + '/' }) // como Pages: la raíz del path redirige con barra
            res.end()
            return
        }
        const nombre = url.pathname.startsWith(BASE + '/') ? url.pathname.slice(BASE.length + 1) : ''
        const archivo = path.join(dirSitio, nombre || 'index.html')
        if (!PUBLICADOS.includes(nombre || 'index.html') || !existsSync(archivo)) {
            res.writeHead(404)
            res.end('no publicado')
            return
        }
        res.writeHead(200, { 'content-type': TIPOS[path.extname(archivo)] || 'application/octet-stream' })
        res.end(readFileSync(archivo))
    })
}

// Cliente CDP mínimo (sin librerías): send + esperar sobre un WebSocket.
function conectar(urlWs) {
    const ws = new WebSocket(urlWs)
    let id = 0
    const pendientes = new Map()
    const eventos = []
    return new Promise((resolve, reject) => {
        ws.onopen = () => {
            ws.onmessage = (ev) => {
                const m = JSON.parse(ev.data)
                if (m.id && pendientes.has(m.id)) {
                    const { resolve: r, reject: j } = pendientes.get(m.id)
                    pendientes.delete(m.id)
                    m.error ? j(new Error(`${m.error.message} ${JSON.stringify(m.error.data || '')}`)) : r(m.result)
                    return
                }
                for (const e of eventos) if (e.method === m.method && !e.hecho) { e.hecho = true; e.resolve(m.params || {}) }
            }
            resolve({
                send: (method, params = {}) => new Promise((r, j) => {
                    const i = ++id
                    pendientes.set(i, { resolve: r, reject: j })
                    ws.send(JSON.stringify({ id: i, method, params }))
                }),
                // Primer evento con ese nombre, o null si llega el timeout (el timeout es reserva, no fallo).
                esperar: (method, ms) => new Promise((r) => {
                    const e = { method, hecho: false, resolve: r }
                    eventos.push(e)
                    setTimeout(() => { if (!e.hecho) { e.hecho = true; r(null) } }, ms)
                }),
                close: () => ws.close()
            })
        }
        ws.onerror = () => reject(new Error('no se pudo conectar al CDP de la diana'))
    })
}

// Espera a que el puerto de CDP exponga una diana de página a la que conectar.
async function esperaDiana(puertoCDP) {
    for (let i = 0; i < 30; i++) {
        try {
            const dianas = await (await fetch(`http://127.0.0.1:${puertoCDP}/json/list`)).json()
            const pagina = dianas.find(d => d.type === 'page' && d.webSocketDebuggerUrl)
            if (pagina) return pagina
        } catch {
            // el navegador aún no escucha
        }
        await new Promise(r => setTimeout(r, 500))
    }
    throw new Error('el navegador no expuso CDP en el puerto ' + puertoCDP)
}

async function main() {
    const bin = buscarChromeCompleto()
    if (!bin) {
        console.log('SKIP offline: no hay Chrome completo (chrome-headless-shell no registra Service Worker).')
        console.log('  Descárgalo:  scripts/get-chromium.sh full')
        console.log('  o señálalo:  PVPC_CHROME=/ruta/a/chrome scripts/offline.sh')
        return 0
    }

    const nucleo = núcleo()
    const sw = núcleoSW()
    // El fixture del registro se construye con el propio núcleo (misma fuente que el smoke).
    const semilla = `Object.entries(${JSON.stringify(fixtureRegistros(nucleo))}).forEach(([k, v]) => localStorage.setItem(k, v));`

    const dir = mkdtempSync(path.join(os.tmpdir(), 'pvpc-offline-'))
    const perfil = mkdtempSync(path.join(os.tmpdir(), 'pvpc-offline-perfil-'))
    const dirSitio = path.join(dir, 'pvpc-tracker')
    mkdirSync(dirSitio, { recursive: true })
    for (const nombre of PUBLICADOS) copyFileSync(path.join(raiz, 'docs', nombre), path.join(dirSitio, nombre))

    const srv = servidor(dirSitio)
    const puertoWeb = await new Promise((res) => srv.listen(0, '127.0.0.1', () => res(srv.address().port)))
    const urlBase = `http://127.0.0.1:${puertoWeb}${BASE}/`
    const puertoCDP = await puertoLibre()

    let stderr = ''
    const proc = spawn(bin, [
        '--headless=new',
        '--no-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-extensions',
        '--disable-background-networking',
        // La API de REE se resuelve a nada: el test no depende de internet ni del API real,
        // y reproduce el modo avión también para la carga de datos.
        '--host-resolver-rules=MAP apidatos.ree.es ~NOTFOUND',
        `--user-data-dir=${perfil}`,
        `--remote-debugging-port=${puertoCDP}`
    ], { stdio: ['ignore', 'ignore', 'pipe'] })
    proc.stderr.on('data', (b) => { stderr += b.toString() })

    let codigo = 0
    const resultados = []
    const alta = (ok, linea) => { resultados.push(`${ok ? 'PASS' : 'FAIL'} ${linea}`); if (!ok) codigo = 1 }

    try {
        const diana = await esperaDiana(puertoCDP)
        const cdp = await conectar(diana.webSocketDebuggerUrl)
        await cdp.send('Page.enable')
        await cdp.send('Runtime.enable')
        await cdp.send('Network.enable')
        // Sin caché HTTP: si la carga offline sale, el único candidato es la caché del SW.
        // (Chrome guarda el documento en su caché HTTP, y eso daría verde sin Service Worker.)
        await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
        // La semilla del registro viaja por CDP: docs/ sigue sin llevar nada de test.
        await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: semilla })

        const evaluar = async (expr) => {
            const r = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
            // Una excepción en la página no aborta el smoke: la página de error del navegador
            // no tiene `document` útil, y eso debe salir como FAIL en la aserción, no como crash.
            if (r.exceptionDetails) return undefined
            return r.result?.value
        }
        const navegar = async (url) => {
            const carga = cdp.esperar('Page.loadEventFired', ESPERA_EVENTO)
            await cdp.send('Page.navigate', { url })
            const llegado = await carga
            await new Promise(r => setTimeout(r, 1500)) // install + activate + precarga del SW
            return !!llegado
        }

        // --- carga 1 (con red): el SW se instala, precarga y toma el control ---
        const carga1 = await navegar(urlBase)
        alta(carga1, 'carga 1 con el servidor arriba (load event)')

        let estadoSW = 'none'
        for (let i = 0; i < 8 && estadoSW !== 'active'; i++) {
            estadoSW = await evaluar('navigator.serviceWorker.getRegistration().then(r => r ? (r.active ? "active" : (r.installing ? "installing" : "waiting")) : "none")')
            if (estadoSW !== 'active') await new Promise(r => setTimeout(r, 700))
        }
        alta(estadoSW === 'active', `Service Worker activo tras la carga 1 (estado: ${estadoSW})`)

        const entradas = await evaluar(`caches.open(${JSON.stringify(sw.CACHE_SHELL)}).then(c => c.keys()).then(k => k.map(r => r.url))`) || []
        alta(entradas.some(u => u.endsWith(BASE + '/index.html')), `shell precargado en la caché (${entradas.length} entradas)`)
        alta(entradas.every(u => new URL(u).hostname === '127.0.0.1'), 'la API de REE no pasa por la caché del SW (offline de datos = registro local)')

        // --- refresco en segundo plano: una publicación nueva llega sin subir versiones ---
        // Se cambia el HTML del espejo (lo que sería un push a main) y se navega otra vez con
        // red: lo que se renderiza puede ser lo viejo, pero la caché debe quedar actualizada.
        const claveShell = urlBase + 'index.html'
        appendFileSync(path.join(dirSitio, 'index.html'), '\n<!-- MARCADOR-PUBLICACION -->\n')
        await navegar(urlBase)
        const cacheada = await evaluar(
            `caches.open(${JSON.stringify(sw.CACHE_SHELL)}).then(c => c.match(${JSON.stringify(claveShell)})).then(r => r ? r.text() : "")`
        )
        alta(typeof cacheada === 'string' && cacheada.includes('MARCADOR-PUBLICACION'),
            'refresco en segundo plano: la publicación nueva queda cacheada para la carga siguiente')

        // --- offline: el servidor cae y se vuelve a navegar a la misma URL ---
        await new Promise((res) => { srv.close(() => res()) })
        // El load event no sirve como prueba aquí: la página de error del navegador también
        // dispara load. La prueba es que el documento controlado por el SW renderice la SPA.
        await navegar(urlBase)

        const titulo = await evaluar('document.title')
        const controlado = await evaluar('!!(navigator.serviceWorker && navigator.serviceWorker.controller)')
        const tarjetas = await evaluar('document.querySelectorAll(".hour-card").length')
        const tabs = await evaluar('document.querySelectorAll("#dayTabs > *").length')
        alta(controlado, 'offline: la navegación la controla el SW (ni red ni caché HTTP)')
        alta(typeof titulo === 'string' && titulo.includes('PVPC'), `offline: el shell servido por el SW renderiza la SPA (título: ${JSON.stringify(titulo)})`)
        alta(tarjetas > 0 && tabs > 0, `offline: SPA usable con el registro local — ${tarjetas} tarjetas horarias y ${tabs} tabs`)

        cdp.close()
    } catch (e) {
        alta(false, 'offline: ' + e.message)
        if (stderr) console.log('  stderr del navegador: ' + stderr.split('\n').slice(-3).join(' / ').slice(0, 300))
    } finally {
        proc.kill()
        srv.close()
        rmSync(dir, { recursive: true, force: true })
        rmSync(perfil, { recursive: true, force: true })
    }

    for (const linea of resultados) console.log(`  ${linea}`)
    const fallos = resultados.filter(l => l.startsWith('FAIL')).length
    console.log(codigo ? `OFFLINE: FAIL (${fallos} fallos)` : `OFFLINE: OK (${resultados.length} pasados)`)
    return codigo
}

main().then(c => process.exit(c)).catch(e => { console.error('offline.mjs: ' + (e && e.stack || e)); process.exit(1) })
