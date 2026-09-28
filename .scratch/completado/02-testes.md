# 🧪 Testes para corrector-datos-mañana

## Prueba 1: Validar parseo de datetime en consola antes del fix

**Objetivo**: Ver qué devuelve la API real y cómo lo interpreta el código actual.

**Paso a paso**:
```javascript
// En consola F12, ejecutar después de pulsar "Actualizar":
const data = {included: [...]}; // la respuesta JSON completa
const rawItem = data.included.find(i => i.id === '1001');
console.log("datetime cruda:", rawItem.attributes.datetime);
console.log("valor kWh:", rawItem.attributes.values[rawItem.attributes.values.length-1].datetime);

// Intentar interpretar:
const match = rawItem.attributes.datetime.match(/T(\d{2}):/);
if (match) {
  const hourNum = parseInt(match[1], 10);
  console.log("Hora interpretada:", hourNum);
}
```

**Caso de prueba**: Si `datetime` contiene `"2026-09-28T20"` → debe darnos "20-21", no "2030" o "2045"

## Prueba 2: Simular respuesta API sin datos mañana (antes publicar)

**JSON simulado**:
```json
{
  "data": [],
  "included": [{
    "type": "PVPC",
    "attributes": {
      "values": [
        {"datetime": "2026-09-28T02", "value": 45123},
        {"datetime": "2026-09-28T03", "value": 42345},
        ...
      ]
    }
  }]
}
```

**Comportamiento esperado después fix**:
- UI muestra "Publicando a partir de las 20:15 - 20:30 h..."
- No hay data en tarjetas del día siguiente
- Botón de actualizar sigue disponible
- Estado: "Consultando..." → "No disponible aún"

## Prueba 3: Simular respuesta API con datos mañana disponibles

**JSON simulado**:
```json
{
  "included": [{
    "type": "PVPC",
    "attributes": {
      "values": [
        {"datetime": "2026-09-28T02", "value": 45123},
        ...
        {"datetime": "2026-09-28T23", "value": 52341}
      ]
    }
  }]
}
```

**Comportamiento esperado**:
- Tarjetas del día siguiente se rellenan
- Etiquetas horarias: "02h-03h", "03h-04h"... hasta "22h-23h"
- Sin etiquetas de medias horas (¡ningún xx30 ni xx45!)

## Prueba 4: Validar formateo horario en producción real

**Acción**: Abrir página a las 19:00 h del día después (antes publicar) y observar.

**Comportamiento esperado**:
- Estado: "Datos no publicados aún para mañana"
- Tarjetas de mañana vacías o con mensaje explícito
- Botón actualizar muestra estado real, no datos falsos

## Prueba 5: Validar persistencia offline posterior a publicación

**Acción**:
1. Esperar que REE publique mañana (pasadas las 20:30 h del día después)
2. Abrir página en móvil (sin red)
3. Verificar que la pestaña de "mañana" muestra datos correctos
4. No muestre etiquetas medias horas

## Prueba 6: Migración de almacenamiento v1 → v2

Si el formato de localStorage cambia (STORAGE_KEY), validar:
```javascript
const oldKey = 'ree_official_pvpc_v1';
const newKey = 'ree_official_pvpc_v2';

// En código inicial o migración automática:
try {
  const oldData = JSON.parse(localStorage.getItem(oldKey));
  localStorage.removeItem(oldKey);
  localStorage.setItem(newKey, JSON.stringify(oldData));
  console.log("Migrado v1 → v2");
} catch(e) {}

// Cargar desde newKey en app normal
```

---

*Nota*: Estos tests se ejecutarán después del análisis de Network tab para entender qué devuelve realmente la API. Antes del fix, validar comportamiento asumiendo que:
- `datetime` = `"YYYY-MM-DDTHH" + "MM"` o `"YYYY-MM-DDTHH"`
- El formato real define si hay medias horas o no
