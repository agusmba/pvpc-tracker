#!/usr/bin/env bash
# Seam del smoke headless: un comando, líneas PASS/FAIL, exit code agregado.
# Solo desarrollo: no añade dependencias ni toca la web publicada (docs/index.html).
# Sin navegador headless disponible, sale 0 con un aviso (no bloquea el pre-commit).
set -euo pipefail
cd "$(dirname "$0")/.."
# Cota dura: un seam que se cuelga sale como fallo legible, no como un proceso eterno.
limite=240
codigo=0
timeout "$limite" node scripts/smoke.mjs "$@" || codigo=$?
if [ "$codigo" -eq 124 ]; then
    echo "  FAIL smoke.sh: el seam superó ${limite} s (timeout) — algo se cuelga" >&2
fi
exit "$codigo"
