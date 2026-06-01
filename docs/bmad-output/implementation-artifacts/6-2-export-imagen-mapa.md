# Story 6.2 — Exportar imagen del mapa

**Status:** Done
**Épica:** 6 — Fase 2 — Exportar, Circuito, HOJA
**FR:** FR24

---

## User Story

Como periodista o analista, quiero exportar el mapa actual como imagen PNG, para poder incluirlo en notas o presentaciones.

## Acceptance Criteria

- [x] Botón "Guardar mapa" visible en la vista de departamento
- [x] Descarga PNG del mapa con header que incluye departamento + elección
- [x] Nombre del archivo: `{departamento}_{eleccion}_mapa.png`
- [x] Watermark discreto "uruguay-electoral-map" en esquina inferior derecha
- [x] `preserveDrawingBuffer: true` en el init de MapLibre para permitir `canvas.toDataURL()`

## Implementación

### Componente: `src/components/share/MapScreenshotButton.vue`

Isla `client:idle`. Captura el canvas de MapLibre (`#map-persist canvas`) via `toDataURL('image/png')`.

**Composición del PNG:**
1. Canvas de salida = ancho del mapa + header del 7% del alto
2. Header blanco con título (dept) en bold y subtítulo (elección) en gris
3. Borde inferior del header (#e5e7eb, 1px)
4. Mapa pegado debajo del header
5. Watermark en `rgba(107,114,128,0.7)` en esquina inferior derecha

**Prerequisito en ChoroplethMap.vue:**
```ts
preserveDrawingBuffer: true, // permite canvas.toDataURL() para export PNG (Story 6.2)
```
Esta opción tiene costo mínimo de GPU pero es requerida para la captura.

### Integración en página

Montado en `src/pages/[eleccion]/[departamento].astro` recibiendo props `deptLabel` y `eleccionLabel` para el header del PNG.

## Archivos creados/modificados

- `src/components/share/MapScreenshotButton.vue` — componente nuevo
- `src/components/map/ChoroplethMap.vue` — agregado `preserveDrawingBuffer: true`
- `src/pages/[eleccion]/[departamento].astro` — instancia el botón con props de label
