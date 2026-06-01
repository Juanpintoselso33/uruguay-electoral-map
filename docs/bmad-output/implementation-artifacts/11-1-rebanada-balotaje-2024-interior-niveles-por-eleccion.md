---
baseline_commit: dc2a06f4526d2f8a8e0863f2f53c9ca000aad315
---

# Story 11.1: Rebanada — balotaje-2024 al interior + niveles por elección

Status: done

## Story

As a usuario del interior,
I want ver el balotaje 2024 en mi departamento, con los niveles que realmente tienen dato,
so that explore la segunda vuelta presidencial donde voté sin que el mapa se rompa al elegir un nivel inexistente.

## Acceptance Criteria

1. **Given** `run-balotaje-interior.ts` (piloto Colonia) **When** lo generalizo a los 18 deptos del interior **Then** cada depto emite su `votes.json` (serie) + `opciones.json` para `balotaje-2024`.
2. **Given** cada depto **When** corro el ETL **Then** los gates de reconciliación (losslessness) y cobertura serie↔geometría pasan por depto.
3. **Given** `departments.json` **When** agrego `balotaje-2024` a los 18 deptos del interior **Then** las rutas SSG se generan para esos deptos.
4. **Given** que los niveles se declaran por-departamento **When** derivo `availableLevels` por elección×depto desde los shards `votes-{nivel}.json` presentes en disco (build-time) **Then** el selector solo ofrece niveles con dato **And** se arregla el break latente de Colonia balotaje-2024 (que hoy ofrece circuito sin dato).
5. **Given** un depto interior en balotaje-2024 **When** lo abro **Then** el mapa renderiza por serie sin romper **And** `astro check` 0 errores.

## Tasks / Subtasks

- [x] **T1** — ETL balotaje-2024 a los 18 deptos (AC: 1, 2)
  - [x] T1.1 — Loop main en `run-balotaje-interior.ts` con los 18 configs (deptCode/deptName), siguiendo el patrón de `run-nacionales-2024-interior.ts`. Colonia es un caso del loop. CSV parseado una vez (param `preParsedRows`).
  - [x] T1.2 — Script `etl:balotaje-2024-interior` en package.json (reemplaza el ambiguo `etl:balotaje-colo`).
  - [x] T1.3 — Gates por depto: reconcile (tol 0) + checkCoverage. **18/18 ✅** (delta=0; placement ≥98.6%; serie-fill ≥96.4%).
- [x] **T2** — Fix niveles-por-elección (AC: 4)
  - [x] T2.1 — En `[departamento].astro`: `availableLevels` derivado filtrando `deptMeta.levels` por existencia del `votes-{nivel}.json` en disco (build-time, `existsSync`), con fallback a `deptMeta.levels` si vacío.
  - [x] T2.2 — Verificado en browser: salto (serie-only) → "Series" [pressed] + "Circuito" [disabled], sin localidad. Colonia → serie+localidad, circuito excluido (arregla el break latente).
- [x] **T3** — Config + verificación (AC: 3, 5)
  - [x] T3.1 — `departments.json`: `balotaje-2024` en los 19 deptos (MVD+Colonia ya estaban; +17 interior).
  - [x] T3.2 — `astro check` 0 errores; `astro build` 140 páginas (incl. 17 rutas nuevas); render verificado en browser.

## Dev Notes

- **No regenerar geometría**: reusar `public/data/geo/{dept}/serie.topo.json` (ya existe por el ETL de internas).
- `run-balotaje-interior.ts` ya filtra por `r['Departamento'] === deptCode` y excluye exterior (`Serie` endsWith ZZ). El CSV `balotaje-2024/balotaje-2024.csv` tiene los 19 deptos.
- `aggregateBalotajeBySerie` es genérico (Orsi/Coalición); ya documentada la convención de empate (commit dc2a06f).
- **Fix de niveles** es el desbloqueante reusable: una vez derivado de disco, las stories 11.2–11.4 (también serie-only) heredan el comportamiento correcto sin tocar UI.
- El nivel base es `votes.json` (zona MVD / serie interior) → siempre presente en una ruta viva; `availableLevels` nunca queda vacío.

### Referencias
- `etl/run-balotaje-interior.ts`, `etl/run-nacionales-2024-interior.ts` (patrón loop 18 deptos), `src/pages/[eleccion]/[departamento].astro`, `src/components/selectors/LevelSelector.vue`, Story 10.6 (rollout + AC4 degradación).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code)

### Completion Notes List

- **ETL (T1):** `run-balotaje-interior.ts` generalizado de piloto-Colonia a loop de los 18 deptos del interior (mismo set de configs que `run-nacionales-2024-interior.ts`). El CSV `balotaje-2024.csv` se parsea una sola vez y se pasa por `preParsedRows` (atiende la nota de re-parse del `deferred-work`). **18/18 deptos, reconciliación exacta delta=0**, placement 98.6–100%, serie-fill 96.4–100%. Geometría reusada (`serie.topo.json`), no regenerada.
- **Niveles por elección (T2) — el desbloqueante reusable:** `[departamento].astro` ahora deriva `availableLevels` por elección×depto chequeando qué `votes-{nivel}.json` existen en disco (build-time), en vez de usar `deptMeta.levels` crudo. Mismo mapeo nivel→archivo que `ChoroplethMap`. Esto hace que el fanout (11.2–11.4, también serie-only) herede el comportamiento correcto sin tocar UI, y **arregla el break latente de Colonia balotaje-2024** (ofrecía circuito sin dato).
- **Verificación en browser (salto):** mapa colorea por ganador (FA/CR), tabla "41 series", selector "Series" [pressed] + "Circuito" [disabled], opciones "Candidato / Lema" → FA + Coalición Republicana. Único error de consola: favicon 404 (pre-existente). 
- `astro check` 0 errores / `astro build` 140 páginas (17 rutas balotaje-2024 interior nuevas).
- **Renombrado:** `etl:balotaje-colo` → `etl:balotaje-2024-interior` (resuelve nota de nombre ambiguo del `deferred-work`).

### File List

- `etl/run-balotaje-interior.ts` (modified) — loop 18 deptos + param `preParsedRows`
- `package.json` (modified) — script `etl:balotaje-2024-interior` (reemplaza `etl:balotaje-colo`)
- `src/pages/[eleccion]/[departamento].astro` (modified) — `availableLevels` derivado de shards en disco (build-time)
- `src/config/departments.json` (modified) — `balotaje-2024` en los 17 deptos interiores restantes
- `public/data/balotaje-2024/{18 deptos interior}/votes.json` + `opciones.json` (new/regenerados)

### Change Log

- 2026-06-01 — Story creada (rebanada vertical del Épico 11). Status → in-progress.
- 2026-06-01 — Implementada: balotaje-2024 a los 18 deptos interior (gates 18/18) + niveles-por-elección derivados de disco (arregla break latente Colonia) + cableado en departments.json. Verificado build + browser. Status → done.
