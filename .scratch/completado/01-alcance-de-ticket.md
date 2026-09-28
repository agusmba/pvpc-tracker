# 🐛 Ticket: Falso-publicar datos de "mañana" antes de su publicación real

## 📝 Descripción del Problema

Cuando la app accede a los precios de **día siguiente (mañana)** mientras aún no han sido publicados oficialmente por REE, muestra:
- Datos que parecen ser **cuatromedias horas** (cada 15 min) en vez de horarios cada hora
- Información que aparenta estar disponible antes de las 20:15-20:30 h

Esto confunde al usuario: ¿mañana ya tiene datos o no? Si los hay, ¿son fiables?

## 🎯 Alcance Esperado

1. **Detectar** si el día "mañana" aún no ha publicado oficialmente
2. **Mostrar estado claro**: "Publicando a partir de las 20:15 - 20:30 h..."
3. **No mostrar datos falsos** o interpolados antes del horario oficial
4. **Manejo correcto del error** cuando se consultan datos no disponibles

### Casos de prueba acordados

#### Caso A: Día después de publicado (EE)
✅ El día "tomorrow" corresponde a hoy EE
→ Se muestran los datos correctamente formateados en 24 horas
→ No hay etiquetas horarias "cuatrimedio hora" extrañas

#### Caso B: Mañana no publicado (todavía)
✅ El tiempo actual es antes de las 20:15 h de día siguiente
→ API responde o sin error o con datos vacíos para mañana
→ UI muestra advertencia visible y clara del estado de publicación
→ No muestra datos interpolados/falsos

#### Caso C: Mañana ya publicado (post-20:30h)
✅ El tiempo actual es después de las 20:30 h de día siguiente
→ API responde con datos válidos y formateados correctamente
→ Los datos ya no son "cuatrimedio hora" si están bien

#### Caso D: Error de API / sin conexión
✅ Cuando la API falla o no hay red
→ Se muestra mensaje adecuado con contexto (offline, error servidor)
→ No miente sobre el estado de los datos

## 🔍 Diagnóstico Previo

Sintomatía reportada:
- Al pulsar "Actualizar" en móvil tras día completo
- Se ve información de mañana que parece de cuatrimedias horas
- Datos publicados antes de su hora real

**Hipótesis**: Error en mapeo del datetime o lógica malinterpretando la respuesta de la API.

## ⚙️ Pasos para Validar (antes de cambiar código)

1. Abrir consola del navegador (F12) → pestaña Network
2. Pulsar botón "Actualizar" cuando ya sea pasado las 20:30 h el día después
3. Inspeccionar respuesta real de `https://apidatos.ree.es/...precios-mercados-tiempo-real`
4. Ver cómo se parsean los datos `item.datetime` actualmente
5. Detectar si la interpretación de formato da cuatrimedio horas o horas completas

## 📋 Lista de verificación post-fix

- [ ] Los datos de 24h formateados correctamente en UI
- [ ] Datos nunca aparecen antes de su publicación oficial
- [ ] Mensajes claros sobre cuándo se publicarán los siguientes precios
- [ ] No hay etiquetas horarias confusas (xx30 o xx45 minutos)
- [ ] Funciona igual offline con datos almacenados

## ⚠️ Riesgos Conocidos

- Posible rotura de localStorage: cambiar STORAGE_KEY a `v2`
- Migrar datos si es necesario: convertir v1 → v2 en caso de formato diferente
- Regresión con días pasados que ya estaban "mal interpretados"

---

*Fechas claves*:
- REE publica mañana a partir de ~~las 20:15~~ las ~~20:30~~ h (confirmar hora exacta)
- Verificar formato datetime exacto devuelto por API REE
