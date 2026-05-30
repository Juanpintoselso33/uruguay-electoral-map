---
baseline_commit: e481b99
---

# Story 2.2: Selector de opción adaptativo

Status: ready-for-dev

## Story

As a usuario,
I want elegir una lista o candidato según el tipo de elección,
so that vea cómo le fue a esa opción zona por zona.

## Acceptance Criteria

1. **Given** la vista de un departamento **When** abro el selector de opción **Then** aparece la lista de opciones (lemas para internas) leída de `opciones.json` con swatch de color y sigla de partido.
2. **Given** el selector **When** hago clic en una opción **Then** `?opcion=<opcionId>` aparece en la URL y el mapa se recolorea: las zonas donde esa opción ganó mantienen su color, el resto pasa a gris (`#e5e7eb`).
3. **Given** una opción seleccionada **When** vuelvo a hacer clic en ella o presiono "Ver todos" **Then** `?opcion=` se elimina de la URL y el mapa restaura el coloreo normal (ganador por zona).
4. **Given** opción seleccionada **Then** la leyenda muestra sólo esa opción con el conteo de zonas donde ganó.
5. **Given** una zona con opción seleccionada **When** el mapa recolorea **Then** los markers de sigla aparecen **sólo** en las zonas donde esa opción ganó (zonas grises = sin marker).
6. **Given** la URL tiene `?opcion=X` al cargar **When** el mapa termina de inicializar **Then** se aplica automáticamente el filtro de opción (deep-link funciona).
7. **Given** el selector **Then** la etiqueta del selector dice "Partido / Lema" para internas y legislativas; "Candidato / Lema" para balotaje y presidencial.

## Tasks / Subtasks

- [ ] **Task 1: OpcionSelector.vue isla (AC: 1, 2, 3, 7)**
  - [ ] Crear `src/components/selectors/OpcionSelector.vue` con `client:idle`.
  - [ ] Props: `eleccion: string`, `departamento: string`.
  - [ ] En `onMounted`: suscribirse a `$selection` para reflejar `opcion` activa; hacer `fetch` a `${BASE_URL}/data/${eleccion}/${departamento}/opciones.json`; mapear con `resolveParty(nombre)` para obtener `sigla` y `color`.
  - [ ] Clic en opción activa → `commit({ opcion: null })`; clic en otra → `commit({ opcion: opcionId })`.
  - [ ] Botón "✕ Ver todos" visible cuando hay opción activa → `commit({ opcion: null })`.
  - [ ] Etiqueta adaptativa basada en el string de elección: `eleccion.startsWith('internas') || eleccion.startsWith('legislativas')` → `"Partido / Lema"`; `eleccion.includes('balotaje') || eleccion.startsWith('presidencial')` → `"Candidato / Lema"`; default → `"Opción"`.
  - [ ] A11y: `role="listbox"` en el `<ul>`, `role="option"` + `aria-selected` en cada `<li>`; targets mínimos 44px.

- [ ] **Task 2: ChoroplethMap.vue — modo opción (AC: 2, 3, 4, 5, 6)**
  - [ ] En `loadData`: agregar `p.ganadorOpcionId = zona.ganadorOpcionId` a las propiedades de cada feature (necesario para la expresión MapLibre).
  - [ ] Elevar `nombrePorOpcion` a variable de módulo (`opcNombreMap: Map<string,string>`) para que `applyOpcionFilter` acceda al nombre de la opción sin recargar.
  - [ ] Añadir `origLegend: LegendEntry[]` a nivel de módulo; asignarlo después de calcular `legend.value` en `loadData` y `reloadData`.
  - [ ] Nueva función `applyOpcionFilter(opcionId: string | null)`:
    - Si `opcionId !== null`: llamar `m.setPaintProperty('zonas-fill', 'fill-color', ['case', ['==', ['get', 'ganadorOpcionId'], opcionId], ['get', 'color'], COLOR_SIN_DATOS])` + `rebuildMarkers(fc, opcionId)` + actualizar `legend.value` con una sola entrada (sigla + nombre + conteo de zonas ganadas).
    - Si `null`: `m.setPaintProperty('zonas-fill', 'fill-color', ['get', 'color'])` + `rebuildMarkers(fc)` + restaurar `legend.value = origLegend`.
    - Guarda antes: `if (!m || !fcRef.value || !m.getSource('zonas')) return`.
  - [ ] Cambiar `$selection.subscribe` (línea 231) para manejar tanto `zona` como `opcion`: `$selection.subscribe((s) => { applySelection(s.zona); applyOpcionFilter(s.opcion); })`.
  - [ ] Dentro del callback `m.on('load', ...)`, **después de** `applySelection(...)`, añadir `applyOpcionFilter($selection.get().opcion)` (AC: 6).
  - [ ] Modificar `rebuildMarkers(fc, filterOpcionId?: string | null)`: si `filterOpcionId` está definido y no es null, omitir features cuyo `p.ganadorOpcionId !== filterOpcionId` (AC: 5).
  - [ ] En `reloadData`: después de asignar `legend.value`, asignar también `origLegend = legend.value`; luego llamar `applyOpcionFilter($selection.get().opcion)` para reaplicar el filtro si hay opcion activa al cambiar de dept.

- [ ] **Task 3: Integrar selector en la página (AC: 1)**
  - [ ] En `src/pages/[eleccion]/[departamento].astro`: importar `OpcionSelector` y añadirlo **fuera** del `div#map-persist` (se re-monta naturalmente en navegación; no necesita `transition:persist`).
  - [ ] Posición: entre la nav de departamentos y el `div#map-persist`.

- [ ] **Task 4: Verificación en navegador (AC: 1–7)**
  - [ ] Playwright: abrir Montevideo internas-2024; verificar que aparece lista de 18 opciones con swatches.
  - [ ] Hacer clic en "Frente Amplio" → URL tiene `?opcion=frente-amplio`; solo zonas FA con color; resto gris; markers solo en zonas FA; leyenda muestra "FA · N zonas".
  - [ ] Clic otra vez en "Frente Amplio" (deselect) → URL sin `?opcion=`; mapa restaura todos los colores; markers en todas las zonas con datos; leyenda completa.
  - [ ] Navegar con deep-link `/internas-2024/montevideo?opcion=frente-amplio` → mapa carga ya filtrado (AC: 6).
  - [ ] Navegar a Rivera → selector recarga opciones de Rivera; opcion se limpia si no existe en nueva URL.
  - [ ] `astro check` 0 errores · `npm run build` verde.

## Dev Notes

### Datos disponibles (no modificar ETL)
- `public/data/internas-2024/{dept}/opciones.json` → `{ opciones: [{opcionId, nombre}] }` ya emitido por ETL. Los `opcionId` coinciden exactamente con los `opcionId` en `votes.json → zonas[].ganadorOpcionId`.
- `votes.json → zonas[].porOpcion` contiene `{opcionId, votos}` por cada opción en cada zona. No necesario para Story 2.2 (solo usamos `ganadorOpcionId` para el filtro). Story 2.3 lo usará para intensidad.
- No hay cambio de ETL necesario.

### Patrón MapLibre para el filtro de opción
Usar `setPaintProperty` con una expresión que lee `ganadorOpcionId` de las propiedades del feature:
```typescript
// Modo opción seleccionada:
m.setPaintProperty('zonas-fill', 'fill-color', [
  'case',
  ['==', ['get', 'ganadorOpcionId'], opcionId],
  ['get', 'color'],
  COLOR_SIN_DATOS,
]);
// Restaurar modo normal:
m.setPaintProperty('zonas-fill', 'fill-color', ['get', 'color']);
```
Esto NO requiere `setData` (evita re-parse del GeoJSON, más rápido). Solo requiere que `ganadorOpcionId` esté en las propiedades de cada feature (nueva clave en `loadData`).

### Propiedad `ganadorOpcionId` en features
En `loadData`, el bloque `if (zona && zona.porOpcion.length > 0)` ya asigna `color`, `sigla`, `nombre`, `validos`, `hasData`. Agregar:
```typescript
p.ganadorOpcionId = zona.ganadorOpcionId; // para expresión MapLibre
```
Las features `!hasData` no tienen `ganadorOpcionId` → la expresión `['==', ['get', 'ganadorOpcionId'], opcionId]` evaluará `false` → quedan en `COLOR_SIN_DATOS`. ✓

### Suscripción `$selection` — no duplicar
La suscripción en línea 231 (`$selection.subscribe((s) => applySelection(s.zona))`) debe ampliarse, **no duplicarse**:
```typescript
$selection.subscribe((s) => {
  applySelection(s.zona);
  applyOpcionFilter(s.opcion);
});
```

### OpcionSelector no necesita `transition:persist`
El selector vive fuera del `div#map-persist`. Con ClientRouter, el DOM del selector es reemplazado en cada navegación. El componente se re-monta con los nuevos props → hace fetch a `opciones.json` del nuevo dept → muestra las nuevas opciones. No necesita escuchar `astro:after-swap`.

### Limpiar opcion en navegación a nuevo dept
Cuando el usuario navega (ej. Montevideo→Rivera), la URL que genera la nav no lleva `?opcion=`. El handler `astro:after-swap` en ChoroplethMap hace `hydrateStores(view)` → `$selection.set({ opcion: null })` → `applyOpcionFilter(null)` → mapa restaura colores normales. ✓
Si el usuario navega con `?opcion=frente-amplio` a Rivera (que sí tiene `frente-amplio`), el filtro se aplica correctamente. No hay que limpiar a la fuerza.

### Leyenda en modo opción
En modo opción seleccionada, `legend.value` se reemplaza por un array de un único elemento:
```typescript
const nombre = opcNombreMap.get(opcionId) ?? opcionId;
const meta = resolveParty(nombre);
const count = fc.features.filter(
  f => (f.properties as {ganadorOpcionId?: string}).ganadorOpcionId === opcionId
).length;
legend.value = [{ sigla: meta.sigla, nombre, color: meta.color, votos: count }];
```
`MapLegend.vue` no necesita cambios — ya muestra la lista `entradas` tal como viene.

### `origLegend` — snapshot de la leyenda normal
```typescript
// A nivel de módulo (junto a otras variables de módulo):
let opcNombreMap = new Map<string, string>();
let origLegend: LegendEntry[] = [];

// Al final de loadData/reloadData, después de calcular legend.value:
origLegend = legend.value;
// Y elevar nombrePorOpcion a opcNombreMap:
opcNombreMap = nombrePorOpcion; // (renombrar la const local a let de módulo o asignar tras construir)
```

### A11y mínima del selector
- `<section aria-label="Selector de opción electoral">`
- `<ul role="listbox">` + cada `<li role="option" :aria-selected="...">`
- Altura máxima del `<ul>` con scroll (`max-h-48 overflow-y-auto`) para que no empuje el mapa fuera de pantalla
- `min-height: 44px` en cada item (NFR2 — targets táctiles)

### Verificación: valores esperados (Montevideo internas-2024)
- **Frente Amplio**: gana en prácticamente todos los barrios (~47 de 48 con datos) → 47 zonas filtradas, 1 zona gris (Carrasco/Punta Gorda = PN).
- **Nacional**: gana en ~1 barrio → 1 zona con color PN, 47 grises.
- Selector muestra 18 opciones (todas las de `opciones.json` de Montevideo).

### Regresiones a proteger
- El coloreo "quién ganó" (modo normal) debe seguir igual que antes cuando `opcion = null`.
- La selección de zona (`?zona=`) sigue funcionando en modo opción (zonas-sel layer no cambia).
- Rivera con sus 36 series debe funcionar igual con el nuevo `ganadorOpcionId` en properties.
- `astro check` debe seguir en 0 errores.

### Referencias
- [epics.md § Story 2.2] · [architecture.md § Estado/URL] · [Story 2.1] (patrón `astro:after-swap`) · [Story 1.8] (markers HTML, paint properties) · [party-meta.ts] (`resolveParty`) · [contracts/votes.ts] (`AgregadoZona.ganadorOpcionId`).

## Dev Agent Record

### Agent Model Used
<!-- to be filled -->

### Debug Log References
<!-- to be filled -->

### Completion Notes
<!-- to be filled -->
