---
baseline_commit: c35f404386d10e5306aca3eab5a99cc5bf7c38fd
---

# Story 7.5: UI — selector y ficha adaptados al tipo de elección

Status: done

## Story

As a usuario,
I want que el selector de opciones y la ficha de resultados se adapten al tipo de elección,
so that no vea opciones sin sentido (ej. selector de HOJA en un balotaje) y entienda el contexto (pregunta del plebiscito).

## Acceptance Criteria (de epics.md)

1. **Balotaje:** el selector muestra solo los candidatos (no el combo de HOJA) **y** la ficha muestra nombre del candidato y partido, no número de lista.
2. **Plebiscito:** el selector muestra Sí/No **y** el texto de la pregunta aparece como contexto.
3. **Internas/nacionales:** comportamiento actual preservado, sin regresión.

## Notas de implementación

- **AC1 y el selector de AC2 ya están entregados por Story 10.10** (acordeón plano para balotaje/plebiscito: balotaje → candidatos con color de partido; plebiscito → Sí/No verde/gris). La ficha de balotaje ya muestra el nombre del candidato (ganador = "Frente Amplio"/"Coalición Republicana"), no número de lista.
- **Gap real de 7.5:** surfacing de la **pregunta del plebiscito** como contexto, y robustez del índice de búsqueda (no tratar Sí/No como partido).

## Tasks / Subtasks

- [x] **T1** — Banner de pregunta del plebiscito (AC: 2)
  - [x] T1.1 — La página lee `pregunta` de `opciones.json` (build-time, `node:fs`, try/catch) para `plebiscito-*`/`referendum-*` y la muestra como banner de contexto ("Se vota Sí o No a: …") bajo el encabezado.
- [x] **T2** — Verificar ficha por tipo (AC: 1, 2, 3)
  - [x] T2.1 — Balotaje: la ficha (ganador) muestra el nombre del candidato/partido ("Frente Amplio"/"Coalición Republicana") y el selector los candidatos (Story 10.10), no "Lista N". Plebiscito: ficha y mapa muestran Sí/No (sigla por zona).
  - [x] T2.2 — El banner solo aparece para plebiscito/referéndum (requiere `opciones.json.pregunta`, que solo esos tienen) → internas/nacionales/balotaje/departamentales sin cambios.
- [x] **T3** — Índice de búsqueda: Sí/No ya NO se marca `type:'partido'` → `type:'opcion'`; además la **pregunta** del plebiscito se agrega como entrada buscable (`type:'pregunta'`). El `SearchBox` filtra/renderiza por label/sublabel y no ramifica por `type` → sin riesgo de render.

## Dev Notes (decisión)

- La pregunta es contexto GLOBAL del mapa (no per-zona), por eso va en un banner de página siempre visible (mejor UX que repetirla en cada ficha de zona). Cumple "la pregunta aparece como contexto" del AC.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code)

### Completion Notes List

- **Gran parte de 7.5 ya estaba** (selector adaptado por tipo) gracias a Story 10.10. El trabajo nuevo fue el contexto del plebiscito + robustez del índice de búsqueda.
- **Banner de pregunta** verificado en browser: `/plebiscito-allanamientos-2024/montevideo` muestra "Se vota Sí o No a: ¿Aprueba la reforma del artículo 11…?" en caja verde; mapa con No ganador y Sí solo en la costa este (coherente con 35.8% MO). 0 errores de consola.
- **Índice de búsqueda:** Sí/No pasó de `type:'partido'` a `'opcion'`; la pregunta es buscable (`type:'pregunta'`). El `SearchBox` no usa `type` para render → cambio seguro.
- `astro check` 0/0/0. Sin regresión en internas/nacionales/balotaje/departamentales (el banner es condicional a `opciones.json.pregunta`).

### File List

- `docs/bmad-output/implementation-artifacts/7-5-ui-selector-ficha-por-tipo.md` (new) — story.
- `src/pages/[eleccion]/[departamento].astro` (modified) — banner de pregunta (build-time read de `opciones.json`).
- `scripts/generate-search-index.mjs` (modified) — Sí/No `type:'opcion'`; pregunta buscable `type:'pregunta'`.
- `public/search-index.json` (regenerado).

### Review Follow-ups (AI)

- [x] **[AI-Review][Important]** `generate-search-index.mjs` hacía `readFileSync` sin guarda → una ruta sin `opciones.json` rompería el build (ENOENT). **Corregido:** try/catch + `continue` con warning (mismo patrón graceful que la página).
- [x] **[AI-Review][Important]** El label del `SearchBox` ("Buscar departamento o partido") quedó incompleto al hacer buscables preguntas/Sí-No. **Corregido:** "Buscar departamento, partido o plebiscito".

### Change Log

- 2026-05-31 — Banner de contexto con la pregunta del plebiscito; índice de búsqueda no marca Sí/No como partido y hace buscable la pregunta. AC1/selector ya cubierto por 10.10. Verificado en browser. Status → review.
- 2026-05-31 — Code review (feature-dev:code-reviewer): 0 Critical, 2 Important (guard del search-index + label del SearchBox) corregidos. Status → done.
