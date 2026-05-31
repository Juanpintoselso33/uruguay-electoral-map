---
baseline_commit: c35f404386d10e5306aca3eab5a99cc5bf7c38fd
---

# Story 7.2: ETL + ingesta para balotaje 2024

Status: done

## Story

As a usuario,
I want explorar el balotaje presidencial 2024 (Orsi vs Delgado) en el mapa,
so that vea cómo votó cada zona del país en la segunda vuelta.

## Acceptance Criteria

1. **Given** los datos de la Corte Electoral para el balotaje 2024 **When** corro el ETL con `tipo=balotaje` **Then** produce shards válidos sin HOJA (`opcion_id = candidato`) con exactamente 2 opciones por zona **And** `blanco/anulado/observado` quedan como categorías separadas en `noPartidarios` **And** los gates de integridad pasan (reconciliación de válidos, cobertura ≥95%).
2. **Given** los shards generados **When** corro `npx astro check` y `npm run build` **Then** las rutas SSG `/balotaje-2024/{depto}` se generan correctamente para cada departamento procesado **And** el build no falla.
3. **Given** el CSV del balotaje **When** el ETL produce el shard **Then** `VotosShard.tipo === 'balotaje'` y cada `zonas[i].porOpcion` tiene exactamente 2 entradas (Frente Amplio / Coalición Republicana).

## Tasks / Subtasks

- [x] **T1** — Obtener y analizar el CSV del balotaje 2024 (AC: 1)
  - [x] T1.1 — Descargar datos del balotaje 2024 desde la Corte Electoral (ver URL en Dev Notes) → guardar en `data/raw/electoral/balotaje-2024/`
  - [x] T1.2 — Inspeccionar header del CSV (columnas reales) y comparar con los Formatos A/B documentados en Dev Notes
  - [x] T1.3 — Identificar: columna de etapa canónica, columna de partido/lema, columna de serie/circuito, y marcadores de blanco/anulado/observado

- [x] **T2** — Crear `etl/transform/aggregate-balotaje-by-serie.ts` (AC: 1, 3)
  - [x] T2.1 — Función `aggregateBalotajeBySerie(rows)` que agrupa por SERIES usando columna PARTIDO/LEMA → mapa fijo a `'frente-amplio'` / `'coalicion-republicana'`
  - [x] T2.2 — Manejar `noPartidarios` con el mismo patrón que `aggregate-by-circuito.ts` (map `NO_PARTIDARIOS` sobre la columna de partido)
  - [x] T2.3 — Catálogo `opciones` retorna exactamente 2 entradas: `{ opcionId: 'frente-amplio', nombre: 'Frente Amplio' }` y `{ opcionId: 'coalicion-republicana', nombre: 'Coalición Republicana' }`
  - [x] T2.4 — Si el CSV tiene Formato A (columna ESCRUTINIO), aceptar `escrutinioCanonico` como parámetro; si Formato B (desglose sin ESCRUTINIO), filtrar por `TIPO_REGISTRO`

- [x] **T3** — Crear `etl/run-balotaje-mvd.ts` — piloto Montevideo (AC: 1, 2)
  - [x] T3.1 — Reutilizar mapping circuito→barrio existente (`data/mappings/montevideo-circuito-barrio.json`), generado previamente por `etl:montevideo`
  - [x] T3.2 — Adaptar `aggregate-by-circuito.ts` para balotaje (ver Dev Notes): la lógica de PARTIDO → opcionId es idéntica; sólo cambia el mapa de opciones esperadas
  - [x] T3.3 — Emitir `public/data/balotaje-2024/montevideo/votes.json` y `public/data/balotaje-2024/montevideo/opciones.json` con `buildShard` + `writeShard`
  - [x] T3.4 — Correr gates: `reconcile` + `checkCoverage` (umbral ≥95%)

- [x] **T4** — Crear `etl/run-balotaje-interior.ts` — orchestrator interior compartido (AC: 1, 2)
  - [x] T4.1 — Misma estructura que `interior-dept.ts` pero con `tipo: 'balotaje'` y llamando a `aggregateBalotajeBySerie` en lugar de `aggregateBySerie`
  - [x] T4.2 — Piloto con Colonia como primer depto interior (geometría ya generada en `public/data/geo/colonia/serie.topo.json`)
  - [x] T4.3 — Verificar gates para Colonia

- [x] **T5** — Actualizar configuración de rutas y manifesto (AC: 2)
  - [x] T5.1 — `src/config/departments.json`: agregar `'balotaje-2024'` al array `elecciones` de cada depto con datos procesados
  - [x] T5.2 — `public/data/elections-meta.json`: agregar `'balotaje-2024'` a `availableElections` y listar los departamentos disponibles
  - [x] T5.3 — `src/pages/[eleccion]/[departamento].astro`: agregar `'balotaje-2024': 'Balotaje 2024'` al mapa `ELECCION_LABELS`

- [x] **T6** — Agregar scripts npm `etl:balotaje-*` (AC: 2)
  - [x] T6.1 — `package.json`: agregar `"etl:balotaje-mvd"` y `"etl:balotaje-colo"` (ver patrón en Dev Notes)

- [x] **T7** — Verificación final (AC: 2, 3)
  - [x] T7.1 — `npx astro check` → 0 errores
  - [x] T7.2 — `npm run build` → rutas `/balotaje-2024/montevideo` y `/balotaje-2024/colonia` generadas sin error

### Review Findings

- [x] [Review][Patch] Side-effect call al tope del módulo en run-balotaje-interior.ts [etl/run-balotaje-interior.ts:96] — envuelto con `if (require.main === module)`
- [x] [Review][Patch] CRV vacío o no-numérico da lookup falso en aggregate-balotaje-mvd.ts [etl/transform/aggregate-balotaje-mvd.ts:54] — guard `if (!crv)` + `Number.isFinite` antes del fallback
- [x] [Review][Patch] `split(/\s+/)` sin `.filter(Boolean)` puede producir `geoId = ''` [etl/transform/aggregate-balotaje-by-serie.ts:63] — agregado `.filter(Boolean)`
- [x] [Review][Patch] Nav filter hardcodeado a `'internas-2024'` oculta deptos balotaje-only [src/pages/[eleccion]/[departamento].astro:66] — cambiado a `d.elecciones.includes(eleccion)`
- [x] [Review][Patch] `OPCIONES_BALOTAJE` duplicado en dos archivos [etl/transform/aggregate-balotaje-mvd.ts:31] — exportado desde `aggregate-balotaje-by-serie.ts`, importado en mvd
- [x] [Review][Defer] Script `etl:balotaje-colo` nombre ambiguo — refactorizar cuando se agreguen más deptos interiores; deferred, pre-existing
- [x] [Review][Defer] Filtro exterior asimétrico MVD (`=== 'BZZ'`) vs interior (`endsWith('ZZ')`) — normalizar en futura Story ETL; deferred, pre-existing
- [x] [Review][Defer] `nivel` hardcodeado en `BalotajeInteriorConfig` — agregar cuando haya dpto interior con nivel distinto; deferred, pre-existing
- [x] [Review][Defer] CSV re-parseado completo en cada invocación de `runBalotajeInteriorDept` — patrón pre-existente de todos los ETL; deferred, pre-existing
- [x] [Review][Defer] `ganadorOpcionId` en empate → frente-amplio — empates imposibles en práctica; aclarar en Story 7.5; deferred, pre-existing

## Dev Notes

### Contexto: qué ya existe

El contrato v2 (Story 7.1, done) ya soporta `tipo: 'balotaje'`:
- `EleccionTipo` incluye `'balotaje'`
- `OpcionCandidato` ya existe: `{ clase: 'candidato', candidato: string, partidoId: string }`
- `assertVotosShard` valida genéricamente — no hay cambios al contrato para esta story
- **Fixture `balotaje.fixture.ts` existe** y pasa todos los guards:
  ```ts
  { clase: 'candidato', id: 'b24-orsi', candidato: 'Yamandú Orsi', partidoId: 'frente-amplio' }
  { clase: 'candidato', id: 'b24-delgado', candidato: 'Álvaro Delgado', partidoId: 'coalicion-republicana' }
  ```

No hay raw data del balotaje en `data/raw/electoral/` — es la **primera tarea** descargarlo.

### URL de datos — Corte Electoral

https://catalogodatos.gub.uy/dataset/corte-electoral-elecciones-nacionales-segunda-vuelta-2024

Buscar el archivo de "desglose de votos" del balotaje 2024 (segunda vuelta). Guardarlo en:
```
data/raw/electoral/balotaje-2024/
```

### Esquemas CSV conocidos — el dev debe inspeccionar cuál aplica

El proyecto ya maneja 3 formatos distintos de CSV. El balotaje 2024 probablemente siga el **Formato B** (el más moderno, igual que internas-2024), pero hay que verificar el header real:

| Formato | Archivo de referencia | Columnas clave |
|---------|----------------------|----------------|
| A — canónico CLAUDE.md | `public/montevideo_odn.csv` | `PARTIDO, DEPTO, CIRCUITO, SERIES, ESCRUTINIO, PRECANDIDATO, HOJA, CNT_VOTOS, ZONA` |
| B — desglose moderno | `data/raw/electoral/internas-2024/desglose-de-votos.csv` | `DEPARTAMENTO, TIPO_REGISTRO, CIRCUITO, SERIES, LEMA, CANTIDAD_VOTOS` |
| C — nacionales-2019 | `data/raw/electoral/nacionales-2019/montevideo_odd.csv` | `CRV, Lema, CantidadVotos, TipoRegistro` |

**Clave del T1**: inspeccionar `head -1 <archivo-balotaje>.csv` y decidir cuál Formato aplica.

### Diseño de `aggregate-balotaje-by-serie.ts`

La lógica es similar a `aggregate-by-serie.ts` pero con mapa fijo de LEMA → candidato.

**Para Formato B** (columnas LEMA, TIPO_REGISTRO, SERIES):
```ts
// Mapa fijo — ajustar al valor exacto de la columna LEMA en el CSV real
const LEMA_A_OPCION: Record<string, { opcionId: string; nombre: string }> = {
  'FRENTE AMPLIO': { opcionId: 'frente-amplio', nombre: 'Frente Amplio' },
  'PARTIDO NACIONAL': { opcionId: 'coalicion-republicana', nombre: 'Coalición Republicana' },
  'COALICION REPUBLICANA': { opcionId: 'coalicion-republicana', nombre: 'Coalición Republicana' },
};

// Marcadores no partidarios (ajustar según CSV real)
const NO_PARTIDARIOS = new Map<string, keyof CatAcc>([
  ['EN BLANCO', 'enBlanco'], ['BLANCO', 'enBlanco'],
  ['ANULADO', 'anulados'], ['ANULADOS', 'anulados'],
  ['OBSERVADO', 'observados'], ['OBSERVADOS', 'observados'],
]);

// Filtro TIPO_REGISTRO: inspeccionar CSV para identificar el valor correcto
// Para internas usa 'HOJA_ODN'; para balotaje puede ser 'HOJA_ODN', 'VOTO_LEMA', etc.
```

**Para Formato A** (columna ESCRUTINIO):
```ts
// Filtrar filas: r['ESCRUTINIO'] === escrutinioCanonico
// escrutinioCanonico: inspeccionar el CSV y buscar la etapa final ('Departamental', 'Nacional', etc.)
// Usar PARTIDO como columna de lema
```

### Aggregate para Montevideo (zona-based)

`aggregate-by-circuito.ts` ya maneja `PARTIDO` como clave de opción y `noPartidarios` — puede reutilizarse **sin cambios** si el CSV del balotaje tiene columnas compatibles (PARTIDO, CIRCUITO, ESCRUTINIO, CNT_VOTOS).

Crear `etl/run-balotaje-mvd.ts` como copia de `run-nacionales-2019-montevideo.ts` adaptada:
- Cambiar CSV path a balotaje-2024
- Cambiar `eleccionId: 'balotaje-2024'`, `tipo: 'balotaje'`
- Cambiar SHARD_OUT/OPCIONES_OUT a `public/data/balotaje-2024/montevideo/`

### No modificar `interior-dept.ts`

`interior-dept.ts` tiene `tipo: 'internas'` implícito y es instanciado por 18+ run-scripts de internas. Crear `etl/run-balotaje-interior.ts` como orchestrator independiente. Patrón a seguir exacto:

```ts
// Misma estructura que interior-dept.ts pero:
// - DESGLOSE apunta al CSV del balotaje-2024
// - tipo: 'balotaje' en buildShard
// - llama a aggregateBalotajeBySerie() en lugar de aggregateBySerie()
// - eleccionId: 'balotaje-2024'
```

### Opciones.json — formato y colors UI

El formato `{ opciones: [{ opcionId, nombre }] }` es el mismo que internas:
```json
{ "opciones": [
  { "opcionId": "frente-amplio", "nombre": "Frente Amplio" },
  { "opcionId": "coalicion-republicana", "nombre": "Coalición Republicana" }
]}
```

`resolveParty(nombre)` en `src/lib/party-meta.ts` ya tiene entradas para "Frente Amplio" y "Partido Nacional" en la tabla `SIGLAS`. Verificar que "Coalición Republicana" también está; si no, agregar entrada. (El display de nombres de candidato en lugar de lemas es trabajo de Story 7.5.)

### Actualizar rutas SSG

`getStaticPaths()` en `src/pages/[eleccion]/[departamento].astro` lee `departments.json`.
Para que `/balotaje-2024/montevideo` sea ruta generada:

```json
// departments.json — Montevideo:
{ "id": "montevideo", ..., "elecciones": ["internas-2024", "nacionales-2019", "balotaje-2024"] }

// departments.json — Colonia (piloto interior):
{ "id": "colonia", ..., "elecciones": ["internas-2024", "balotaje-2024"] }
```

En `[departamento].astro` agregar al mapa `ELECCION_LABELS`:
```ts
const ELECCION_LABELS: Record<string, string> = {
  'internas-2024':   'Elecciones Internas 2024',
  'nacionales-2019': 'Elecciones Nacionales 2019',
  'balotaje-2024':   'Balotaje 2024',          // ← agregar
};
```

### Script npm (patrón existente)

```json
"etl:balotaje-mvd": "esbuild etl/run-balotaje-mvd.ts --bundle --platform=node --format=cjs --outfile=node_modules/.cache/etl-bal-mvd.cjs --log-level=warning && node node_modules/.cache/etl-bal-mvd.cjs",
"etl:balotaje-colo": "esbuild etl/run-balotaje-interior.ts --bundle --platform=node --format=cjs --outfile=node_modules/.cache/etl-bal-col.cjs --log-level=warning && node node_modules/.cache/etl-bal-col.cjs",
```

### Dependencias de geometría

- `etl:balotaje-mvd` requiere que `etl:montevideo` haya corrido antes → `data/mappings/montevideo-circuito-barrio.json` y `public/data/geo/montevideo/zona.topo.json` deben existir.
- `etl:balotaje-colo` requiere que `etl:colo` haya corrido → `public/data/geo/colonia/serie.topo.json`.

### Archivos a crear (NEW)

| Archivo | Descripción |
|---------|-------------|
| `etl/transform/aggregate-balotaje-by-serie.ts` | Agrega balotaje por SERIES → lema/candidato (interior) |
| `etl/run-balotaje-mvd.ts` | Orchestrator Montevideo balotaje (zona-based) |
| `etl/run-balotaje-interior.ts` | Orchestrator compartido interior balotaje (serie-based) |

### Archivos a modificar (UPDATE)

| Archivo | Cambio |
|---------|--------|
| `src/config/departments.json` | `+balotaje-2024` en array `elecciones` de Mvd + deptos piloto |
| `public/data/elections-meta.json` | `+balotaje-2024` en `availableElections` + lista de deptos |
| `src/pages/[eleccion]/[departamento].astro` | `+ELECCION_LABELS['balotaje-2024']` |
| `package.json` | Scripts `etl:balotaje-mvd` y `etl:balotaje-colo` |

### Qué NO cambiar

- `etl/interior-dept.ts` — no romper las 18+ instancias de internas-2024
- `src/lib/contracts/` — ya soporta balotaje desde Story 7.1, cero cambios
- `etl/transform/aggregate-by-serie.ts` — solo para internas
- `etl/transform/aggregate-by-circuito.ts` — reutilizable as-is si el CSV tiene columnas compatibles

### Verificación

```bash
# Tras correr el ETL:
ls public/data/balotaje-2024/montevideo/   # votes.json + opciones.json
ls public/data/balotaje-2024/colonia/      # votes.json + opciones.json

# Typecheck + build:
npx astro check
npm run build
# → rutas /balotaje-2024/montevideo y /balotaje-2024/colonia en la salida
```

### Referencias

- Contrato v2: `src/lib/contracts/` (Story 7.1 done)
- Fixture balotaje (patrón): `src/lib/contracts/__fixtures__/balotaje.fixture.ts`
- ETL piloto nacionales-2019 MVD: `etl/run-nacionales-2019-montevideo.ts`
- Orchestrator interior (patrón): `etl/interior-dept.ts`
- Aggregate by circuito (reutilizable): `etl/transform/aggregate-by-circuito.ts`
- Aggregate by serie (patrón para interior): `etl/transform/aggregate-by-serie.ts`
- Datos Corte Electoral: https://catalogodatos.gub.uy/dataset/corte-electoral-elecciones-nacionales-segunda-vuelta-2024

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- CSV formato D (no documentado): una fila por CRV con candidatos en columnas separadas (TotalOrsiCosse, TotalDelgadoRipoll). Sin TIPO_REGISTRO ni PARTIDO. URL real del dataset: `corte-electoral-balotaje_2024` (no `segunda-vuelta-2024`).
- Series exteriores con TotalVotosEmitidos=0 pero votos reales no-cero → excluir por patrón `Serie.endsWith('ZZ')`.
- Montevideo: mapping existente (2521 CRVs) cubre 2521 de 2569 CRVs del balotaje → 48 unmapped, placement=98.1% ✅.
- Colonia: cobertura perfecta 33/33 series, placement=100% ✅.

### Completion Notes List

- CSV del balotaje 2024 descargado de `catalogodatos.gub.uy` (267KB, 7349 filas, 19 departamentos).
- Formato D: pre-agregado por CRV con candidatos en columnas fijas — sin TIPO_REGISTRO, sin columna PARTIDO.
- Nuevo `aggregate-balotaje-by-serie.ts`: agrupa por Serie con pro-rata para CRVs multi-serie, opciones fijas, noPartidarios desde columnas explícitas.
- Nuevo `aggregate-balotaje-mvd.ts`: agrupa por CRV→barrio vía mapping existente; unmappedVotos 1.9% → placement 98.1%.
- Gates de integridad pasan para ambos pilotos: reconciliación delta=0, cobertura ≥95%.
- `astro check`: 0 errores. `npm run build`: rutas `/balotaje-2024/montevideo` y `/balotaje-2024/colonia` generadas sin error.
- `run-balotaje-interior.ts` exporta `runBalotajeInteriorDept(cfg)` reutilizable para los 17 deptos interiores restantes.

### File List

- `data/raw/electoral/balotaje-2024/balotaje-2024.csv` (new — datos descargados)
- `etl/transform/aggregate-balotaje-by-serie.ts` (new)
- `etl/transform/aggregate-balotaje-mvd.ts` (new)
- `etl/run-balotaje-mvd.ts` (new)
- `etl/run-balotaje-interior.ts` (new)
- `public/data/balotaje-2024/montevideo/votes.json` (new — generado por ETL)
- `public/data/balotaje-2024/montevideo/opciones.json` (new — generado por ETL)
- `public/data/balotaje-2024/colonia/votes.json` (new — generado por ETL)
- `public/data/balotaje-2024/colonia/opciones.json` (new — generado por ETL)
- `src/config/departments.json` (modified — `+balotaje-2024` en montevideo y colonia)
- `public/data/elections-meta.json` (modified — `+balotaje-2024` con deptos piloto)
- `src/pages/[eleccion]/[departamento].astro` (modified — `+ELECCION_LABELS['balotaje-2024']`)
- `package.json` (modified — scripts `etl:balotaje-mvd` y `etl:balotaje-colo`)

### Change Log

- Descargado e integrado CSV balotaje 2024 de Corte Electoral (2026-05-31)
- Creados 2 aggregate functions y 2 orchestrators ETL para balotaje
- Rutas SSG `/balotaje-2024/{montevideo,colonia}` activas y buildando
