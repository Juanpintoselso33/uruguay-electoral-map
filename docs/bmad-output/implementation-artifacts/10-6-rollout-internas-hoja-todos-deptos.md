---
baseline_commit: c35f404386d10e5306aca3eab5a99cc5bf7c38fd
---

# Story 10.6: Rollout internas HOJA a todos los departamentos ingeridos

Status: done

## Story

As a usuario del interior,
I want ver el voto por lista de las internas en mi departamento,
so that tenga la misma granularidad de lista que Montevideo.

## Acceptance Criteria

1. **Given** el ETL de granularidad de 10.2 **When** lo generalizo al interior (nivel serie/localidad) y al ODD de Montevideo **Then** cada depto ingerido emite su `catalogo.json` + shards de hojas por lema.
2. **Given** cada depto **When** corro el ETL **Then** los gates (reconciliación vs el shard lema existente + consistencia de catálogo + roll-up) pasan por depto.
3. **Given** el selector y el mapa **When** abro cualquier depto del interior **Then** el acordeón (10.3) y los modos de mapa (10.4) funcionan con sus hojas.
4. **Given** un depto/contienda sin algún nivel **When** se construye el árbol **Then** degrada con rótulo (no rompe): interior internas suele ser solo ODN a nivel serie.
5. **Given** Montevideo ODD **When** corro el ETL **Then** el shard de hojas ODD se emite (10.2 ya hizo ODN+ODD para MO; acá se valida la cobertura completa).

## Tasks / Subtasks

- [x] **T1** — Aggregator de hoja para el interior (AC: 1, 4)
  - [x] T1.1 — `aggregate-hoja-serie.ts` nuevo (el de MO usa barrio; el interior usa SERIE — fuente y columnas distintas: `desglose-de-votos.csv` con DESCRIPCIÓN_1/_2)
  - [x] T1.2 — Clave geográfica = SERIE; **replica el pro-rata exacto de `aggregate-by-serie`** para series combinadas → reconciliación exacta
  - [x] T1.3 — Orquestado por `run-interior-hoja.ts` (loop de los 18 deptos), no por `interior-dept.ts` (más simple, un solo runner)
- [x] **T2** — Correr para los 18 deptos (AC: 1, 2, 5)
  - [x] T2.1 — Loop parametrizado `run-interior-hoja.ts` con los 18 configs (code/name/exteriorSerie); script `etl:interior-hoja`
  - [x] T2.2 — Gates por depto: catálogo consistente + hojas-en-catálogo + reconciliación + roll-up. **18/18 ✅**
- [x] **T3** — UI/config (AC: 3)
  - [x] T3.1 — El acordeón lee `catalogo.json` por depto (genérico, sin asumir Montevideo) — verificado en Salto
  - [x] T3.2 — `[departamento].astro`: `tieneCatalogoHoja = eleccion === 'internas-2024'` (los 19 deptos ya tienen catálogo)
- [x] **T4** — Gate global (AC: 2)
  - [x] T4.1 — Reconciliación por depto: ODN contra el `votes.json` por serie publicado; ODD contra `aggregateBySerie` (fuente independiente). Tolerancia 0, ambos sentidos del total

## Dev Notes

- **Depende de 10.2** (aggregator + formato de catálogo/shards) y de 10.1 (contrato).
- Interior internas: el `desglose-de-votos.csv` tiene HOJA_ODN y HOJA_ODD para todos los deptos; la clave geográfica del interior es SERIE (ver `aggregate-by-serie.ts`, `interior-dept.ts`).
- Cuidado con el ODN "corrupto" señalado en el informe legacy (algunos `odn.json` keyados por nombre, no número) — acá partimos del CSV crudo `desglose-de-votos.csv`, no de esos JSON, así que no aplica; pero validar que DESCRIPCIÓN_2 es siempre numérico.
- No regenerar geometría; reusar `serie.topo.json` por depto.

### Referencias
- `etl/transform/aggregate-by-serie.ts`, `etl/interior-dept.ts`, Story 10.2 (`aggregate-hoja-internas.ts`)

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code, bmad-dev-story)

### Completion Notes List

- **`aggregate-hoja-serie.ts` (nuevo):** aggregator de hoja para el interior (geoId = SERIE). Replica el pro-rata exacto de series combinadas de `aggregate-by-serie` (base=floor(votos/n), resto a la primera) para que Σ hojas por (serie,lema) == el agregado por lema. Lema en Title-Case; precandidato "APELLIDO, Nombre" → "Nombre Apellido".
- **`run-interior-hoja.ts` (nuevo):** loop de los 18 deptos (configs code/name/exteriorSerie). Por depto: filtra `desglose-de-votos.csv` por depto + HOJA_ODN/HOJA_ODD (excluye exterior), agrega ODN+ODD, escribe `catalogo.json` + `hoja/{odn,odd}/{lema}.json`, y corre los gates.
- **Reconciliación EXACTA por depto:** ODN contra `public/data/internas-2024/{depto}/votes.json` (serie publicado); ODD contra `aggregateBySerie(oddRows)` (fuente independiente). **Resultado: 18/18 deptos, todos los pares (serie×lema) exactos** (ej. lavalleja ODN 303 pares/52.474; rivera ODN 298/38.666; salto ODN 279/29.002).
- **UI:** `[departamento].astro` ahora habilita el acordeón para toda `internas-2024` (los 19 deptos tienen catálogo). **Verificado en browser (Salto):** acordeón con 14 lemas; seleccionar Frente Amplio commitea sus 36 hojas y el mapa por SERIE colorea por Share% (13/29/42/53%…) con el switch Share/Votos/Heatmap.
- `npx tsc --noEmit` exit 0; `astro check` 0/0/0.
- **Nota:** se aplicó Title-Case al nombre de lema del interior (el desglose viene en MAYÚSCULAS) para consistencia con Montevideo; no afecta ids/reconciliación (usan slug).

### File List

- `etl/transform/aggregate-hoja-serie.ts` (new) — aggregator de hoja por serie (interior)
- `etl/run-interior-hoja.ts` (new) — orquestador de los 18 deptos + gates
- `package.json` (modified) — script `etl:interior-hoja`
- `src/pages/[eleccion]/[departamento].astro` (modified) — acordeón para todos los deptos de internas-2024
- `public/data/internas-2024/{18 deptos}/catalogo.json` + `hoja/{odn,odd}/{lema}.json` (new, generados)

### Change Log

- 2026-05-31 — Rollout internas HOJA a los 18 deptos del interior (serie) con reconciliación exacta 18/18 + acordeón habilitado en todos. Verificado en browser. Status → done.
