# 0003 — Offline del shell con Service Worker y stale-while-revalidate

El enlace guardado en el móvil no abría sin red (issue #5): GitHub Pages sirve el HTML con
`cache-control: max-age=600`, así que el documento es stale a los 10 minutos y el navegador lo
revalida en la red — sin red, pantalla de error. El registro PVPC en localStorage solo sirve si
el documento ya cargó. Decidimos cachear el **shell** con un Service Worker (`docs/sw.js`) y
publicar la página como PWA (`manifest.webmanifest`), con estrategia *stale-while-revalidate*:
la caché responde al instante y la red la refresca en segundo plano, de modo que una publicación
en `main` llega al móvil en la carga siguiente **sin subir versiones del caché** ni hacer esperar
al usuario.

## La API de REE queda fuera de la caché

Decidido explícitamente: el SW pasa las peticiones de `apidatos.ree.es` directas a la red.
Cachear el JSON de precios convertiría un dato viejo en una respuesta aparentemente fresca y
mentiría el estado del día; el **offline de datos** ya es asunto del **registro PVPC**
(localStorage), que además sabe qué día es cada uno. El **offline del shell** y el **offline de
datos** son dos conceptos distintos y cada uno tiene su dueño (ver `GLOSSARY.md`).

## Dos trampas que el refresco tiene que sortear

- **El refresco manda `cache: 'reload'`.** Pages responde el HTML con `max-age=600`, así que un
  `fetch(req)` del refresco puede resolver contra la caché HTTP del navegador y devolver el
  documento viejo: re-cacheamos lo stale y una publicación no llega "en la carga siguiente".
  Con `reload` el fetch salta la caché HTTP y la publicación llega de verdad.
- **Un marcador guardado sin barra final (`/pvpc-tracker`) es la misma carpeta del scope.** Con
  red Pages redirige con 301; sin red no hay redirección y el scope `/pvpc-tracker/` no controla
  `/pvpc-tracker`. El SW normaliza esa ruta a la carpeta, y la clave de caché la comparte con
  `/pvpc-tracker/index.html`, así que el shell responde sin depender del 301.

## Consecuencias no obvias

- El HTML publicado lleva 5 líneas de registro del SW; sigue siendo cero dependencias y sigue
  funcionando en `file://` (el navegador no registra SW fuera de contexto seguro, y la SPA no
  depende del SW para nada).
- Publicar cambios de UI no exige bump de `CACHE_SHELL`. Se sube solo si cambia la **precarga**
  o la lógica del propio SW, porque `activate` borra los cachés con otro nombre.
- iOS Safari cachea el SW solo en la página añadida a la pantalla de inicio y expulsa el caché
  si la app no se usa en días; Android puede expulsar el almacenamiento bajo presión de disco.
  El registro local se regenera en la primera carga con red.
