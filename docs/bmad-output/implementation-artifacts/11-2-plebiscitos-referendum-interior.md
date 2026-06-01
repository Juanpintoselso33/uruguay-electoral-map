---
baseline_commit: 5c6e7c9
---

# Story 11.2: Plebiscitos 2024 + Referéndum LUC 2022 al interior

Status: done

## Story

As a usuario del interior,
I want ver cómo votó mi departamento los plebiscitos 2024 y el referéndum LUC 2022,
so that explore esas consultas nacionales donde viví.

## Acceptance Criteria

1. **Given** los CSV de plebiscitos-2024 y referéndum-LUC-2022 (con `Serie` y conteo Sí/No) **When** corro el ETL Sí/No por serie para los 18 deptos del interior **Then** cada depto emite `votes.json` (serie) + `opciones.json` (pregunta + Sí/No) para las 3 contiendas.
2. **Given** cada depto **When** corro el ETL **Then** el gate de losslessness (Σ válidos shard == Σ válidos CSV) y el de cobertura serie↔geometría pasan.
3. **Given** `departments.json` **When** agrego las 3 elecciones a los 18 deptos **Then** las rutas SSG se generan y el selector plano (10.10) + ficha funcionan en el interior.

## Tasks / Subtasks

- [x] **T1** — Aggregator genérico de 2 opciones por serie (`aggregate-binaria-by-serie.ts`), con pro-rata de series combinadas; devuelve `totalValidos` (losslessness) y `totalCanonico` (cobertura).
- [x] **T2** — Runner compartido `lib/run-binaria-interior.ts` (loop elección × 18 deptos + gates).
- [x] **T3** — `run-plebiscitos-referendum-interior.ts`: allanamientos (SiArt11), seguridad-social (SiArt67) con No derivado (válidos−Sí); referéndum (Total_SI/Total_NO). 3×18 = 54 combinaciones, gates 18/18 c/u.
- [x] **T4** — `departments.json`: 3 elecciones en los 18 deptos.

## Dev Notes

- Plebiscitos 2024: no hay papeleta "No" → Sí = SiArt{N}; No = `TotalVotosNoObservados` − Sí. Referéndum: Sí/No explícitos.
- `opcionId`/nombres/preguntas replican los shards de Montevideo (consistencia de leyenda).
- No regenera geometría (reusa `serie.topo.json`).

## Dev Agent Record

### Agent Model Used
claude-opus-4-8 (Claude Code)

### Completion Notes List
- **Gates 18/18 por elección**, losslessness delta=0, placement ≤100% (98.4–100%), serie-fill ≥82%.
- **Bug encontrado y corregido en verificación:** `checkCoverage` cuenta `validos + noPartidarios`; el denominador debía ser el total emitido completo (`totalCanonico`), no solo válidos — sin el fix daba placement >100%.
- Verificado en browser (allanamientos/salto): banner de pregunta, selector "Opción (Sí / No)", "Series"[pressed]/"Circuito"[disabled], mapa + tabla "41 series".

### File List
- `etl/transform/aggregate-binaria-by-serie.ts` (new)
- `etl/lib/run-binaria-interior.ts` (new)
- `etl/run-plebiscitos-referendum-interior.ts` (new)
- `package.json` (script `etl:plebiscitos-referendum-interior`)
- `src/config/departments.json` (modified — paridad interior)
- `public/data/{plebiscito-allanamientos-2024,plebiscito-seguridad-social-2024,referendum-luc-2022}/{18 deptos}/` (new)

### Change Log
- 2026-06-01 — Implementada; gates 18/18 × 3 elecciones; verificada en build + browser. Status → done.
