# PVPC Tracker ⚡

SPA ligera en un solo archivo HTML (`docs/index.html`) para consultar los precios oficiales del PVPC publicados por Red Eléctrica Española (REE). Sin dependencias, sin hosting: se abre directamente desde el móvil o el escritorio.

## Características
- Precios oficiales hora a hora de la API pública de datos de REE (serie PVPC)
- Historial de 7 días + previsión del día siguiente, con gráfica horaria y resumen (mínimo/máximo/media)
- Funciona offline: guarda el histórico en `localStorage` y actualiza una vez al día
- Diseño mobile-first con modo oscuro automático

## Uso
1. Abrir `docs/index.html` en el navegador.
2. Pulsa **↻ Actualizar** para descargar los precios del día seleccionado (los de mañana se publican sobre las 20:15–20:30).
3. Después, la app funciona offline con los datos guardados.

## Notas
- Los datos se almacenan en el navegador (`localStorage`, clave `ree_official_pvpc_v1`); borrar los datos del sitio borra el histórico.
- El código de la app vive íntegramente en `docs/index.html`; las reglas de trabajo están en `AGENTS.md`.
