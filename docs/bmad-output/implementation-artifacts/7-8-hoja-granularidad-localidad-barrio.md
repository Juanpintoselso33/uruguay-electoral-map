---
baseline_commit: c35f404386d10e5306aca3eab5a99cc5bf7c38fd
---

# Story 7.8: Granularidad por HOJA en localidad y barrio

Status: done

## Story

As a usuario,
I want que el drill-down por HOJA (lema → precandidato/sublema/alcalde → lista) coloree el mapa
también a nivel **localidad** y **barrio**, no solo a nivel serie,
so that toda elección y todo nivel geográfico tengan la MISMA granularidad por HOJA — el core del
producto, no una extensión opcional.

## Problema (regresión de granularidad por eje geográfico)

El drill-down por HOJA solo coloreaba a nivel **serie**. Los shards `hoja/{contienda}/{lema}.json`
están keyed por código de serie (`caa`, `cba`…); al subir a localidad/barrio (geoId = nombre de
localidad/barrio) el join geográfico fallaba: `hojaVotos.get(key)` no encontraba nada y el mapa
quedaba en **blanco uniforme** (todo en el bucket "bajo"). Mismo síntoma a nivel circuito (geoId =
número de circuito, 0 overlap con series) — limitación preexistente, fuera de este alcance (Epic 5.2
pmtiles para sus 1060 zonas).

Diagnóstico clave: **todas** las capas base (`votes.json`, `votes-localidad.json`,
`votes-circuito.json`) solo llevan opcionIds a nivel **lema** (`frente-amplio`); los opcionIds por
HOJA (`odn-frente-amplio-609`) viven EXCLUSIVAMENTE en los shards por serie. Para internas, la base
= contienda **ODN** (la ODD solo existe en los shards de hoja).

## Acceptance Criteria

1. Seleccionar una HOJA específica (p. ej. Lista 609) a nivel localidad/barrio colorea por el
   **share por-localidad/barrio de esa hoja** (gradiente), no uniforme ni en blanco.
2. Funciona para TODAS las elecciones con HOJA (internas-2019/2024, nacionales-2014/2024,
   departamentales-2020/2025) y ambas contiendas donde aplica (ODN y ODD en internas).
3. Capa base (ganador/lema) por barrio para las 8 capitales del interior con geometría de barrio,
   en todas esas elecciones (antes solo existía para internas-2024).
4. Gates de integridad **no tautológicos**.

## Alcance de cobertura (enumerado, = test de "todas las elecciones")

| Tipo | hoja shards | → hoja-localidad | → hoja-barrio |
|---|---|---|---|
| internas-2019 | 19 deptos | 18 interior | 8 capitales |
| internas-2024 | 19 | 18 | 8 |
| nacionales-2014 | 19 | 18 | 8 |
| nacionales-2024 | 19 | 18 | 8 |
| departamentales-2020 | 19 | 18 | 8 |
| departamentales-2025 | 19 | 18 | 8 |
| balotaje/plebiscito/referendum | — (planos, sin lema/hoja) | base-only (correcto) | — |

**0 gaps en el eje opción**: toda elección que debe tener shards de hoja los tiene. Total generado:
**108 `hoja-localidad.json` + 48 `hoja-barrio.json` = 156 archivos** (consolidados por
elección×depto — evita la explosión de miles de archivos por-lema; cf. Epic 5.2 payload).

## Tasks / Subtasks

- [x] **T1** — Capa base barrio para todas las elecciones (`etl/run-barrio-all.ts`)
  - [x] T1.1 — Re-agrega `votes.json` (serie) → barrio vía `{ciudad}-serie-barrio.json` (solo series
        urbanas de la capital). Agnóstico de elección (opera sobre el shard, compound ya resuelto).
  - [x] T1.2 — Gate de cobertura DURO: un barrio del mapping nunca cubierto en NINGUNA elección =
        mapping obsoleto (ERROR); vacío en una elección puntual = serie ausente ese año por
        redistritado (WARNING — p. ej. KBB→Amanecer existe en 2024, ausente en 2019). 48 generadas.
- [x] **T2** — Consolidado HOJA por nivel geográfico (`etl/run-hoja-geo.ts`)
  - [x] T2.1 — Re-agrega cada shard `hoja/{cont}/{lema}.json` (serie) → localidad/barrio y consolida
        TODAS las hojas de TODAS las contiendas en UN `hoja-{nivel}.json` por elección×depto.
  - [x] T2.2 — Detección de contienda **ancla**: la que iguala el total de `votes.json` base (ODN
        para internas, `unica` para nacionales, intendente para departamentales).
  - [x] T2.3 — **Gate (B) ancla cross-file (HARD, no tautológico)**: Σ del ancla por geo ==
        Σ `votes-{nivel}.json` por geo. `votes-{nivel}` se construye aparte desde `votes.json`, no
        desde los shards de hoja → el desacuerdo caza misplacement/aritmética. Como ODN y ODD usan
        la MISMA serie→geo, validar ODN por geo prueba el mapping para ambas. Sin ancla → NO emitir.
  - [x] T2.4 — **Gate (A) no-drop (independiente)**: `totalFull` (todos los shards) vs `totalMapped`
        (los que mapearon); en localidad la diferencia = votos en series sin localidad (warning
        informativo, 0.1–1.6% legítimo por series exterior/especiales). Reemplaza el gate de
        conservación original que era **tautológico** (in/out de la misma acumulación).
- [x] **T3** — Cliente level-aware (`ChoroplethMap.vue`)
  - [x] T3.1 — `ensureHojaGeoConsolidado`: a nivel localidad/barrio carga UNA vez `hoja-{nivel}.json`
        y puebla `hojaVotos` keyed por nombre de zona (mismo índice de join que serie). Cortocircuita
        el fetch por-lema. `selSumZona`/`buildDesglose` funcionan sin cambios.
  - [x] T3.2 — Dedup concurrente vía **promise guardada** (no bool), espejando `catalogoPromise`:
        callers concurrentes esperan el MISMO fetch y ven `hojaVotos` ya poblado (evita re-introducir
        el mapa en blanco por race). Reset de `hojaGeoPromise` en `reloadData` al cambiar nivel/depto.
- [x] **T4** — Wiring de nivel `localidad` en los 9 deptos serie-only que tenían geometría pero no
      datos (`departments.json`); base `votes-localidad.json` para las 18 deptos interior × todas las
      elecciones con HOJA (`etl/run-localidad-all.ts`, ya existente, revisado).

## Verificación

- ✅ **internas-2024 / canelones / localidad** — Lista 609 (ODN): gradiente 1% (rural NE) → 34% (sur).
- ✅ **internas-2024 / salto / barrio** — FA (36 listas, ODN): gradiente 7%–58% por barrio capital,
  resto del depto sin geometría de barrio (blanco, esperado).
- ✅ **nacionales-2024 / canelones / localidad** — FA (57 listas, `unica`): 19–30% norte rural,
  54–63% sur metropolitano (coincide con la geografía política conocida).
- ✅ `astro check` 0 errores · `npm run build` exit 0 · `etl:hoja-geo` 156 archivos, gates PASARON.

## Code Review (feature-dev:code-reviewer) — findings resueltos

- **CRÍTICO** Gate (A) tautológico (in/out de la misma acumulación, no podía fallar; dejaba ODD sin
  red) → reemplazado por no-drop independiente (totalFull vs totalMapped) + ancla cross-file (B)
  hecha HARD y sin-ancla → ERROR (no emitir archivo sin validar).
- **IMPORTANTE** Race en `ensureHojaGeoConsolidado` (bool antes del await) → promise guardada.
- **LOW** `readHojaShards`: guard muerto `if (!readdirSync(cd))` → `statSync(...).isDirectory()`;
  acceso `tipo[0][0]` sobre contienda vacía → filtrar `shards.length > 0` al coleccionar.

## Out of scope / deuda anotada

- **Circuito blanquea al seleccionar HOJA**: bug preexistente (1060 circuitos, 0 overlap con series,
  base solo-lema). No es parte del eje localidad/barrio pedido. Fix futuro: fallback de coloreo por
  lema padre (`parentDe`) cuando no hay datos de HOJA al nivel activo — con riesgo de
  representar colores de lema como si fueran de lista, a evaluar antes de implementar.

## File List

- `etl/run-barrio-all.ts` (NEW)
- `etl/run-hoja-geo.ts` (NEW)
- `etl/run-localidad-all.ts` (revisado; sin cambios funcionales esta story)
- `src/components/map/ChoroplethMap.vue` (level-aware hoja-geo + dedup por promise)
- `src/config/departments.json` (nivel `localidad` en 9 deptos serie-only)
- `package.json` (scripts `etl:barrio-all`, `etl:hoja-geo`)
- `public/data/*/*/votes-barrio.json` (48 nuevas), `hoja-localidad.json` (108), `hoja-barrio.json` (48)

## Change Log

- 2026-05-31 — Implementada y verificada. Drill-down por HOJA ahora colorea en serie + localidad +
  barrio para las 6 elecciones con HOJA. Gates de review corregidos (tautológico → independiente).
