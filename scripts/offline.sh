#!/usr/bin/env bash
# Seam del smoke de offline real: un comando, líneas PASS/FAIL/SKIP, exit code agregado.
# Solo desarrollo: no añade dependencias ni toca la web publicada (docs/).
# Necesita Chrome completo (el headless shell no registra SW): scripts/get-chromium.sh full.
# Sin navegador disponible sale 0 con aviso, igual que scripts/smoke.sh.
set -euo pipefail
cd "$(dirname "$0")/.."
exec node scripts/offline.mjs "$@"
