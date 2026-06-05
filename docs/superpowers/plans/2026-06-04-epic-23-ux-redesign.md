# Epic 23 — Rediseño UX "Atlas Electoral"

_Arrancado 2026-06-04._

Fuente: handoff de Claude Design (mockup HTML/React de alta fidelidad de la vista de departamento, con datos+geometría reales de Montevideo). El mockup explora 3 direcciones visuales; **se adopta solo la Dirección A · Editorial** (es la identidad actual de la app, pulida). Las direcciones B/C y el panel "Tweaks" son andamiaje de exploración y NO se portan.

## Objetivo

Subir el nivel de **layout y componentes** de la app sin perder funcionalidad, sacándole el "aura vibecodeada": jerarquía y ritmo profesionales, controles on-brand (segmented controls), resultados en cards, y un layout de dos columnas (mapa héroe + rail) en desktop que colapsa a una columna + bottom-sheet en mobile.

**Principio rector (lección del chat de diseño):** el rediseño RE-SKINEA, no remueve. Toda función actual (filtro de listas por hoja —el corazón—, comparación, niveles, modos Ganador/Intensidad/Margen, búsqueda, export, ficha, plebiscitos, municipales, API) sigue intacta. La pega es visual y de layout, no de lógica.

## No-goals

- No tocar el modelo de datos, stores, ni la lógica de coloreo/agregación.
- No portar las direcciones B/C ni el panel Tweaks.
- No rehacer MapLibre/ChoroplethMap internamente (solo su chrome y overlays).

## Decisiones del usuario (2026-06-04)

- **Layout desktop:** 2 columnas (mapa + rail sticky). Mobile: 1 columna + bottom-sheet. ✅
- **Implementación:** por fases, empezando por la base visual. ✅
- **Dark mode:** toggle manual (claro/oscuro/auto) que persiste. ✅

## Sistema visual (del mockup, Dirección A)

Tokens ya casi idénticos a `src/styles/global.css`. Ajustes a incorporar (sin romper los actuales):
- Escala de superficies/tinta/bordes refinada; `--accent` oxblood `#8A1C1C` se mantiene.
- Tipografía: Source Serif 4 (display/números) + Inter (UI). `--num-feat` para tabular/lining.
- Radios, sombras (sm/md/lg/sheet), densidad (`--pad`/`--gap`/`--rail-w`).
- Componentes: `.topbar`, `.seg` (segmented), `.card`, `.winner-hero`, `.ranking`, `.map-frame`, `.map-badge`, `.map-zoom`, `.zone-panel`/`.zone-sheet`.

---

## Stories

### 23.1 — Base visual (FASE 1) · _bajo riesgo, se ve en todas las vistas_
Refinar el sistema de tokens y los componentes atómicos sin cambiar el layout todavía.
**Alcance:** tokens (superficies, tipografía, radios, sombras, densidad) en `global.css`; topbar sticky con brand-mark; segmented controls reutilizables; estilo de cards; estilo de timeline refinado.
**AC:**
- Los tokens nuevos conviven con los existentes; ninguna vista actual se rompe (`npm run check` + build OK).
- Existe una clase/comp `.seg` (segmented control) aplicable a LevelSelector/GranularitySelector/modos.
- Topbar sticky con marca; el masthead actual migra a ella.
- Dark sigue funcionando (auto, hasta 23.5).
- Sin regresiones de a11y (focus-visible, contraste) ni de los gates.

### 23.2 — Layout workspace 2-columnas (FASE 2)
Vista de departamento y nacional: grid `1fr var(--rail-w)` en desktop; 1 columna + bottom-sheet en mobile (`@media max-width:940px`).
**AC:**
- Desktop ≥940px: mapa a la izq (héroe), rail sticky a la der. Mobile: 1 columna; la ficha de zona es bottom-sheet.
- `transition:persist` del mapa sigue vivo entre navegaciones (NFR1).
- Controles del mapa (timeline, niveles, modos, listas) reubicados arriba del mapa, coherentes en ambos breakpoints.

### 23.3 — Rail de resultados (FASE 2)
Portar `ResultadoGlobal` → card winner-hero (bandera + nombre serif + % grande) + ranking territorial (barras + zonas ganadas). Ficha de zona como card en el rail (desktop) / sheet (mobile).
**AC:**
- Winner-hero muestra ganador, %, y meta. Ranking lista opciones con barra y nº de zonas ganadas.
- Reusa los datos/stores actuales; sin recálculo nuevo.
- En plebiscitos/municipales degrada coherente (Sí/No; alcalde/lema).

### 23.4 — Mapa pulido (FASE 3)
`map-frame` con borde/sombra; `map-badge` (leyenda-chip abajo-izq); zoom abajo-der; tooltip on-brand. Sin tocar la lógica de capas.
**AC:** badge refleja el modo actual; zoom +/- funciona; tooltip muestra nombre+ganador; nada rompe el overlay de puntos (local/circuito).

### 23.5 — Dark mode toggle (FASE 3)
Botón en la topbar: claro / oscuro / auto, persistido en `localStorage`. `data-theme` en el root; default = auto (`prefers-color-scheme`).
**AC:** el toggle cambia el tema sin recarga, persiste, y respeta `auto`. SSR-safe (sin flash).

### 23.6 — Timeline refinado (FASE 3, opcional)
Re-skin del `EleccionSelector` como línea de tiempo con nodos conectados + fades, manteniendo el orden cronológico y el agrupado actual.
**AC:** mismas elecciones/orden; activo destacado; scrollable con fades; sin cambiar la navegación.

---

## Secuencia
Fase 1 = 23.1 · Fase 2 = 23.2 + 23.3 · Fase 3 = 23.4 + 23.5 (+ 23.6). Validar (`npm run check`, build, a11y) entre fases. Una rama por fase o PR incremental sobre `feat/epic-23-ux-redesign`.

## Estado (2026-06-04)

Rama `feat/epic-23-ux-redesign`. Todo verificado en browser (Playwright) + `npm run check` 0 errores.

| Story | Estado | Commit |
|---|---|---|
| 23.1 base visual (tokens + `.seg`/`.card`/`.topbar`/`.num`, selectores segmented) | ✅ | `ddd5abf` |
| 23.1 color (paleta exacta del mockup, dark cálido) | ✅ | `0db392a` |
| 23.2 layout workspace 2-columnas (mapa + rail sticky) | ✅ | `11417c3` |
| 23.5 dark mode toggle manual (claro/oscuro/auto, anti-flash) | ✅ | `e352df6` |
| 23.3 rail de resultados como card | ✅ | `ff9a8be` |
| 23.4 mapa: badge de leyenda overlay + tooltip on-brand (zoom ya existe) | ⏳ pendiente | |
| 23.6 timeline con nodos conectados (re-skin EleccionSelector) | ⏳ pendiente | |

**Notas para continuar:** todo el layout 2-col vive DENTRO de `ChoroplethMap.vue` (`.ws-map`/`.ws-rail`), porque el mapa+leyenda+result+ficha son un solo island con `transition:persist`. El badge (23.4) sería un overlay absolute sobre `.ws-map`. El timeline (23.6) toca `EleccionSelector.vue` (cuidado con la lógica de agrupado por año). El `<main>` se ensancha a `max-w-6xl` en `lg` (1024px), mismo breakpoint que el grid.
