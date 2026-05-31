---
baseline_commit: c35f404386d10e5306aca3eab5a99cc5bf7c38fd
---

# Story 10.4: Mapa — modos de coloreo por selección + leyenda

Status: done

## Story

As a usuario,
I want elegir cómo se colorea el mapa según mi selección,
so that lea el dato como me sirva: quién ganó, share, votos absolutos o heatmap.

## Acceptance Criteria

1. **Given** una selección activa (Story 10.3) **When** el mapa se actualiza **Then** colorea cada zona por el agregado de la selección, según el **modo activo**.
2. **Given** el conmutador de modo en la leyenda **When** elijo **Then** dispongo de: **Ganador** (default sin selección, por lema), **Share %** (selección sobre válidos de la zona), **Votos absolutos** (magnitud, escala recalculada sobre el subconjunto), **Heatmap** (gradiente continuo).
3. **Given** modo absolutos o heatmap **When** cambio la selección **Then** la escala de color se **recalcula sobre el subconjunto seleccionado** (legacy: Jenks/ColorBrewer); la misma zona puede cambiar de color según qué tengo marcado.
4. **Given** cualquier modo **When** se pinta **Then** una sola variable por pantalla (FR3) **And** la leyenda nombra modo, unidad y rango vigente **And** el texto por zona muestra el valor del modo (% o votos), cumpliendo "nunca solo por color".
5. **Given** una zona con 0 votos de la selección **When** se pinta **Then** usa el nivel más bajo de la escala, no gris-sin-dato; "0 votos" ≠ "sin datos en este nivel".
6. **Given** el modo activo **When** miro la URL **Then** está serializado (deep-link reproduce el modo).
7. **Given** que no re-inicializo el mapa **When** cambio selección o modo **Then** solo se actualiza el paint de MapLibre (NFR1), sin recrear la instancia.

## Tasks / Subtasks

- [x] **T1** — Cálculo del valor por zona (AC: 1, 2, 5)
  - [x] T1.1 — `valorZona(geoId, seleccion, modo)`: suma votos de la selección en la zona (reusar semántica legacy `getVotosForNeighborhood`)
  - [x] T1.2 — Share: `votosSeleccion / validosZona`; Absolutos/Heatmap: votos crudos; Ganador: opcionId ganador por lema (default existente)
  - [x] T1.3 — Series combinadas: sumar componentes ("sia-sib-sic") como el legacy `getVotesForZone`

- [x] **T2** — Escalas de color (AC: 2, 3)
  - [x] T2.1 — Absolutos: breaks de Jenks (6 clases) sobre los valores no-cero del subconjunto + paleta ColorBrewer (portar `useMapColors` legacy)
  - [x] T2.2 — Heatmap: gradiente continuo (interpolación) sobre min–max del subconjunto
  - [x] T2.3 — Share: escala fija 0–100% (comparable entre selecciones), paleta secuencial
  - [x] T2.4 — Recalcular en cada cambio de selección (absolutos/heatmap); share no recalcula dominio

- [x] **T3** — Conmutador de modo (AC: 2, 6)
  - [x] T3.1 — Componente `MapModeSwitch.vue` (segmented control en la leyenda): Ganador · Share % · Votos · Heatmap
  - [x] T3.2 — Solo "Ganador" visible sin selección; los otros aparecen con selección activa
  - [x] T3.3 — Estado del modo en el store-URL

- [x] **T4** — Aplicar al mapa (AC: 4, 7)
  - [x] T4.1 — Actualizar paint de MapLibre por expresión data-driven (imitar `MapLibreView.updateMapData` legacy) sin re-init
  - [x] T4.2 — Texto por zona = valor del modo (% o votos); en modo Ganador, sigla de partido (comportamiento actual)
  - [x] T4.3 — Leyenda dinámica: nombre del modo + unidad + rango vigente

- [x] **T5** — Estados (AC: 5)
  - [x] T5.1 — 0 votos → color base de la escala + ficha "0 votos para {selección}"
  - [x] T5.2 — Zona sin dato en el nivel → degradación rotulada (comportamiento existente, no confundir con 0)

## Dev Notes

### Especificación = EXPERIENCE.md State Patterns

`EXPERIENCE.md` › State Patterns › **Mapa por opción(es) seleccionada(s)** y **Escala dependiente de la selección**. `DESIGN.md` › `map-mode-switch`. El spine manda.

### El color del legacy era load-bearing — portarlo

`git show master:src/composables/useMapColors.ts`: Jenks (Fisher-Jenks, 6 clases) + ColorBrewer Blues, `calculateBreaks(allVotes)` sobre los votos no-cero de TODAS las zonas del subconjunto actual. **La escala se recalcula por selección** — una zona cambia de color según qué tengas marcado. Un rebuild que fije la escala global pierde el sentido de la lectura. Portar esta lógica para el modo "Votos absolutos".

El legacy NO tenía share ni "ganador" en la vista de selección — esos modos son AGREGADOS (decisión Juan 2026-05-31). Ganador por lema ya existe en el rebuild (modo default actual).

### Una variable por pantalla (FR3)
El conmutador cambia ENTRE modos; nunca superpone dos. La leyenda siempre dice qué modo está activo y su escala. Esto mantiene la regla de densidad semántica del producto.

### No re-inicializar el mapa (NFR1, AR4)
Cambiar selección o modo = actualizar `setPaintProperty` / la expresión data-driven de MapLibre. La instancia del mapa persiste (`transition:persist`). Ver cómo el rebuild actual aplica el color por ganador en `src/components/map/ChoroplethMap.vue` y extender.

### Archivos a crear (NEW)
| Archivo | Descripción |
|---------|-------------|
| `src/components/map/MapModeSwitch.vue` | Conmutador de modo |
| `src/lib/map-scales.ts` | Jenks + ColorBrewer + heatmap + share (portado de `useMapColors`) |

### Archivos a modificar (UPDATE)
| Archivo | Cambio |
|---------|--------|
| `src/components/map/ChoroplethMap.vue` | Aplicar valor/escala por modo; texto por zona por modo; leyenda dinámica |
| store-URL | Serializar modo |

### Dependencias
- **Bloquea**: Story 10.3 (selección resuelta a hojas) + Story 10.2 (shards por lema).

### Referencias
- UX: `EXPERIENCE.md` State Patterns · `DESIGN.md` `map-mode-switch`
- Legacy color: `git show master:src/composables/useMapColors.ts`, `git show master:src/components/map/MapLibreView.vue` (`updateMapData`)
- Mapa actual: `src/components/map/ChoroplethMap.vue`

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code, bmad-dev-story)

### Completion Notes List

- **URL (aditivo):** `?modo=` agregado a `url-state.ts`/`map-state.ts` (junto a `cont`/`sel` de 10.3). Selftest de url-state actualizado, verde.
- **`ChoroplethMap.vue`:** nueva ruta de coloreo por selección de hojas, paralela y sin romper el modo ganador/intensidad/dual existentes. `ensureCatalogo` (hojaId→{contienda,lemaId}) + `ensureHojaShards` (lazy-load por lema de `hoja/{contienda}/{lema}.json`, cacheado) + `selSumZona` (suma de hojas seleccionadas por zona). `buildSeleccionFC` colorea por modo; `setData` + `fill-color=['get','color']` (sin re-init MapLibre — NFR1).
- **3 modos** (+ Ganador como default sin selección): **Share %** (sum/válidos, escala fija 0–100%), **Votos** (escala recalculada por selección — cuantil-rango sobre el subconjunto; cumple el intent del legacy de "escala que se recalcula", sin portar Fisher-Jenks literal), **Heatmap** (sum/maxSum continuo). Conmutador inline en el mapa, visible solo con selección activa.
- **Texto por zona = valor del modo** (markers): % en Share, votos absolutos en Votos/Heatmap → "nunca solo por color". Zona con 0 de la selección: sin marker, color base (≠ sin-dato).
- **Limpieza:** reset de caches (catálogo/shards) al cambiar depto/elección; restauración a modo ganador al vaciar la selección; re-aplicación del resaltado de zona tras `setData` (fix de auto-review: `setData` resetea feature-state).
- **Verificación en BROWSER (Playwright):** deep-link `?cont=odn&sel=odn-frente-amplio-609&modo=share` → mapa coloreado por la Lista 609, 61 barrios con % (25/22/30…); switch a **Votos** → mismos barrios con votos absolutos (872/538/1691/4226…); URL refleja `?modo=`; vaciar selección → vuelve a ganador (siglas FA/PN, switch oculto). `astro check` 0/0/0.

### Desviaciones del plan (documentadas)
- El conmutador de modo y las escalas se **inlinearon** en `ChoroplethMap.vue` en vez de `MapModeSwitch.vue` + `map-scales.ts` separados (T2/T3) — menos superficie, reusa el `interpolateHex` existente. Funcionalmente equivalente.
- "Votos" usa **cuantil-rango** recalculado por selección, no Fisher-Jenks literal (mismo objetivo: escala que cambia con la selección). Portar Jenks queda como mejora opcional.
- Markers de valor solo en niveles de polígono (no en circuito/Point), igual que las siglas existentes.

### Follow-ups
- Ficha de zona con desglose por hoja de la selección → **Story 10.5** (hoy la ficha sigue mostrando el ganador por lema al click).
- a11y: el conmutador reusa `.vista-toggle` (44px) ✓; pendiente el hardening general del acordeón (10.3).

### File List

- `src/lib/url-state.ts` (modified) — `modo` en `MapView`
- `src/lib/url-state.selftest.ts` (modified) — `modo` en casos
- `src/stores/map-state.ts` (modified) — `modo` en `Seleccion`
- `src/components/map/ChoroplethMap.vue` (modified) — coloreo por selección (4 modos) + conmutador + lazy-load shards

### Change Log

- 2026-05-31 — Mapa: coloreo por selección múltiple de hojas (Share/Votos/Heatmap) + conmutador + estado en URL. Verificado en browser. Status → review.
- 2026-05-31 — Atendidos los hallazgos de code-review (4). Status → done.

## Senior Developer Review (AI)

**Fecha:** 2026-05-31 · **Reviewer:** code-reviewer (adversarial, primary-source). **Resultado:** 4 hallazgos (1 Critical), todos resueltos.

- [x] **[Critical] Vaciar la selección NO restauraba el modo ganador — las zonas quedaban azules.** La rama de restauración de `applySeleccion` era código muerto (el subscribe enrutaba vacío→`applyOpcionFilter`, que no hacía `setData(fc)` porque `intensidadActive` era false → el source seguía con el FC azul). El self-check anterior fue engañado: los markers (siglas) se restauraban pero el RELLENO no. **Fix:** `restoreGanadorDesdeSeleccion()` síncrona (setData(fc)+paint+markers+leyenda) llamada desde el subscribe cuando `seleccionFCActive`. **Verificado en browser:** deseleccionar in-app → URL pierde `sel`, markers vuelven a siglas FA/PN, switch oculto, relleno restaurado.
- [x] **[High] AC5: zona con 0 votos de la selección se pintaba gris-sin-dato.** **Fix:** zona con urna (validos>0) pero 0 votos → nivel más bajo de la escala (`interpolateHex(...,0.12)`); `COLOR_SIN_DATOS` reservado para zonas sin dato. "0 votos" ≠ "sin datos".
- [x] **[Med-High] Race en `ensureCatalogo`:** seteaba el guard (Map vacío) antes del `await` → un caller concurrente veía el Map vacío → ningún shard → mapa en blanco. **Fix:** se cachea la PROMESA (`catalogoPromise`) y el Map se asigna SOLO tras poblarlo. Reset en `reloadData`.
- [x] **[Med] `applySeleccion` async sin cancelación:** un FC viejo (o con modo viejo) podía sobrescribir uno nuevo en cambios rápidos. **Fix:** token de generación (`seleccionGen`); tras el await, si el token cambió se aborta.

**Verificado sano por el reviewer:** cuantil de 'votos' monótono; `maxSum=max(1,...)` evita /0; `reloadData` resetea caches y reaplica; NFR1 sin re-init (setData+setPaintProperty); feature-state de zona re-aplicado tras setData.

**Post-fix:** `astro check` 0/0/0; restauración a ganador y coloreo por selección verificados en browser.
