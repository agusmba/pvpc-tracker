#!/usr/bin/env bash
# Check determinista: valida la sintaxis de los scripts publicados (docs/*.js, como sw.js) y
# de los bloques <script> de docs/*.html con node --check. Cableado como pre-commit (.githooks/pre-commit).
set -euo pipefail

python3 << 'PYEOF'
import glob, re, subprocess, tempfile, os, sys

fail = False
for path in glob.glob('docs/*.js'):
    r = subprocess.run(['node', '--check', path], capture_output=True, text=True)
    if r.returncode != 0:
        fail = True
        print(f'FAIL {path}: {r.stderr.strip()[:300]}', file=sys.stderr)

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
            print(f'FAIL {path} (bloque {i}): {r.stderr.strip()[:300]}', file=sys.stderr)

raise SystemExit(1 if fail else 0)
PYEOF

# Nota visual solo cuando hay algo publicado que validar (se ejecuta desde la raíz del repo).
if [ -n "$(ls docs/*.html docs/*.js 2>/dev/null)" ]; then
    echo "OK: sintaxis JS de docs/*.html y docs/*.js valida"
fi
