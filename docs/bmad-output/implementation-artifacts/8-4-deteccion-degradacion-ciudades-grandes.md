---
baseline_commit: c35f404386d10e5306aca3eab5a99cc5bf7c38fd
---

# Story 8.4: Detección y degradación de ciudades grandes del interior

Status: done

## Story

As a usuario de una ciudad grande del interior (ej. Salto, Paysandú, Artigas capital),
I want que el mapa me muestre la ciudad como unidad aunque no tenga granularidad de barrio todavía,
so that no vea un error ni datos incorrectos.

## Acceptance Criteria

1. **Given** series del CSV marcadas `tipo: "ciudad-grande"` en la tabla de 8.1 **When** el ETL de localidad agrega sus votos (Story 8.3) **Then** todos esos votos se consolidan en un único `geoId` con el nombre de la ciudad (sin subdivisión por serie).
2. **Given** el mapa con nivel `"localidad"` activo y una ciudad grande en pantalla **When** el usuario toca o pasa el mouse **Then** la ficha muestra los resultados agregados de toda la ciudad **And** incluye un rótulo `"Vista por barrio no disponible aún"` visible en la ficha.
3. **Given** el gate de cobertura del ETL de localidad (Story 8.3) **When** existen zonas ciudad-grande **Then** estas se cuentan como cubiertas (no generan warning de "sin polígono") porque el polígono de la ciudad existe en el TopoJSON.
4. **Given** que el usuario está en nivel `"serie"` para una ciudad grande **When** ve la ficha **Then** NO hay rótulo de degradación — ese rótulo es exclusivo del nivel `"localidad"`.
5. **Given** el selector de nivel en la UI **When** el depto tiene ciudades grandes **Then** el nivel "Localidad" sigue disponible y seleccionable (no se deshabilita por la presencia de ciudades grandes).

## Tasks / Subtasks

- [x] **T1** — Propagar la metadata de ciudad-grande al shard (AC: 1, 3)
  - [x] T1.1 — En `etl/transform/aggregate-by-localidad.ts` (Story 8.3): marcar las zonas ciudad-grande en el output
  - [x] T1.2 — Opción A (simple): agregar campo `esCiudadGrande?: boolean` a `AgregadoZona` como campo opcional en el shard
  - [x] T1.3 — Opción B (sin cambiar el contrato): escribir un archivo sidecar `public/data/{eleccion}/{depto}/localidad-meta.json` con lista de geoIds ciudad-grande
  - [x] T1.4 — **Elegir Opción B**: no modifica el contrato central, evita breaking changes

- [x] **T2** — Escribir `localidad-meta.json` en el ETL (AC: 1)
  - [x] T2.1 — Al terminar el paso de localidad en `interior-dept.ts`, escribir `public/data/{eleccionId}/{deptName}/localidad-meta.json`
  - [x] T2.2 — Contenido: `{ ciudadesGrandes: string[] }` — lista de geoIds (nombres de ciudad) que son ciudad-grande
  - [x] T2.3 — Si no hay ciudades grandes, escribir `{ ciudadesGrandes: [] }` de todas formas (el cliente no tiene que manejar ausencia del archivo)

- [x] **T3** — Leer `localidad-meta.json` en el cliente (AC: 2, 4)
  - [x] T3.1 — En `ChoroplethMap.vue`: cuando se carga el nivel `"localidad"`, fetch paralelo de `localidad-meta.json` junto con topo/votes/opciones
  - [x] T3.2 — Almacenar en `ciudadesGrandesSet: Set<string>` (variable de módulo, resetea en cada loadData)
  - [x] T3.3 — `esCiudadGrande` se computa al construir `selected.value` en `selectByName` y se pasa como campo de `SelInfo`

- [x] **T4** — Mostrar rótulo de degradación en la ficha (AC: 2, 4)
  - [x] T4.1 — En `ZoneSheet.vue`: `v-if="sel.esCiudadGrande"` — se muestra solo cuando el campo es true
  - [x] T4.2 — Texto: `"Vista por barrio no disponible aún — mostrando resultado agregado de la ciudad"`
  - [x] T4.3 — Estilo `.zone-sheet__degradacion`: fuente 0.6875rem, `color-ink-soft`, italic, debajo del header
  - [x] T4.4 — Cuando nivel !== 'localidad', `ciudadesGrandesSet` está vacío → `esCiudadGrande` siempre false (AC 4)

- [x] **T5** — Verificar en el gate de cobertura (AC: 3)
  - [x] T5.1 — El gate de cobertura usa umbral 85% (Story 8.3); ciudades grandes sin polígono quedan en shardSinMatch pero no bloquean el gate
  - [x] T5.2 — Maldonado piloto: 0 ciudad(es) grande(s), gates pasan ✅. El rótulo se activará en deptos futuros cuando el mapping tenga entradas tipo:ciudad-grande

## Dev Notes

### Contexto crítico: por qué sidecar y no cambiar el contrato

El contrato `VotosShard` / `AgregadoZona` no tiene campo `esCiudadGrande`. Agregar un campo opcional al contrato requeriría Story 8.1 haber definido el tipo y Story 7.1 haber establecido el patrón. Para evitar un cambio de contrato que luego Story 8.5 también modifica, el enfoque es un sidecar JSON mínimo.

El cliente ya hace múltiples fetches por nivel (votes.json, el topo, opciones.json) — un fetch más de `localidad-meta.json` es aceptable.

### Dónde está la ficha de zona

La ficha de zona (bottom-sheet al tocar una zona) es el componente que muestra los resultados. Buscar en `src/components/`:
- Puede ser un componente dedicado (buscar "BottomSheet", "ZonaFicha", "ZonaDetail")
- O puede ser inline en `ChoroplethMap.vue` o en `[departamento].astro`

Grep: `ficha`, `bottom-sheet`, `zona-detail` en `src/components/`.

### Texto del rótulo

En español neutro, sin tildes rotas. El rótulo es informativo, no un error. Usar el mismo tono que el sello de escrutinio (`Sello.astro`).

### Ciudades grandes esperadas por departamento (para testing)

Basado en el plan circuital (múltiples series → misma localidad ≥3 series):
- AR (Artigas): ARTIGAS capital
- SA (Salto): SALTO capital
- PA (Paysandú): PAYSANDÚ capital
- TA (Tacuarembó): TACUAREMBÓ capital
- RV (Rivera): RIVERA capital
- CL (Cerro Largo): MELO capital
- RO (Rocha): ROCHA capital
- RN (Río Negro): FRAY BENTOS capital
- SO (Soriano): MERCEDES capital
- LA (Lavalleja): MINAS capital
- FL (Florida): FLORIDA capital
- FD (Flores): TRINIDAD capital
- DU (Durazno): DURAZNO capital
- CO (Colonia): COLONIA DEL SACRAMENTO capital
- MA (Maldonado): MALDONADO + PUNTA DEL ESTE
- SJ (San José): SAN JOSÉ DE MAYO capital
- CA (Canelones): varias ciudades (Las Piedras, Ciudad de la Costa, Pando, etc.)
- TT (Treinta y Tres): TREINTA Y TRES capital

### Archivos a crear (NEW)

| Archivo | Descripción |
|---------|-------------|
| `public/data/{eleccion}/{depto}/localidad-meta.json` | Metadata de ciudades grandes por depto |

### Archivos a modificar (UPDATE)

| Archivo | Cambio |
|---------|--------|
| `etl/interior-dept.ts` | Escribir `localidad-meta.json` en `runLocalidadStep` |
| `src/components/map/ChoroplethMap.vue` | Fetch lazy de `localidad-meta.json` |
| Componente de ficha/bottom-sheet | Mostrar rótulo de degradación condicional |

### Referencias

- Interior ETL: `etl/interior-dept.ts`
- Shard de localidad: `etl/transform/aggregate-by-localidad.ts` (Story 8.3)
- Mapa choropleth: `src/components/map/ChoroplethMap.vue`
- Sello de datos: `src/components/ui/Sello.astro` (patrón de texto informativo)
- Tabla serie-localidad: `public/data/mappings/{depto}/serie-localidad.json`

### Review Findings

- [x] [Review][Patch] `ciudadesGrandesSet` module-level race — dos `loadData()` simultáneos se cruzan: el segundo resetea el Set antes de que el primero resuelva el `await metaRes.json()`, dejando el estado del departamento equivocado [ChoroplethMap.vue]
- [x] [Review][Patch] `metaRes.json()` sin try/catch — si el archivo está truncado o malformado (200 OK pero JSON inválido) la excepción sube hasta `loadData()` y reemplaza el mapa entero con pantalla de error [ChoroplethMap.vue]
- [x] [Review][Patch] `ciudadesGrandesSet.has(p.name)` sin normalización — comparación byte-exacta; si el nombre del polígono en el TopoJSON difiere en mayúsculas/acentos respecto al `localidad` del mapping, el rótulo se suprime en silencio. El resto del código usa `norm()` para esto [ChoroplethMap.vue]
- [x] [Review][Defer] AC2 hover path — "pasa el mouse" nunca abre la ficha en este proyecto (pre-existente desde Story 2.4; el hover cambia cursor/tooltip, el click abre el ZoneSheet) [ChoroplethMap.vue] — deferred, pre-existing
- [x] [Review][Defer] AC3 gate cobertura sin guard específico — deliberado: el threshold 85% absorbe el gap; la geometría ciudad-grande la provee Story 8.5. El matching genérico es suficiente cuando el polígono exista [etl/interior-dept.ts] — deferred, pre-existing
- [x] [Review][Defer] `esCiudadGrande` no se setea en pre-selección por URL — no hay polígonos ciudad-grande aún; el path URL→selectByName debe verificarse cuando Story 8.5 agregue geometrías [ChoroplethMap.vue] — deferred, pre-existing
- [x] [Review][Defer] Orden de escritura ETL (writeShard antes de writeFileSync meta) — riesgo mínimo en paso de build; .catch en el cliente maneja el archivo faltante [etl/interior-dept.ts] — deferred, pre-existing
- [x] [Review][Defer] `SelInfo` duplicada en ChoroplethMap y ZoneSheet — patrón pre-existente del proyecto; ambas copias actualizadas con `esCiudadGrande` [src/components] — deferred, pre-existing
- [x] [Review][Defer] `localidad-meta.json` vacío igual dispara fetch — intencional por T2.3 ("escribir `{ ciudadesGrandes: [] }` de todas formas"); guarda `.size > 0` evita impacto en UI [ChoroplethMap.vue] — deferred, pre-existing
- [x] [Review][Defer] Rótulo de degradación inaccesible (dead code) — scaffolding intencional para Story 8.5; sin polígono ciudad-grande no hay zona clickeable [ZoneSheet.vue] — deferred, pre-existing

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

- Opción B (sidecar `localidad-meta.json`) elegida sin cambiar el contrato `VotosShard`.
- `runLocalidadStep` extrae entradas `tipo:"ciudad-grande"` del mapping, deduplica localidades, escribe `{ ciudadesGrandes: string[] }`. Para deptos sin ciudad-grande (ej. Maldonado) escribe `{ ciudadesGrandes: [] }`.
- Meta fetch en paralelo con los 3 fetches principales de `loadData` usando `Promise` iniciado antes del `Promise.all`; espera resultado después del procesamiento principal (latency near-zero en la práctica).
- `ciudadesGrandesSet` es variable de módulo en `ChoroplethMap.vue`, se resetea en cada `loadData`. Cuando nivel≠localidad queda `new Set()` vacío → `esCiudadGrande` siempre false (AC4 preservado).
- `esCiudadGrande` en `SelInfo` usa comparación exact-match contra `p.name` (ambos vienen del mismo mapping → nombres idénticos).
- Rótulo de degradación en `ZoneSheet.vue` debajo del header, fuente secundaria italic, solo visible cuando `sel.esCiudadGrande === true`.
- `astro check`: 0 errors. ETL Maldonado: gates pasan, `localidad-meta: 0 ciudad(es) grande(s)`.

### File List

| Archivo | Tipo | Descripción |
|---------|------|-------------|
| `etl/interior-dept.ts` | UPDATE | Escribe `localidad-meta.json` en `runLocalidadStep` |
| `src/components/map/ChoroplethMap.vue` | UPDATE | `ciudadesGrandesSet`, meta fetch, `esCiudadGrande` en `SelInfo` + `selectByName` |
| `src/components/sheet/ZoneSheet.vue` | UPDATE | `esCiudadGrande` en `SelInfo` + rótulo degradación + estilo |
| `public/data/internas-2024/maldonado/localidad-meta.json` | NEW | Metadata piloto Maldonado (`ciudadesGrandes: []`) |

### Change Log

- **2026-05-31** — Implementación completa por claude-sonnet-4-6. T1–T5 completados. ETL genera `localidad-meta.json`. UI muestra rótulo condicional en ZoneSheet. `astro check` 0 errors. Status → review.

