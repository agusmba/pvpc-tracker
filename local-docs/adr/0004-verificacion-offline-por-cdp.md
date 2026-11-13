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

Además, tres trampas que dan **verde falso**:

- La caché HTTP del navegador guarda el documento y puede servirlo sin red **sin** Service
  Worker. En el lanzamiento offline hay que desactivarla (`Network.setCacheDisabled`) para que el
  único candidato sea la caché del SW.
- La página de error del navegador también dispara `load` y su título es el host. Un invariante
  escrito sobre "hubo load event" pasa con el SW roto.
- Un navegador con el que todo lo anterior pasa pero que **nunca reinicia el perfil** prueba la
  caché en memoria, no la que sobrevive a apagar el móvil.

## Decision

`scripts/offline.mjs` habla con el navegador por **CDP con el `WebSocket` global de Node**
(cero librerías). Dos lanzamientos con el **mismo perfil**, como el móvil real entre usos:

- **Lanzamiento A (con el espejo arriba, caché HTTP activa).** El espejo sirve la publicación
  bajo `/pvpc-tracker/` con las cabeceras de Pages (`max-age=600`) y deja un recurso en **otro
  origen** (`localhost` vs `127.0.0.1`): si el SW cacheara cross-origin — la API de REE entre
  ellas — el aserto correspondiente se pone rojo. Con la caché HTTP activa, la aserción de la
  publicación también castiga el refresco que no manda `cache: 'reload'`. El registro se siembra
  en `localStorage` con `Runtime.evaluate`.
- **Lanzamiento B (servidor caído, modo avión por `Network.emulateNetworkConditions`, caché HTTP
  desactivada).** Mismo perfil, navegador nuevo: prueba que el caché del SW **persiste en disco**
  y que `navigator.onLine` es `false`, que es lo que decide el estado `sin conexión` de la SPA.

El invariante honesto es que el documento esté **controlado por el SW**
(`navigator.serviceWorker.controller`) y que renderice el registro local.

El motor es **Chrome completo** (`.cache/chrome-linux64`, vía `scripts/get-chromium.sh full`, o
`PVPC_CHROME`). Sin él, el seam sale 0 con `SKIP` accionable, como el smoke de geometría.

## Consecuencias

- Dos motores conviven detrás de seams separados: `smoke.sh` (CLI, geometría, headless shell) y
  `offline.sh` (CDP, SW, Chrome completo). Cada invariante elige el motor que puede probarlo.
- El `--dump-dom` del CLI sigue sin servir para nada que dependa de SW; si algún día hace falta
  CDP para geometría, `offline.mjs` ya tiene el cliente.
- El red-check del offline es obligado: neutraizar `respondWith` o la precarga, o quitar
  `cache: 'reload'` del refresco, tiene que dar FAIL en las aserciones de offline, no en la de
  load. Sin el `respondWith` la navegación al puerto cerrado no tiene quién le responda, así que
  `Page.navigate` y `Runtime.evaluate` se acotan con reloj: un fallo tiene que salir como `FAIL`,
  nunca como un harness colgado hasta el `timeout`.
- `--host-resolver-rules=MAP apidatos.ree.es ~NOTFOUND`: el test no depende de internet ni del
  API real; el modo avión lo pone `Network.emulateNetworkConditions`, no el bloqueo de DNS.
