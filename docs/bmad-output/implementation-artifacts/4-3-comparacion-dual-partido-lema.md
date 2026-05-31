---
baseline_commit: 637f45f
---

# Story 4.3: Comparación dual (partido/lema)

Status: in-progress

## Story

As a analista,
I want comparar dos elecciones lado a lado,
so that entienda el cambio entre comicios.

## Acceptance Criteria

1. **Given** dos elecciones de un mismo departamento **When** entro al modo comparación **Then** veo vista de cambio a nivel partido/lema, a granularidad zona **And** las zonas que cambiaron de ganador quedan visualmente marcadas.
2. **Given** el modo comparación activo **When** veo la leyenda **Then** los partidos que ganaron zonas en la elección actual pero NO aparecen en la comparación quedan marcados como `(solo {año})`.
3. **Given** que no hay comparación activa **When** veo el `CompareControls` **Then** hay un botón "Comparar con {elección}" que entra al modo; **When** hay comparación activa **Then** hay un botón "Salir" que la cancela — entrar/salir es explícito y reversible.
4. **Given** modo comparación activo **When** el estado vive en URL (`?vs=nacionales-2019`) **Then** el deep-link restaura el modo al cargar la página.
5. **Given** que el departamento solo tiene una elección (Rivera) **When** renderizo la página **Then** `CompareControls` NO se muestra (lista de elecciones ≤ 1).

## Dev Notes

### Arquitectura de comparación

- **`?vs=`** (no `?a=&b=`): aunque el epic menciona `a=&b=`, se usa `?vs=` que ya está en la url-state/contracts. Es más limpio para la vista de CAMBIO (vs. dual simultáneo). Documentado aquí.
- **Vista de cambio** (no lado-a-lado): el mismo mapa, coloreado por ganador de la elección ACTUAL. Zonas donde el ganador difiere entre elecciones reciben un borde grueso naranja.
- **La URL es fuente de verdad**: `commit({ vs: eleccion })` pushea `?vs=` al history y los nanostores espejean.

### Componentes nuevos

#### `CompareControls.vue` (isla `client:idle`)

Props:
```ts
interface Props {
  availableElecciones: string[];  // elecciones disponibles para este depto
  eleccionActual: string;          // la elección en el path
}
```

Estado reactivo: `onMounted` → `$comparison.subscribe(...)` → `comparisonVs` local ref.

Render:
- Si `comparisonVs.value !== null`: muestra "Comparando con: {label} · Salir"
- Si `availableElecciones.length > 1 && !comparisonVs.value`: muestra "Comparar con {label de la otra elección}"
- Si solo hay una elección: renderiza `null` (o el componente no se monta desde el Astro page)

Acciones:
- Entrar: `commit({ vs: otherEleccion })`
- Salir: `commit({ vs: null })`

#### `zonas-vs-changed` layer (MapLibre)

Nuevo layer de línea en `ChoroplethMap.vue`, agregado en `m.on('load')`:
```js
m.addLayer({
  id: 'zonas-vs-changed',
  type: 'line',
  source: 'zonas',
  paint: {
    'line-color': '#f97316',   // naranja — cambio de ganador
    'line-width': ['case', ['boolean', ['feature-state', 'vsChanged'], false], 3, 0],
  },
});
```

El feature-state `vsChanged: true` activa el borde; `false` lo oculta (width=0). Se inserta ANTES de `zonas-sel` para que el borde de selección tenga prioridad.

### Cambios en `ChoroplethMap.vue`

Variables de módulo a agregar:
```ts
let activeVs: string | null = null;
let vsWinnersMap = new Map<string, string>(); // normalizedGeoId → nombre ganador en eleccion de comparación
let unsubComparison: (() => void) | null = null;
```

Funciones nuevas:
- `async applyComparisonOverlay(vs, baseEleccion, departamento, nivel)`: fetch votes+opciones de `vs`, poblar `vsWinnersMap`, setFeatureState `vsChanged` en cada zona, actualizar legend con marcas de continuidad.
- `clearComparisonOverlay()`: setFeatureState `vsChanged: false` en todo, restaurar `legend.value = origLegend`, limpiar `vsWinnersMap`.

Puntos de re-aplicación:
1. `m.on('load')` callback — al final, check `$comparison.get().vs`.
2. `reloadData()` — al final, check `$comparison.get().vs`.
3. `$comparison.subscribe()` — reacciona a cambios (incluyendo los del `commit()`).

Guard en subscripción: `if (!map.value || status.value !== 'listo') return;`

### Integración en `[departamento].astro`

Agregar debajo de `<EleccionSelector>`:
```html
{availableElecciones.length > 1 && (
  <CompareControls
    client:idle
    availableElecciones={availableElecciones}
    eleccionActual={eleccion}
  />
)}
```

### Marcado de continuidad en la leyenda

En `applyComparisonOverlay`, después de cargar los datos de la comparación:
```ts
const vsNombres = new Set([...vsWinnersMap.values()]);
const year = activeEleccion.match(/\d{4}/)?.[0] ?? activeEleccion;
legend.value = origLegend.map((entry) =>
  vsNombres.has(entry.nombre)
    ? entry
    : { ...entry, nombre: `${entry.nombre} (solo ${year})` }
);
```

### ETL: sin cambios

Los datos ya existen para nacionales-2019/montevideo (Story 4.1).

### TypeScript

- No `any`. `$comparison` es `Comparacion = { vs: string|null, a: string|null, b: string|null }`.
- `applyComparisonOverlay` devuelve `Promise<void>`.

## Tasks / Subtasks

- [ ] **Task 1: `CompareControls.vue` (AC: 3, 5)**
  - [ ] Crear isla con props `availableElecciones + eleccionActual`
  - [ ] Subscribe `$comparison` en `onMounted`
  - [ ] Renderizar botón entrar/salir

- [ ] **Task 2: `ChoroplethMap.vue` — layer y funciones (AC: 1, 2, 4)**
  - [ ] Agregar `zonas-vs-changed` layer en `m.on('load')`
  - [ ] Implementar `applyComparisonOverlay` y `clearComparisonOverlay`
  - [ ] Subscribe `$comparison` en `onMounted`
  - [ ] Re-aplicar en `m.on('load')` y `reloadData`
  - [ ] Unsubscribe en `onUnmounted`

- [ ] **Task 3: Integrar en `[departamento].astro` (AC: 3, 5)**
  - [ ] Import `CompareControls`
  - [ ] Agregar island condicionalmente

- [ ] **Task 4: Verificación manual (AC: 1-5)**
  - [ ] `/internas-2024/montevideo`: botón "Comparar con Nacionales 2019" visible
  - [ ] Clic → mapa muestra bordes naranjas en zonas que cambiaron ganador
  - [ ] Leyenda marca `(solo 2024)` en partidos sin continuidad
  - [ ] Clic "Salir" → bordes desaparecen, leyenda restaurada
  - [ ] URL `?vs=nacionales-2019` persiste; refresh restaura modo
  - [ ] `/internas-2024/rivera`: sin botón de comparación
  - [ ] `astro check` → 0 errores TS

## Story Completion Checklist

- [ ] Todos los ACs verificados manualmente en browser
- [ ] `astro check` sin errores TS
- [ ] Commit con mensaje `feat(map): comparación dual partido/lema (Story 4.3)`
- [ ] `sprint-status.yaml`: `4-3-comparacion-dual-partido-lema: done`
