# Ticket 01 — Publicar la página en GitHub Pages (solo lo necesario)

Estado: `[COMPLETADO]` (2026-10-12)

## Descripción

Publicar el PVPC Tracker en internet de forma gratuita usando GitHub Pages,
sirviendo **únicamente** un subdirectorio con lo imprescindible, sin exponer
el resto del repositorio como sitio web.

Alcance validado:
- Subdirectorio `docs/` que contiene únicamente `index.html` (GitHub solo
  permite como fuente sin CI la raíz o `/docs`; con `pages/` haría falta CI).
- `luz.html` se **mueve** a `docs/index.html` (no copia): el archivo principal
  de la app vive desde ahora en `docs/index.html`, única fuente de verdad.
- Repo público (lo exige el tier gratuito de GitHub Pages).
- Sin CI por ahora: no hay build que hacer y, al mover el fichero, tampoco hay
  copia que sincronizar.
- Configurar GitHub Pages para desplegar desde ese subdirectorio (Settings →
  Pages → Deploy from a branch → rama `main`, carpeta `/docs`): el contenido
  del subdirectorio se sirve como raíz del sitio, sin prefijo en la URL.

## Casos de uso afectados

1. Acceso desde el móvil u otro dispositivo sin abrir archivo local: la URL de
   Pages carga la app y consulta REE directamente desde el navegador (CORS
   verificado: `access-control-allow-origin: *`).
2. Solo se sirve en el sitio web lo que haya dentro de `docs/`; el resto del
   repo (`AGENTS.md`, `README.md`, `.scratch/`) no aparece en la URL.
3. Navegación normal de la app (tabs de días, gráfico, resumen, modo offline con
   datos ya descargados) idéntica a la versión local.

## Esperanza de resultado

- URL pública estable `https://<usuario>.github.io/<repo>/` sirviendo la app.
- HTTPS automático, sin build ni servidor propio.
- El repo mantiene su estructura actual; `docs/` es el único contenido
  publicado y contiene directamente el archivo principal de la app.

## Pasos de prueba

1. Con el repo pushado y Pages activado (rama `main`, carpeta `/docs`):
   - [x] `https://agusmba.github.io/pvpc-tracker/` responde 200 y muestra la app
         (HTML servido idéntico byte a byte a `docs/index.html`).
   - [x] Botón "Actualizar" carga datos de REE en el navegador, sin errores CORS en consola.
   - [x] Al recargar, los días con datos guardados se muestran (localStorage por origen https).
   - [x] `https://agusmba.github.io/pvpc-tracker/luz.html` → 404 (también `/AGENTS.md` → 404:
         solo se sirve el contenido de `docs/`).
   - [x] En móvil: layout correcto y los datos ya descargados siguen visibles sin red.
2. Primer uso en un dispositivo nuevo: sin datos locales, muestra "Cargando
   precios..." y rellena con REE al pulsar "Actualizar".

## Validación post-implementación

- 2026-10-12 — Lado servidor (verificado con curl):
  - `GET /` → 200, HTML servido idéntico a `docs/index.html`.
  - `GET /luz.html` → 404, `GET /AGENTS.md` → 404: solo se sirve `docs/`.
- 2026-10-12 — Navegador real (confirmado por el usuario): fetch REE sin
  errores CORS, localStorage por origen https y móvil OK. Ticket cerrado.

## Riesgos conocidos

1. **Cambio de flujo local**: la app se edita ahora directamente en
   `docs/index.html` (ya no existe `luz.html` en la raíz). Sin riesgo de
   desincronización al ser un único fichero. Mejora futura (fuera de este
   ticket): CI con GitHub Actions (`actions/deploy-pages`) si más adelante se
   quiere publicación automatizada o build.
2. **Cambio de origen**: los datos guardados abriendo el archivo local
   (`file://`) no migran a la URL de Pages; el primer uso en la web requiere un
   "Actualizar".
3. **Visibilidad del repo**: si el repo es público, todo su contenido sigue
   siendo visible en GitHub (Pages solo controla qué se sirve en la URL del
   sitio). Si se quiere ocultar el resto, opción: repo privado (GitHub Pages
   funciona también con repos privados en el plan gratuito).

## Decisiones tomadas (validadas)

- [x] Nombre del subdirectorio: `docs/` (cambiado de `pages/`: GitHub solo
      permite la raíz o `/docs` como fuente sin CI).
- [x] Repo público (necesario para el tier gratuito).
- [x] Sin CI; en lugar de copiar, **mover** `luz.html` a `docs/index.html`.
