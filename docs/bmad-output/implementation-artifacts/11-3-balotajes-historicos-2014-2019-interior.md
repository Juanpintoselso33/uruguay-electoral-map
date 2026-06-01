---
baseline_commit: 5c6e7c9
---

# Story 11.3: Balotajes históricos 2014/2019 al interior

Status: done

## Story

As a usuario del interior,
I want ver los balotajes 2014 y 2019 en mi departamento,
so that compare las segundas vueltas presidenciales históricas por zona.

## Acceptance Criteria

1. **Given** `balotaje-2014.csv` y `balotaje-2019.csv` (columnas de candidato propias por año) **When** corro el ETL por serie para los 18 deptos **Then** cada depto emite `votes.json` + `opciones.json` con el par de candidatos correcto del año.
2. **Given** cada depto **When** corro el ETL **Then** losslessness y cobertura pasan.
3. **Given** `departments.json` **When** agrego ambos balotajes a los 18 deptos **Then** las rutas SSG se generan.

## Tasks / Subtasks

- [x] **T1** — Reusa `aggregate-binaria-by-serie.ts` + `run-binaria-interior.ts` (mismo patrón que 11.2).
- [x] **T2** — `run-balotajes-historicos-interior.ts`: 2014 (Vázquez-Sendic / Lacalle Pou-Larrañaga), 2019 (Martínez-Villar / Lacalle Pou-Argimón) → `frente-amplio` / `partido-nacional`.
- [x] **T3** — `departments.json`: ambos balotajes en los 18 deptos.

## Dev Notes

- `opcionId` estable por lema (`frente-amplio` / `partido-nacional`), igual que `run-balotaje-historico-mvd.ts`. En 2024 el rival fue `coalicion-republicana`; pre-coalición es PN.
- No regenera geometría.

## Dev Agent Record

### Agent Model Used
claude-opus-4-8 (Claude Code)

### Completion Notes List
- **Gates 18/18 por año**, losslessness delta=0, placement ≤100%.
- **Ancla de cordura (cross-check, no tautológico):** totales interior 18 deptos — balotaje-2014 FA 53.6% (Vázquez ganó nacional), balotaje-2019 PN 55.4% (Lacalle Pou ganó; interior más blanco que el ~50.8% nacional). Direcciones correctas → sin swap de columnas.

### File List
- `etl/run-balotajes-historicos-interior.ts` (new)
- `package.json` (script `etl:balotajes-historicos-interior`)
- `src/config/departments.json` (modified — paridad interior)
- `public/data/{balotaje-2014,balotaje-2019}/{18 deptos}/` (new)

### Change Log
- 2026-06-01 — Implementada; gates 18/18 × 2 años; ancla de resultado nacional OK. Status → done.
