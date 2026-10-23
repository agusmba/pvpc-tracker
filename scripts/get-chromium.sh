#!/usr/bin/env bash
# Descarga chrome-headless-shell (Chrome for Testing estable) en .cache/ para scripts/smoke.sh.
# ~125 MB, una sola vez. No añade dependencias al repo: el binario queda fuera del git.
set -euo pipefail
cd "$(dirname "$0")/.."

case "$(uname -s)" in
    Linux)  plataforma=linux64 ;;
    Darwin) plataforma=mac-x64 ;;
    *)      echo "Plataforma no reconocida: usa PVPC_CHROME=/ruta/a/chromium scripts/smoke.sh" >&2; exit 1 ;;
esac

url=$(node -e "
const u = 'https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json';
fetch(u).then(r => r.json()).then(d => {
    for (const x of d.channels.Stable.downloads['chrome-headless-shell']) {
        if (x.platform === '$plataforma') { console.log(x.url); return; }
    }
    process.exit(1);
})")

dest=".cache/chrome-headless-shell-${plataforma}"
curl -fsSL --max-time 300 -o .cache/chs.zip "$url"
unzip -q -o .cache/chs.zip -d .cache
rm .cache/chs.zip
echo "Navegador headless en ${dest}/chrome-headless-shell"
