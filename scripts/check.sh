#!/usr/bin/env bash
# Check determinista: extrae los bloques <script> de docs/*.html y valida su sintaxis con node --check.
# Cableado como pre-commit (.githooks/pre-commit). Sin dependencias externas.
set -euo pipefail

python3 << 'PYEOF'
import glob, re, subprocess, tempfile, os

fail = False
for path in glob.glob('docs/*.html'):
    html = open(path, encoding='utf-8').read()
    for i, m in enumerate(re.finditer(r'<script>(.*?)</script>', html, re.S)):
        fd, tmp = tempfile.mkstemp(suffix='.js')
        with os.fdopen(fd, 'w') as f:
            f.write(m.group(1))
        r = subprocess.run(['node', '--check', tmp], capture_output=True, text=True)
        os.unlink(tmp)
        if r.returncode != 0:
            fail = True
            print(f'FAIL {path} (bloque {i}): {r.stderr.strip()[:300]}', file=os.stderr)

raise SystemExit(1 if fail else 0)
PYEOF
