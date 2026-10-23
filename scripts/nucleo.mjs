// Extractor del núcleo PVPC (solo desarrollo; no viaja a GitHub Pages).
// El HTML de la SPA es la única fuente de verdad: este módulo lee el bloque de
// lógica pura delimitado por >>>nucleo / <<<nucleo y lo evalúa en un sandbox sin
// navegador. function y var declarados en el bloque salen como globales del sandbox.
// NUCLEO_HTML permite apuntar a una copia con un bug reintroducido, para comprobar
// que un test de lógica va red de verdad.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const INICIO = '// >>>nucleo'
const FIN = '// <<<nucleo'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export function núcleo(htmlPath = process.env.NUCLEO_HTML || path.join(raiz, 'docs', 'index.html')) {
    const html = readFileSync(htmlPath, 'utf8')
    const i = html.indexOf(INICIO)
    const j = html.indexOf(FIN)
    if (i < 0 || j < 0) {
        throw new Error(`El HTML (${htmlPath}) no delimita el bloque núcleo con ${INICIO} / ${FIN}`)
    }
    const codigo = html.slice(i + INICIO.length, j)
    // Sandbox deliberadamente vacío: sin document, window, localStorage ni fetch.
    const sandbox = {}
    vm.runInNewContext(codigo, sandbox)
    return sandbox
}
