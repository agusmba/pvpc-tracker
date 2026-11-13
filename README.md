# PVPC Tracker ⚡

SPA ligera en un solo HTML autocontenido (`docs/index.html`) para consultar los precios oficiales del PVPC publicados por Red Eléctrica Española (REE). Sin dependencias, sin hosting propio: publicada en GitHub Pages, o abriendo el archivo directamente.

## Características
- Precios oficiales hora a hora de la API pública de datos de REE (serie PVPC)
- Funciona sin conexión: abre aunque no haya red (Service Worker) y muestra los días guardados en `localStorage`
- Historial de 7 días + previsión del día siguiente, con gráfica horaria y resumen (mínimo/máximo/media)
- Diseño mobile-first con modo oscuro automático
- Instalable como app (PWA): al añadirla a la pantalla de inicio, el HTML queda en el dispositivo

## Uso
1. Abrir `docs/index.html` en el navegador, o la publicación de GitHub Pages.
2. Pulsa **↻ Actualizar** para descargar los precios del día seleccionado (los de mañana se publican sobre las 20:15–20:30).
3. Después, la app funciona sin conexión con los datos guardados. En el móvil: abre la publicación una vez con red y añádela a la pantalla de inicio; desde entonces abre aunque no haya señal.

## Notas
- Los datos se almacenan en el navegador (`localStorage`, clave `ree_official_pvpc_v1`); borrar los datos del sitio borra el histórico.
- El HTML lo cachea el Service Worker (`docs/sw.js`) con refresco en segundo plano: una publicación nueva llega en la carga siguiente. La API de REE nunca pasa por esa caché.
- El código de la app vive íntegramente en `docs/index.html`; las reglas de trabajo están en `AGENTS.md`.
