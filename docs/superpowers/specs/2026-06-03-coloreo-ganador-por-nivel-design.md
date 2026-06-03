# Coloreo del mapa por opción ganadora a cualquier nivel (lema → precandidato → sublema → lista)

Fecha: 2026-06-03 · Estado: diseño aprobado, pendiente de plan de implementación.

## Problema

El modo **Ganador** del toggle del mapa (`Ganador / Heatmap / Share`) siempre hace *roll-up a
lema*: `ganadorSelDeZona` agrega los votos por partido y colorea cada zona con
`resolveParty(lema).color`. No se puede ver quién ganó **dentro** de un partido: qué sublema,
qué precandidato o qué lista lidera cada zona.

Queremos que el modo Ganador pueda calcular y colorear al ganador a **cualquier nivel** de la
escalera de la contienda (lema / precandidato / sublema / lista), con una **paleta en cascada**
derivada del color del lema padre, y dejar la **arquitectura lista para asignar un SVG/logo
custom** a un sublema o a una lista en el futuro (ej.: logo del MPP), sin rehacer nada.

Restricción dura del usuario: **que no rompa ni sature la UI.**

## Decisiones tomadas (brainstorming)

1. **Nivel del ganador:** selector explícito **"Ganador por: Lema · Precandidato · Sublema ·
   Lista"** (no auto-derivado de la selección).
2. **Universo:** **selección si hay, todas si no** (mismo modelo mental que hoy: con selección
   compite lo marcado; sin selección, el ganador absoluto del nivel).
3. **Paleta:** cascada determinística por **luminosidad** desde el color del lema padre (el
   algoritmo exacto es secundario; los colores de lema —FA violeta, PC rojo, etc.— salen de
   `resolveParty`). Lo importante es **dejar la puerta abierta a SVGs custom por sublema y por
   lista**.
4. **Enfoque:** resolver de apariencia en **runtime** + registry de overrides (no hornear en el
   catálogo, no precomputar en ETL).

## Arquitectura (Enfoque A — resolver de apariencia en runtime)

Toda la lógica nueva queda detrás de **dos costuras** en `ChoroplethMap.vue` (+ helpers en
`src/lib`), minimizando el cambio al resto:

- `grupoKeyDeOpcion(opcionId, nivel)` → la clave de agrupación del ganador a ese nivel.
- `resolveOpcionAppearance(key, nivel, eleccion)` → `{ color, label, sigla, pattern }`.

### Componentes

**1. Selector de nivel (UI) — `gnivel`.**
- Mini-selector que aparece **solo en modo Ganador** y **solo si la contienda tiene >1 nivel
  agrupable** (derivado de `catalogo.contiendas[].niveles`). Para balotaje/plebiscito (plano) no
  aparece. Ubicación: inmediatamente debajo del toggle `Ganador/Heatmap/Share` (mismo bloque de
  chrome del mapa, ya reordenado: leyenda → toggle → resultado → ficha).
- Opciones = los niveles intermedios+terminal de la contienda, etiquetados:
  `lema`→"Lema", `precandidato`→"Precandidato", `sublema`→"Sublema", `hoja`→"Lista",
  `candidato`→"Candidato". Default **Lema** (comportamiento idéntico al actual).
- Estado en URL: `?gnivel=lema|precandidato|sublema|lista`. Se **clampa a `lema`** si el nivel no
  existe en la contienda activa (al cambiar de elección/contienda). Vive en el store `map-state`
  junto a `coloreoMode`.

**2. Cómputo del ganador a nivel N.**
- Generalizar `ganadorSelDeZona(key, sel, nombres)` → `ganadorDeZona(zonaKey, universo, nivel)`:
  agrega los votos de las opciones del universo por `grupoKeyDeOpcion(oid, nivel)` y devuelve
  `{ key, votos }` del grupo ganador.
- `grupoKeyDeOpcion(oid, nivel)`:
  - `lema` → `meta.lemaId`
  - `precandidato` → `meta.precandidatoId` (fallback lema si la opción no tiene precandidato)
  - `sublema` → `meta.sublemaId` (fallback al padre que exista: precandidato → lema)
  - `lista`/`hoja`/`candidato` → el propio `oid`
- **Universo:** si `seleccionActiva.length > 0` → la selección; si no → todas las opciones de la
  contienda (de `catalogoOpcMeta`). Idéntico al doble sistema actual (entre-seleccionado vs
  absoluto), ahora parametrizado por nivel.
- **Roll-up exacto:** Σ de los grupos de un nivel == total del nivel superior (la suma de
  sublemas de un lema == el total del lema). Es invariante de test.

**3. `catalogoOpcMeta` ampliado.**
Hoy guarda `{ contienda, lemaId, hoja, lemaNombre }` por `opcionId`. Se amplía a
`{ contienda, lemaId, lemaNombre, hoja, precandidatoId?, sublemaId?, etiqueta? }` leyendo
`grupoId`/`sublemaId`/`precandidatoId` de `catalogo.opciones` y un mapa `nodeId → etiqueta`
(de `catalogo.nodos`) para los labels de leyenda/ficha. El catálogo ya trae los nodos
sublema/precandidato (trabajo previo de esta sesión).

**4. Resolver de apariencia — el seam para SVGs.**
```
resolveOpcionAppearance(key: string, nivel: Nivel, eleccion: string): {
  color: string;            // hex
  label: string;            // "Frente Amplio" | "POR LA PATRIA" | "Lista 609"
  sigla: string;            // del lema padre (para agrupar leyenda)
  pattern: { kind: 'flag' | 'shade' | 'custom'; id: string; url?: string } | null;
}
```
- `nivel === 'lema'` → `resolveParty(lemaNombre, eleccion)`: color + bandera (`kind:'flag'`).
  **Comportamiento actual intacto.**
- `nivel` sub (precandidato/sublema/lista) → color = **cascada** `cascadeShade(colorLemaPadre, key)`
  (sombreado determinístico por luminosidad, hash estable del `key` → mismo nodo, mismo tono);
  `label` = etiqueta del nodo / "Lista N"; `pattern = null` (relleno sólido) salvo override.
- **`APARIENCIA_OVERRIDES`**: `Record<string, { color?: string; svgUrl?: string }>` keyed por
  `${eleccion}:${nivel}:${key}` (con fallback por `key` solo, para reusar un logo entre años).
  **Vacío en esta entrega.** Cuando exista una entrada: `color` pisa la cascada y `svgUrl`
  produce `pattern.kind:'custom'` que el overlay clipea al polígono. Vive en
  `src/lib/appearance-overrides.ts` (TS, no data) para tipado y para evitar regenerar catálogos.

**5. Render en el mapa.**
- `fill-color` sigue siendo `['get','color']`; el FC de cada zona toma `color`/`sigla`/`pattern`
  del resolver (en vez del `resolveParty` hardcodeado de `buildSeleccionGanadorFC`).
- El **flag-overlay** (`drawFlagOverlay`) ya clipea un patrón (bandera) al polígono. Se extiende
  para que el patrón venga del resolver: bandera de lema, SVG custom, o **nada** (sólido) para
  sub-niveles sin override. Registrar el SVG custom como patrón igual que las banderas
  (`addImage`/canvas pattern). Esto evita 40 íconos distintos = no satura.

**6. Leyenda sin saturar.**
- Agrupada por **lema**: un encabezado por lema que gana ≥1 zona (sigla + bandera + color base);
  debajo, los sub-ganadores (sublema/lista) como chips con su shade + nº de zonas ganadas, **cap
  a top-K (p.ej. 6) por lema + "+N más"**.
- Si `gnivel === 'lema'`: leyenda **idéntica** a la actual (un renglón por lema).
- Reusa `MapLegend` con una variante de entradas jerárquica (lema → sub-chips); si agregar
  jerarquía a `MapLegend` lo complica, una sub-lista plana ordenada por lema también sirve.

**7. Dots de circuito — gratis.**
El mismo resolver + `ganadorDeZona` alimentan `circuitStyle` (ya hay paridad zona↔circuito vía
`circuitColorCtx`/`circuitStyle`). Los circuitos heredan el coloreo por nivel sin lógica nueva.

### Flujo de datos

```
URL ?gnivel  ─┐
              ├─► store map-state ─► ChoroplethMap
selección ────┘                         │
                                        ▼
            universo (sel||todas) + nivel ─► ganadorDeZona(zona) ─► grupo ganador {key}
                                        │
                                        ▼
            resolveOpcionAppearance(key, nivel) ─► {color,label,sigla,pattern}
                                        │
                ┌───────────────────────┼───────────────────────┐
                ▼                       ▼                       ▼
          fill-color (FC)        flag-overlay (pattern)      leyenda (agrup. lema)
```

### Manejo de errores / degradación
- Opción sin metadata de nivel (catálogo incompleto / contienda plana) → cae al nivel disponible
  más alto (sublema→precandidato→lema), nunca rompe.
- `gnivel` inválido para la contienda → clamp a `lema`.
- Sin votos del universo en una zona → base claro/gris (igual que hoy).
- Red caída / `catalogoOpcMeta` no cargado → degrada a coloreo por lema (estado actual).

### Testing
- Unit: `grupoKeyDeOpcion` para cada nivel y fallbacks; `ganadorDeZona` con roll-up exacto
  (Σ sublemas == total lema en una zona fixture); determinismo de `cascadeShade` (mismo key →
  mismo hex); clamp de `gnivel` por contienda.
- Gate visual/manual (Playwright): ODN nivel sublema/lista en MVD pinta y la leyenda no explota;
  cambio de contienda resetea `gnivel`; circuitos heredan el coloreo.

## Fuera de alcance (explícito)
- Crear los SVG custom (MPP, etc.) y poblar `APARIENCIA_OVERRIDES`. La entrega deja el seam listo
  y **vacío**.
- Cambiar Heatmap/Share (siguen operando como hoy, sobre la selección).
- Tuning fino del algoritmo de cascada (alcanza con luminosidad determinística).

## Archivos afectados (estimado)
- `src/components/map/ChoroplethMap.vue` — selector `gnivel`, `ganadorDeZona`/`grupoKeyDeOpcion`,
  `catalogoOpcMeta` ampliado, FC/overlay/circuitStyle vía resolver.
- `src/lib/appearance.ts` (nuevo) — `resolveOpcionAppearance` + `cascadeShade`.
- `src/lib/appearance-overrides.ts` (nuevo, vacío) — registry de overrides.
- `src/stores/map-state.ts` — estado `gnivel` + URL.
- `src/components/map/MapLegend.vue` — variante de leyenda agrupada por lema.
- Tests en `src/lib/__tests__` (o donde vivan los tests del proyecto).
