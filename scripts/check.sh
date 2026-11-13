#!/usr/bin/env bash
# Check determinista (≈2 s): el guardrail que viaja con el clone.
#   - pre-commit: .githooks/pre-commit (config local, no viaja en el clone)
#   - CI:         .github/workflows/checks.yml (este sí viaja)
# Lleva todo lo detectable sin navegador aquí, para que un error de scripts/ no espere a
# un lanzamiento de navegador de 3 minutos (ADR 0002 y 0004 son los seams con navegador).
# Cuatro capas:
#   1. sintaxis JS de lo publicado (docs/*.js) y de los bloques <script> de docs/*.html
#   2. sintaxis JS de los helpers de desarrollo (scripts/*.{mjs,js})
#   3. sintaxis de los seams de shell (scripts/*.sh)
#   4. enlaces: cada `import { X } from './y.mjs'` pide un export que existe (el nombre
#      inventado revienta aquí, en texto, sin ejecutar nada)
set -euo pipefail
cd "$(dirname "$0")/.."

falla=0
err="$(mktemp)"
trap 'rm -f "$err"' EXIT

# 2) Sintaxis de los módulos de desarrollo.
for f in docs/*.js scripts/*.mjs scripts/*.js; do
    [ -e "$f" ] || continue
    if ! node --check "$f" 2>"$err"; then
        falla=1; echo "FAIL sintaxis $f: $(head -c 300 "$err")" >&2
    fi
done

# 3) Sintaxis de los seams de shell.
for f in scripts/*.sh; do
    [ -e "$f" ] || continue
    if ! bash -n "$f" 2>"$err"; then
        falla=1; echo "FAIL sintaxis $f: $(head -c 300 "$err")" >&2
    fi
done

# 1) y 4) Bloques <script> publicados y enlaces entre módulos.
python3 << 'PYEOF'
import glob, re, subprocess, tempfile, os, sys

fail = False

def informar(msg):
    global fail
    fail = True
    print(f'FAIL {msg}', file=sys.stderr)

# 1) Los bloques <script> del HTML publicado se validan como JS aparte del documento.
for path in glob.glob('docs/*.html'):
    html = open(path, encoding='utf-8').read()
    for i, m in enumerate(re.finditer(r'<script>(.*?)</script>', html, re.S)):
        fd, tmp = tempfile.mkstemp(suffix='.js')
        with os.fdopen(fd, 'w') as f:
            f.write(m.group(1))
        r = subprocess.run(['node', '--check', tmp], capture_output=True, text=True)
        os.unlink(tmp)
        if r.returncode != 0:
            informar(f'{path} (bloque {i}): {r.stderr.strip()[:300]}')

def exportados(texto):
    nombres = set(re.findall(r'export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)', texto))
    for bloque in re.findall(r'export\s*\{([^}]*)\}', texto):
        for parte in bloque.split(','):
            parte = parte.strip()
            if parte:
                nombres.add(parte.split(' as ')[-1].strip())
    if re.search(r'export\s+default\b', texto):
        nombres.add('default')
    return nombres

# 4) Un import con un nombre inventado solo se veía al ejecutar el harness (3 minutos de
#    navegador). Aquí se comprueba en texto, sin efectos secundarios, también en los tests.
for path in sorted(glob.glob('scripts/*.mjs') + glob.glob('docs/*.js')):
    texto = open(path, encoding='utf-8').read()
    for m in re.finditer(r'import\s*\{([^}]*)\}\s*from\s*[\'"](\./[^\'"]+)[\'"]', texto):
        nombres, destino = m.group(1), os.path.normpath(os.path.join(os.path.dirname(path), m.group(2)))
        if not os.path.exists(destino):
            informar(f'{path}: importa {m.group(2)}, que no existe')
            continue
        disponibles = exportados(open(destino, encoding='utf-8').read())
        for nombre in nombres.split(','):
            nombre = nombre.strip().split(' as ')[0].strip()
            if nombre and nombre not in disponibles:
                informar(f"{path}: '{m.group(2)}' no exporta '{nombre}'")

raise SystemExit(1 if fail else 0)
PYEOF

# El fallo ya está en stderr; aquí se suma el de las capas de bash.
if [ "$falla" -ne 0 ]; then
    exit 1
fi

if [ -n "$(ls docs/*.html docs/*.js 2>/dev/null)" ]; then
    echo "OK: check determinista (sintaxis publicada + scripts + seams de shell + enlaces)"
fi
