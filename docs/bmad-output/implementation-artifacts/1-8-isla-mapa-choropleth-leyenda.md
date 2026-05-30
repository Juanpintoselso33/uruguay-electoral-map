---
baseline_commit: 58d33203aefb3ec02238cafc3d3f41abbd6d8e7e
---

# Story 1.8: Isla mapa choropleth + leyenda (mobile)

Status: done

## Story

As a ciudadano,
I want ver el mapa de mi departamento coloreado por ganador en el celular,
so that entienda "quién ganó acá" sin tocar nada.

## Acceptance Criteria

1. **Given** la vista de Montevideo internas-2024 **When** abro la página en mobile **Then** una isla MapLibre `client:load` pinta las zonas por partido ganador con nombres humanos.
2. **Given** una zona **Then** muestra la **sigla del partido como texto** (nunca solo color).
3. **Given** la leyenda **Then** nombra cada color, su sigla y qué representa.
4. **Given** un tap en una zona **Then** resalta y muestra el ganador (ficha completa = Epic 2); el estado de selección va a la URL.

## Tasks / Subtasks

- [x] **Task 1: Catálogo de opciones (dato para sigla/leyenda) (AC: 1, 3)**
  - [x] ETL emite `public/data/internas-2024/montevideo/opciones.json` (`opcionId→nombre`). `aggregate-by-circuito.ts` ahora recolecta el catálogo.
  - [x] `src/lib/party-meta.ts`: `resolveParty(nombre)→{sigla,color}` (sigla canónica FA/PN/PC/CA/… + acrónimo fallback; color de `party-colors.ts`).
- [x] **Task 2: Isla mapa (AC: 1, 2, 4)**
  - [x] `src/components/map/ChoroplethMap.vue` `client:load`. Carga geometría TopoJSON + votos + opciones; join por `geoId` normalizado; pinta `fill` por color del ganador.
  - [x] Siglas como **markers HTML en centroides** (el `text-field` de MapLibre exige glyphs/fuentes que no tenemos). maplibre-gl con **import dinámico** (SSR-safe).
  - [x] Tap → realce (`zonas-sel` line layer) + readout del ganador + `commit({zona})` a la URL (nanostores). Deep-link/recarga reconstruye la selección.
- [x] **Task 3: Leyenda (AC: 3)**
  - [x] `src/components/map/MapLegend.vue`: swatch + **sigla + nombre** por opción presente (ordenado por votos desc) + "N barrios sin datos".
- [x] **Task 4: Página + verificación (AC: 1-4)**
  - [x] `src/pages/[eleccion]/[departamento].astro` con `getStaticPaths` (internas-2024/montevideo).
  - [x] `astro check` 0 · `npm run build` verde · verificación en navegador real (Playwright).

## Dev Notes

### Decisiones
- **Sin basemap / sin API key:** style MapLibre en blanco (`{version:8,sources:{},layers:[]}`, **sin** `glyphs`) — solo polígonos choropleth. (Gotcha: `glyphs:undefined` rompe el validador; omitir la clave.)
- **Siglas = markers HTML**, no symbol layer (evita dependencia de servidor de glyphs; texto real y accesible).
- **SSR-safe:** maplibre-gl import dinámico en `onMounted`; el resto guardado. El build SSRea el shell de la isla sin tocar window.
- **Estado:** selección vive en la URL vía `map-state` (Story 1.7). `client:load` (NO `client:only`, patrón spike R7).
- **Datos:** geometría de `v_sig_barrios` (1.6, limpia); votos por barrio (1.6). 14 barrios sin datos (incompletitud mapping CRV→barrio) se muestran en gris + contados en la leyenda (honesto).

### Verificación en navegador (Playwright, datos reales)
- Canvas renderizado; **48 markers de sigla** (= 48 barrios con datos); leyenda 19 entradas con sigla+nombre.
- Distribución de ganadores: **FA 47, PN 1** (Montevideo internas-2024, realista: FA dominante, Carrasco/Punta Gorda PN).
- Tap en el mapa → URL `?zona=Conciliación`, realce + readout "ganó FA (Frente Amplio) · 6.287 votos válidos".
- Screenshot confirmó choropleth + siglas + realce + leyenda + "14 barrios sin datos".

### References
- [epics.md#Story 1.8] · [architecture.md#Estado/Mapa persistente] · [1-6] (geometría+votos por barrio) · [1-7] (url-state) · [party-colors.ts].

## Dev Agent Record

### Agent Model Used
Amelia — claude-opus-4-8[1m]

### Debug Log References
- Bug encontrado y corregido en verificación: `glyphs: undefined` en el style rompía el `load` de MapLibre ("glyphs: string expected, undefined found") → omitir la clave. Tras el fix: 48 siglas, mapa listo.

### Completion Notes List
- Isla MapLibre choropleth funcional verificada en navegador real con datos reales. AC1-4 ✅.
- ETL extendido para emitir `opciones.json` (opcionId→nombre); `party-meta.ts` resuelve sigla+color.

### Senior Developer Review (AI)
**2026-05-30 · inline · APPROVED.** AC1 (choropleth client:load por ganador) ✅, AC2 (sigla como texto) ✅, AC3 (leyenda color+sigla+nombre) ✅, AC4 (tap → realce+readout+URL) ✅ — todo verificado en navegador (Playwright), no solo compilación. Sin findings bloqueantes. Nota: la ficha completa de zona es Epic 2 (acá solo readout mínimo, por diseño).

### File List
**Nuevos:** `src/components/map/ChoroplethMap.vue` · `src/components/map/MapLegend.vue` · `src/lib/party-meta.ts` · `src/pages/[eleccion]/[departamento].astro` · `public/data/internas-2024/montevideo/opciones.json`
**Modificados:** `etl/transform/aggregate-by-circuito.ts` (catálogo opciones) · `etl/run-montevideo.ts` (emite opciones.json) · `.gitignore` (.playwright-mcp/_preview.log/_*.cjs)

### Change Log
- Isla mapa choropleth MapLibre (client:load) coloreada por ganador, siglas como markers HTML, leyenda, tap→URL. ETL emite catálogo de opciones.
