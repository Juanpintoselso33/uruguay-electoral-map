---
baseline_commit: c35f404386d10e5306aca3eab5a99cc5bf7c38fd
---

# Story 10.1: Data Contract v3 — escalera de granularidad + contienda

Status: done

## Story

As a desarrollador,
I want que el contrato modele la jerarquía de opción (contienda → lema → precandidato/sublema → hoja) con un `opcion_id` compuesto y un descriptor de escalera por tipo,
so that el ETL y la UI construyan el árbol de selección desde el dato, sin lógica ad-hoc por tipo de elección.

## Acceptance Criteria

1. **Given** el contrato v2 **When** agrego el tipo `Contienda` **Then** modela las contiendas paralelas de un voto: `'odn' | 'odd'` (internas), `'intendente' | 'junta' | 'municipio'` (departamentales), `'unica'` (nacionales/balotaje/plebiscito).
2. **Given** la jerarquía de opción **When** agrego el linaje padre a `Opcion` **Then** una `OpcionHoja` referencia su `contienda`, `lemaId`, y opcionalmente `precandidatoId`/`sublemaId`; el `id` (opcion_id) es **compuesto** y único entre departamentos (deriva de contienda+lema+hoja).
3. **Given** que cada tipo declara qué niveles tiene **When** defino `EscaleraGranularidad` **Then** existe un descriptor por `(tipo, contienda)` que enumera los niveles disponibles en orden, p. ej. internas/odn = `['lema','precandidato','hoja']`, internas/odd = `['lema','hoja']`, balotaje/unica = `['candidato']`.
4. **Given** un nodo intermedio (lema, precandidato, sublema) **When** lo modelo **Then** existe un tipo `NodoOpcion` que representa un nivel agregable del árbol (id, nivel, etiqueta, parentId opcional) — distinto de la `Opcion` hoja/candidato/binaria que es la unidad de voto.
5. **Given** fixtures secos de internas ODN (lema→precandidato→hoja, 3 niveles) y ODD (lema→hoja, 2 niveles) **When** compilan contra el contrato v3 **Then** validan con `satisfies` **And** `assertVotosShard` no lanza sobre un shard a nivel hoja **And** existe un guard/validador que verifica que todo `opcion_id` de hoja en un shard existe en el catálogo jerárquico.
6. **Given** el cambio de contrato **When** corro `astro check` **Then** compila sin romper los contratos v2, los fixtures existentes ni el ETL existente (ampliación retro-compatible; los campos nuevos de linaje son opcionales donde haga falta para no romper shards a nivel lema).

## Tasks / Subtasks

- [x] **T1** — Ampliar `src/lib/contracts/election.ts` (AC: 1, 2, 4)
  - [x] T1.1 — Agregar `export type Contienda = 'odn' | 'odd' | 'intendente' | 'junta' | 'municipio' | 'unica'`
  - [x] T1.2 — Agregar linaje a `OpcionHoja`: `contienda: Contienda`, `lemaId: string`, `precandidatoId?: string`, `sublemaId?: string` (campos opcionales para no romper instancias v2)
  - [x] T1.3 — Agregar `OpcionCandidato.contienda?` y `OpcionCandidato.lemaId?` (para intendente/balotaje)
  - [x] T1.4 — Definir `NodoOpcion { id; nivel: GranularidadNivel; etiqueta: string; parentId?: string; partidoId?: string }`
  - [x] T1.5 — Definir `export type GranularidadNivel = 'contienda' | 'lema' | 'sublema' | 'precandidato' | 'candidato' | 'alcalde' | 'hoja' | 'binaria'`

- [x] **T2** — Definir el descriptor de escalera (AC: 3)
  - [x] T2.1 — `EscaleraGranularidad { tipo: EleccionTipo; contienda: Contienda; niveles: readonly GranularidadNivel[] }`
  - [x] T2.2 — Catálogo `ESCALERAS` (const) con las escaleras conocidas (internas odn/odd; nacionales unica; balotaje unica; plebiscito unica; departamentales intendente/junta/municipio)
  - [x] T2.3 — Helper `escaleraDe(tipo, contienda): readonly GranularidadNivel[]`

- [x] **T3** — Catálogo jerárquico de opciones (AC: 2, 5)
  - [x] T3.1 — Definir `CatalogoOpciones { eleccionId; departamento; contiendas: ContiendaCatalogo[] }` donde cada contienda tiene `nodos: NodoOpcion[]` (los niveles intermedios) + `opciones: Opcion[]` (las hojas)
  - [x] T3.2 — Helper para construir `opcion_id` compuesto de hoja: `opcionIdHoja(contienda, lemaId, hoja): string`

- [x] **T4** — Guards y validación (AC: 5)
  - [x] T4.1 — Agregar a `guards.ts`: `assertCatalogoConsistente(cat)` — todo nodo parentId existe; todo opcion_id de hoja referencia un lema/precandidato presente
  - [x] T4.2 — `assertHojasEnCatalogo(shard, catalogo)` — todo `opcionId` del shard a nivel hoja existe en el catálogo

- [x] **T5** — Manifest (AC: 3)
  - [x] T5.1 — `ManifestEleccion` gana `contiendas?: Contienda[]` y `contractVersion` → `'v3'`
  - [x] T5.2 — Buscar usos de `contractVersion` antes de cambiar el literal

- [x] **T6** — Actualizar `index.ts` (AC: todos)
  - [x] T6.1 — Re-exportar los tipos nuevos (`Contienda`, `GranularidadNivel`, `NodoOpcion`, `EscaleraGranularidad`, `CatalogoOpciones`) y guards

- [x] **T7** — Fixtures secos (AC: 5, 6)
  - [x] T7.1 — `__fixtures__/internas-hoja.fixture.ts`: catálogo ODN (1 lema → 1 precandidato → 2 hojas) + ODD (1 lema → 2 hojas) + shard a nivel hoja
  - [x] T7.2 — Agregar al `validate.ts` selftest: consistencia de catálogo + hojas-en-catálogo + escaleras
  - [x] T7.3 — `astro check` + selftest verdes

## Dev Notes

### Contexto crítico: qué confirma el dato crudo

`data/raw/electoral/desglose-de-votos.csv` (todos los deptos) ya trae la jerarquía:
```
TIPO_REGISTRO, DEPARTAMENTO, CRV, SERIES, LEMA, DESCRIPCIÓN_1, DESCRIPCIÓN_2, CANTIDAD_VOTOS
HOJA_ODN, MO, 1, AAA, FRENTE AMPLIO, "COSSE GARRIDO, Ana Carolina", 90, 13
HOJA_ODD, MO, 1, AAA, FRENTE AMPLIO, No aplica, 190, 10
```
- `TIPO_REGISTRO` = contienda (HOJA_ODN → `'odn'`, HOJA_ODD → `'odd'`)
- `LEMA` = lema
- `DESCRIPCIÓN_1` = precandidato (en ODN) o "No aplica" (en ODD → no hay nivel precandidato)
- `DESCRIPCIÓN_2` = número de HOJA
- `CANTIDAD_VOTOS` = votos

**Verificado (uniqueness):** dentro de Montevideo ningún nº de hoja se repite entre lemas ni entre ODN/ODD. PERO entre departamentos los números SÍ se reusan → por eso `opcion_id` debe ser compuesto (incluir contienda + lema o depto). Decisión: `opcion_id` de hoja = `slug(contienda)-slug(lema)-{hoja}` (estable dentro de una elección×depto, que es el scope del shard).

### Por qué `NodoOpcion` separado de `Opcion`

`Opcion` (hoja/candidato/binaria) es la **unidad de voto** (tiene votos en el shard). Los niveles intermedios (lema, precandidato, sublema) son **agrupadores** sin voto propio: su total es el roll-up de sus hojas. Modelarlos como `NodoOpcion` (no como `Opcion`) evita meter entidades sin voto en el shard de votos y mantiene `assertVotosShard` intacto.

### Retro-compatibilidad (no romper v2)

Los shards actuales son a nivel lema (`opcionId` = slug de lema). El contrato v3 **amplía**, no reemplaza: los campos de linaje en `OpcionHoja` son opcionales para que los fixtures v2 (internas-2024, nacionales-2019, balotaje, plebiscito) sigan compilando. El shard a nivel hoja es un artefacto NUEVO (Story 10.2), no una mutación del existente.

### Sublema: modelarlo pero no exigir dato

`sublemaId?` y el nivel `'sublema'` se definen en el contrato, pero **no hay dato de sublema en el repo** (ver Story 10.8). Las escaleras de nacionales/departamentales que incluyen sublema quedan declaradas; el ETL las degrada cuando el dato falta (Story 10.7 AC). No inventar sublemas.

### Qué NO cambiar
- `assertVotosShard` — sigue genérico (no discrimina por tipo).
- `OpcionBinaria` — sin cambios.
- Los fixtures v1/v2 existentes — sin cambios (la ampliación es opcional).

### Verificación
```bash
npx astro check
npx tsx src/lib/contracts/__fixtures__/validate.ts
```

### Referencias
- Contrato actual: `src/lib/contracts/election.ts`, `votes.ts`, `manifest.ts`, `guards.ts`, `index.ts`
- Fixture patrón: `src/lib/contracts/__fixtures__/balotaje.fixture.ts`, `plebiscito.fixture.ts`
- Dato crudo: `data/raw/electoral/desglose-de-votos.csv`
- UX (escaleras por tipo): `docs/bmad-output/planning-artifacts/ux-designs/.../EXPERIENCE.md` › IA › Escaleras de granularidad
- Legacy modelo (referencia): `git show master:src/stores/electoral.ts` (`partiesByList`, `precandidatosByList`, `votosPorListas`)

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code, bmad-dev-story)

### Completion Notes List

- **T1** — `election.ts`: agregados `Contienda` (odn/odd/intendente/junta/municipio/unica), `GranularidadNivel` (8 niveles), `NodoOpcion` (agrupador sin voto), y linaje OPCIONAL en `OpcionHoja` (`contienda?`, `lemaId?`, `precandidatoId?`, `sublemaId?`) y `OpcionCandidato` (`contienda?`, `lemaId?`). Opcionales = cero breaking changes en los fixtures/ETL v2.
- **Decisión de diseño:** `lemaId` se agrega explícito aunque en UY lema≡partido (suele coincidir con `partidoId`); documentado en el JSDoc. El árbol de granularidad referencia nodos por `lemaId`/`precandidatoId` (ids de nodo), distintos del `partidoId` (color/identidad de partido).
- **T2/T3** — nuevo `granularidad.ts` (sin deps): `EscaleraGranularidad` + `ESCALERAS` (8 escaleras: internas odn/odd, nacionales, balotaje, plebiscito, departamentales int/junta/mun) + `escaleraDe`; `CatalogoOpciones`/`ContiendaCatalogo` (catálogo jerárquico con `degradado?`); `opcionIdHoja(contienda,lema,hoja)` → id compuesto `contienda-slug(lema)-hoja` (los nº de hoja se reúsan entre deptos → compuesto obligatorio); `slugContrato` (slug propio, sin dependencias).
- **T4** — `guards.ts`: `assertCatalogoConsistente` (ids únicos, parentId existe, hoja referencia lema/precandidato presentes) + `assertHojasEnCatalogo` (todo opcionId de un shard de hojas ∈ catálogo). Reusan `ContractError`.
- **T5** — `manifest.ts`: `ManifestEleccion.contiendas?` + `contractVersion: 'v2'→'v3'`. Verificado por grep: NINGÚN código runtime compara el literal (solo el README, actualizado) → cero breaking changes.
- **T6** — `index.ts`: re-exporta los tipos (`Contienda`, `GranularidadNivel`, `NodoOpcion`, `EscaleraGranularidad`, `ContiendaCatalogo`, `CatalogoOpciones`), const/helpers (`ESCALERAS`, `escaleraDe`, `opcionIdHoja`, `slugContrato`) y guards nuevos.
- **T7** — fixture `internas-hoja.fixture.ts` (catálogo ODN 3 niveles lema→precandidato→hoja + ODD 2 niveles lema→hoja + shard de hojas) `as const satisfies`. Selftest `validate.ts` ampliado: **11 checks OK** (4 nuevos: escaleras, opcionIdHoja, catálogo+hojas-en-catálogo, negativo parentId colgante).
- **Verificación:** `npx astro check` → 0 errores / 0 warnings (74 files). `npx tsc --noEmit` → exit 0 (ETL existente compila sin tocar). Selftest → 11/11 OK. Headers election.ts/README actualizados a v3 (evita el "header stale" que marcó la review de 7.1).

### File List

- `src/lib/contracts/election.ts` (modified) — Contienda, GranularidadNivel, NodoOpcion, linaje de opciones, header v3
- `src/lib/contracts/granularidad.ts` (new) — escalera + catálogo + helpers
- `src/lib/contracts/guards.ts` (modified) — assertCatalogoConsistente, assertHojasEnCatalogo
- `src/lib/contracts/manifest.ts` (modified) — contiendas?, contractVersion v3
- `src/lib/contracts/index.ts` (modified) — re-exports v3
- `src/lib/contracts/__fixtures__/internas-hoja.fixture.ts` (new) — fixture seco v3
- `src/lib/contracts/__fixtures__/validate.ts` (modified) — +5 checks v3 (12 total)
- `src/lib/contracts/votes.ts` (modified) — header v3
- `src/lib/contracts/README.md` (modified) — doc v3

### Change Log

- 2026-05-31 — Data Contract v3: escalera de granularidad + contienda + catálogo jerárquico + opcion_id compuesto. astro check + tsc + selftest (11) verdes. Status → review.
- 2026-05-31 — Atendidos los hallazgos de code-review (2 reviewers). +1 check (12 total). Status → done.

## Senior Developer Review (AI)

**Fecha:** 2026-05-31 · **Reviewers:** code-reviewer (corrección) + type-design-analyzer (diseño de tipos), adversariales, en paralelo. **Resultado:** Changes Requested → resueltos.

Sin bugs de alta confianza; ambos convergieron en **huecos de enforcement en `assertCatalogoConsistente`** + un **defecto real en el esquema de ids** descubierto al fixearlos.

### Action Items (todos resueltos)

- [x] **[Med] Esquema de id inconsistente** — el id de nodo lema estaba prefijado por contienda (`odn-frente-amplio`), así que `lemaId` NO derivaba el `opcion_id` con `opcionIdHoja` (rompería el join al shard) y el JSDoc "lemaId coincide con partidoId" era falso. **Fix:** id de nodo lema = slug puro (`frente-amplio`, scopeado por contienda) → `lemaId`≡`partidoId` y `id === opcionIdHoja(contienda, lemaId, hoja)`. Fixture + JSDoc corregidos.
- [x] **[Med] `clase` vs nivel terminal no se chequeaba** — una `binaria`/`candidato` en una contienda `odn` (terminal `hoja`) pasaba. **Fix:** el guard exige `opcion.clase === niveles.at(-1)`. +negativo en selftest.
- [x] **[Med] Coherencia de contienda + derivación de id + linaje no enforced** — `o.contienda===c.contienda`, `o.id===opcionIdHoja(...)`, `lemaId` presente y referenciado, `precandidatoId` presente si la escalera lo exige. Todo agregado al guard.
- [x] **[Med] Unicidad de opcion_id solo por-contienda** — ahora unicidad GLOBAL entre contiendas.
- [x] **[Med] JSDoc de `lemaId` incorrecto** — reescrito (slug del lema = partidoId).
- [x] **[Low] Headers stale "v2"** en `guards.ts`/`votes.ts`/`manifest.ts** — actualizados a v3.

### Deuda aceptada (documentada, no defecto)
- Tipo `OpcionHojaV3` con campos requeridos (P1 del type-analyzer): se cubre con el guard runtime `assertCatalogoConsistente` reforzado; se evita proliferación de tipos. El linaje sigue opcional en `OpcionHoja` por retro-compat con shards v2 a nivel lema.
- Separador `-` en `opcionIdHoja`: verificado sin colisión en el dato real (hojas numéricas, 18 lemas slug-únicos). Hardening futuro posible (separador `_`/`:`).
- `Contienda` plana (no discriminada por tipo) y `ESCALERAS` como array: alineado con el diseño data-driven explícito (la UI/ETL leen la escalera, no la hardcodean).

### Verificación post-fix
`astro check` 0/0/0 · `tsc --noEmit` exit 0 · selftest **12/12 OK** (nuevo: clase != nivel terminal).
