// Fixture del registro PVPC para la verificación headless (solo desarrollo).
// Se construye con el propio núcleo: una sola fuente de verdad para la clave de
// almacenamiento y para los días navegables (ADR 0002). Lo usan smoke.mjs (semilla
// inyectada en la copia temporal) y offline.mjs (semilla vía CDP antes del arranque).
import { núcleo } from './nucleo.mjs'

export function fixtureRegistros(logica = núcleo()) {
    const valorMWh = i => 60 + i * 2.6 // €/MWh: franja barata abajo, cara arriba, media en el centro
    const horas = logica.normalizarRegistroPvpc(
        Array.from({ length: 24 }, (_, i) => {
            const hora = String(i).padStart(2, '0')
            return { datetime: `2026-10-23T${hora}:00:00.000Z`, value: valorMWh(i) }
        })
    )
    const registro = {}
    for (const dia of logica.getNavigableDays()) registro[dia] = horas
    return { [logica.STORAGE_KEY]: JSON.stringify(registro) }
}
