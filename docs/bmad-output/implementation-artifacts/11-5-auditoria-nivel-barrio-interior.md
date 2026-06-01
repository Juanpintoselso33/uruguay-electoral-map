---
baseline_commit: 5c6e7c9
---

# Story 11.5: Auditoría del nivel barrio en el interior (¿deuda o diseño?)

Status: done

## Story

As a desarrollador,
I want saber por qué solo 8/18 deptos del interior tienen nivel barrio,
so that decida si es deuda a completar o una decisión de diseño a documentar.

## Acceptance Criteria

1. **Given** que 8 de 18 deptos tienen `votes-barrio.json` **When** investigo el rollout serie→barrio y la geometría disponible **Then** documento si los 10 restantes carecen de barrio por deuda o por diseño **And** queda registrado.

## Hallazgos (investigación)

Los **8 deptos con `barrio.topo.json`** (artigas, cerro_largo/Melo, durazno, paysandu, rivera, salto, san_jose/San José de Mayo, treinta_y_tres) son **exactamente** donde la **Story 8.5** (mapeo manual SERIE→barrio para ciudades grandes) completó la geometría de barrio de la capital.

Estado de los 10 restantes:
- **Con mapping serie→barrio pero SIN geometría** (parcial): lavalleja (Polanco), soriano (José Enrique Rodó) — mappings de localidades chicas, sin `barrio.topo.json` generado.
- **Sin trabajo de barrio**: canelones, maldonado, colonia, florida, flores, rio_negro, rocha, tacuarembo — incluye capitales grandes (Maldonado/Punta del Este, Colonia, Las Piedras) que serían candidatas naturales.

**Conclusión: deuda parcial de Epic 8.5 (rollout en progreso), NO regresión de Epic 11.** El nivel barrio es una mejora opcional sobre serie/localidad para capitales con división barrial. El fix de niveles-por-elección de la Story 11.1 hace que toda elección×depto sin barrio **degrade limpio a serie** (el selector solo ofrece niveles con dato), así que no hay rutas rotas. Completar barrio para más capitales es trabajo futuro de tipo Epic 8.5, no de este épico.

## Dev Agent Record

### Agent Model Used
claude-opus-4-8 (Claude Code)

### Change Log
- 2026-06-01 — Investigación completada; deuda parcial de 8.5 documentada (ver también deferred-work.md). Status → done.
