// Extractor del núcleo del Service Worker (solo desarrollo; no viaja a GitHub Pages).
// Mismo patrón que nucleo.mjs: lee el bloque de lógica pura de docs/sw.js delimitado por
// >>>sw-nucleo / <<<sw-nucleo y lo evalúa en un sandbox. El sandbox solo inyecta URL:
// sin document, window, fetch ni caches. Si la decisión necesitara el navegador, red.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const INICIO = '// >>>sw-nucleo'
const FIN = '// <<<sw-nucleo'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export function núcleoSW(swPath = process.env.NUCLEO_SW || path.join(raiz, 'docs', 'sw.js')) {
    const codigo = readFileSync(swPath, 'utf8')
    const i = codigo.indexOf(INICIO)
    const j = codigo.indexOf(FIN)
    if (i < 0 || j < 0) {
        throw new Error(`El SW (${swPath}) no delimita el bloque núcleo con ${INICIO} / ${FIN}`)
    }
    const sandbox = { URL }
    vm.runInNewContext(codigo.slice(i + INICIO.length, j), sandbox)
    return sandbox
}
