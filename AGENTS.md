# PVPC Tracker

SPA autocontenida en `docs/index.html`: precios PVPC oficiales de REE, offline con localStorage, historial semanal, mobile-first. Sin dependencias externas.

GitHub Pages sirve `docs/` de **`main`**: el plegado final de cualquier cambio de UI va en `main`.

## Flujo por feature
1. Ticket como GitHub Issue del repo (skills `to-spec`/`to-tickets`, o `gh issue create`). Validar el alcance antes de implementar.
2. Implementar sin romper lo existente; probar en navegador (móvil, offline, datos incompletos).
3. Al terminar: migrar el código a `docs/index.html`, verificar regresiones y cerrar el issue con un comentario resumen (`gh issue close <n> --comment "..."`).

## Reglas
- Todo en un solo archivo HTML; comentarios en español.
- Cambios progresivos, no reescrituras.
- Si cambia el esquema de datos persistidos, subir versión del STORAGE_KEY (`v1`, `v2`…).
- Assets binarios (p. ej. fuentes woff2): escribir un token placeholder en el HTML y sustituirlo con un script; el base64 nunca pasa por una llamada de herramienta.
- Prototipos (skill `prototype`): la rama desechable que captura el prototipo se llamar `prototype/*` y se pusha a origin (así queda recuperable para colaboradores).

## Checks
- `scripts/check.sh` valida la sintaxis de los `<script>` de `docs/*.html` (`node --check`); cableado como pre-commit vía `git config core.hooksPath .githooks` (config local, no viaja en el clone).

## Agent skills

### Issue tracker

Issues y specs viven en GitHub Issues del repo; operaciones vía CLI `gh`. Ver `local-docs/issue-tracker.md`.

### Triage labels

Vocabulario por defecto de 5 roles (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). Ver `local-docs/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` en la raíz + ADRs en `local-docs/adr/`. Ver `local-docs/domain.md`.
