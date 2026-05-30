---
baseline_commit: e138c28
---

# Story 2.4: Ficha de zona (bottom sheet)

Status: done

## Story

As a ciudadano,
I want tocar una zona y ver sus resultados en una ficha,
so that conozca el detalle de mi barrio.

## Acceptance Criteria

1. **Given** el mapa **When** toco una zona **Then** aparece una ficha con: nombre de zona, ganador (sigla + nombre + color), votos del ganador, % sobre válidos, total válidos.
2. **Given** la ficha **Then** incluye blanco, anulados y observados como categorías separadas (nunca sumadas al ganador).
3. **Given** mobile (< 640px) **Then** la ficha sube como bottom sheet; swipe-down la colapsa/cierra; botón ✕ también la cierra.
4. **Given** desktop (≥ 640px) **Then** la ficha se ancla como panel lateral junto al mapa.
5. **Given** el usuario navega a otro departamento **Then** la ficha se cierra automáticamente (URL ya no tiene `?zona=`).
6. **Given** la ficha abierta **When** se selecciona otra zona **Then** la ficha se actualiza con los datos de la nueva zona sin cerrarse.
7. **Given** modo intensidad activo **Then** la ficha muestra el % de la opción seleccionada para esa zona además del ganador.

## Tasks / Subtasks

- [ ] **Task 1: Extender datos de zona en ChoroplethMap.vue (AC: 1, 2, 7)**
  - [ ] Agregar `zonasNoPartidarios: Map<string, {enBlanco,anulados,observados}>` a módulo; poblar en `loadData`.
  - [ ] Extender `SelInfo`: agregar `color`, `votoGanador`, `pct`, `enBlanco`, `anulados`, `observados`.
  - [ ] Actualizar `selectByName` para calcular `votoGanador` (de `zonasVotos`) y `pct = votoGanador/validos*100`.
  - [ ] Opcionalmente, cuando hay `opcionActiva`: agregar `pctOpcionActiva` a `selected` (% de la opción seleccionada en esa zona, para AC: 7).

- [ ] **Task 2: ZoneSheet.vue componente (AC: 1, 2, 3, 4)**
  - [ ] Crear `src/components/sheet/ZoneSheet.vue`.
  - [ ] Props: `sel: SelInfo | null`, `opcionActiva: string | null`, `opcionNombre: string | null`.
  - [ ] Template: header (nombre zona + botón ✕), cuerpo (ganador destacado, votos, %, categorías no partidarias).
  - [ ] CSS: `.zone-sheet` con `position: fixed; bottom: 0` en mobile; `transition: transform`; `transform: translateY(100%)` cuando `!sel`, `translateY(0)` cuando `sel`.
  - [ ] Desktop (`@media (min-width: 640px)`): posición estática dentro del flujo, sin transform.
  - [ ] Swipe-down (mobile): `@touchstart` + `@touchend`; si `deltaY > 80px` → emit `close`.
  - [ ] Botón ✕ → emit `close` → `commit({ zona: null })` en ChoroplethMap.

- [ ] **Task 3: Integrar ZoneSheet en ChoroplethMap.vue (AC: 5, 6)**
  - [ ] Importar `ZoneSheet` y reemplazar el `<div class="readout">` con `<ZoneSheet :sel="selected" ... @close="commit({zona:null})" />`.
  - [ ] Pasar `opcionActiva` y `opcionNombre` como props (para AC: 7).

- [ ] **Task 4: Verificación (AC: 1–7)**
  - [ ] Click en barrio Montevideo → ficha con ganador FA, votos, %, blanco/anulados/observados.
  - [ ] Swipe-down (simular con mouse drag en mobile viewport) → ficha se cierra.
  - [ ] Navegar Rivera → ficha cerrada, URL sin `?zona=`.
  - [ ] `astro check` 0 · `npm run build` verde.

## Dev Notes

### Datos disponibles
- `zonasVotos.get(norm(geoId))?.get(ganadorOpcionId)` → votos del ganador en esa zona.
- `votes.zonas[].noPartidarios = { enBlanco, anulados, observados }` → ya en el contrato.
- Agregar `zonasNoPartidarios` en `loadData` junto a `zonasVotos`/`zonasValidos`.

### pct
```typescript
const pct = validos > 0 ? (votoGanador / validos) * 100 : 0;
```
Siempre sobre válidos (no sobre total de emitidos). Formato: `toFixed(1)` + `%`.

### Bottom sheet CSS (mobile-first)
```css
.zone-sheet {
  position: fixed; bottom: 0; left: 0; right: 0;
  background: white; border-radius: 1rem 1rem 0 0;
  transform: translateY(100%);
  transition: transform 0.25s ease;
  z-index: 100;
  max-height: 60vh; overflow-y: auto;
}
.zone-sheet--open { transform: translateY(0); }
@media (min-width: 640px) {
  .zone-sheet { position: static; transform: none; border-radius: 0; max-height: none; }
}
```

### Swipe-down en mobile
```typescript
let touchStartY = 0;
function onTouchStart(e: TouchEvent) { touchStartY = e.touches[0].clientY; }
function onTouchEnd(e: TouchEvent) {
  if (e.changedTouches[0].clientY - touchStartY > 80) emit('close');
}
```

### AC: 7 — pct opcion activa
Cuando `opcionActiva` es no-null, mostrar también "X% de votos para [SIGLA]" para esa zona:
```typescript
const pctOpcionActiva = opcionActiva && validos > 0
  ? (zonasVotos.get(norm(name))?.get(opcionActiva) ?? 0) / validos * 100
  : null;
```
Puede ir en el SelInfo extendido o calcularse en selectByName.

### Navegar cierra la ficha
`astro:after-swap` → `hydrateStores(view)` → `$selection.zona = null` (URL sin ?zona=) → `applySelection(null)` → `selected.value = null` → ZoneSheet se oculta vía `:class`. No requiere lógica adicional.

### No romper el readout actual
El `<div class="readout">` actual se reemplaza completo por `<ZoneSheet>`. La clase `.readout` puede eliminarse del CSS scoped.

### Referencias
- [epics.md § Story 2.4] · [ChoroplethMap.vue] · [contracts/votes.ts CategoriasNoPartidarias] · [Story 1.8] (click en zona → commit({zona})) · [map-state.ts commit].

## Dev Agent Record

### Agent Model Used
<!-- to be filled -->
