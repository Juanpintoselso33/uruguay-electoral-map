---
baseline_commit: db3901a3ffa694e3debaa722e73c71e802b18da6
---

# Story 1.5: ETL — geometría a TopoJSON + lazy-load por nivel

Status: done

## Story

As a desarrollador,
I want la geometría optimizada como TopoJSON (simplificada, con gate de tamaño) y organizada por nivel para carga perezosa,
so that el mapa cargue rápido en mobile dentro del budget (NFR1: la geometría es el cuello de botella, no los votos).

## Acceptance Criteria

1. **Given** el GeoJSON `public/montevideo_map.json` (barrios, 251 KB) **When** corro el paso de geometría **Then** se convierte a **TopoJSON** simplificado y se emite como artefacto del nivel zona/barrio.
2. **Given** el artefacto de geometría **When** mido su tamaño **Then** un **gate de tamaño** falla el build si el artefacto eager supera el budget (objetivo ≤500 KB; idealmente mucho menos tras TopoJSON+simplify).
3. **Given** la organización de artefactos **When** reviso la estructura **Then** la geometría queda separada por nivel (boundary depto eager; serie/circuito como artefactos lazy aparte), de modo que el cliente pueda cargar solo lo que necesita (el loader cliente es de Story 1.8; acá se produce la estructura).
4. **Given** la estrategia de almacenamiento **When** reviso `.gitattributes` **Then** Git LFS queda acotado a la **geometría grande**, y los **shards de votos chicos vuelven a texto** (se corrige el overkill detectado en 1.4).
5. **Given** el TopoJSON emitido **When** lo decodifico con `topojson-client` **Then** reconstruye los polígonos de barrios correctamente (sin pérdida topológica que rompa el mapa).

## Tasks / Subtasks

- [x] **Task 1: Conversión GeoJSON → TopoJSON simplificado (AC: 1, 5)**
  - [x] Agregar deps de geometría: `topojson-server` (topology) + `topojson-simplify` (presimplify/simplify). _[Deps legítimas del ETL geométrico, AR5. Documentar.]_ `topojson-client` ya está.
  - [x] `etl/geometry/build-topojson.ts`: GeoJSON → `topology()` → `presimplify` → `simplify` (con un umbral que preserve la forma) → emitir TopoJSON. Reproyectar/quantizar si ayuda al tamaño.
  - [x] Verificar round-trip: decodificar con `topojson-client` (`feature`) reconstruye los 63 barrios.
- [x] **Task 2: Gate de tamaño (AC: 2)**
  - [x] `etl/gates/geometry-size.ts`: falla (exit≠0) si el artefacto eager supera el budget. Reportar tamaño crudo y gz.
- [x] **Task 3: Organización por nivel + emisión (AC: 3)**
  - [x] Emitir el boundary de barrios como artefacto eager (ej. `public/data/internas-2024/montevideo/geo.topo.json` o ruta de geometría compartida por depto — ver Dev Notes; geometría no depende de la elección, podría vivir en `public/data/geo/montevideo/zona.topo.json`).
  - [x] Dejar el lugar para serie/circuito (lazy, Fase 2 para circuito). No hace falta generarlos todos ahora; sí dejar la convención.
- [x] **Task 4: Estrategia LFS (AC: 4)**
  - [x] Refinar `.gitattributes`: LFS solo para geometría grande (GeoJSON fuente `*_map.json`/`*_series_map.json`/`*_series_electorales*.json` y, si es grande, `*.topo.json`); **shards de votos (`public/data/**/votes.json`) como TEXTO**.
  - [x] Re-normalizar (`git add --renormalize`) los shards afectados para que dejen de ser punteros LFS. Verificar `git check-attr`.
- [x] **Task 5: Verificación (AC: 1-5)**
  - [x] `astro check` 0 errores · ETL de geometría ejecutado · gate de tamaño PASA · round-trip OK · `votes.json` ya NO es LFS, geometría grande SÍ.

## Dev Notes

### Por qué (architecture.md §Data Architecture, Measurement Findings)
La medición mostró que **la geometría es el cuello de botella**, no los votos (votos ~6-59KB gz; `_series_map.json` hasta 1MB gz en TyT). TopoJSON reduce 40-80% (bordes compartidos una vez) + mapshaper/simplify recorta más. Para Montevideo barrios (251KB GeoJSON) el TopoJSON simplificado debería quedar bien por debajo del budget.

### Decisión LFS (corrige 1.4)
- 1.1 puso `public/**/*.json` + `data/**/*.json` en LFS (para no romper config). Pero eso mandó el shard chico `votes.json` (45KB) a LFS → overkill + riesgo deploy.
- **Acotar:** LFS solo geometría grande; vote shards como texto. Cuidado de NO volver a romper package.json/tsconfig (siguen fuera de LFS). Verificar con `git check-attr` que: `votes.json`=text, `montevideo_map.json`=lfs, `package.json`=unspecified.

### Artefactos y rutas
- Geometría NO depende de la elección (los barrios son los mismos) → conviene `public/data/geo/{departamento}/{nivel}.topo.json` (compartida entre elecciones), separada de los `votes.json` (que sí son por elección). Confirmar/ajustar el `Manifest` (contrato 1.2 tiene `ShardRefs.geometria` por nivel) — alinear las rutas con el manifest cuando se genere (Story posterior o acá si es directo).
- El **loader cliente** (lazy fetch por nivel) es de Story 1.8 (mapa). Acá solo se PRODUCEN los artefactos y se deja la convención de rutas.

### Aprendizajes 1.1-1.4
- TS strict + `import type`. `@types/node` instalado. Ejecutar ETL vía esbuild+node.
- 🚧 Gotcha LFS (no volver a poner config en LFS). El GeoJSON fuente ya está en LFS (OK, es grande).
- Sin tocar runtime/UI de Astro.

### Testing
- `astro check` 0 + ejecución del ETL geométrico: TopoJSON emitido, gate de tamaño PASA, round-trip con `topojson-client` reconstruye los 63 barrios, y verificación de `.gitattributes` (check-attr).

### References
- [epics.md#Story 1.5] · [architecture.md#Data Architecture + Measurement Findings] (geometría = bottleneck, TopoJSON/simplify/PMTiles) · [1-4] (decisión LFS pendiente) · [1-2 contract] (`ShardRefs.geometria`).

## Dev Agent Record

### Agent Model Used
(pendiente)

### Debug Log References

### Completion Notes List

### File List

### Change Log

## Dev Agent Record (resultado)
**Agent:** Amelia — claude-opus-4-8[1m]
- GeoJSON 251 KB → TopoJSON **71.7 KB raw / 17.4 KB gz** (−93%). Gate ≤500KB gz PASA. Round-trip `topojson-client`: 63/63 barrios ✅. `astro check` 0 / build verde.
- Deps: `topojson-server` + `topojson-simplify` (+ @types). Casts a `Parameters<typeof fn>[0]` por variancia over-strict de genéricos topojson.
- **LFS corregido:** `.gitattributes` ahora LFS solo geometría FUENTE grande (`*_map.json`, `*_series_map.json`, etc.); `votes.json` y `zona.topo.json` = TEXTO (renormalizados). package.json/tsconfig = texto. Verificado con `git check-attr`.
- Artefacto geometría en `public/data/geo/montevideo/zona.topo.json` (compartido entre elecciones, separado de votos). serie/circuito = lazy/Fase 2 (convención dejada).

## Senior Developer Review (AI)
**2026-05-30 · inline · APPROVED.** Sin findings bloqueantes. Reducción de payload validada con números reales (17.4KB gz). LFS overkill de 1.4 corregido. Casts de genéricos topojson son pragmáticos y honestos (tipos over-strict de la lib). AC1-5 ✅. Status → done.

### File List
**Nuevos:** `etl/geometry/build-topojson.ts` · `etl/gates/geometry-size.ts` · `etl/run-geometry-montevideo.ts` · `public/data/geo/montevideo/zona.topo.json`
**Modificados:** `.gitattributes` (LFS acotado) · `package.json` (topojson deps) · `public/data/internas-2024/montevideo/votes.json` (LFS→texto)
