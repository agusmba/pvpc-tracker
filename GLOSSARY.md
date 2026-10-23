# PVPC Tracker

Tracker offline-first de precios PVPC oficiales de REE: el usuario navega por días y ve cada hora clasificada según su precio dentro del día.

## Language

**Registro PVPC**:
El conjunto de precios horarios oficiales de un día, normalizados a €/kWh.
_Avoid_: historial, caché

**Día navegable**:
Un día que el tracker puede mostrar: mañana más los siete pasados. Días fuera de esta ventana dejan de existir para el registro.
_Avoid_: ventana de días

**Franja de precio**:
Clasificación del precio de una hora según su posición en el rango del día: barata, media o cara.
_Avoid_: categoría, banda

**Núcleo PVPC**:
La lógica pura del registro — fecha de día, días navegables, franja de precio, normalización del payload de REE y decisión de redibujado de la gráfica — sin DOM ni red. Es el bloque que los tests de lógica pueden ejecutar bajo Node (ADR 0002).
_Avoid_: core, kernel
