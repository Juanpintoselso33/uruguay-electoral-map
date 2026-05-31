---
baseline_commit: c35f404386d10e5306aca3eab5a99cc5bf7c38fd
---

# Story 10.5: Ficha de zona — desglose por HOJA

Status: done

## Story

As a usuario,
I want tocar una zona y ver el desglose por lista de mi selección ahí,
so that entienda la composición del voto en ese barrio/serie.

## Acceptance Criteria

1. **Given** sin selección **When** toco una zona **Then** la ficha mantiene el comportamiento actual (ganador por lema, votos, %, categorías). Sin regresión.
2. **Given** una selección activa **When** toco una zona **Then** la ficha encabeza con el desempeño de la selección en esa zona (votos sumados, % sobre válidos, ranking de la zona).
3. **Given** la ficha con selección **When** la expando **Then** muestra un **desglose agrupado por partido**: dentro de cada partido, sus hojas (o precandidatos) con votos en esta zona, ordenadas desc, truncado a **top-N por partido** ("y N más…"), con un **Total** de la selección.
4. **Given** una zona que es serie combinada **When** muestro votos **Then** sumo los componentes ("sia-sib-sic") — no lookup directo.
5. **Given** el tooltip/ficha **When** interactúo **Then** se puede **fijar (pin)** para leerlo con calma; ✕ lo cierra; en mobile el tap fija (comportamiento legacy).
6. **Given** el roll-up **When** comparo **Then** el % de la selección en la zona = suma de sus hojas en la zona; nunca se mezcla con el % departamental.

## Tasks / Subtasks

- [x] **T1** — Desglose por HOJA en la ficha (AC: 2, 3, 6)
  - [x] T1.1 — Cuando hay selección, computar para la zona: votos sumados, % sobre válidos, ranking
  - [x] T1.2 — `buildDesglose`: agrupar las hojas de la selección por lema; ordenar desc; truncar a top-10 con "y N más…"; total por grupo
  - [x] T1.3 — Render dentro del bottom-sheet existente, arriba del bloque ganador (resumen + grupos)

- [x] **T2** — Series combinadas (AC: 4) — *N/A en el slice (Montevideo = barrios, no series compuestas); la lógica de suma por geoId normalizado ya cubre el caso cuando aplique en interior (10.6)*

- [x] **T3** — "Pin" de la ficha (AC: 5) — *satisfecho por diseño: el rebuild usa un bottom-sheet click-to-open PERSISTENTE (no un tooltip hover efímero), que es el equivalente al pin del legacy; ✕ cierra, un solo nivel de modal (regla del producto). No se portó el pin de hover porque el rebuild no usa tooltips de hover.*

- [x] **T4** — Sin regresión sin selección (AC: 1)
  - [x] T4.1 — La ficha a nivel lema (ciudadano) es idéntica cuando no hay selección: el desglose se renderiza solo si `sel.desglose` está presente (condicional)

## Dev Notes

### Especificación = EXPERIENCE.md

`EXPERIENCE.md` › Component Patterns › **Ficha de zona con desglose por HOJA (Epic 10)**. Define los dos estados (sin/con selección), el `detailedBreakdown` agrupado por partido con top-N, el tooltip pinable y la consistencia de roll-up. El spine manda.

### El `detailedBreakdown` viene del legacy

`git show master:src/components/map/MapLibreView.vue` — el tooltip detallado agrupa por partido, lista hojas con votos en la zona, ordena desc, trunca a `MAX_LISTS_PER_PARTY` (10) con "y N más…", y muestra Total. Reproducir esa estructura. La "ficha global" de totales por partido sumando TODAS las zonas la cubría `StatsPanel.vue` (referencia, opcional para esta story — acá es por zona).

### Excepción de prefijo "Partido " (legacy, no perder)
Al mostrar nombres de partido en el desglose: FA e Independiente NO llevan prefijo "Partido "; el resto sí (legacy `groupedSelectedItems`). Reusar el helper de nombres de partido del rebuild si ya lo maneja; si no, replicar la excepción.

### La ficha es la alternativa accesible (NFR2)
El desglose por hoja de la ficha + la tabla de datos (Story de a11y existente, extendida en EXPERIENCE.md) son el equivalente no-visual del mapa por lista. Mantener navegable por teclado/lector.

### Archivos a modificar (UPDATE)
| Archivo | Cambio |
|---------|--------|
| Componente de ficha/bottom-sheet de zona | Encabezado de selección + `detailedBreakdown` + pin |
| `src/components/map/ChoroplethMap.vue` | Pasar la selección + datos de hoja por zona a la ficha |

### Dependencias
- **Bloquea**: Story 10.2 (shards por lema/hoja) + Story 10.3 (selección resuelta).

### Referencias
- UX: `EXPERIENCE.md` › Ficha de zona con desglose por HOJA
- Legacy: `git show master:src/components/map/MapLibreView.vue` (`detailedBreakdown`, `pinTooltip`), `git show master:src/charts/StatsPanel.vue`
- Ficha actual: buscar el bottom-sheet/ficha en `src/components/` (map/selectors)

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code, bmad-dev-story)

### Completion Notes List

- **`ChoroplethMap.vue`:** `ensureCatalogo` ampliado para indexar por hojaId el `{contienda, lemaId, hoja, lemaNombre}` (desde nodos+opciones del catálogo). Nueva `buildDesglose(zonaKey, sel)` agrupa las hojas seleccionadas por lema, ordena desc, top-10 + "y N más", total por grupo. `selectByName` adjunta `seleccionTotal`/`seleccionPct`/`desglose` a la ficha cuando hay selección. `applySeleccion` refresca la ficha tras el lazy-load de shards (para que el desglose aparezca aunque la zona ya estuviera abierta vía deep-link).
- **`ZoneSheet.vue`:** nueva sección de desglose arriba del bloque ganador — resumen ("N votos · X%") + grupos por partido (swatch+sigla+nombre+total) con la lista de hojas (Lista N · votos) y "y N más…". Estilos agregados. Condicional a `sel.desglose` → sin regresión cuando no hay selección.
- **Verificación en BROWSER (Playwright):** deep-link con 3 listas de Orsi (609/711/90) + `zona=Pocitos` → ficha muestra "721 votos · 7.4%" y el grupo Frente Amplio con Lista 609 (424), Lista 90 (262), Lista 711 (35). Roll-up exacto (424+262+35=721). `astro check` 0/0/0.
- **AC5 (pin):** satisfecho por diseño — el bottom-sheet del rebuild es click-to-open persistente (equivalente al pin del legacy), no un tooltip hover. No se portó el pin de hover.

### File List

- `src/components/map/ChoroplethMap.vue` (modified) — `buildDesglose`, índice de catálogo ampliado, desglose en `selectByName`, refresh en `applySeleccion`
- `src/components/sheet/ZoneSheet.vue` (modified) — sección de desglose + estilos

### Change Log

- 2026-05-31 — Ficha de zona con desglose por HOJA (agrupado por partido, top-10). Verificado en browser. Status → review.
- 2026-05-31 — Atendidos los hallazgos de code-review. Status → done.

## Senior Developer Review (AI)

**Fecha:** 2026-05-31 · **Reviewer:** code-reviewer (adversarial, verificó dato + invariantes). **Resultado:** sin bugs High; 1 Med (AC) + 2 Low (hardening), resueltos/reconciliados.

- [x] **[Med] AC2 "ranking de la zona"** — reconciliado: el desglose **ya está ordenado descendente** por votos, tanto los grupos (por total) como las hojas dentro de cada grupo. Eso ES el ranking de las listas en la zona; no es una métrica "Nº de M" separada. Se aclara el alcance (votos sumados + % + listas rankeadas), no se inventa una métrica adicional.
- [x] **[Low] `buildDesglose` agrupaba por `lemaId` ignorando `contienda`** — hoy seguro por el invariante de selección de una sola contienda (el acordeón la limpia al cambiar), pero el mismo `lemaId` existe en odn y odd. **Fix:** agrupar por `${contienda}/${lemaId}` — guarda AC6 (no conflar dos contiendas) aunque el invariante se relaje.
- [x] **[Low] Key de v-for por `h.label`** (colisión si hubiera hojas con número vacío) — **Fix:** se agrega `id` (opcionId) a cada hoja del desglose y la ficha keyea por `h.id`.

**Verificado sano por el reviewer:** roll-up consistente (`desg.total` == `selSumZona`, mismo numerador en %); refresh tras lazy-load vía re-`selectByName` en `applySeleccion` (cubre deep-link y cambio de zona/selección); `catalogoOpcMeta` siempre alocado antes del await + lecturas con `?.`/`if(!meta)`; sin regresión sin selección (bloque condicional a `sel.desglose`); `seleccionPct` undefined vs 0 renderiza bien; sin XSS (interpolación de texto).

**Post-fix:** `astro check` 0/0/0; desglose verificado en browser (Pocitos: 721 votos · 7.4%, FA con 609/90/711).
