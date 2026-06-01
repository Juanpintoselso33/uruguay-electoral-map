---
baseline_commit: 5c6e7c9
---

# Story 11.4: nacionales-2019 al interior

Status: done

## Story

As a usuario del interior,
I want ver las nacionales 2019 en mi departamento,
so that tenga la elección presidencial/legislativa 2019 con la misma cobertura que 2024.

## Acceptance Criteria

1. **Given** `nacionales-2019-full/desglose-de-votos.csv` (schema idéntico a 2024: TipoRegistro/Departamento/Series/Lema/Descripcion1/CantidadVotos) **When** clono el patrón `run-nacionales-2024-interior.ts` apuntando a esa fuente **Then** los 18 deptos emiten `nacionales-2019` a nivel serie con sus gates.
2. **Given** `departments.json` **When** agrego `nacionales-2019` a los 18 deptos **Then** las rutas SSG se generan.

## Tasks / Subtasks

- [x] **T1** — `run-nacionales-2019-interior.ts` (clon de 2024: reusa `aggregateNacionalesSerie`, `reconcile`, `checkCoverage`; CSV = `nacionales-2019-full/`, ELECCION = `nacionales-2019`).
- [x] **T2** — `departments.json`: `nacionales-2019` en los 18 deptos.

## Dev Notes

- Verificado que `TipoRegistro` en 2019-full = `HOJA_EN`/`VOTO_LEMA` (igual que 2024) y los 19 deptos presentes → clon directo.
- `exteriorSerie` por depto idéntico a 2024 (las series son identificadores geográficos estables).
- No regenera geometría. (La granularidad HOJA legislativa de 10.7 para el interior queda fuera de alcance de esta story.)

## Dev Agent Record

### Agent Model Used
claude-opus-4-8 (Claude Code)

### Completion Notes List
- **18/18 deptos**, reconcile delta=0, placement ≤100% (98.6–100%), serie-fill ≥91.9%.
- Cierra la asimetría con nacionales-2024 (que ya estaba completo en 19): ahora 2019 y 2024 tienen la misma cobertura interior.

### File List
- `etl/run-nacionales-2019-interior.ts` (new)
- `package.json` (script `etl:nacionales-2019-interior`)
- `src/config/departments.json` (modified — paridad interior)
- `public/data/nacionales-2019/{18 deptos}/` (new)

### Change Log
- 2026-06-01 — Implementada; 18/18 reconcile delta=0. Status → done.
