---
baseline_commit: e4dbbc3
---

# Story 13.2: Toggle de coloreo — {Ganador, Share %, Heatmap} con ganador entre lo seleccionado

Status: done

## Story

As a usuario, I want elegir entre ver el ganador de mi selección (con banderas), el share % o el heatmap, so that lea el mapa de mi selección como me sirva, sin un modo redundante.

## Acceptance Criteria

1. **Given** una selección múltiple activa **When** abro el conmutador **Then** las opciones son `Ganador` / `Share %` / `Heatmap` (se elimina `Votos`).
2. **Given** modo `Ganador` **Then** cada zona se colorea con la opción seleccionada con más votos ahí (color de partido + bandera vía `drawFlagOverlay`); la leyenda lista las opciones que lideran ≥1 zona.
3. **Given** `Share %` / `Heatmap` **Then** mantienen su comportamiento.
4. **Given** una URL vieja con `modo=votos` **Then** degrada a un modo válido (no rompe).
5. **Given** `astro check` **Then** 0 errores + verificación en browser.

## Tasks / Subtasks

- [x] **T1** — `coloreoMode` tipado a `'ganador' | 'share' | 'heatmap'`; se elimina `'votos'` de `buildSeleccionFC`/`rebuildSelMarkers`/`buildSeleccionLegend`/`setColoreo` y de la validación de `modo` en subscribe/init (URL `votos` → no matchea → default).
- [x] **T2** — `buildSeleccionGanadorFC` + `buildSeleccionGanadorLegend` + helper `ganadorSelDeZona`: argmax de votos entre las opciones seleccionadas por zona; color/sigla/bandera vía `nombrePartidoDeOpcion` (HOJA → lema del catálogo; plano → opciones.json) + `resolveParty`.
- [x] **T3** — `applySeleccion`: rama `ganador` (FC ganador + `setPatternVisible(true)` para banderas + leyenda de ganador). Toggle UI `['ganador','share','heatmap']`.

## Dev Agent Record

### Agent Model Used
claude-opus-4-8 (Claude Code)

### Completion Notes List
- **Bug atrapado en verificación:** la leyenda/color del modo ganador mostraba el `opcionId` crudo (`odn-frente-amplio-90`) porque `opcNombreMap` (de opciones.json) no tiene los ids de HOJA. Fix: `nombrePartidoDeOpcion` resuelve el nombre del lema desde `catalogoOpcMeta` para HOJA y cae a `opcNombreMap` para tipos planos.
- **Verificado en browser** (internas-2024/montevideo, sel = FA-90 + Nacional-1007, `modo=ganador`): toggle muestra `Ganador [pressed] / Share % / Heatmap` (sin Votos); mapa coloreado por ganador con banderas; leyenda "FA · Frente Amplio" (FA lidera las 61 zonas con esa selección).
- `Votos` eliminado (redundante con `Heatmap`, decisión de Juan). `astro check` 0/0/0.

### File List
- `src/components/map/ChoroplethMap.vue` (modified) — toggle {Ganador, Share %, Heatmap}, `buildSeleccionGanadorFC`/`buildSeleccionGanadorLegend`/`ganadorSelDeZona`/`nombrePartidoDeOpcion`, rama ganador en `applySeleccion`, eliminado modo `votos`.

### Change Log
- 2026-06-01 — Toggle reworkeado (Ganador/Share/Heatmap) + modo ganador-entre-seleccionado con banderas, verificado en browser. Status → done.
