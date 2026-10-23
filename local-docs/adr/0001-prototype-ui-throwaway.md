# ADR 0001: Los prototipos UI son código desechable, fuera de `main`

## Contexto

La UI de la SPA (`docs/index.html`) se rediseñó en octubre de 2025 con el skill `prototype`: se generaron variantes de interfaz en `docs/prototype-ui.html` (datos mock en memoria, switcher `?variant=`, fuentes embebidas) para decidir aspecto y layout. Las variantes ganadoras se plegaron en `docs/index.html`; el resto del código del prototipo es descartable.

## Decisión

Los prototipos UI viven en un archivo claramente marcado como desechable y, una vez validada la decisión, su código completo se captura como **fuente primaria** en una **rama desechable** (`prototype/*`, p. ej. `prototype/ui-b3`) y **nunca en `main`**. `main` conserva únicamente el plegado de la decisión validada (paleta, layout, fuentes) en `docs/index.html`.

## Consecuencias

- `main` mantiene la regla de "un solo archivo HTML" sin código muerto ni switchers de prototipo.
- El conjunto completo de variantes queda recuperable vía la rama para iteraciones futuras ("robar" detalles de variantes perdedoras).
- La barra flotante del switcher y los datos mock nunca llegan a la SPA publicada (Pages sirve `docs/` de `main`).
- El veredicto (variante elegida y por qué) se registra cerrando el issue correspondiente, no en el código.
