---
baseline_commit: 6011922
---

# Story 12.2: Desglose de la selección en la ficha para todos los caminos

Status: done

## Story

As a usuario, I want que al tocar una zona vea el desempeño de lo que tengo seleccionado ahí (cada lista/opción, agrupado por partido, con total), so that tenga la misma lectura por zona que daba el legacy, sin importar el tipo de elección.

## Acceptance Criteria

1. **Given** una selección activa (HOJA múltiple, opción simple, candidato balotaje, Sí/No plebiscito) y una zona tocada **When** se abre la ficha **Then** muestra el desglose de la selección en esa zona (grupo por partido/opción, votos por ítem, total + % sobre válidos).
2. **Given** sin selección **Then** la ficha mantiene el comportamiento actual (ganador + válidos/blanco/anulados/observados).
3. **Given** un tipo plano **Then** el desglose se resuelve desde `votes.json` (no pide shards de HOJA inexistentes).
4. **Given** comparación dual A/B **Then** la ficha refleja el desglose de a+b (cuando sus votos están disponibles).

## Tasks / Subtasks

- [x] **T1** — `buildDesglose`: las opciones planas (sin `lemaId`) arman su propio grupo (sin sub-hojas), con nombre desde `opcNombreMap` y color/sigla vía `resolveParty`.
- [x] **T2** — `selectByName`: unificar la selección de la ficha → `selFicha = seleccionActiva` (acordeón) | `[a,b]` (dual) | `[opcion]` (simple). `desg` se gatea por `grupos.length>0`; `pctOpcionActiva` queda como fallback sin desglose (evita redundancia).
- [x] **T3** — Verificación: `astro check` 0 errores + browser.

## Dev Agent Record

### Agent Model Used
claude-opus-4-8 (Claude Code)

### Completion Notes List

- Cambios solo en `ChoroplethMap.vue` (la UI de `ZoneSheet.vue` ya soportaba el render del desglose desde 10.5 — no se tocó).
- **Verificado en browser** (balotaje-2024/salto, plano, FA seleccionado vía selector simple): la ficha de "Pueblo Cayetano · JFC" muestra "Tu selección en esta zona: 32 votos · 47.1%" + grupo "FA · Frente Amplio · 32". Válidos 68 = FA 32 + CR 36 ✅. Antes este camino solo mostraba la línea de %.
- Sin selección: sin regresión (desglose oculto, ganador + totales).
- `astro check`: 0 errores.
- Nota: dual A/B en elecciones HOJA depende de que los shards de a/b estén cargados; para tipos planos (el caso común de comparación) sale de `zonasVotos`. 

### File List
- `src/components/map/ChoroplethMap.vue` (modified) — `buildDesglose` (grupos para opciones planas) + `selectByName` (selección unificada para la ficha)

### Change Log
- 2026-06-01 — Implementada; desglose de selección en la ficha para selector simple/dual/plano, verificado en browser. Status → done.
