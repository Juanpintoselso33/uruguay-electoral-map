---
baseline_commit: e4dbbc3
---

# Story 13.1: Decomiso de la comparación A/B

Status: done

## Story

As a usuario, I want que la UI no ofrezca la comparación dual A/B (no la usamos por ahora), so that el selector quede más simple.

## Acceptance Criteria

1. **Given** el `OpcionSelector` con chips "Comparar vs:" y el header dual A/B **When** decomiso la feature **Then** se quitan de la UI los chips, el header dual y sus handlers (`compararVs`/`salirDual`).
2. **Given** `[departamento].astro` **Then** se quita el import muerto de `CompareControls`.
3. **Given** la rama dual del desglose de la ficha (12.2) **Then** se retira.
4. **Given** `astro check` **Then** 0 errores.

## Dev Agent Record

### Agent Model Used
claude-opus-4-8 (Claude Code)

### Completion Notes List
- `OpcionSelector.vue`: eliminados header dual, chips "Comparar vs", `compararVs`/`salirDual`/`opcionPorId`, refs `cmpA`/`cmpB`, suscripción a `$comparison` y el import de `$comparison`. El `<template v-else>` se desenvolvió (ya no hay modo dual).
- `[departamento].astro`: removido el import de `CompareControls` (también resuelve el hint pre-existente "declared but never read").
- `ChoroplethMap.vue::selectByName`: retirada la rama dual `cmp.a && cmp.b` del desglose (queda acordeón HOJA > opción simple).
- `$comparison` (store) queda inerte; no se borra el contrato.
- `astro check`: 0 errores / 0 hints.

### File List
- `src/components/selectors/OpcionSelector.vue` (modified)
- `src/pages/[eleccion]/[departamento].astro` (modified)
- `src/components/map/ChoroplethMap.vue` (modified — rama dual del desglose retirada)

### Change Log
- 2026-06-01 — A/B decomisada de la UI. Status → done.
