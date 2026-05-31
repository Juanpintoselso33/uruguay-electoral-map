---
baseline_commit: c35f404386d10e5306aca3eab5a99cc5bf7c38fd
---

# Story 7.1: Data contract v2 — discriminadores formales para tipos de elección

Status: done

## Story

As a desarrollador,
I want que el contrato de datos tenga discriminadores explícitos para cada tipo de elección,
so that el ETL y la UI sepan cómo manejar balotajes y plebiscitos sin lógica ad-hoc.

## Acceptance Criteria

1. **Given** el contrato v1 **When** agrego `'plebiscito'` al discriminador `EleccionTipo` **Then** el esquema TypeScript genera error en compile-time si se pasa un tipo no reconocido en `VotosShard.tipo` o `Eleccion.tipo`.
2. **Given** un plebiscito con opciones Sí/No **When** modelo las opciones **Then** existe una interfaz `OpcionBinaria` con `clase: 'binaria'` y `etiqueta: 'si' | 'no'` — distinta de `OpcionCandidato` (que usa `candidato: string`) y de `OpcionHoja`.
3. **Given** un plebiscito **When** se registra en el manifest **Then** `ManifestEleccion` y `Eleccion` tienen un campo opcional `pregunta?: string` para el texto de la pregunta del plebiscito.
4. **Given** el fixture seco `plebiscito.fixture.ts` **When** compila contra el contrato v2 **Then** `assertVotosShard(shardPlebiscito)` no lanza **And** `isOpcionBinaria(opcionesPlebiscito[0])` devuelve `true`.
5. **Given** el selftest `validate.ts` **When** se ejecuta **Then** cubre los 4 tipos de elección (internas, nacionales, balotaje, plebiscito) con sus guards correspondientes.
6. **Given** el cambio de contrato **When** corro `npx astro check` **Then** compila sin errores — incluyendo los fixtures y los scripts ETL existentes que ya usaban `EleccionTipo`.

## Tasks / Subtasks

- [x] **T1** — Ampliar `src/lib/contracts/election.ts` (AC: 1, 2, 3)
  - [x] T1.1 — Agregar `'plebiscito'` al union `EleccionTipo`
  - [x] T1.2 — Agregar interfaz `OpcionBinaria { clase: 'binaria'; id: string; etiqueta: 'si' | 'no' }`
  - [x] T1.3 — Ampliar union `Opcion = OpcionHoja | OpcionCandidato | OpcionBinaria`
  - [x] T1.4 — Agregar campo `pregunta?: string` a la interfaz `Eleccion`

- [x] **T2** — Ampliar `src/lib/contracts/manifest.ts` (AC: 3, 6)
  - [x] T2.1 — Agregar campo `pregunta?: string` a `ManifestEleccion`
  - [x] T2.2 — Cambiar literal `contractVersion: 'v1'` → `'v2'` en la interfaz `Manifest`

- [x] **T3** — Ampliar `src/lib/contracts/guards.ts` (AC: 4, 5)
  - [x] T3.1 — Agregar `isOpcionBinaria(o: Opcion): o is OpcionBinaria`

- [x] **T4** — Actualizar `src/lib/contracts/index.ts` (AC: 4)
  - [x] T4.1 — Exportar `OpcionBinaria` desde `'./election'`
  - [x] T4.2 — Exportar `isOpcionBinaria` desde `'./guards'`
  - [x] T4.3 — Cambiar el comentario del header de `v1` a `v2`

- [x] **T5** — Crear `src/lib/contracts/__fixtures__/plebiscito.fixture.ts` (AC: 4)
  - [x] T5.1 — Exportar `eleccionPlebiscito2024` con `tipo: 'plebiscito'` y `pregunta: '...'`
  - [x] T5.2 — Exportar `opcionesPlebiscito` con dos `OpcionBinaria` (etiqueta: 'si' y 'no')
  - [x] T5.3 — Exportar `shardPlebiscito` con zonas, `noPartidarios` y `tipo: 'plebiscito'`

- [x] **T6** — Ampliar `src/lib/contracts/__fixtures__/validate.ts` (AC: 5)
  - [x] T6.1 — Importar `shardPlebiscito`, `opcionesPlebiscito` del nuevo fixture
  - [x] T6.2 — Agregar `shardPlebiscito` al loop de positivos
  - [x] T6.3 — Agregar `isOpcionBinaria(opcionesPlebiscito[0])` al bloque de guards

- [x] **T7** — Verificar que el ETL existente compila sin cambios (AC: 6)
  - [x] T7.1 — `npx tsc --noEmit` → 0 errores
  - [x] T7.2 — Selftest → 7 checks OK (internas, nacionales, balotaje, plebiscito, guards, 2 negativos)

## Dev Notes

### Contexto crítico: qué ya existe vs. qué falta

El contrato v1 ya fue diseñado con polimorfia en mente (Epic 1, Story 1.2) y cubre balotaje:

- `EleccionTipo` ya incluye `'internas' | 'nacionales' | 'balotaje' | 'departamentales'` — **SOLO falta `'plebiscito'`**.
- `OpcionCandidato` (clase: 'candidato') ya sirve para balotaje presidencial. El fixture `balotaje.fixture.ts` ya existe y valida correctamente con `assertVotosShard`.
- **Lo que realmente falta** para plebiscito: `OpcionBinaria` (Sí/No es semánticamente distinto de un candidato) + `pregunta` en `Eleccion` + el fixture correspondiente.

**No hace falta rediseñar nada.** Esta story es una ampliación quirúrgica de 5 archivos.

### Archivos a modificar (UPDATE)

| Archivo | Cambio |
|---------|--------|
| `src/lib/contracts/election.ts` | Añadir `'plebiscito'` a `EleccionTipo`, añadir `OpcionBinaria`, añadir `pregunta?` a `Eleccion`, ampliar `Opcion` union |
| `src/lib/contracts/manifest.ts` | Añadir `pregunta?` a `ManifestEleccion`, cambiar literal `contractVersion` a `'v2'` |
| `src/lib/contracts/guards.ts` | Añadir `isOpcionBinaria` |
| `src/lib/contracts/index.ts` | Re-exportar `OpcionBinaria` e `isOpcionBinaria` |
| `src/lib/contracts/__fixtures__/validate.ts` | Agregar plebiscito al selftest |

### Archivos a crear (NEW)

| Archivo | Descripción |
|---------|-------------|
| `src/lib/contracts/__fixtures__/plebiscito.fixture.ts` | Fixture seco del plebiscito (mismo patrón que `balotaje.fixture.ts`) |

### Diseño exacto de `OpcionBinaria`

```ts
// En election.ts — después de OpcionCandidato
export interface OpcionBinaria {
  readonly clase: 'binaria';
  readonly id: string;
  /** Etiqueta canónica (internacionalizable si fuera necesario). */
  readonly etiqueta: 'si' | 'no';
}

// Ampliar el union:
export type Opcion = OpcionHoja | OpcionCandidato | OpcionBinaria;
```

### Diseño del fixture `plebiscito.fixture.ts`

Seguir exactamente el patrón de `balotaje.fixture.ts`:

```ts
import type { Eleccion, Opcion, VotosShard } from '../index';

export const eleccionPlebiscito2024 = {
  id: 'plebiscito-seguridad-2024',
  tipo: 'plebiscito',
  anio: 2024,
  nombre: 'Plebiscito Seguridad Pública 2024',
  pregunta: '¿Está de acuerdo con la reforma constitucional propuesta en materia de seguridad pública?',
} as const satisfies Eleccion;

export const opcionesPlebiscito = [
  { clase: 'binaria', id: 'pleb24seg-si', etiqueta: 'si' },
  { clase: 'binaria', id: 'pleb24seg-no', etiqueta: 'no' },
] as const satisfies readonly Opcion[];

export const shardPlebiscito = {
  eleccionId: 'plebiscito-seguridad-2024',
  departamento: 'montevideo',
  nivel: 'zona',
  escrutinio: 'definitivo',
  tipo: 'plebiscito',
  zonas: [
    {
      geoId: 'centro',
      ganadorOpcionId: 'pleb24seg-no',
      validos: 2000,
      porOpcion: [
        { opcionId: 'pleb24seg-si', votos: 900 },
        { opcionId: 'pleb24seg-no', votos: 1100 },
      ],
      noPartidarios: { enBlanco: 30, anulados: 8, observados: 2 },
    },
  ],
} as const satisfies VotosShard;
```

### Cambio `contractVersion` en `manifest.ts`

```ts
// ANTES:
readonly contractVersion: 'v1';

// DESPUÉS:
readonly contractVersion: 'v2';
```

**Implicación:** Cualquier código que compara `manifest.contractVersion === 'v1'` necesita actualizarse a `'v2'`. Buscar usos con `grep -r "contractVersion" src/` antes de hacer el cambio.

### Qué NO cambiar

- `assertVotosShard` en `guards.ts` — ya valida genéricamente (no discrimina por `tipo`), seguirá funcionando.
- `OpcionHoja` y `OpcionCandidato` — no se modifican.
- Los fixtures de internas y nacionales — no se modifican.
- El ETL existente (`emit-shard.ts`, `run-montevideo.ts`, `run-nacionales-2019-montevideo.ts`) — usa `EleccionTipo` y no necesita cambios (ampliamos el union, no rompemos el existente).

### Verificación antes de marcar done

```bash
# Typecheck completo
npx astro check

# Selftest del contrato (en Node)
npx tsx src/lib/contracts/__fixtures__/validate.ts
```

Ambos deben correr sin errores.

### Project Structure Notes

- Todos los archivos del contrato viven en `src/lib/contracts/` — no crear archivos fuera de esa carpeta para esta story.
- Los fixtures siguen el patrón `*-fixture.ts` con `satisfies` para validación compile-time.
- El `index.ts` es el único punto de entrada público del contrato — toda exportación pasa por ahí.

### References

- Contrato v1 actual: `src/lib/contracts/election.ts`, `votes.ts`, `manifest.ts`, `guards.ts`, `index.ts`
- Fixture existente de balotaje (patrón a seguir): `src/lib/contracts/__fixtures__/balotaje.fixture.ts`
- Selftest actual: `src/lib/contracts/__fixtures__/validate.ts`
- Orchestrador ETL que consume el contrato: `etl/load/emit-shard.ts`
- Story original en epics: `docs/bmad-output/planning-artifacts/epics.md` → Epic 7, Story 7.1
- Project context (invariantes de dominio): `docs/bmad-output/project-context.md`

## Dev Agent Record

### Agent Model Used

_a completar al implementar_

### Debug Log References

### Completion Notes List

- Ampliado `EleccionTipo` con `'plebiscito'` (5to tipo, sin breaking changes en ETL existente)
- Nueva interfaz `OpcionBinaria` (clase: 'binaria', etiqueta: 'si'|'no') — distinta semánticamente de `OpcionCandidato`
- `Opcion` union ampliado a 3 variantes; `Eleccion` y `ManifestEleccion` tienen `pregunta?` opcional
- `contractVersion` actualizado a `'v2'`; ningún código runtime comparaba el literal así que cero breaking changes
- Selftest corre 7 checks en verde: 4 shards positivos + 3 guards (tipo + 2 negativos)

### File List

- `src/lib/contracts/election.ts` (modified)
- `src/lib/contracts/manifest.ts` (modified)
- `src/lib/contracts/guards.ts` (modified)
- `src/lib/contracts/index.ts` (modified)
- `src/lib/contracts/__fixtures__/plebiscito.fixture.ts` (new)
- `src/lib/contracts/__fixtures__/validate.ts` (modified)

### Review Findings

- [x] [Review][Patch] votes.ts header aún dice "Data Contract v1" [`src/lib/contracts/votes.ts:2`]
- [x] [Review][Patch] README.md del contrato está desactualizado (v1, falta OpcionBinaria, fixture count viejo) [`src/lib/contracts/README.md`]
- [x] [Review][Defer] validate.ts no verifica guard de nacionales (opcionesNacionales nunca importado) [`src/lib/contracts/__fixtures__/validate.ts`] — deferred, pre-existing
- [x] [Review][Defer] OpcionBinaria no tiene campo `nombre` — el puente de serialización a opciones.json es undefined para plebiscito [`src/lib/contracts/election.ts`] — deferred, forward-integration gap (ETL story 7.3)
- [x] [Review][Defer] resolveParty('Sí'/'No') producirá output inválido cuando se cargue data de plebiscito [`src/lib/party-meta.ts`] — deferred, forward-integration gap (ETL story 7.3)
- [x] [Review][Defer] OpcionSelector.labelSelector no tiene rama para 'plebiscito' — fallback genérico 'Opción' [`src/components/selectors/OpcionSelector.vue:32`] — deferred, forward-integration gap (UI story 7.5)
- [x] [Review][Defer] departamentales no tiene fixture en el selftest — brecha pre-existente [`src/lib/contracts/__fixtures__/validate.ts`] — deferred, pre-existing
