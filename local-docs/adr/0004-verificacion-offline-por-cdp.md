# 0004 — Verificación del offline por CDP con Chrome completo

**Status:** aceptado (2026-11-13). Complementa el 0002, que decide el motor del smoke de
geometría; este decide el motor del smoke de **offline** (`scripts/offline.sh`).

## Contexto

El offline del shell solo se puede probar con un navegador que registre de verdad el Service
Worker y que intercepte la navegación cuando la red cae. El seam de ADR 0002 (CLI de chromium,
`--dump-dom`) no sirve: con `chrome-headless-shell` la promesa de
`navigator.serviceWorker.register()` **no llega a resolverse nunca** y no queda registración en
el perfil — la segunda navegación da `ERR_CONNECTION_REFUSED`. Lo probamos con el binario que
ya usa el smoke y con Chrome for Testing en modo `--headless=new` lanzado por CLI: los dos, sin
SW. Con el mismo Chrome completo dirigido por CDP, la registración resuelve y el offline sirve.

Además, dos trampas que dan **verde falso**:

- La caché HTTP del navegador guarda el documento y puede servirlo sin red **sin** Service
  Worker. Hay que desactivarla (`Network.setCacheDisabled`) para que el único candidato sea la
  caché del SW.
- La página de error del navegador también dispara `load` y su título es el host. Un invariante
  escrito sobre "hubo load event" pasa con el SW roto.

## Decision

`scripts/offline.mjs` habla con el navegador por **CDP con el `WebSocket` global de Node**
(≈35 líneas de cliente, cero librerías): servidor estático local que espeja Pages bajo
`/pvpc-tracker/`, semilla del registro inyectada con `Page.addScriptToEvaluateOnNewDocument`,
y segunda navegación con el servidor cerrado. El invariante honesto es que el documento esté
**controlado por el SW** (`navigator.serviceWorker.controller`) y que renderice la SPA.

El motor es **Chrome completo** (`.cache/chrome-linux64`, vía `scripts/get-chromium.sh full`, o
`PVPC_CHROME`). Sin él, el seam sale 0 con `SKIP` accionable, como el smoke de geometría.

## Consecuencias

- Dos motores conviven detrás de seams separados: `smoke.sh` (CLI, geometría, headless shell) y
  `offline.sh` (CDP, SW, Chrome completo). Cada invariante elige el motor que puede probarlo.
- El `--dump-dom` del CLI sigue sin servir para nada que dependa de SW; si algún día hace falta
  CDP para geometría, `offline.mjs` ya tiene el cliente.
- El red-check del offline es obligado: neutraizar `respondWith` o la precarga tiene que dar
  FAIL en las aserciones de offline, no en la de load.
- `--host-resolver-rules=MAP apidatos.ree.es ~NOTFOUND`: el test no depende de internet ni del
  API real, y reproduce el modo avión también para la carga de datos.
