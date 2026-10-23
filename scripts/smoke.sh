#!/usr/bin/env bash
# Seam del smoke headless: un comando, líneas PASS/FAIL, exit code agregado.
# Solo desarrollo: no añade dependencias ni toca la web publicada (docs/index.html).
# Sin navegador headless disponible, sale 0 con un aviso (no bloquea el pre-commit).
set -euo pipefail
cd "$(dirname "$0")/.."
exec node scripts/smoke.mjs "$@"
