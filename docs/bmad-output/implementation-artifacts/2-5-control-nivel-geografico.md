---
baseline_commit: 7d62a50
---

# Story 2.5: Control de nivel geográfico (zona/serie)

Status: done

## Story

As a analista,
I want cambiar el nivel geográfico del mapa,
so that explore los datos a distinta granularidad (barrio vs. serie electoral).

## Acceptance Criteria

1. **Given** el mapa **Then** existe un control Zona / Serie / Circuito; Circuito está siempre deshabilitado con tooltip "Próximamente"; los niveles disponibles para el depto actual están habilitados.
2. **Given** el control **When** selecciono un nivel disponible **Then** se hace lazy-load del artefacto `.topo.json` de ese nivel y el mapa recolorea sin re-inicializar MapLibre.
3. **Given** el control **Then** el nivel activo se escribe en la URL (`?level=zona|serie`) y se lee correctamente al entrar con deep-link.
4. **Given** navegar a Rivera (nivel nativo=serie) **Without** `?level=` en URL **Then** el mapa se carga en modo serie y la URL se actualiza a `?level=serie` automáticamente.
5. **Given** la tabla de datos accesible **Then** su caption/summary refleja el nivel activo ("barrio" → nivel=zona; "serie" → nivel=serie).
6. **Given** el control **When** cambio de nivel **Then** la selección de zona (`?zona=`) se limpia (distinta granularidad → zona previa no aplica) y la ficha se cierra.
7. **Given** el control **Then** cumple a11y: targets ≥44px, `role="group"`, `aria-pressed`, `aria-disabled`.

## Tasks / Subtasks

- [ ] **Task 1: DEPT_AVAIL table + wiring $level en ChoroplethMap.vue (AC: 2, 3, 4)**
  - [ ] Añadir `DEPT_AVAIL: Record<string, NivelGeografico[]>` como constante módulo:
    ```typescript
    const DEPT_AVAIL: Record<string, NivelGeografico[]> = {
      montevideo: ['zona'],
      rivera:     ['serie'],
    };
    ```
  - [ ] Eliminar `DEPT_NIVEL` (reemplazado por `DEPT_AVAIL`).
  - [ ] En `onMounted`: resolver el nivel activo desde `$level.get()` + `DEPT_AVAIL`; si el nivel de URL no está disponible para el dept, corregir al primer nivel disponible Y llamar `commit({ level: corrected })` para actualizar URL (AC: 4).
  - [ ] Añadir `$level.subscribe` que llame `reloadData(eleccion, dept, newLevel)` solo cuando `newLevel` esté en `DEPT_AVAIL[dept]`.
  - [ ] `reloadData` ya toma `nivel: string` como argumento — usarlo sin cambios adicionales.

- [ ] **Task 2: LevelSelector.vue (AC: 1, 2, 3, 6, 7)**
  - [ ] Crear `src/components/selectors/LevelSelector.vue`.
  - [ ] Props: `availableLevels: NivelGeografico[]` (desde la página).
  - [ ] Template: `<div role="group" aria-label="Nivel geográfico">` con 3 botones:
    - "Zona" — habilitado si `availableLevels.includes('zona')`.
    - "Serie" — habilitado si `availableLevels.includes('serie')`.
    - "Circuito" — siempre `disabled`, título `"Próximamente"`.
  - [ ] Suscribir `$level` (nanostore) para el estado activo reactivo.
  - [ ] Click en nivel disponible → `commit({ level: X, zona: null })` (AC: 6, limpia zona).
  - [ ] Botón activo: `aria-pressed="true"`, estilo diferenciado (borde + bold).
  - [ ] Botón deshabilitado (nivel no disponible): `aria-disabled="true"`, color gris, cursor not-allowed.
  - [ ] Botón circuito: `disabled` nativo, texto gris, title "Próximamente".
  - [ ] Targets ≥44px (AC: 7).

- [ ] **Task 3: Integrar LevelSelector en la página (AC: 1)**
  - [ ] En `src/pages/[eleccion]/[departamento].astro`:
    - Importar `LevelSelector`.
    - Calcular `availableLevels` desde la misma tabla `DEPT_AVAIL` (duplicar la constante en el astro, o importar desde un módulo compartido).
    - Añadir `<LevelSelector client:idle :available-levels={availableLevels} />` entre `OpcionSelector` y `div#map-persist`.

- [ ] **Task 4: DataTable caption dinámica (AC: 5)**
  - [ ] En `DataTable.astro`: añadir prop `nivel?: string` (default: leer `votes.nivel`).
  - [ ] Derivar etiqueta: `nivel === 'zona' ? 'barrio' : nivel === 'serie' ? 'serie' : nivel`.
  - [ ] Actualizar `<summary>`: "Tabla de datos (accesible) — 61 barrios" / "— 36 series".
  - [ ] Actualizar `<caption>`: "Resultados por barrio" → "Resultados por serie".
  - [ ] En la página: pasar `nivel={votes.nivel}` a `<DataTable>` (o leer votes.json en el astro).

- [ ] **Task 5: Verificación (AC: 1–7)**
  - [ ] Montevideo: Zona activo y resaltado; Serie gris (aria-disabled); Circuito disabled "Próximamente".
  - [ ] Rivera carga en nivel serie sin `?level=`; URL se actualiza a `?level=serie`; "Serie" está activo.
  - [ ] Click "Zona" en Rivera: como no está en `DEPT_AVAIL['rivera']`, el botón está deshabilitado → no se puede.
  - [ ] Deep-link `?level=serie` en Montevideo: corrige a zona (no disponible) → URL queda sin `?level=`.
  - [ ] Cambiar nivel → `?zona=` desaparece de la URL + ficha ZoneSheet se cierra.
  - [ ] DataTable: Montevideo dice "61 barrios"; Rivera dice "36 series".
  - [ ] `astro check` 0 · `npm run build` verde.

## Dev Notes

### Datos disponibles (estado actual)

```
public/data/geo/montevideo/zona.topo.json   ← ÚNICO nivel geo disponible
public/data/geo/rivera/serie.topo.json      ← ÚNICO nivel geo disponible

public/data/internas-2024/montevideo/votes.json  (nivel: "zona", 61 zonas)
public/data/internas-2024/rivera/votes.json      (nivel: "serie", 36 zonas)
```

Cada depto tiene exactamente un nivel disponible en esta fase. El selector muestra los demás como deshabilitados (no error — UX intencional). Cuando el ETL genere votos+geo para niveles adicionales, basta con actualizar `DEPT_AVAIL`.

### DEPT_AVAIL — tabla de verdad de niveles

Colocar esta constante en el módulo de ChoroplethMap.vue (y duplicar en el .astro para el SSR). Cuando se agreguen departamentos, actualizar ambos lugares.

```typescript
import type { NivelGeografico } from '../../lib/contracts';
const DEPT_AVAIL: Record<string, NivelGeografico[]> = {
  montevideo: ['zona'],
  rivera:     ['serie'],
};
```

### Resolución de nivel activo en onMounted

```typescript
const urlLevel = $level.get();                              // de la URL parseada
const avail = DEPT_AVAIL[props.departamento] ?? ['zona'];
const activeLevel: NivelGeografico = avail.includes(urlLevel) ? urlLevel : avail[0];
if (activeLevel !== urlLevel) commit({ level: activeLevel }); // corrige URL silenciosamente
// Usar activeLevel para loadData inicial
```

Este patrón garantiza que:
- Montevideo sin ?level= → urlLevel='zona', zona disponible → usa zona, no cambia URL.
- Rivera sin ?level= → urlLevel='zona', zona NO disponible → usa serie, escribe `?level=serie`.
- Rivera con ?level=serie → urlLevel='serie', disponible → usa serie, no cambia URL.

### $level.subscribe en ChoroplethMap

Añadir JUNTO A los subscribes existentes ($context, $selection):

```typescript
const unsubLevel = $level.subscribe((newLevel) => {
  const avail = DEPT_AVAIL[props.departamento] ?? ['zona'];
  if (avail.includes(newLevel) && mapReady) {
    reloadData(props.eleccion, props.departamento, newLevel);
  }
});
onUnmounted(() => { unsubLevel(); /* ... otros unsub */ });
```

`mapReady` es el flag existente (o verificar que `mlMap` no sea null). Importante: el subscribe se activa también en la hidratación inicial — asegurarse de no llamar reloadData dos veces (una en onMounted + una por subscribe). La forma más limpia: en `onMounted` llamar `loadData` directamente (no via subscribe); el subscribe solo reacciona a CAMBIOS posteriores.

### LevelSelector.vue — esquema mínimo

```vue
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import type { NivelGeografico } from '../../lib/contracts';
import { $level, commit } from '../../stores/map-state';

const props = defineProps<{ availableLevels: NivelGeografico[] }>();
const activeLevel = ref<NivelGeografico>($level.get());
let unsub: () => void;
onMounted(() => { unsub = $level.subscribe((v) => { activeLevel.value = v; }); });
onUnmounted(() => unsub?.());

const LABELS: Record<string, string> = { zona: 'Zona', serie: 'Serie', circuito: 'Circuito' };

function select(nivel: NivelGeografico) {
  if (!props.availableLevels.includes(nivel)) return;
  commit({ level: nivel, zona: null });
}
</script>
```

### DataTable.astro — cambio mínimo

Añadir prop `nivel` al frontmatter (o leer `votes.nivel` ya cargado):

```typescript
const nivelLabel = votes.nivel === 'zona' ? 'barrio' : votes.nivel === 'serie' ? 'serie' : votes.nivel;
const nivelLabelPlural = votes.nivel === 'zona' ? 'barrios' : votes.nivel === 'serie' ? 'series' : votes.nivel + 's';
```

Cambios en template:
- `<summary>Tabla de datos (accesible) — {filas.length} {nivelLabelPlural}</summary>`
- `<caption>Resultados por {nivelLabel} — ...</caption>`
- `<th scope="col">{nivelLabel.charAt(0).toUpperCase() + nivelLabel.slice(1)}</th>` (primera col)

### No romper regresiones

- Rivera sigue mostrando sus 36 series en el mapa (datos no cambian).
- El filtro de opción (Story 2.2) y el toggle intensidad (Story 2.3) deben seguir funcionando tras el cambio de nivel (son independientes — operan sobre `zonas` que se recargan con el nivel).
- La ficha (Story 2.4) se cierra al cambiar nivel porque `commit({ zona: null })` se llama junto con `commit({ level: X })`.
- `astro check` en 0 — DataTable recibe el `nivel` como prop y lo usa para etiquetas.

### Nota sobre circuito

El botón "Circuito" usa `disabled` nativo del HTML (no solo `aria-disabled`), porque nunca tiene datos y no tiene caso manejarlo con JS. El tooltip `title="Próximamente"` es suficiente para mobile (no hay hover); en futuras iteraciones se puede añadir un tooltip accesible.

### Posición en la página

```
[EleccionSelector / nav]
[OpcionSelector]         ← existente (Story 2.2)
[LevelSelector]          ← nuevo (Story 2.5)
[div#map-persist]        ← mapa
[DataTable]              ← accesible
```

### Referencias

- [epics.md § Story 2.5, FR13, UX-DR7] · [architecture.md AR5, AR8] · [url-state.ts NIVELES] · [contracts/votes.ts NivelGeografico] · [map-state.ts $level] · [ChoroplethMap.vue reloadData] · [Story 2.2 OpcionSelector] · [Story 2.4 ZoneSheet]

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6
