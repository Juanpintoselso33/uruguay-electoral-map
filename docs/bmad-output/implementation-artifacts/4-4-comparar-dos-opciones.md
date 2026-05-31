---
baseline_commit: 660c3f8
---

# Story 4.4: Comparar dos opciones en una elección

Status: in-progress

## Story

As a analista,
I want comparar dos opciones dentro de una misma elección,
so that contraste su desempeño por zona.

## Acceptance Criteria

1. **Given** una elección con varias opciones **When** tengo una opción activa **Then** veo chips "Comparar vs:" con cada otra opción disponible.
2. **Given** el modo dual activo (`?a=&b=`) **When** veo el mapa **Then** las zonas se colorean por cuál de las dos opciones obtuvo más votos en esa zona, con leyenda clara ([sigla A] vs [sigla B]).
3. **Given** el modo dual activo **When** hago clic en "Salir" en el `OpcionSelector` **Then** el mapa vuelve al modo ganador y la URL limpia `a` y `b`.
4. **Given** `?a=X&b=Y` en la URL **When** cargo la página **Then** el modo dual se restaura automáticamente.

## Dev Notes

### URL state

- `?a={opcionId}&b={opcionId}` — ya en `url-state.ts`/`$comparison`; NO crear nuevos campos.
- Entrar: `commit({ a: opcionActiva, b: target, opcion: null, vs: null })`
- Salir: `commit({ a: null, b: null })`

### Sin nuevo fetch — datos ya cargados

`zonasVotos` (Map<normalizedGeoId, Map<opcionId, votos>>) se pobla en `loadData`. Para comparar A vs B, basta con `zonasVotos.get(key)?.get(aId) ?? 0` vs `get(bId) ?? 0`. No hay fetch adicional — comparar 2 opciones de la MISMA elección usa los datos ya en memoria.

### `applyDualOpcionView(aId, bId)` en ChoroplethMap.vue

```ts
function applyDualOpcionView(aId: string, bId: string): void {
  // Para cada feature: setFeatureState { dualA: bool, dualB: bool }
  // m.setPaintProperty('zonas-fill', 'fill-color', ['case',
  //   ['boolean', ['feature-state', 'dualA'], false], aColor,
  //   ['boolean', ['feature-state', 'dualB'], false], bColor,
  //   COLOR_SIN_DATOS,
  // ])
  // Markers: sigla del ganador local (A o B)
  // legend.value = [{ sigla: aSignla, nombre: aNombre, color: aColor }, { B }]
}
```

### Guard en `applyOpcionFilter(null)` — crítico

Cuando el usuario hace clic en una zona (commit({ zona }) sin cambiar opcion), `$selection.subscribe` dispara `applyOpcionFilter(null)`, lo que normalmente restaura fill-color = `['get', 'color']`. En modo dual eso destruiría la vista dual.

**Fix**: en `applyOpcionFilter(null)`, check antes de restaurar:
```ts
if (!opcionId) {
  const cmp = $comparison.get();
  if (cmp.a && cmp.b) return; // dual activo — no restaurar
  // ... resto normal
}
```

### `clearDualOpcionView()` — idempotente

```ts
function clearDualOpcionView(): void {
  // setFeatureState dualA/dualB = false en todas las features
  // setPaintProperty fill-color → ['get', 'color']
  // rebuildMarkers(fc)
  // legend.value = origLegend
}
```

Llamar desde `$comparison.subscribe` cuando a/b transicionan a null (el fill-color sigue siendo el case expression — debe restaurarse aquí porque `$selection` no cambió y no dispara `applyOpcionFilter`).

### Subscription actualizada en `onMounted`

```ts
unsubComparison = $comparison.subscribe((cmp) => {
  if (!map.value || status.value !== 'listo') return;
  if (cmp.a && cmp.b) {
    applyDualOpcionView(cmp.a, cmp.b);
  } else if (cmp.vs && cmp.vs !== activeEleccion) {
    void applyComparisonOverlay(cmp.vs, activeEleccion, activeDepartamento, activeNivel);
  } else {
    clearComparisonOverlay();
    clearDualOpcionView();
  }
});
```

### Re-aplicar en `m.on('load')` y `reloadData`

```ts
const cmp = $comparison.get();
if (cmp.a && cmp.b) {
  applyDualOpcionView(cmp.a, cmp.b);
} else if (cmp.vs && cmp.vs !== activeEleccion) {
  void applyComparisonOverlay(...);
}
```

### UI en OpcionSelector.vue

Estado adicional (vía `onMounted` subscribe):
```ts
const cmpA = ref<string | null>(null);
const cmpB = ref<string | null>(null);

$comparison.subscribe((cmp) => {
  cmpA.value = cmp.a;
  cmpB.value = cmp.b;
});
```

Render (template):
- **Modo dual activo (cmpA && cmpB)**: encabezado "[sigla A] vs [sigla B] · Salir" — ocultar lista de opciones.
- **Opcion activa, sin dual**: debajo de "Viendo: X", añadir `<div>Comparar vs: [chip Y] [chip Z]</div>`.
- **Sin opcion activa**: UI actual sin cambios.

Acción "vs chip": `commit({ a: opcionActiva, b: chip.opcionId, opcion: null, vs: null })`
Acción "Salir": `commit({ a: null, b: null })`

## Tasks / Subtasks

- [ ] **Task 1: `applyDualOpcionView` + `clearDualOpcionView` en ChoroplethMap.vue (AC: 2, 4)**
  - [ ] Implementar `applyDualOpcionView(aId, bId)` con feature-state dualA/dualB
  - [ ] Guard en `applyOpcionFilter(null)` contra modo dual activo
  - [ ] `clearDualOpcionView` idempotente
  - [ ] Actualizar subscription `$comparison`
  - [ ] Re-aplicar en `m.on('load')` y `reloadData`

- [ ] **Task 2: UI en `OpcionSelector.vue` (AC: 1, 3)**
  - [ ] Subscribe `$comparison` en `onMounted`
  - [ ] Encabezado dual mode con "Salir"
  - [ ] Chips "Comparar vs:" cuando opcion activa

- [ ] **Task 3: Verificación manual (AC: 1-4)**
  - [ ] Seleccionar FA → aparece "Comparar vs: PC, PN, …"
  - [ ] Clic "vs PN" → mapa muestra FA/PN por zona, URL `?a=X&b=Y`
  - [ ] "Salir" → vuelve a modo ganador
  - [ ] Deep-link `?a=X&b=Y` → modo dual restaurado
  - [ ] Clic en zona (durante dual) → NO destruye dual view
  - [ ] `astro check` → 0 errores

## Story Completion Checklist

- [ ] Todos los ACs verificados manualmente en browser
- [ ] `astro check` sin errores TS
- [ ] Commit `feat(map): comparar dos opciones en una elección (Story 4.4)`
- [ ] `sprint-status.yaml`: `4-4-comparar-dos-opciones: done`
