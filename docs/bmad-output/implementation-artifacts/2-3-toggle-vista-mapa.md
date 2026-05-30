---
baseline_commit: 1fd6ba1
---

# Story 2.3: Toggle de vista del mapa

Status: ready-for-dev

## Story

As a usuario,
I want alternar entre "quién ganó" y "cómo le fue a una opción",
so that el mapa responda una pregunta por vez.

## Acceptance Criteria

1. **Given** una opción seleccionada (`?opcion=X`) **When** existe el toggle de vista **Then** aparece un control "Ganador | Intensidad" visible sólo cuando hay opción activa.
2. **Given** modo Ganador (default) **Then** las zonas donde la opción ganó mantienen su color; el resto es gris — igual que Story 2.2.
3. **Given** modo Intensidad **When** el usuario lo activa **Then** el mapa muestra un gradiente (claro→color del partido) proporcional al % de votos de esa opción en cada zona, sin importar si ganó o no.
4. **Given** modo Intensidad **Then** la leyenda muestra 3 swatches de gradiente (alto/medio/bajo) con el nombre del partido; no hay markers de sigla por zona (todos los colores son del mismo partido).
5. **Given** el toggle **Then** nunca se superponen dos variables: Ganador y modo Intensidad son mutuamente excluyentes (FR3).
6. **Given** la opción se limpia (usuario pulsa "Ver todos") **Then** la vista vuelve a modo ganador completo y el toggle desaparece.
7. **Given** el usuario navega a otro departamento **Then** el vistaMode se resetea a Ganador para el nuevo contexto.

## Tasks / Subtasks

- [ ] **Task 1: Estado + helpers en ChoroplethMap.vue (AC: 2, 3)**
  - [ ] Añadir `vistaMode = ref<'ganador' | 'intensidad'>('ganador')` y `opcionActiva = ref<string | null>(null)` como estado reactivo local.
  - [ ] Añadir `zonasVotos: Map<string, Map<string, number>>` y `zonasValidos: Map<string, number>` como variables de módulo; poblarlas en `loadData` desde `votes.zonas[].porOpcion` y `votes.zonas[].validos`.
  - [ ] Añadir flag `let intensidadActive = false` para trackear si se hizo `setData` con el FC de intensidad (necesario para saber si hay que restaurar con `setData(fcRef.value)` al salir).
  - [ ] `interpolateHex(c1, c2, t)` — interpolación lineal entre dos colores hex 6-dígitos.
  - [ ] `buildIntensidadFC(fc, opcionId, partyColor)` — nuevo FC con colores de gradiente por zona; `t` = `pct / maxPct` normalizado; zonas con 0 votos → `COLOR_SIN_DATOS`.
  - [ ] `buildIntensidadLegend(opcionId, meta)` — 3 entradas: alto/medio/bajo con colores interpolados y sigla del partido en la primera.

- [ ] **Task 2: Refactor applyOpcionFilter (AC: 2, 3, 5, 6, 7)**
  - [ ] Actualizar `$selection.subscribe`: también actualizar `opcionActiva.value = s.opcion` (para reactividad en template).
  - [ ] En `applyOpcionFilter(opcionId)`: si `!opcionId`, restaurar `setData(fc)` si `intensidadActive`, resetear `vistaMode.value = 'ganador'`, limpiar `intensidadActive`, restore leyenda normal.
  - [ ] En modo ganador con opcionId: si `intensidadActive`, primero `setData(fc)` para restaurar colors originales, luego `setPaintProperty` con expresión ganador.
  - [ ] Nueva función `applyIntensidadMode(opcionId)`: `buildIntensidadFC` → `setData(gradientFC)` → `setPaintProperty(['get', 'color'])` → limpiar markers → `buildIntensidadLegend`.
  - [ ] Nueva función `setVista(mode: 'ganador' | 'intensidad')`: actualiza `vistaMode.value`, llama `applyOpcionFilter` con opcion actual para re-aplicar.
  - [ ] En `reloadData`: resetear `intensidadActive = false` y `vistaMode.value = 'ganador'` ANTES de llamar `applyOpcionFilter` (AC: 7).

- [ ] **Task 3: Toggle UI en template (AC: 1, 5)**
  - [ ] Añadir `<div v-if="opcionActiva" class="vista-toggle">` con dos botones "Ganador" e "Intensidad".
  - [ ] Botón activo distinguido visualmente (e.g. `font-weight: bold`, borde más oscuro).
  - [ ] Posición: entre el readout y la leyenda, dentro de `.map-wrap`.
  - [ ] A11y: `role="group"`, `aria-label="Tipo de vista del mapa"`; cada botón `aria-pressed`.

- [ ] **Task 4: Verificación en navegador (AC: 1–7)**
  - [ ] Seleccionar FA en Montevideo → toggle aparece en modo Ganador (default).
  - [ ] Activar Intensidad → gradiente visible (barrios con más votos FA = color más intenso); leyenda = 3 swatches FA (alto/medio/bajo); markers desaparecen.
  - [ ] Volver a Ganador → markers reaparecen solo en zonas FA; gris en PN; leyenda de 1 entrada.
  - [ ] "Ver todos" → toggle desaparece; mapa vuelve a coloreo normal por ganador.
  - [ ] Navegar Montevideo → Rivera con modo Intensidad activo → Rivera carga en modo Ganador (AC: 7).
  - [ ] `astro check` 0 · `npm run build` verde.

## Dev Notes

### Datos para intensidad
`votes.json → zonas[].porOpcion` ya contiene `{opcionId, votos}` por zona. En `loadData`, poblar:
```typescript
for (const z of votes.zonas) {
  const key = norm(z.geoId);
  const m = new Map<string, number>();
  for (const { opcionId, votos } of z.porOpcion) m.set(opcionId, votos);
  zonasVotos.set(key, m);
  zonasValidos.set(key, z.validos);
}
```

### buildIntensidadFC
Normaliza por el máximo local (maxPct en el dept actual):
```typescript
function buildIntensidadFC(fc, opcionId, partyColor) {
  const LIGHT = '#f0f4f8';
  let maxPct = 0;
  for (const f of fc.features) {
    const key = norm(String(f.properties.name));
    const votos = zonasVotos.get(key)?.get(opcionId) ?? 0;
    const validos = zonasValidos.get(key) ?? 0;
    if (validos > 0 && votos / validos > maxPct) maxPct = votos / validos;
  }
  return { ...fc, features: fc.features.map(f => {
    const key = norm(String(f.properties.name));
    const votos = zonasVotos.get(key)?.get(opcionId) ?? 0;
    const validos = zonasValidos.get(key) ?? 0;
    const t = (validos > 0 && maxPct > 0) ? (votos / validos) / maxPct : 0;
    return { ...f, properties: { ...f.properties, color: t > 0.01 ? interpolateHex(LIGHT, partyColor, t) : COLOR_SIN_DATOS } };
  }) } as FeatureCollection;
}
```

### interpolateHex
Solo válido para strings `#rrggbb` (6 dígitos). Los colores de `party-colors.ts` son todos 6-dígitos.
```typescript
function interpolateHex(c1: string, c2: string, t: number): string {
  const p = (s: string) => [parseInt(s.slice(1,3),16), parseInt(s.slice(3,5),16), parseInt(s.slice(5,7),16)];
  const [r1,g1,b1] = p(c1); const [r2,g2,b2] = p(c2);
  const h = (n: number) => Math.round(n).toString(16).padStart(2,'0');
  return `#${h(r1+(r2-r1)*t)}${h(g1+(g2-g1)*t)}${h(b1+(b2-b1)*t)}`;
}
```

### buildIntensidadLegend — sin votos (MapLegend no lo muestra)
```typescript
function buildIntensidadLegend(opcionId, meta) {
  const LIGHT = '#f0f4f8';
  return [
    { sigla: meta.sigla, nombre: `${meta.nombre} — intensidad alta`, color: meta.color, votos: 0 },
    { sigla: '', nombre: 'Intensidad media', color: interpolateHex(LIGHT, meta.color, 0.4), votos: 0 },
    { sigla: '', nombre: 'Intensidad baja', color: interpolateHex(LIGHT, meta.color, 0.15), votos: 0 },
  ];
}
```

### Restaurar datos al salir de intensidad
Cuando `intensidadActive = true` y el usuario cambia a ganador o limpia opcion, hay que restaurar los datos originales antes de cambiar la expresión de pintura:
```typescript
if (intensidadActive) {
  (m.getSource('zonas') as GeoJSONSource).setData(fcRef.value!);
  intensidadActive = false;
}
m.setPaintProperty('zonas-fill', 'fill-color', ['get', 'color']); // ahora lee colores originales
```

### opcionActiva ref para reactividad del template
La suscripción `$selection.subscribe` ya existe. Añadir `opcionActiva.value = s.opcion` para que el template `v-if="opcionActiva"` del toggle sea reactivo.

### reloadData: reset de vistaMode
Al principio de la sección try/catch en `reloadData`, ANTES de llamar `applyOpcionFilter`:
```typescript
intensidadActive = false;
vistaMode.value = 'ganador';
```
Esto garantiza que navegar a otro depto siempre empieza en modo ganador (AC: 7).

### MapLegend.vue — sin cambios
El componente no muestra el campo `votos`, solo `sigla`, `nombre`, `color`. Las 3 entradas de intensidad funcionan sin modificar `MapLegend.vue`.

### Regresiones a proteger
- Modo ganador (Story 2.2) no debe cambiar en comportamiento.
- "Ver todos" sigue limpiando opcion y reseteando todo.
- Rivera sigue funcionando con sus 36 series.
- `astro check` en 0.

### Referencias
- [epics.md § Story 2.3] · [architecture.md FR3] · [Story 2.2] · [ChoroplethMap.vue] · [party-meta.ts] · [contracts/votes.ts `porOpcion`].

## Dev Agent Record

### Agent Model Used
<!-- to be filled -->

### Debug Log References
<!-- to be filled -->

### Completion Notes
<!-- to be filled -->
