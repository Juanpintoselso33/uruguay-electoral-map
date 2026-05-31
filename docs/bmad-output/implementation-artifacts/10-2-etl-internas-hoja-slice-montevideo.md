---
baseline_commit: c35f404386d10e5306aca3eab5a99cc5bf7c38fd
---

# Story 10.2: ETL internas HOJA — catálogo jerárquico + shard por lista (slice Montevideo)

Status: done

## Story

As a usuario,
I want explorar cómo le fue a cada lista de las internas 2024 en Montevideo,
so that vea el voto a nivel de lista individual, no solo agregado por partido.

## Acceptance Criteria

1. **Given** `desglose-de-votos.csv` filtrado a Montevideo (HOJA_ODN y HOJA_ODD) **When** corro el ETL de granularidad **Then** emite un **catálogo de opciones jerárquico** `public/data/internas-2024/montevideo/catalogo.json` con las dos contiendas (ODN/ODD), sus nodos (lema → precandidato → hoja en ODN; lema → hoja en ODD) y los `opcion_id` compuestos.
2. **Given** los votos por hoja por barrio **When** emito los shards **Then** genero un shard de votos a nivel HOJA **shardeado por lema** para lazy-load: `public/data/internas-2024/montevideo/hoja/{contienda}/{lemaSlug}.json` (cargás solo las hojas del lema que abrís).
3. **Given** el join CIRCUITO→BARRIO existente (Story 1.6) **When** agrego por hoja **Then** uso el mismo mapping `montevideo-circuito-barrio.json` y la misma geometría de barrios — el geoId de cada hoja coincide con los barrios del shard a nivel lema existente.
4. **Given** el gate de reconciliación **When** corro el ETL **Then** la suma de votos de todas las hojas de un lema en un barrio = el agregado por lema de ese barrio (el shard lema existente `votes.json` no cambia) — losslessness verificada.
5. **Given** el gate de consistencia de catálogo (Story 10.1) **When** valido **Then** todo `opcion_id` de hoja en los shards existe en `catalogo.json` y todo nodo tiene su parent.
6. **Given** el roll-up **When** comparo niveles **Then** hoja → precandidato → lema → departamento es consistente (sumas cuadran a cada nivel).

## Tasks / Subtasks

- [x] **T1** — Crear `etl/transform/aggregate-hoja-internas.ts` (AC: 1, 2, 6)
  - [x] T1.1 — Filtrar filas: `DEPARTAMENTO === 'MO'`, `TIPO_REGISTRO ∈ {HOJA_ODN, HOJA_ODD}`
  - [x] T1.2 — Por contienda, agregar votos por `(hoja, barrio)` usando el mapping CIRCUITO→BARRIO (mismo de internas Story 1.6)
  - [x] T1.3 — Construir el catálogo jerárquico: contienda → lema (LEMA) → precandidato (DESCRIPCIÓN_1, solo ODN) → hoja (DESCRIPCIÓN_2), con `opcion_id` compuesto
  - [x] T1.4 — Emitir, por (contienda, lema), un shard de hojas: zonas[].porOpcion = hojas de ese lema con sus votos por barrio
  - [x] T1.5 — Calcular roll-up y exponer totales por nivel para los gates

- [x] **T2** — Orquestador `etl/run-montevideo-hoja.ts` (AC: 1, 2, 3)
  - [x] T2.1 — Reusar `parseCsv`, el mapping `data/mappings/montevideo-circuito-barrio.json`, y la geometría `public/data/geo/montevideo/zona.topo.json` (NO regenerar geometría)
  - [x] T2.2 — Escribir `catalogo.json` + los shards `hoja/{contienda}/{lemaSlug}.json`
  - [x] T2.3 — Loggear: nº de hojas por contienda, nº de lemas, nº de shards emitidos

- [x] **T3** — Gates (AC: 4, 5, 6)
  - [x] T3.1 — Reconciliación: suma de hojas por barrio == agregado por lema del `votes.json` existente (cargar el shard lema y comparar)
  - [x] T3.2 — `assertHojasEnCatalogo` + `assertCatalogoConsistente` (Story 10.1)
  - [x] T3.3 — Roll-up: precandidato == suma de sus hojas; lema == suma de sus precandidatos (ODN) o hojas (ODD)
  - [x] T3.4 — Cualquier gate que falle → exit≠0

- [x] **T4** — Catálogo de nombres humanos (AC: 1)
  - [x] T4.1 — Precandidato: normalizar "COSSE GARRIDO, Ana Carolina" → "Carolina Cosse" (Apellido, Nombre → Nombre Apellido); guardar en el nodo
  - [x] T4.2 — Lema: reusar el mapeo de partido existente (`partidos_abrev.json` / `partyColors`)

- [x] **T5** — Script npm (AC: 1)
  - [x] T5.1 — `"etl:montevideo-hoja": "npx tsx etl/run-montevideo-hoja.ts"` en `package.json`

## Dev Notes

### Contexto crítico: el dato ya existe, el ETL lo tiraba

El ETL actual (`aggregate-by-circuito.ts`) agrega por LEMA y descarta DESCRIPCIÓN_1 (precandidato) y DESCRIPCIÓN_2 (hoja). Esta story los conserva. **Mismo CSV, mismo join, distinta granularidad de agregación.**

```
HOJA_ODN, MO, 1, AAA, FRENTE AMPLIO, "COSSE GARRIDO, Ana Carolina", 90, 13
         contienda=odn  lema=FA       precand=Cosse                  hoja=90  votos=13
```

### El join geográfico es el MISMO que internas a nivel lema

NO inventar un join nuevo. Reusar:
- Mapping: `data/mappings/montevideo-circuito-barrio.json` (CRV→BARRIO)
- Geometría: `public/data/geo/montevideo/zona.topo.json`
- Lógica: ver `etl/transform/aggregate-by-circuito.ts` (`resolveBarrio`, acumulación por barrio)

La diferencia: la clave de agregación pasa de `LEMA` a `(contienda, lema, precandidato, hoja)`.

### Por qué shardear por lema

El producto cartesiano hoja×barrio es grande (~250 hojas × ~62 barrios). Servir todo junto pesa. El cliente solo necesita las hojas del lema que el usuario expande en el acordeón. Por eso: un archivo por `(contienda, lema)`. El eager sigue siendo el `votes.json` a nivel lema (ya existe); las hojas son lazy.

Estructura `hoja/odn/frente-amplio.json` (un VotosShard con `nivel: 'zona'` pero `porOpcion` = hojas del lema):
```json
{
  "eleccionId": "internas-2024", "departamento": "montevideo",
  "nivel": "zona", "escrutinio": "definitivo", "tipo": "internas",
  "contienda": "odn", "lemaId": "frente-amplio",
  "zonas": [
    { "geoId": "Centro", "ganadorOpcionId": "odn-frente-amplio-609", "validos": 5000,
      "porOpcion": [ {"opcionId":"odn-frente-amplio-609","votos":2100}, ... ],
      "noPartidarios": {"enBlanco":0,"anulados":0,"observados":0} } ]
}
```

### Reconciliación contra el shard lema existente

`public/data/internas-2024/montevideo/votes.json` (nivel lema) NO se toca. El gate carga ese archivo y verifica que, por barrio, `Σ hojas(lema) == agregado(lema)`. Esto garantiza que la nueva capa de hojas es consistente con lo ya publicado. Tolerancia 0 (mismo dato crudo, misma etapa definitiva).

### Normalización de precandidato

DESCRIPCIÓN_1 viene "APELLIDO APELLIDO, Nombre Nombre". Convertir a "Nombre Apellido" para el nombre humano. Guardar también el id estable (`slug` del apellido principal). En ODD DESCRIPCIÓN_1 = "No aplica" → no se crea nivel precandidato.

### Escrutinio
El `desglose-de-votos.csv` ES la etapa definitiva (no tiene columna ESCRUTINIO; es el archivo consolidado). `escrutinio: 'definitivo'` en todos los shards.

### Archivos a crear (NEW)
| Archivo | Descripción |
|---------|-------------|
| `etl/transform/aggregate-hoja-internas.ts` | Aggregator por hoja |
| `etl/run-montevideo-hoja.ts` | Orquestador |
| `public/data/internas-2024/montevideo/catalogo.json` | Catálogo jerárquico |
| `public/data/internas-2024/montevideo/hoja/{contienda}/{lema}.json` | Shards por lema |

### Archivos a modificar (UPDATE)
| Archivo | Cambio |
|---------|--------|
| `package.json` | Script `etl:montevideo-hoja` |

### Dependencias
- **Bloquea**: Story 10.1 (contrato v3: `Contienda`, catálogo, `opcion_id` compuesto, guards).
- **Reusa**: Story 1.6 (mapping + geometría Montevideo).

### Referencias
- Aggregator a imitar: `etl/transform/aggregate-by-circuito.ts`
- Orquestador a imitar: `etl/run-montevideo.ts`
- Emit/gates: `etl/load/emit-shard.ts`, `etl/gates/reconcile.ts`, `etl/gates/coverage.ts`
- Legacy (cómo agregaba candidato=suma de hojas): `git show master:src/stores/electoral.ts` (`getVotosForNeighborhood`, `precandidatosByList`)

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code, bmad-dev-story)

### Completion Notes List

- **Decisión de origen:** se usa `public/montevideo_{odn,odd}.csv` (mismo origen que el ETL por lema de Story 1.6, columnas PARTIDO/PRECANDIDATO/HOJA/CIRCUITO, ESCRUTINIO=Departamental) en vez del `desglose-de-votos.csv` que sugería la story — así la reconciliación contra el `votes.json` lema publicado es EXACTA (mismo dato, mismo join). El desglose descargado es para las elecciones aún no en el repo.
- **T1** — `aggregate-hoja-internas.ts`: agrega una contienda por `(PARTIDO,PRECANDIDATO,HOJA,barrio)` reusando `resolveBarrio` (CIRCUITO→BARRIO del mapping existente). Salta no-partidarios. Emite catálogo de contienda (nodos lema+precandidato, opciones hoja con id compuesto via `opcionIdHoja`) + shards por lema + mapa de reconciliación `(barrio,lema)→votos`.
- **T2** — `run-montevideo-hoja.ts`: orquesta ODN+ODD, no regenera geometría/mapping; escribe `catalogo.json` + `hoja/{contienda}/{lema}.json`.
- **T3** — gates: `assertCatalogoConsistente`, `assertVotosShard`+`assertHojasEnCatalogo` por shard, **reconciliación ODN exacta** (914 pares barrio×lema, total 319.512 == lema, tolerancia 0), roll-up hoja→lema por contienda.
- **T4** — nombre de precandidato normalizado "APELLIDO, Nombre" → "Nombre Apellido" Title-Case Unicode-safe (corregido un bug de `\b` ASCII que rompía acentos: "AndrÉS" → "Andrés").
- **T5** — script `etl:montevideo-hoja`.
- **Resultado:** ODN 187 hojas / 48 nodos / 18 lemas · ODD 224 hojas / 15 nodos / 15 lemas · 33 shards. `tsc --noEmit` exit 0. Todos los gates PASARON. Verificado a ojo: shard FA odn Ciudad Vieja `validos 6080` == `votes.json` FA.

### File List

- `etl/transform/aggregate-hoja-internas.ts` (new) — aggregator por hoja
- `etl/run-montevideo-hoja.ts` (new) — orquestador + gates
- `package.json` (modified) — script `etl:montevideo-hoja`
- `public/data/internas-2024/montevideo/catalogo.json` (new, generado)
- `public/data/internas-2024/montevideo/hoja/{odn,odd}/{lema}.json` (new, 33 shards generados)

### Change Log

- 2026-05-31 — ETL internas HOJA Montevideo (ODN+ODD): catálogo jerárquico + shards por lema + reconciliación exacta vs lema. Status → review.
- 2026-05-31 — Atendido hallazgo de code-review. Status → done.

## Senior Developer Review (AI)

**Fecha:** 2026-05-31 · **Reviewer:** code-reviewer (adversarial, sondeó el dato real). **Resultado:** 1 hallazgo Med resuelto; resto verificado sano.

- [x] **[Med] ODD se validaba solo internamente** — `rollupOk('ODD')` comparaba dos acumuladores construidos en el mismo loop (identidad tautológica); ODN sí reconciliaba contra `votes.json` publicado, pero ODD no tenía referencia independiente. **Fix:** se agregó reconciliación ODD contra `aggregateByCircuito(montevideo_odd.csv)` — fuente independiente y confiable (el mismo código que produce el agregado por lema). Resultado: **ODD 696 pares barrio×lema exactos, total 246.052 = lema**. Generalicé `reconcileContraLema(nombre, result, ref)` para ambas contiendas.

**Verificado sano por el reviewer (no-hallazgos):** el reconcile ODN es *provablemente exacto* (el check per-par fuerza mine⊆ref con valores exactos, y el check de total global cierra el caso de entradas en ref ausentes en mine); empates/0-votos/lema-con-1-hoja no rompen `assertVotosShard`; `resolveBarrio`+unmapped idénticos a `aggregate-by-circuito`; nodos precandidato sin huérfanos. Riesgos Low (last-write-wins de precandidato; hoja ODN sin precandidato) confirmados con 0 ocurrencias en el dato y de falla ruidosa, no silenciosa.

**Verificación post-fix:** ETL corre, ambas contiendas reconcilian exacto, `tsc --noEmit` exit 0.
