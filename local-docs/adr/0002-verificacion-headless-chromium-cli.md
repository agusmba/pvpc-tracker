# 0002 — Verificación headless de la UI con el CLI de chromium

**Status:** aceptado (2026-10-23)

> Numeración: el ADR 0001 (`prototype-ui-throwaway`) fue retirado (commit 9b597c7) y su convención vive en `AGENTS.md`; este es el 0002 para no reutilizar el número.

## Contexto

La UI de la SPA solo se probaba en navegador humano. En la sesión de rediseño (issue #3) cuatro bugs — escala de los ejes de la gráfica, colores por franja de precio, placeholder invisible de la celda 'Ahora' y desplazamiento del selector de días — solo se detectaron por feedback del usuario. `scripts/check.sh` valida sintaxis, no comportamiento.

Hacía falta una verificación automatizada de geometría y comportamiento que fuera barata en memoria y en tokens, y que no añadiera dependencias a la SPA (regla del repo: un solo archivo HTML servido, cero dependencias).

La distinción que decide el diseño es **lógica pura vs geometría**. La lógica pura se puede ejecutar sin navegador; la geometría no.

## Decision

Dos capas de verificación, ambas **solo de desarrollo**, fuera de la web publicada (`docs/`):

1. **Lógica pura** — el HTML de la SPA delimita un bloque `nucleo` con lógica sin DOM, `localStorage` ni `fetch`. `scripts/nucleo.mjs` lo extrae y lo evalúa en un sandbox vacío de Node; los tests corren con `node --test`. Caza: franja de precio, día navegable, fechas, normalización del payload REE y la decisión de redibujado por ancho.
2. **Geometría** — `scripts/smoke.sh` lanza chromium headless (`--headless --dump-dom --window-size`) contra una **copia temporal** del HTML con un harness inyectado (`scripts/smoke-harness.js`). Las aserciones se computan dentro de la página (`getBoundingClientRect`, `scrollWidth`/`clientWidth`, `elementFromPoint`, `click()`) y se publican como texto; el runner solo imprime líneas `PASS`/`FAIL`/`SKIP` y un exit code agregado.

El motor es el **CLI de chromium**, no una librería de test. El binario se obtiene una vez con `scripts/get-chromium.sh` (chrome-headless-shell de Chrome for Testing, en `.cache/`, fuera del git). Se puede señalar un navegador existente con `PVPC_CHROME`. El repo no añade dependencias: `npm ls` sigue vacío.

Sin navegador disponible, `scripts/smoke.sh` sale 0 con un aviso accionable: el guardrail duro sigue siendo `check.sh` (pre-commit).

## Consecuencias

- **Coste de tokens constante**: la salida del smoke son ~16 líneas, independientemente del motor. Lo caro — navegación interactiva del agente con snapshots/screenshots — queda descartado por decisión, no por omisión.
- **Coste de memoria**: dos lanzamientos de headless shell (~150 MB cada uno, efímeros). Los tests de lógica cuestan ~40 MB y menos de 100 ms.
- **Nada de test viaja a GitHub Pages**: el harness y la semilla del registro solo existen en la copia temporal. El HTML publicado no cambia de forma.
- **El seam es `scripts/smoke.sh`**: un comando, líneas de resultado, exit code. Añadir un invariante es añadir una aserción al harness, no tocar el runner.
- **El fixture se construye con el propio núcleo** (clave de almacenamiento, días navegables, normalización), así que no hay segunda fuente de verdad.

## Límites conocidos del headless shell

- No emula dispositivo puntero: `matchMedia('(hover: hover) and (pointer: fine))` es falso, así que el invariante *barra de scroll visible en escritorio* queda **SKIP** (omite, no falla).
- La barra de scroll clásica encoge el layout en ventana estrecha sin disparar `resize`: el invariante *escala 1:1 de los ejes* admite hasta un 6% de desajuste. El bug real que cazaba esto (medir el contenedor raíz en vez de la tarjeta) desajusta un 30%, así que sigue fallando.
- No hay eventos de input reales: los clicks y el scroll se hacen desde JS dentro de la página, no con `input` del navegador.
- No hay determinismo de versión de navegador fijada (la del binario descargado).

## Revisitar cuando…

…haga falta emulación de móvil/puntero, eventos de input reales, o CI con versión de navegador fijada. Entonces se cambia **solo el motor**, detrás del mismo seam:

- **Playwright** como runner (eventos reales, emulación, determinismo): ~120 MB de navegador más una librería en el repo de desarrollo.
- **CDP directo** con el `WebSocket` global de Node (~60 líneas, sin librería): mismos eventos reales, más código propio que mantener.
- **Firefox ya instalado + geckodriver** (WebDriver sobre `fetch` de Node): cero descarga de navegador, acoplado a la versión de Firefox.

Descartadas y por qué: **jsdom/linkedom** — sin motor de layout no puede medir geometría, y los cuatro bugs son geométricos. **Navegación interactiva del agente** — miles de tokens por paso, no determinista, no ejecutable en pre-commit ni CI.
