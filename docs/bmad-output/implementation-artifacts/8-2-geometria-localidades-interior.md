---
baseline_commit: c35f404386d10e5306aca3eab5a99cc5bf7c38fd
---

# Story 8.2: Geometría de localidades del interior (IDE Uruguay)

Status: done

## Story

As a desarrollador,
I want polígonos de las localidades del interior disponibles como TopoJSON,
so that el mapa pueda colorear por localidad en lugar de mostrar series abstractas.

## Acceptance Criteria

1. **Given** la capa de localidades de IDE Uruguay (GeoJSON de localidades pobladas) **When** proceso cada departamento del interior **Then** existe `public/data/geo/{depto}/localidad.topo.json` con los polígonos del departamento **And** cada feature tiene propiedad `name` con el nombre de la localidad (coincidente con los valores en la tabla de 8.1).
2. **Given** el TopoJSON generado **When** lo valido con `assertGeometryBudget` **Then** pesa ≤500 KB gzip por departamento; si excede, se aplica `simplifyQuantile` menor hasta cumplir.
3. **Given** el TopoJSON de un departamento **When** lo comparo con la tabla `serie-localidad.json` de 8.1 **Then** ≥90% de las localidades `tipo:"1:1"` tienen un polígono correspondiente (coincidencia de nombre normalizado).
4. **Given** que las ciudades-grande de 8.1 son varias series → una localidad **When** proceso la geometría **Then** esa localidad aparece como un único polígono (ya lo es en la fuente de IDE Uruguay).
5. **Given** que en la fuente de IDE Uruguay la propiedad del nombre puede variar (`nombre`, `NOMBRE`, `localidad`, `LOCALIDAD`) **When** proceso **Then** el script detecta automáticamente cuál es y la normaliza a `name` en el output.

## Tasks / Subtasks

- [x] **T1** — Identificar y documentar la fuente de geometría de localidades (AC: 1)
  - [x] T1.1 — Verificar si existe GeoJSON de localidades en `data/raw/geographic/` o `public/`
  - [x] T1.2 — Capa IDE Uruguay NO existe; se usa enfoque derivado: `data/raw/geographic/{depto}_series_map.json` ya tiene polígonos por serie. Uniendo series por localidad (via mapping 8.1) se obtiene la geometría sin descarga adicional. 18/18 deptos verificados con 100% match de series.
  - [x] T1.3 — Approach documentado: series polygon union > IDE Uruguay download (más consistente con electoral boundaries)

- [x] **T2** — Crear `etl/build-localidad-topojson.ts` (AC: 1, 2, 3, 5)
  - [x] T2.1 — Leer series geometry `data/raw/geographic/{depto}_series_map.json` (approach derivado de T1)
  - [x] T2.2 — Detectar automáticamente la propiedad de nombre de serie (`serie`/`SERIE`/etc.)
  - [x] T2.3 — Normalizar a `name` en output (uso display name de serie-localidad.json)
  - [x] T2.4 — Para cada depto: agrupar series por localidad → union polígonos → `topojsonFromFC` → `assertGeometryBudget`
  - [x] T2.5 — Si excede budget, reducir `simplifyQuantile` en pasos: 0.15 → 0.10 → 0.05 → 0.02 hasta cumplir
  - [x] T2.6 — Escribir `public/data/geo/{depto}/localidad.topo.json`

- [x] **T3** — Validar cobertura vs tabla 8.1 (AC: 3)
  - [x] T3.1 — Leer `serie-localidad.json` de cada depto (si existe)
  - [x] T3.2 — Comparar localidades `tipo:"1:1"` vs nombres en geometría (normalizado)
  - [x] T3.3 — Imprimir porcentaje de match; advertir si <90% pero no fallar build

- [x] **T4** — Agregar script npm (AC: 1)
  - [x] T4.1 — Agregar `"etl:localidad-geo": "npx tsx etl/build-localidad-topojson.ts"` al `package.json`

### Review Findings

- [x] [Review][Patch] Solo primer polígono por localidad — series adicionales silenciosamente descartadas [etl/build-localidad-topojson.ts:115-117]
- [x] [Review][Patch] Map `serieToLocalidad` dead code + O(n²) con `mapping.find` en lugar del Map O(1) [etl/build-localidad-topojson.ts:80-83]
- [x] [Review][Patch] Map `localidadTipo` dead code [etl/build-localidad-topojson.ts:86-88]
- [x] [Review][Patch] Docblock obsoleto — describe "union de polígonos adyacentes (ciudad-grande)" que ya no aplica [etl/build-localidad-topojson.ts:1-13]
- [x] [Review][Defer] `catch {}` genérico traga errores de topología distintos al budget — deferred, pre-existing
- [x] [Review][Defer] `serieProp` detectado solo del primer feature — fragile con properties null — deferred, pre-existing
- [x] [Review][Defer] FeatureCollection vacía (all ciudad-grande) escrita sin failCount — deferred, imposible con datos reales
- [x] [Review][Defer] Paths relativos sin CWD guard — deferred, pre-existing en todos los ETL scripts
- [x] [Review][Defer] `JSON.parse`/`readFileSync` sin try/catch — deferred, pre-existing
- [x] [Review][Defer] Object name `'zonas'` en TopoJSON en lugar de `'localidades'` — deferred, convención del proyecto

## Dev Notes

### Contexto crítico: fuente geométrica

IDE Uruguay publica capas de localidades en su catálogo. La capa más probable es:
- **"Localidades Amanzanadas"** — polígonos de localidades con manzanas, solo localidades urbanas
- **"Localidades Pobladas"** — todas las localidades incluyendo rurales (más completa, más pesada)

El script debe verificar si ya existe un archivo en `data/raw/geographic/` (puede que el dev haya descargado algo). Si no existe, el dev debe descargar manualmente y colocarlo en `data/raw/geographic/localidades-uruguay.geojson`.

**IMPORTANTE**: La fuente del IDE suele tener todos los deptos en un solo GeoJSON nacional. El script filtra por propiedad de departamento. La propiedad departamento en la fuente puede llamarse `DEPTO`, `departamento`, `CODIGO_DEPTO` — el script debe detectarla.

### Patrón de código existente (reutilizar exactamente)

```typescript
// De etl/geometry/build-topojson.ts — ya existe:
import { cleanFeatureCollection, topojsonFromFC } from './geometry/build-topojson';
import { assertGeometryBudget } from './gates/geometry-size';

// Patrón de interior-dept.ts:
const clean = cleanFeatureCollection(geoSrc, 'name');  // prop del nombre
const { topo, features } = topojsonFromFC(clean, 'zonas', { simplifyQuantile });
const serialized = JSON.stringify(topo);
const size = assertGeometryBudget(serialized, 500 * 1024);
```

### Correspondencia departamento → código de filtro

Para filtrar el GeoJSON nacional por departamento, la propiedad en la fuente IDE suele usar el nombre del departamento en mayúsculas. Mapeo esperado:

| deptName | filtro probable |
|----------|-----------------|
| artigas | ARTIGAS |
| canelones | CANELONES |
| cerro_largo | CERRO LARGO |
| colonia | COLONIA |
| ... | ... |

El script debe ser robusto: si no puede determinar el filtro, loggear los valores únicos de la propiedad de depto para que el dev los inspeccione.

### Normalización de nombres para match con tabla 8.1

La propiedad `name` en el output TopoJSON debe coincidir exactamente con `localidad` en `serie-localidad.json` (Story 8.1). Ambos scripts deben usar la misma lógica de normalización (Title Case, sin tildes para comparación pero con tildes en el valor guardado).

```typescript
// De etl/lib/normalize.ts (ya existe):
import { normName } from '../lib/normalize'; // NFD+upper+trim para comparación
// Para guardar: usar capitalización del CSV original
```

### Budget por depto

Uruguay tiene localidades pequeñas, los polígonos son simples. Esperar:
- Deptos grandes (Canelones, Rivera): 200-400 KB gz
- Deptos pequeños (Flores, Treinta y Tres): 50-150 KB gz

Si Canelones excede budget: `simplifyQuantile: 0.05` (igual que los run-*.ts de interior).

### Archivos a crear (NEW)

| Archivo | Descripción |
|---------|-------------|
| `etl/build-localidad-topojson.ts` | Script principal |
| `public/data/geo/{depto}/localidad.topo.json` | 18 archivos TopoJSON |

### Archivos a modificar (UPDATE)

| Archivo | Cambio |
|---------|--------|
| `package.json` | Agregar script `etl:localidad-geo` |

### Dependencia explícita

**Esta story depende de 8.1**: usa `serie-localidad.json` para la validación de cobertura (T3). Si 8.1 no corrió, T3 se saltea con un warning y el script igual genera la geometría.

### Referencias

- Build TopoJSON: `etl/geometry/build-topojson.ts`
- Budget gate: `etl/gates/geometry-size.ts`
- Patrón existente: `etl/interior-dept.ts` (geometryStep)
- Normalización: `etl/lib/normalize.ts`
- Fuente IDE Uruguay: https://catalogodatos.gub.uy (buscar "localidades")

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

- Capa IDE Uruguay no existe en el proyecto → enfoque alternativo: derivar localidades usando polígonos de series `data/raw/geographic/{depto}_series_map.json` mapeados por el mapping SERIE→localidad de Story 8.1.
- **Ciudad-grande EXCLUIDA del output**: series con `tipo: "ciudad-grande"` son filtradas; NO se union-ea la capital en un polígono único. Las series ciudad-grande serán manejadas individualmente por Stories 8.4/8.5 (research de barrios + UI degradación).
- 18/18 departamentos generados con budget ≤500 KB gz (máximo: Durazno 485 KB).
- Detección automática de propiedad de serie: busca clave con `.toLowerCase() === 'serie'` en properties del primer feature.
- `polygon-clipping` dependency eliminada (no longer needed — no hay union de polígonos).
- 10 departamentos con ciudad-grande excluida: artigas (5), cerro_largo (8), durazno (5), lavalleja (3), paysandu (8), rivera (9), salto (18), san_jose (8), soriano (3), treinta_y_tres (7).
- Cobertura 1:1 ≥90% en todos: mínimo 92.3% (lavalleja, 1 serie sin match en mapping).
- Canelones: 95.5% cobertura (2 series sin geometría correspondiente).
- Simplification steps: 0.15 → 0.10 → 0.05 → 0.02 (ningún depto necesitó más que 0.15 para cumplir budget).

### File List

| Archivo | Tipo | Descripción |
|---------|------|-------------|
| `etl/build-localidad-topojson.ts` | NEW | Script ETL: series union → localidad TopoJSON |
| `package.json` | UPDATE | Agrega script `etl:localidad-geo` |
| `public/data/geo/artigas/localidad.topo.json` | NEW | TopoJSON generado (artifact) |
| `public/data/geo/canelones/localidad.topo.json` | NEW | TopoJSON generado (artifact) |
| `public/data/geo/cerro_largo/localidad.topo.json` | NEW | TopoJSON generado (artifact) |
| `public/data/geo/colonia/localidad.topo.json` | NEW | TopoJSON generado (artifact) |
| `public/data/geo/durazno/localidad.topo.json` | NEW | TopoJSON generado (artifact) |
| `public/data/geo/flores/localidad.topo.json` | NEW | TopoJSON generado (artifact) |
| `public/data/geo/florida/localidad.topo.json` | NEW | TopoJSON generado (artifact) |
| `public/data/geo/lavalleja/localidad.topo.json` | NEW | TopoJSON generado (artifact) |
| `public/data/geo/maldonado/localidad.topo.json` | NEW | TopoJSON generado (artifact) |
| `public/data/geo/paysandu/localidad.topo.json` | NEW | TopoJSON generado (artifact) |
| `public/data/geo/rio_negro/localidad.topo.json` | NEW | TopoJSON generado (artifact) |
| `public/data/geo/rivera/localidad.topo.json` | NEW | TopoJSON generado (artifact) |
| `public/data/geo/rocha/localidad.topo.json` | NEW | TopoJSON generado (artifact) |
| `public/data/geo/salto/localidad.topo.json` | NEW | TopoJSON generado (artifact) |
| `public/data/geo/san_jose/localidad.topo.json` | NEW | TopoJSON generado (artifact) |
| `public/data/geo/soriano/localidad.topo.json` | NEW | TopoJSON generado (artifact) |
| `public/data/geo/tacuarembo/localidad.topo.json` | NEW | TopoJSON generado (artifact) |
| `public/data/geo/treinta_y_tres/localidad.topo.json` | NEW | TopoJSON generado (artifact) |

### Change Log

- **2026-05-31** — Implementación completa por claude-sonnet-4-6. Creado `etl/build-localidad-topojson.ts` con enfoque series-to-localidad (no requiere descarga IDE Uruguay). 18/18 deptos generados, todos ≤500 KB gz, cobertura 1:1 ≥90%. Status → review.
- **2026-05-31** — Corrección crítica: eliminado union de polígonos para ciudad-grande. Series `tipo: "ciudad-grande"` se excluyen del output; permanecen como polígonos individuales de serie para Story 8.5 (research barrios). Eliminada dependencia `polygon-clipping`. ETL re-ejecutado. Status → review.

