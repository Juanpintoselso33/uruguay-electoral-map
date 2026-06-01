# Story 6.1 — Exportar datos de la vista actual como CSV

**Status:** Done
**Épica:** 6 — Fase 2 — Exportar, Circuito, HOJA
**FR:** FR23

---

## User Story

Como analista, quiero descargar los datos que veo en la vista actual como un CSV, para poder trabajarlos en mi herramienta de análisis favorita.

## Acceptance Criteria

- [x] Botón "Descargar CSV" visible en la vista de departamento
- [x] Si hay una opción activa, exporta solo esa opción; si no, todas las opciones
- [x] CSV con columnas: zona, opcion_id, nombre, sigla, votos, pct_validos, validos, en_blanco, anulados, observados, es_ganador
- [x] Nombre del archivo: `{departamento}_{eleccion}_{nivel}.csv`
- [x] Encoding UTF-8 con BOM (compatible Excel)
- [x] Formato largo (tidy): una fila por zona × opción

## Implementación

### Componente: `src/components/share/ExportButton.vue`

Isla `client:idle`. Lee `votes.json` + `opciones.json` del departamento activo.
Construye el CSV en memoria y lo descarga via `URL.createObjectURL`.

**Comportamiento con selección activa:** si `$selection.opcion` está seteado, filtra las filas al opcionId activo. Sin selección, exporta todas las opciones.

**BOM (`﻿`):** prepend `'﻿'` al CSV para que Excel lo abra sin configurar codificación.

### Integración en página

Montado en `src/pages/[eleccion]/[departamento].astro` dentro del panel de controles, junto a `ShareButton` y `MapScreenshotButton`.

## Archivos creados/modificados

- `src/components/share/ExportButton.vue` — componente nuevo
- `src/pages/[eleccion]/[departamento].astro` — instancia el botón
