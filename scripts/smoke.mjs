// Runner de smoke headless (solo desarrollo; cero dependencias npm).
// Seam: scripts/smoke.sh → un comando, líneas PASS/FAIL, exit code agregado.
// Motor: CLI de chromium headless (--dump-dom). El harness se inyecta en una copia
// temporal del HTML de la SPA, así que la web publicada no lleva nada de test.
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync, readdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { núcleo } from './nucleo.mjs'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// Fuente bajo prueba: por defecto la web publicada. Se puede señalar otra copia
// (p. ej. una con un bug reintroducido) para comprobar que un invariante va red.
const htmlFuente = process.argv[2] ? path.resolve(process.argv[2]) : path.join(raiz, 'docs', 'index.html')

// Viewports bajo prueba: el estrecho es el caso móvil (barra de URL, scroll del selector).
const VIEWPORTS = [
    { nombre: 'móvil', width: 375, height: 667 },
    { nombre: 'desktop', width: 1280, height: 900 }
]

const CANDIDATOS = [
    process.env.PVPC_CHROME,
    path.join(raiz, '.cache', 'chrome-headless-shell-linux64', 'chrome-headless-shell'),
    path.join(raiz, '.cache', 'chrome-headless-shell-mac-x64', 'chrome-headless-shell'),
    'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser', 'chrome-headless-shell'
].filter(Boolean)

function buscarNavegador() {
    for (const c of CANDIDATOS) {
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
    // Playwright puede haber descargado un chromium: cualquier build serve
    const playwright = path.join(os.homedir(), '.cache', 'ms-playwright')
    if (existsSync(playwright)) {
        for (const build of readdirSync(playwright)) {
            for (const bin of [path.join(playwright, build, 'chrome-linux', 'chrome'),
                               path.join(playwright, build, 'chrome-linux', 'chrome-headless-shell')]) {
                if (existsSync(bin)) return bin
            }
        }
    }
    return null
}

// El fixture se construye con el propio núcleo: una sola fuente de verdad para
// la clave de almacenamiento y para los días navegables.
function fixture(n) {
    const valorMWh = i => 60 + i * 2.6 // €/MWh: franja barata abajo, cara arriba, media en el centro
    const horas = n.normalizarRegistroPvpc(
        Array.from({ length: 24 }, (_, i) => ({
            datetime: `2026-10-23T${String(i).padStart(2, '0')}:00:00.000Z`,
            value: valorMWh(i)
        }))
    )
    const registro = {}
    for (const dia of n.getNavigableDays()) registro[dia] = horas
    return { [n.STORAGE_KEY]: JSON.stringify(registro) }
}

function copiaConHarness(dir, n) {
    const html = readFileSync(htmlFuente, 'utf8')
    // Semilla: el registro PVPC se escribe en localStorage ANTES de que arranque la
    // SPA, para que cargue offline y ningún invariante dependa de la red.
    const siembra = `<script>var __smokeRegistro = ${JSON.stringify(fixture(n))};
        Object.entries(__smokeRegistro).forEach(([k, v]) => localStorage.setItem(k, v));</script>`
    const harness = `<script>${readFileSync(path.join(raiz, 'scripts', 'smoke-harness.js'), 'utf8')}</script>`
    const destino = path.join(dir, 'index.html')
    writeFileSync(destino, html.replace('<script>', `${siembra}
    <script>`).replace('</body>', `${harness}
</body>`))
    return destino
}

function lanzarNavegador(bin, destino, viewport) {
    return execFileSync(bin, [
        '--headless',
        '--dump-dom',
        '--no-sandbox',
        '--disable-gpu',
        `--window-size=${viewport.width},${viewport.height}`,
        '--virtual-time-budget=4000', // más que los esperas del harness (~2,1 s)
        `file://${destino}`
    ], { maxBuffer: 10 * 1024 * 1024, timeout: 30000, stdio: 'pipe' }).toString()
}

function leerResultados(dom) {
    // Tomamos el último bloque publicado por el harness y solo líneas de resultado.
    const coincidencias = [...dom.matchAll(/<pre id="__smoke">([\s\S]*?)<\/pre>/g)]
    if (!coincidencias.length) return ['FAIL harness — el navegador no publicó resultados (¿init() no terminó?)']
    return coincidencias[coincidencias.length - 1][1]
        .split('\n')
        .map(l => l.trim().replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&lt;/g, '<'))
        .filter(l => /^(PASS|FAIL|SKIP) /.test(l))
}

const bin = buscarNavegador()
if (!bin) {
    console.log('SMOKE omitido: no hay navegador headless.')
    console.log('  Instálalo:  scripts/get-chromium.sh   (chrome-headless-shell, ~125 MB, en .cache/)')
    console.log('  o señala uno existente:  PVPC_CHROME=/ruta/a/chromium scripts/smoke.sh')
    process.exit(0)
}

const n = núcleo()
const dir = mkdtempSync(path.join(os.tmpdir(), 'pvpc-smoke-'))
let fallo = false
let pasados = 0
let omitidos = 0
try {
    const destino = copiaConHarness(dir, n)
    console.log(`Smoke headless (${bin}) · ${VIEWPORTS.map(v => `${v.nombre} ${v.width}x${v.height}`).join(' + ')}`)
    for (const viewport of VIEWPORTS) {
        const dom = lanzarNavegador(bin, destino, viewport)
        for (const linea of leerResultados(dom)) {
            if (linea.startsWith('FAIL')) fallo = true
            else if (linea.startsWith('SKIP')) omitidos++
            else if (linea.startsWith('PASS')) pasados++
            console.log(`  ${linea}`)
        }
    }
} finally {
    rmSync(dir, { recursive: true, force: true })
}

console.log(fallo ? `SMOKE: FAIL (${pasados} pasados, ${omitidos} omitidos)` : `SMOKE: OK (${pasados} pasados, ${omitidos} omitidos)`)
process.exit(fallo ? 1 : 0)
