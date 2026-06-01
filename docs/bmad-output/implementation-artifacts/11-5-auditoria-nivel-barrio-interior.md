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

**Conclusión (corregida 2026-06-01 tras revisar la Story 8.5): Story 8.5 está `done` y entregó lo que scopeó — NO es deuda en progreso.** Detalle:
- 8.5 completó barrio para **8 ciudades** (Salto MVP + Artigas, Melo, Durazno, Paysandú, San José de Mayo, Treinta y Tres, Rivera).
- **Lavalleja (Polanco del Yi, 0.5%) y Soriano (José E. Rodó, 3.4%) se excluyeron a propósito** por cobertura insignificante → por diseño, no deuda. (Tienen mapping serie→barrio pero sin geometría.)
- Las capitales grandes restantes (Maldonado/Punta del Este, Las Piedras-Ciudad de la Costa/Canelones, Tacuarembó, Rocha, Fray Bentos, Florida, Trinidad, Colonia del Sacramento, Minas, Mercedes) **no formaron parte del alcance entregado de 8.5** → completarlas sería una **nueva story** (mismo patrón 8.5: geocodificar locales del plan circuital + geometría), NO "8.5 sin terminar".

El nivel barrio es una mejora opcional sobre serie/localidad. El fix de niveles-por-elección de la Story 11.1 hace que toda elección×depto sin barrio **degrade limpio a serie**, así que no hay rutas rotas en ningún caso.

## Dev Agent Record

### Agent Model Used
claude-opus-4-8 (Claude Code)

### Change Log
- 2026-06-01 — Investigación completada; deuda parcial de 8.5 documentada (ver también deferred-work.md). Status → done.
