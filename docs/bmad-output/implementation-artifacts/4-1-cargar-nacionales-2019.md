---
baseline_commit: f7cb11e
---

# Story 4.1: Cargar nacionales-2019 como instancia del contrato

Status: ready-for-dev

## Story

As a desarrollador,
I want incorporar nacionales-2019 (Montevideo) vía el ETL existente,
so that haya una segunda elección real para comparar en Epic 4.

## Acceptance Criteria

1. **Given** el contrato polimórfico de Epic 1 **When** corro `npm run etl:nacionales-mvd` **Then** se generan `public/data/nacionales-2019/montevideo/votes.json` y `public/data/nacionales-2019/montevideo/opciones.json` con el esquema `VotosShard` válido (tipo=`'nacionales'`, escrutinio=`'definitivo'`).
2. **Given** el shard generado **When** corren los gates de reconciliación y cobertura **Then** ambos pasan sin cambiar el esquema del contrato.
3. **Given** la ruta SSG `/nacionales-2019/montevideo` **When** corro `npm run build` **Then** la página se genera, la OG-image se genera en `public/og/nacionales-2019/montevideo.png`, y `public/search-index.json` incluye la nueva elección.
4. **Given** `astro check` y `npm run build` **Then** 0 errores TypeScript.

## Tasks / Subtasks

- [ ] **Task 1: Nuevo transform `aggregate-nacionales-mvd.ts` (AC: 1, 2)**
  - [ ] Crear `etl/transform/aggregate-nacionales-mvd.ts`
  - [ ] Filtrar TipoRegistro ∈ {HOJA_EN, VOTO_LEMA}; mapear CRV → barrio vía mapping
  - [ ] Agrupar por barrio → Lema; producir `AggregateByCircuitoResult`

- [ ] **Task 2: Runner ETL `run-nacionales-2019-montevideo.ts` (AC: 1, 2)**
  - [ ] Crear `etl/run-nacionales-2019-montevideo.ts` siguiendo el patrón de `run-montevideo.ts`
  - [ ] Leer mapping de `data/mappings/montevideo-circuito-barrio.json` (ya generado por `etl:montevideo`)
  - [ ] Reusar geometría de `public/data/geo/montevideo/zona.topo.json` (ya generada)
  - [ ] Gate reconciliación + gate cobertura
  - [ ] Agregar `etl:nacionales-mvd` al `package.json`

- [ ] **Task 3: Nueva ruta SSG y metadatos dinámicos (AC: 3)**
  - [ ] Agregar `{ params: { eleccion: 'nacionales-2019', departamento: 'montevideo' } }` en `getStaticPaths()` de `src/pages/[eleccion]/[departamento].astro`
  - [ ] Agregar `nacionales-2019` al `DEPT_AVAIL` map (nivel `'zona'`)
  - [ ] Hacer dinámico el título/descripción de la página (no hardcodeado "Internas 2024")
  - [ ] Agregar la ruta a `ROUTES` en `scripts/generate-og.mjs`
  - [ ] Agregar la ruta a `ROUTES` en `scripts/generate-search-index.mjs`

- [ ] **Task 4: Verificar build completo (AC: 3, 4)**
  - [ ] Correr `npm run etl:nacionales-mvd` → gates verdes
  - [ ] Correr `npm run build` → 0 errores, OG-image generada, sitemap actualizado
  - [ ] Verificar en browser que `/nacionales-2019/montevideo` carga y muestra el mapa

## Dev Notes

### Diferencia crítica de schema CSV

El CSV `data/raw/electoral/nacionales-2019/montevideo_odd.csv` tiene un schema **completamente diferente** a los CSVs de internas-2024:

```
internas-2024: PARTIDO, DEPTO, CIRCUITO, SERIES, ESCRUTINIO, PRECANDIDATO, HOJA, CNT_VOTOS, ZONA
nacionales-2019: TipoRegistro, Departamento, CRV, Series, Lema, Descripcion1, CantidadVotos
```

Mappeo de columnas:
- `CRV` = CIRCUITO (número de circuito)
- `Lema` = nombre del partido (equivalente a PARTIDO)
- `CantidadVotos` = votos
- **No tiene ESCRUTINIO** — este CSV ES el definitivo (es el `_odd.csv`)
- **No tiene ZONA** — el join geográfico se hace por CRV → barrio vía mapping

`TipoRegistro` tiene dos valores relevantes:
- `HOJA_EN` (133.232 filas): votos de una lista/hoja específica de nacionales, atribuidos al Lema
- `VOTO_LEMA` (4.738 filas): votos directos al lema (sin listas — envejecen como voto de partido)
- Ambos se INCLUYEN en la agregación a nivel partido/lema

### Función de agregación nueva: `aggregate-nacionales-mvd.ts`

```ts
// etl/transform/aggregate-nacionales-mvd.ts
import type { AgregadoZona, VotoOpcion } from '../../src/lib/contracts';
import { normName, slug } from '../lib/normalize';

export interface AggregateNacionalesResult {
  zonas: AgregadoZona[];
  totalCanonico: number;
  unmappedVotos: number;
  circuitosSinBarrio: string[];
  opciones: { opcionId: string; nombre: string }[];
}

export function aggregateNacionalesMvd(
  rows: Record<string, string>[],
  crvToBarrio: Record<string, string>,
): AggregateNacionalesResult {
  // Filtrar: solo HOJA_EN + VOTO_LEMA de MO
  const relevant = rows.filter(r =>
    (r['TipoRegistro'] === 'HOJA_EN' || r['TipoRegistro'] === 'VOTO_LEMA') &&
    r['Departamento'] === 'MO'
  );

  const porBarrio = new Map<string, { display: string; lemas: Map<string, number> }>();
  const opcionesPorId = new Map<string, string>();
  const circuitosSinBarrio = new Set<string>();
  let totalCanonico = 0;
  let unmappedVotos = 0;

  for (const r of relevant) {
    const votos = Number(r['CantidadVotos']) || 0;
    if (votos < 0) continue;
    totalCanonico += votos;

    const crv = (r['CRV'] ?? '').trim();
    const barrio = crvToBarrio[crv] ?? crvToBarrio[String(Number(crv))];
    if (!barrio) {
      circuitosSinBarrio.add(crv);
      unmappedVotos += votos;
      continue;
    }

    const lema = (r['Lema'] ?? '').trim();
    if (!lema) continue;

    const key = normName(barrio);
    let entry = porBarrio.get(key);
    if (!entry) {
      entry = { display: barrio, lemas: new Map() };
      porBarrio.set(key, entry);
    }
    entry.lemas.set(lema, (entry.lemas.get(lema) ?? 0) + votos);
    opcionesPorId.set(slug(lema), lema);
  }

  const zonas: AgregadoZona[] = [];
  for (const [, entry] of porBarrio) {
    const ranking = [...entry.lemas.entries()].sort((a, b) => b[1] - a[1]);
    const validos = ranking.reduce((s, [, v]) => s + v, 0);
    const porOpcion: VotoOpcion[] = ranking.map(([lema, v]) => ({ opcionId: slug(lema), votos: v }));
    zonas.push({
      geoId: entry.display,
      ganadorOpcionId: ranking.length ? slug(ranking[0][0]) : '',
      validos,
      porOpcion,
      noPartidarios: { enBlanco: 0, anulados: 0, observados: 0 },
    });
  }

  return {
    zonas,
    totalCanonico,
    unmappedVotos,
    circuitosSinBarrio: [...circuitosSinBarrio],
    opciones: [...opcionesPorId.entries()].map(([opcionId, nombre]) => ({ opcionId, nombre })),
  };
}
```

**Nota sobre blanco/anulados:** El CSV de nacionales-2019 no incluye blanco/anulados en las filas de HOJA_EN ni VOTO_LEMA. Quedan en 0 en `noPartidarios` (aceptable en esta historia; Fase 2 puede agregarlos desde fuente separada).

### Runner `run-nacionales-2019-montevideo.ts`

Diferencias clave respecto a `run-montevideo.ts`:
1. **No recalcula la mapping** — la lee del JSON ya generado por `etl:montevideo`
2. **No regenera la geometría** — lee `public/data/geo/montevideo/zona.topo.json` directamente
3. Llama a `aggregateNacionalesMvd` (nueva función) en lugar de `aggregateByCircuito`
4. Pasa `tipo: 'nacionales'` al `buildShard`

```ts
// Constantes del runner
const CSV = 'data/raw/electoral/nacionales-2019/montevideo_odd.csv';
const MAPPING_IN = 'data/mappings/montevideo-circuito-barrio.json';
const GEO_IN = 'public/data/geo/montevideo/zona.topo.json';
const SHARD_OUT = 'public/data/nacionales-2019/montevideo/votes.json';
const OPCIONES_OUT = 'public/data/nacionales-2019/montevideo/opciones.json';
```

Flujo:
```
parseCsv(CSV)
  → aggregateNacionalesMvd(rows, crvToBarrio)
  → buildShard(zonas, { tipo: 'nacionales', eleccionId: 'nacionales-2019', ... })
  → writeShard + writeOpciones
  → reconcile (gate)
  → checkCoverage con geoNames de GEO_IN (gate)
```

Para leer los nombres de barrios desde el TopoJSON existente:
```ts
import { readFileSync } from 'node:fs';
import { feature } from 'topojson-client';
// ...
const topo = JSON.parse(readFileSync(GEO_IN, 'utf8'));
const obj = topo.objects['zonas'];
const fc = feature(topo, obj);
const geoNames = fc.features.map(f => String(f.properties.name));
```

### Mappeo de circuito→barrio para nacionales-2019

El archivo `data/mappings/montevideo-circuito-barrio.json` tiene la estructura:
```json
{ "crvToBarrio": { "1": "Ciudad Vieja", "2": "Ciudad Vieja", ... } }
```

El `crvToBarrio` ya mapea número de circuito (CRV) al barrio. Leer así:
```ts
const { crvToBarrio } = JSON.parse(readFileSync(MAPPING_IN, 'utf8'));
```

**Dependencia explícita:** Este runner requiere que `npm run etl:montevideo` haya corrido antes (para generar el mapping y la geometría). Documentar en el console.log del runner.

### Ruta SSG — cambios en `[departamento].astro`

El archivo actualmente tiene:
1. `getStaticPaths()` hardcodeado con solo 2 rutas internas-2024
2. `titulo` y `descripcion` hardcodeados con "Internas 2024"
3. `DEPT_AVAIL` solo con `montevideo` y `rivera`

Cambios necesarios:
```ts
// getStaticPaths — agregar:
{ params: { eleccion: 'nacionales-2019', departamento: 'montevideo' } }

// DEPT_AVAIL — agregar:
'nacionales-2019-montevideo': ['zona']  // o reusar la clave 'montevideo'
```

Para el nivel geográfico, nacionales-2019 Montevideo usa barrios (nivel `'zona'`), igual que internas-2024. Opciones para `DEPT_AVAIL`:
- Clave `departamento` no alcanza porque el mismo departamento puede tener distintos niveles por elección
- Solución simple: keying por `departamento` (no por elección) es suficiente porque Montevideo SIEMPRE es zona

**Título dinámico:**
```ts
const ELECCION_LABELS: Record<string, string> = {
  'internas-2024': 'Elecciones Internas 2024',
  'nacionales-2019': 'Elecciones Nacionales 2019',
};
const eleccionLabel = ELECCION_LABELS[eleccion] ?? eleccion;
const titulo = `${deptLabel} — ${eleccionLabel} | Uruguay Electoral Map`;
const descripcion = `Resultados por zona del departamento ${deptLabel} en las ${eleccionLabel}.`;
```

### Scripts `generate-og.mjs` y `generate-search-index.mjs`

Ambos tienen un array `ROUTES` hardcodeado. Agregar:
```js
{ eleccion: 'nacionales-2019', departamento: 'montevideo' }
```

El script `generate-og.mjs` ya sabe leer `public/data/{eleccion}/{departamento}/votes.json` y `opciones.json`, y la geometría de `public/data/geo/{departamento}/zona.topo.json` — la nueva ruta funciona sin cambios en la lógica del script.

### Script `package.json`

Agregar en `scripts`:
```json
"etl:nacionales-mvd": "esbuild etl/run-nacionales-2019-montevideo.ts --bundle --platform=node --format=cjs --outfile=node_modules/.cache/etl-nac-mvd.cjs --log-level=warning && node node_modules/.cache/etl-nac-mvd.cjs"
```

### Archivos a crear/modificar

| Acción | Archivo |
|--------|---------|
| NEW    | `etl/transform/aggregate-nacionales-mvd.ts` |
| NEW    | `etl/run-nacionales-2019-montevideo.ts` |
| UPDATE | `package.json` — agregar `etl:nacionales-mvd` |
| UPDATE | `src/pages/[eleccion]/[departamento].astro` — nueva ruta + título dinámico |
| UPDATE | `scripts/generate-og.mjs` — agregar ruta nacionales-2019/montevideo |
| UPDATE | `scripts/generate-search-index.mjs` — agregar ruta nacionales-2019/montevideo |

### Lo que NO cambia

- El contrato `VotosShard` y `AgregadoZona` (sin cambio de schema)
- La geometría de Montevideo (`public/data/geo/montevideo/zona.topo.json`)
- El mapping `data/mappings/montevideo-circuito-barrio.json`
- Los shards de internas-2024 Montevideo y Rivera
- Los gates `reconcile.ts` y `coverage.ts` (se reusan sin cambios)

### Nav de elecciones (Story 4.2)

La barra de navegación en `[departamento].astro` actualmente solo muestra Montevideo y Rivera (hardcodeado). En esta historia NO modificar esa barra — Story 4.2 agrega el selector de elección. Solo agregar la ruta SSG es suficiente.

### Lema "Partido Frente Amplio" en nacionales-2019

Los colores de partido en `src/lib/party-colors.ts` usan slugs como `'frente-amplio'`. La función `slug('Partido Frente Amplio')` produce `'partido-frente-amplio'`, que NO matchea el slug de internas-2024 `'frente-amplio'`.

Para Story 4.1 (ETL + datos): es aceptable que nacionales-2019 use slugs largos (`'partido-frente-amplio'`). El mapa coloreará los partidos correctamente solo si `party-colors.ts` tiene esa clave — de lo contrario usará el color de fallback.

**Solución para 4.1:** Verificar que los opciones.json emiten nombres correctos. Si los colores del mapa no coinciden con los partidos correctos, agregar las claves largas a `party-meta.ts` o `party-colors.ts`. No es un bloqueador del gate de build, pero sí visible en la UI.

Alternativa preferida: normalizar el `Lema` en `aggregateNacionalesMvd` quitando el prefijo "Partido " antes de hacer el slug:
```ts
// Normalizar: "Partido Frente Amplio" → "Frente Amplio" → slug → "frente-amplio"
const lemaDisplay = lema.replace(/^Partido\s+/i, '');
```
Esto produce slugs compatibles con internas-2024. **Implementar esta normalización.**

### Referencias

- [Source: etl/run-montevideo.ts] — patrón del runner (steps: votes → geometry → reconcile → coverage)
- [Source: etl/transform/aggregate-by-circuito.ts] — patrón de agregación por circuito→barrio
- [Source: etl/transform/aggregate-by-serie.ts] — patrón de agregación alternativa
- [Source: etl/load/emit-shard.ts] — buildShard + writeShard
- [Source: etl/gates/reconcile.ts] y [Source: etl/gates/coverage.ts] — gates reutilizados
- [Source: data/raw/electoral/nacionales-2019/montevideo_odd.csv] — schema real del CSV fuente
- [Source: data/mappings/montevideo-circuito-barrio.json] — mapping CRV→barrio pre-generado
- [Source: src/lib/contracts/votes.ts] — VotosShard (sin cambios)
- [Source: src/pages/[eleccion]/[departamento].astro] — getStaticPaths + título a hacer dinámico

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List
