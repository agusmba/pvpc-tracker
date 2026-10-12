# 🤖 Agentes - PVPC Tracker (pages/index.html)

## 🎯 Objetivo

Evolucionar una SPA ligera y autocontenida en un solo archivo HTML que:
- Obtiene precios PVPC oficiales de REE
- Funciona offline con localStorage
- Muestra historial de 7 días
- Funciona desde móvil sin hosting

## 📋 Flujo de Trabajo

### 1. Identificar mejora o bug
El usuario describe una mejora deseada, un error visual, o un límite funcional detectado.

### 2. Crear ticket en `.scratch/`
Crear directorio de feature y documento de alcance:
```bash
mkdir -p .scratch/<feature>
vi .scratch/<feature>/01-alcance-de-ticket.md
```

Estructura del ticket:
- Descripción clara del problema/mejora
- Casos de uso afectados
- Esperanza de resultado
- Pasos de prueba
- Riesgos conocidos

### 3. Validar alcance
Revisar el ticket juntos y acordar los límites. Aclarar dudas antes de implementar.

### 4. Implementar por sesiones
En cada sesión:
1. Leer el ticket actual
2. Preparar estructura de código
3. Realizar cambios (sin romper SPA existente)
4. Escribir tests/cases de uso
5. Verificar en navegador
6. Marcar como `[COMPLETADO]` en el ticket
7. Limpiar directorio `.scratch/<feature>/`

### 5. Migrar al archivo principal
Al finalizar feature:
- Mover código a `pages/index.html`
- Actualizar almacenamiento con versión nueva
- Verificar regresiones

## 🛠️ Reglas de Implementación

1. **Mantener autocontenido**: Todo en un archivo HTML hasta acuerdos contrarios
2. **No romper lo existente**: Los cambios son progresivos, no reescribir todo
3. **Código limpio**: Comentarios en español, sin dependencias externas
4. **Pruebas prácticas**: Probar en móvil, modo offline, datos incompletos
5. **Versionado de almacenamiento**: Usar sufijos como `v1`, `v2` en STORAGE_KEY

## 📦 Estructura de Tickets

```
.scratch/
├── <feature>/.gitkeep           # Feature activa (en progreso)
│   ├── 01-alcance-de-ticket.md  # Definición inicial, con casos de prueba y validación
│   └── 02-otro-ticket.md        # Otro ticket, con su definición, pruebas y validación
├── <feature-completado>/         # Archive features terminadas (opcional)
└── cleanup.log                   # Registra qué tickets se han cerrado
```

## 🐛 Bugs Reportados

*(Se añade al encontrar errores)*

## ✨ Mejoras Pendientes

*(Próximos tickets a planificar)*
