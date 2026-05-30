---
baseline_commit: 55a5a1c01e84faa765fb1c34069a106603e8a04e
---

# Story 1.9: Tabla de datos accesible del mapa

Status: done

## Story
As a usuario de lector de pantalla, I want una tabla equivalente al mapa, so that acceda a los resultados sin depender de la visualización.

## Acceptance Criteria
1. **Given** los datos de la vista **When** se renderiza la página (HTML estático, componente Astro) **Then** existe una tabla navegable por teclado con zona → ganador → votos → % (WCAG 1.1.1).
2. **Given** la tabla **Then** refleja el mismo dato que el mapa.

## Tasks / Subtasks
- [x] **Task 1: Componente Astro estático (AC: 1, 2)**
  - [x] `src/components/a11y/DataTable.astro`: lee en build los MISMOS shards que el mapa (votes.json + opciones.json) → mismo dato por construcción.
  - [x] Tabla semántica: `<caption>`, `th scope=col`/`th scope=row`, columnas Barrio → Ganador (sigla+nombre) → Votos → % válidos → Válidos. Sin JS (HTML estático).
  - [x] En `<details>` (keyboard + screen-reader accesible). Incluida en `[eleccion]/[departamento].astro`.
- [x] **Task 2: Verificación (AC: 1, 2)**
  - [x] `astro check` 0 · `npm run build` verde · HTML generado contiene 48 filas (`th scope=row`) = 48 barrios del mapa, caption presente.

## Dev Notes
- Arquitectura: "la tabla accesible = HTML estático, no isla". Cero JS, alternativa textual WCAG 1.1.1 del choropleth.
- Mismo dato que el mapa: ambos consumen `votes.json` + `opciones.json`. % = votos del ganador / válidos.
- Refs: [epics.md#Story 1.9] · [architecture.md#a11y/DataTable.astro] · [1-6 datos] · [1-8 mapa].

## Dev Agent Record
### Agent Model Used
Amelia — claude-opus-4-8[1m]
### Completion Notes List
- Tabla accesible estática (48 barrios) renderizada en build, mismo dato que el mapa, navegable por teclado, WCAG 1.1.1.
### Senior Developer Review (AI)
**2026-05-30 · inline · APPROVED.** AC1 (tabla estática keyboard-navegable zona→ganador→votos→%) ✅, AC2 (mismo dato que el mapa, misma fuente) ✅. HTML estático sin JS. Sin findings.
### File List
**Nuevos:** `src/components/a11y/DataTable.astro`
**Modificados:** `src/pages/[eleccion]/[departamento].astro` (incluye DataTable)
### Change Log
- Tabla de datos accesible (HTML estático, build-time) equivalente al mapa.
