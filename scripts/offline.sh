#!/usr/bin/env bash
# Seam del smoke de offline real: un comando, líneas PASS/FAIL/SKIP, exit code agregado.
# Solo desarrollo: no añade dependencias ni toca la web publicada (docs/).
# Necesita Chrome completo (el headless shell no registra SW): scripts/get-chromium.sh full.
# Sin navegador disponible sale 0 con aviso, igual que scripts/smoke.sh.
set -euo pipefail
cd "$(dirname "$0")/.."
# Cota dura: un seam que se cuelga tiene que salir como fallo legible, no como un proceso
# eterno que el humano corta a mano. (El harness además acota Page.navigate y Runtime.evaluate.)
limite=420
codigo=0
timeout "$limite" node scripts/offline.mjs "$@" || codigo=$?
if [ "$codigo" -eq 124 ]; then
    echo "  FAIL offline.sh: el seam superó ${limite} s (timeout) — algo se cuelga" >&2
fi
exit "$codigo"
