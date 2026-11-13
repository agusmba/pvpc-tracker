# PVPC Tracker

SPA autocontenida en `docs/index.html`: precios PVPC oficiales de REE, historial semanal, mobile-first. Sin dependencias externas.

Dos offlines distintos (GLOSSARY): el **offline del shell** lo da `docs/sw.js` (la página abre sin red), el **offline de datos** el registro en localStorage.

GitHub Pages sirve `docs/` de **`main`**: el plegado final de cualquier cambio de UI va en `main`.

## Flujo por feature
1. Ticket como GitHub Issue del repo (skills `to-spec`/`to-tickets`, o `gh issue create`). Validar el alcance antes de implementar.
2. Implementar sin romper lo existente; probar en navegador (móvil, offline, datos incompletos).
3. Al terminar: migrar el código a `docs/index.html`, verificar regresiones y cerrar el issue con un comentario resumen (`gh issue close <n> --comment "..."`).

## Reglas
- Un solo HTML autocontenido (sin JS ni CSS externos); los únicos otros archivos publicados son `sw.js`, `manifest.webmanifest` e `icono.svg`. Comentarios en español.
- Cambios progresivos, no reescrituras.
- Si cambia el esquema de datos persistidos, subir versión del STORAGE_KEY (`v1`, `v2`…). La caché del shell no necesita bump al publicar: se refresca en segundo plano (ADR 0003); `CACHE_SHELL` solo sube si cambia la precarga o la lógica del SW.
- La API de REE no se cachea en el SW: el offline de datos es del registro (ADR 0003).
- Assets binarios (p. ej. fuentes woff2): escribir un token placeholder en el HTML y sustituirlo con un script; el base64 nunca pasa por una llamada de herramienta.
- Prototipos (skill `prototype`): la rama desechable que captura el prototipo se llamará `prototype/*` y se pusha a origin (así queda recuperable para colaboradores).

## Checks
- `scripts/check.sh` es el guardrail determinista (≈2 s, sin navegador): sintaxis de lo publicado y de `scripts/`, seams de shell y enlaces entre módulos (un `import` con nombre inventado revienta aquí). Cableado como pre-commit (`git config core.hooksPath .githooks`, config local) y como job de CI en `.github/workflows/checks.yml`, que es el que viaja en el clone.
- `node --test scripts/` prueba la lógica pura: el bloque `// >>>nucleo` / `// <<<nucleo` del HTML (`scripts/nucleo.mjs`) y el `// >>>sw-nucleo` / `// <<<sw-nucleo` de `docs/sw.js` (`scripts/nucleo-sw.mjs`). Sin dependencias.
- `scripts/smoke.sh` smoke headless de geometría con el CLI de chromium (ADR 0002). Sin navegador sale 0 con aviso; binario con `scripts/get-chromium.sh`. Nada de test viaja a `docs/`: el harness solo se inyecta en una copia temporal.
- `scripts/offline.sh` smoke del **offline del shell**: espejo local de Pages bajo `/pvpc-tracker/`, SW instalado y, con el servidor caído, la SPA renderiza desde la caché del SW (motor: Chrome completo por CDP, ADR 0004 — el headless shell no registra SW). Sale 0 con aviso si falta el navegador; binario con `scripts/get-chromium.sh full`.
- Los tests y helpers de desarrollo viven en `scripts/`; `docs/` es solo la web publicada.

## Agent skills

### Issue tracker

Issues y specs viven en GitHub Issues del repo; operaciones vía CLI `gh`. Ver `local-docs/issue-tracker.md`.

### Triage labels

Vocabulario por defecto de 5 roles (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). Ver `local-docs/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` en la raíz + ADRs en `local-docs/adr/`. Ver `local-docs/domain.md`.
