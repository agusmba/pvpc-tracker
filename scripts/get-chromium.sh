#!/usr/bin/env bash
# Descarga el navegador headless de Chrome for Testing en .cache/ (fuera del git, cero dependencias).
#   scripts/get-chromium.sh          → chrome-headless-shell (~125 MB): basta para scripts/smoke.sh
#   scripts/get-chromium.sh full     → Chrome completo (~150 MB): lo necesita scripts/offline.sh,
#                                      porque el headless shell no registra Service Worker (ADR 0003)
set -euo pipefail
cd "$(dirname "$0")/.."

modo="${1:-shell}"
case "$modo" in
    shell) pieza=chrome-headless-shell ;;
    full)  pieza=chrome ;;
    *) echo "Modo desconocido: usa 'shell' o 'full'" >&2; exit 1 ;;
esac

case "$(uname -s)" in
    Linux)  plataforma=linux64 ;;
    Darwin) plataforma=mac-x64 ;;
    *) echo "Plataforma no reconocida: usa PVPC_CHROME=/ruta/a/chromium scripts/smoke.sh" >&2; exit 1 ;;
esac

url=$(node -e "
const u = 'https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json';
fetch(u).then(r => r.json()).then(d => {
    for (const x of d.channels.Stable.downloads['$pieza']) {
        if (x.platform === '$plataforma') { console.log(x.url); return; }
    }
    process.exit(1);
})")

dest=".cache/${pieza}-${plataforma}"
bin=chrome-headless-shell
[ "$pieza" = chrome ] && bin=chrome
curl -fsSL --max-time 600 -o .cache/navegador.zip "$url"
unzip -q -o .cache/navegador.zip -d .cache
rm .cache/navegador.zip
echo "Navegador en ${dest}/${bin}"
