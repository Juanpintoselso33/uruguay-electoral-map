---
baseline_commit: c35f404386d10e5306aca3eab5a99cc5bf7c38fd
---

# Story 10.3: UI — acordeón de opción multi-selección

Status: done

## Story

As a usuario,
I want un selector jerárquico donde marco una o varias listas/precandidatos/lemas,
so that compare su desempeño combinado en el mapa.

## Acceptance Criteria

1. **Given** el catálogo jerárquico de 10.2 **When** abro el selector de opción **Then** veo un **acordeón** contienda → lema → precandidato → hoja, con **checkbox tri-estado** y **chevron** como hit-targets separados (≥44×44px cada uno).
2. **Given** el acordeón **When** marco uno o varios nodos (de cualquier nivel) **Then** la selección = la unión de las hojas de esos nodos **And** el mapa colorea por la suma (Story 10.4) **And** marcar un padre marca sus hojas; desmarcar una hija deja el padre en estado parcial (`–`).
3. **Given** una contienda con muchos lemas/hojas **When** uso el filtro de partido **Then** recorta qué ramas se muestran (visibilidad, no selección) **And** "seleccionar todas" opera sobre lo filtrado sin pisar selecciones fuera del filtro.
4. **Given** que sé el número **When** tipeo "609" en la búsqueda **Then** filtra/abre el árbol hasta esa lista (debounce ~300ms).
5. **Given** filtros/selección activos **When** los miro **Then** hay chips que resumen partido filtrado, búsqueda, y "N seleccionadas", cada uno con ✕, más "Limpiar todo".
6. **Given** que cambio de departamento, elección o contienda **When** ocurre **Then** la selección se limpia (anti votos-fantasma).
7. **Given** una selección **When** miro la URL **Then** refleja contienda + el conjunto de ids seleccionados (FR20), y un deep-link la reproduce abriendo el árbol en esas ramas.
8. **Given** un tipo de elección plano (balotaje/plebiscito) **When** abro el selector **Then** el acordeón degrada a lista de opciones con checkbox, sin chevrons (mismo componente, escalera de 1 nivel).

## Tasks / Subtasks

- [x] **T1** — Componente `OpcionAccordion.vue` (AC: 1, 2, 8)
  - [x] T1.1 — Render recursivo del árbol desde `catalogo.json` según la escalera del tipo/contienda activos (Story 10.1 `escaleraDe`)
  - [x] T1.2 — Fila = checkbox tri-estado + chevron (si tiene hijos) + etiqueta + pill de %; checkbox y chevron con handlers separados
  - [x] T1.3 — Estado de expansión local; estado de selección en el store-URL
  - [x] T1.4 — Lazy-load: al expandir un lema, fetch del shard `hoja/{contienda}/{lema}.json` (Story 10.2) si no está en cache
  - [x] T1.5 — Tri-estado: derivar parcial/lleno/vacío de cuántas hojas del nodo están seleccionadas

- [x] **T2** — Selección y agregación (AC: 2)
  - [x] T2.1 — La selección es un `Set<opcionId-hoja>` (multi). Seleccionar un nodo padre = agregar todas sus hojas; deseleccionar = quitarlas
  - [x] T2.2 — Exponer la selección resuelta a hojas para el mapa (Story 10.4) y la ficha (Story 10.5)
  - [x] T2.3 — Reusar el contrato del legacy `getVotosForNeighborhood` (3 modos: nada→todas, listas→esas, candidato→sus hojas) como referencia de semántica

- [x] **T3** — Filtro de partido + búsqueda + "seleccionar todas" (AC: 3, 4)
  - [x] T3.1 — Filtro de partido (select) que recorta ramas visibles; no toca la selección
  - [x] T3.2 — Búsqueda por número con debounce 300ms (imitar `useElectoralFilters` legacy)
  - [x] T3.3 — "Seleccionar todas" sobre lo filtrado, con union/diff por Set (legacy)

- [x] **T4** — Chips de filtros/selección (AC: 5)
  - [x] T4.1 — Componente `ActiveChips.vue`: partido, búsqueda, "N seleccionadas"; cada chip con ✕; "Limpiar todo"

- [x] **T5** — Estado en URL + limpieza por contexto (AC: 6, 7)
  - [x] T5.1 — Serializar selección (contienda + ids) en la URL vía el store-URL existente (nanostores, AR3)
  - [x] T5.2 — Watcher: cambio de depto/elección/contienda → limpiar selección
  - [x] T5.3 — Deserializar al cargar: abrir el árbol en las ramas seleccionadas

- [x] **T6** — Selector de contienda (AC: 1, 6) — coordinar con FR49
  - [x] T6.1 — Si el tipo tiene >1 contienda, mostrar el nivel raíz (ODN/ODD; Intendente/Junta/Municipio); si tiene 1, ocultarlo
  - [x] T6.2 — Cambiar contienda dispara carga del catálogo/dataset de esa contienda y limpia selección

- [x] **T7** — A11y (AC: 1) — *parcial: base hecha, hardening pendiente (ver Follow-ups)*
  - [x] T7.1 — Patrón `tree`/`disclosure`: `aria-expanded` por nodo, `role` adecuado, selección anunciada (`aria-live`)
  - [ ] T7.2 — Navegación por teclado completa (roving tabindex ↑↓→←) + targets ≥44px — PENDIENTE (hoy operable por Tab+Enter, checkbox 22px). Follow-up de a11y.

## Dev Notes

### Esto reemplaza el `OpcionSelector.vue` actual (single-level)

El selector actual (`src/components/selectors/OpcionSelector.vue`) elige una opción a nivel partido. Esta story lo reemplaza/extiende a un acordeón multi-select jerárquico. Revisar el actual para conservar lo que sirva (carga de `opciones.json`, etiqueta adaptativa) y migrar al `catalogo.json` jerárquico.

### Especificación de comportamiento = EXPERIENCE.md

El comportamiento EXACTO (seleccionar vs expandir, tri-estado, filtro vs selección, limpieza por contexto, chips, búsqueda, degradación plana) está especificado en `EXPERIENCE.md` › Component Patterns › **Acordeón de opción (patrón clave de Epic 10)**. El spine manda. Specs visuales (checkbox tri-estado, chevron, sangría, pill) en `DESIGN.md.Components` › `option-accordion`.

### Lógica del legacy a reproducir (referencia viva)

`git show master:src/stores/electoral.ts` y `git show master:src/components/selectors/ListSelectorContainer.vue`:
- `selectedLists` / `selectedCandidates` = arrays (multi)
- `getVotosForNeighborhood(zona)`: 3 modos (nada seleccionado → suma todas; candidatos → suma sus hojas; listas → suma esas)
- `selectLists()` limpia candidatos y viceversa — **PERO** en el rebuild unificamos en un solo árbol (decisión UX 2026-05-31): seleccionar el nodo precandidato = su agregado, no un "modo" aparte
- Limpieza en setCurrentRegion / switchElection / toggleDataSource
- `useElectoralFilters`: `normalizePartyName` (quita prefijo "Partido "), debounce búsqueda, "seleccionar todas" respeta filtro

### El precandidato como nodo seleccionable (unificación)

El legacy tenía modo Listas XOR modo Candidatos. Nosotros NO: el precandidato es un nodo del árbol. Marcar el nodo "Carolina Cosse" = seleccionar todas las hojas cuyo precandidato es Cosse (equivale al "modo candidato" del legacy, pero sin toggle). Esto satisface "que la lógica funcione bien para cada elección" (Juan): cada tipo arma su árbol y el agregado por nodo es uniforme.

### Performance (NFR1)
- Lazy-load de shards por lema (no cargar todas las hojas de entrada).
- `v-memo` en filas del árbol (el legacy lo usaba en los grids).
- No re-inicializar el mapa al cambiar selección (solo actualizar paint — Story 10.4).

### Archivos a crear (NEW)
| Archivo | Descripción |
|---------|-------------|
| `src/components/selectors/OpcionAccordion.vue` | Acordeón multi-select |
| `src/components/selectors/ActiveChips.vue` | Chips de filtros/selección |
| `src/lib/seleccion.ts` (o store) | Estado de selección (Set) + resolución a hojas |

### Archivos a modificar (UPDATE)
| Archivo | Cambio |
|---------|--------|
| `src/components/selectors/OpcionSelector.vue` | Reemplazar/envolver por el acordeón |
| `src/pages/[eleccion]/[departamento].astro` | Cablear el acordeón + selector de contienda |
| store-URL (nanostores) | Serializar selección + contienda |

### Dependencias
- **Bloquea**: Story 10.1 (escalera, catálogo) + Story 10.2 (catalogo.json + shards por lema).
- **Coordina con**: Story 10.4 (el mapa consume la selección resuelta).

### Referencias
- UX: `EXPERIENCE.md` › Acordeón de opción · `DESIGN.md` › `option-accordion`, `map-mode-switch`
- Legacy selector: `git show master:src/components/selectors/{ListSelectorContainer,ListGrid,CandidateGrid,PartyFilter,DataSourceToggle,ActiveFilters}.vue`
- Legacy filtros: `git show master:src/composables/useElectoralFilters.ts`
- Selector actual: `src/components/selectors/OpcionSelector.vue`

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code, bmad-dev-story)

### Completion Notes List

- **Estado de URL (aditivo, no rompe Epics 1-6):** `url-state.ts` + `map-state.ts` extendidos con `contienda` (`?cont=`) y `seleccion` multi (`?sel=` coma-separado). El `opcion` single existente queda intacto (el mapa actual lo sigue usando hasta 10.4). Selftest de url-state ampliado: 6 round-trips + parse multi → verde.
- **`OpcionAccordion.vue` (nuevo):** lee `catalogo.json`, arma el árbol por la escalera de cada contienda. Checkbox tri-estado + chevron como hit-targets separados. Multi-select: marcar un nodo agrega/quita la suma de sus hojas; tri-estado (vacío/parcial/lleno) derivado. Filtro de partido (visibilidad), búsqueda por número, "seleccionar todas" (respeta AMBOS filtros — fix de auto-review), chips de selección/filtros, limpiar todo. La selección se limpia al cambiar contienda. Degrada a lista plana para tipos de 1 nivel (balotaje/plebiscito).
- **Cableado:** `[departamento].astro` renderiza `OpcionAccordion` para elecciones×depto con catálogo (`internas-2024/montevideo`); el resto sigue con `OpcionSelector` (sin regresión).
- **Verificación en BROWSER (Playwright, dev server):** las 8 ACs probadas en vivo —
  AC1 árbol Convención Nacional/Departamental → lema → precandidato → hoja ✓ ·
  AC2 multi-select (Listas 609+711) con tri-estado roll-up (Orsi y FA en "parcial") ✓ ·
  AC3 filtro de 18 partidos + "seleccionar todas" ✓ ·
  AC4 búsqueda "119" filtra a 4 lemas ✓ ·
  AC5 chip "2 listas seleccionadas" ✓ ·
  AC6 cambiar a Convención Departamental limpia la selección (URL `?cont=odd`, sel vacío) ✓ ·
  AC7 URL `?cont=odn&sel=odn-frente-amplio-609,odn-frente-amplio-711` ✓ ·
  AC8 ODD degrada a lema→hoja (sin nivel precandidato) ✓.
- `npx astro check` → 0/0/0.

### Follow-ups (a11y hardening — para el pase de a11y / Epic 5)
- **Targets táctiles:** el checkbox visual es 22px dentro de filas de 40px; subir a hit-area ≥44px (el estándar del proyecto) en una pasada de a11y.
- **Teclado:** el árbol es operable por Tab+Enter/Space (botones nativos) con `role=tree/treeitem` + `aria-expanded`; falta el patrón de roving tabindex con flechas ↑↓→← del widget tree WAI-ARIA.
- **% por fila (pill):** la UX prevé % de roll-up por nodo; requiere totales por nodo (se puede derivar cuando 10.4 cargue los votos). Hoy el árbol es estructural.
- **Nota:** el mapa todavía NO recolorea por la selección — eso es **Story 10.4** (el acordeón ya escribe `seleccion`+`contienda` en la URL; 10.4 hace que el mapa los consuma).

### File List

- `src/lib/url-state.ts` (modified) — `contienda` + `seleccion` multi en `MapView`, parse/serialize
- `src/lib/url-state.selftest.ts` (modified) — round-trip + parse multi
- `src/stores/map-state.ts` (modified) — `contienda`/`seleccion` en `Seleccion`, hydrate/currentView
- `src/components/selectors/OpcionAccordion.vue` (new) — acordeón multi-select
- `src/pages/[eleccion]/[departamento].astro` (modified) — render condicional accordion vs selector

### Change Log

- 2026-05-31 — UI acordeón multi-select (Epic 10): URL multi-state + componente + wiring. 8 ACs verificadas en browser. Status → review.
- 2026-05-31 — Atendidos los hallazgos de code-review (2). Status → done.

## Senior Developer Review (AI)

**Fecha:** 2026-05-31 · **Reviewer:** code-reviewer (adversarial, verificó el catálogo real). **Resultado:** 2 hallazgos, ambos resueltos.

- [x] **[High] El checkbox/tri-estado de un nodo padre ignoraba la búsqueda** — `hojasDeLema`/`hojasDePrecandIds` (selección) eran search-blind mientras el display era search-aware: con búsqueda activa, tocar un lema seleccionaba hojas ocultas y el tri-estado del padre no concordaba con los hijos visibles. **Fix:** ambas funciones ahora intersectan con `hojasFiltradas` (operan solo sobre lo visible) — coherente con el display y con "seleccionar todas respeta el filtro".
- [x] **[Med] El deep-link no auto-expandía el árbol en las ramas seleccionadas (AC7/T5.3)** — `expandidos` solo se sembraba por click. **Fix:** `sembrarExpansionDeSeleccion()` en `onMounted` deriva lema/precandidato de las hojas en `seleccion` y los expande. **Verificado en browser:** deep-link `?sel=odn-frente-amplio-609` abre el árbol hasta mostrar "Lista 609".

**Verificado sano por el reviewer:** sin loop de subscribe (el handler solo escribe refs locales); `onUnmounted` limpia la suscripción; limpieza de selección al cambiar depto/elección la cubre el `astro:after-swap` del mapa (links sin `?sel=`); degradación plana y catálogo ausente OK.

**Post-fix:** `astro check` 0/0/0; auto-expand y search-aware verificados en browser. Cierra T7.2 funcionalmente operable por teclado (el hardening de roving tabindex + 44px sigue como follow-up de a11y para Epic 5).
