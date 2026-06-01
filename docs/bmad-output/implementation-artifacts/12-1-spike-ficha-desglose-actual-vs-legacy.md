---
baseline_commit: 6011922
---

# Story 12.1: Spike — ficha de zona, comportamiento actual vs legacy

Status: done

## Story

As a desarrollador, I want confirmar en qué caminos de selección aparece (o no) el desglose por zona y cómo lo hacía el legacy, so that la implementación cubra todos los casos sin romper el caso "sin selección".

## Hallazgos

**Legacy** (`legacy/src/composables/useTooltipContent.ts`): al interactuar con un polígono, el tooltip mostraba el desglose de las listas/candidatos **seleccionados** en esa zona, agrupado por partido (partido: total → cada lista/candidato: votos → Total).

**Rebuild hoy:**
- `ZoneSheet.vue` tiene el bloque `desglose` ("Tu selección en esta zona" + grupos por lema con hojas + total) — Story 10.5. La UI ya soporta el render.
- `ChoroplethMap.vue::selectByName` poblaba `desg` **solo desde `seleccionActiva`** (el array `seleccion[]` del acordeón de HOJA). 
- El selector simple `OpcionSelector` (elecciones planas: balotaje/plebiscito/referéndum) setea `opcion` singular → la ficha mostraba solo `pctOpcionActiva` ("{sigla} en esta zona: {pct}%"), **sin desglose**.
- Comparación dual A/B (`$comparison.a/b`) tampoco alimentaba el desglose.

**Dato disponible para implementar:** `zonasVotos` (Map zona→opción→votos del `votes.json` base) tiene TODAS las opciones de los tipos planos; `opcNombreMap` (opcionId→nombre, de `opciones.json`) ya está cargado en `loadData`. `buildDesglose` ya sumaba los planos al total pero no les armaba grupo.

**UX objetivo definida:** cuando hay cualquier selección activa (HOJA múltiple, opción simple, candidato balotaje, Sí/No plebiscito, dual A/B), la ficha muestra el desglose de lo seleccionado en esa zona (grupo por partido/opción, votos, total + % sobre válidos). Sin selección: ficha actual (ganador + totales). Tipos planos resuelven desde `votes.json` (no piden shards de HOJA inexistentes).

## Change Log
- 2026-06-01 — Spike completado (investigación de código + referencia legacy). Status → done.
