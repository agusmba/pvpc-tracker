# PVPC Tracker

SPA autocontenida en `docs/index.html`: precios PVPC oficiales de REE, offline con localStorage, historial semanal, mobile-first. Sin dependencias externas.

## Flujo por feature
1. Ticket en `.scratch/<feature>/NN-nombre.md` (problema, casos de uso, resultado esperado, pruebas, riesgos). Validar el alcance antes de implementar.
2. Implementar sin romper lo existente; probar en navegador (móvil, offline, datos incompletos).
3. Al terminar: marcar `[COMPLETADO]` en el ticket, migrar código a `docs/index.html`, subir versión del STORAGE_KEY (`v1`, `v2`…) si hiciera falta, verificar regresiones, mover la carpeta a `.scratch/completado/` y registrar en `cleanup.log`.

## Reglas
- Todo en un solo archivo HTML; comentarios en español.
- Cambios progresivos, no reescrituras.
