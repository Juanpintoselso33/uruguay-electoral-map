---
baseline_commit: 17df493bf9ec7f3e51ed5d1ab7de300b2d669035
---

# Story 1.2: Definir el Data Contract v1 polimórfico

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a desarrollador,
I want un esquema TypeScript del Data Contract (manifest + votes-shard + geometry) con discriminador `eleccion.tipo` y `opcion` polimórfica,
so that el contrato soporte internas/nacionales/balotaje/departamentales sin rediseño futuro y los Epics 2-4 lo consuman como contrato estable.

## Acceptance Criteria

1. **Given** el modelo de dominio del PRD/Arquitectura **When** defino los tipos del contrato en TS **Then** existe un `Eleccion` con discriminador `tipo: 'internas' | 'nacionales' | 'balotaje' | 'departamentales'` y un tipo `Opcion` **polimórfico** (HOJA | candidato/lema | opción-binaria).
2. **Given** el contrato **When** modelo el voto **Then** la unidad es `(opcion × geografía × escrutinio)` con la etapa **DEFINITIVA** marcada/indexada; blanco/anulado/observado son categorías separadas (no parte de `Opcion` partidaria).
3. **Given** un fixture seco de **nacionales-2019 + balotaje** **When** corro el typecheck (`astro check`/`tsc`) **Then** el fixture valida contra el esquema **sin modificarlo** (compila bajo strict) — prueba la polimorfia. Si balotaje (sin HOJA) no encaja, el contrato está mal.
4. **Given** el contrato **When** reviso el `manifest` **Then** define artefactos versionados con `hash`, lista de elecciones/departamentos disponibles, y referencias a los shards de votos y geometría por nivel.
5. **Given** type guards/validadores **When** un dato no cumple el contrato **Then** un guard runtime lo detecta (sin dependencias nuevas — guards a mano, no zod).

## Tasks / Subtasks

- [x] **Task 1: Tipos del contrato (AC: 1, 2, 4)**
  - [x] `src/lib/contracts/election.ts`: `EleccionTipo`, `Eleccion`, `Opcion` (unión discriminada `OpcionHoja`|`OpcionCandidato`), `Partido`, `EntidadCanonica`.
  - [x] `src/lib/contracts/votes.ts`: `VotosShard`, `AgregadoZona` (ganador, % vía válidos, porOpcion), `CategoriasNoPartidarias`, `Escrutinio`, `NivelGeografico`.
  - [x] `src/lib/contracts/manifest.ts`: `Manifest` (contractVersion, hash, generatedAt, elecciones[], shards[] con refs votos+geometría por nivel).
  - [x] `src/lib/contracts/index.ts` (re-export con `import type`/`export type`, compatible con `verbatimModuleSyntax`).
- [x] **Task 2: Type guards runtime (AC: 5)**
  - [x] `src/lib/contracts/guards.ts`: `isOpcionHoja`, `isOpcionCandidato`, `isEscrutinioDefinitivo`, `assertVotosShard` + `ContractError`. Sin deps nuevas.
- [x] **Task 3: Fixture seco de validación polimórfica (AC: 3)**
  - [x] Fixtures TS bajo `src/lib/contracts/__fixtures__/` (NO json en public/data — gotcha LFS evitado): internas-2024, nacionales-2019, balotaje, tipados con `satisfies`.
  - [x] Balotaje usa `OpcionCandidato` **sin HOJA** → **compila** (polimorfia probada, AC3).
  - [x] `astro check` verde con los fixtures.
- [x] **Task 4: Verificación (AC: 1-5)**
  - [x] `astro check` strict = **0 errores/warnings/hints** (15 files).
  - [x] Self-test de guards ejecutado en runtime (esbuild bundle + node): 3 shards OK + guards de opción + detección de violación. AC5 ✅.
  - [x] `src/lib/contracts/README.md`.
  - [x] `npm run build` verde (sin regresión).

## Dev Notes

### Qué define este contrato (architecture.md §Data Architecture + §Decisiones del party mode)
- **Átomo canónico:** `(elección, depto, circuito, serie, zona, escrutinio, opcion_id, votos)`. `escrutinio` retenido como dimensión; **DEFINITIVO** es la etapa indexada/canónica.
- **`opcion_id` polimórfico:** HOJA (internas/legislativas) | candidato/lema (balotaje/presidencial, SIN hoja) | opción-binaria (balotaje). El discriminador es `eleccion.tipo`.
- **Equivalencia cross-año = juicio editorial, NO dato** (Mary). El contrato debe tener el GANCHO: `opcion → entidad_canónica` versionada con procedencia, **vacío/identidad en Fase 1**. NO asumir equivalencia HOJA total. NO diseñar dos sistemas: el mismo mecanismo de entidad canónica cubre HOJA + drift de partido/lema.
- **Agregados precomputados** (los produce el ETL en historias siguientes; acá solo se TIPAN): ganador por zona, % partido/lema, roll-ups, denominadores (válidos).
- **manifest.json** versiona artefactos con hash (architecture.md §Data Architecture).

### El porqué (Winston, party mode épicas) — DECISIÓN LOAD-BEARING
Esta historia es la razón de ser de Epic 1: **el contrato se valida contra el 2º tipo de elección (nacionales-2019 + balotaje) ANTES de construir encima.** Si el contrato se modela solo para internas, balotaje rompe el shard/manifest en Epic 4 y sangra hacia atrás a Epics 2-3. El deliverable NO es "tipos para internas" — es el **contrato genérico**, instanciado luego con datos reales en Story 1.4.

### Aprendizajes de Story 1.1 (previa, done)
- **tsconfig `verbatimModuleSyntax`:** usar `import type { X }` para tipos, si no `astro check` falla.
- **`@/*` → `src/*`** alias disponible (paths en tsconfig).
- 🚧 **GOTCHA LFS (crítico, encontrado en review 1.1):** el `.gitattributes` manda a Git LFS `public/**/*.json` y `data/**/*.json`. **NO pongas los fixtures de este contrato como `.json` bajo `public/` o `data/`** → quedarían como punteros LFS. Los fixtures van como **`.ts` bajo `src/`** (texto, no LFS, y typechequean).
- Stack: TS strict, ESM. Sin tests unitarios todavía → la validación es **compile-time** (`astro check`) + type guards.
- NO agregar dependencias nuevas (zod, etc.) sin aprobación → guards a mano.

### Invariantes de dominio (project-context.md) que el contrato DEBE respetar
- HOJA pertenece a 1 PARTIDO; en ODN mapea a 1 PRECANDIDATO; en ODD no hay precandidato.
- Voto canónico = etapa DEFINITIVA; nunca sumar etapas.
- Blanco/anulado/observado: categorías sin partido ni HOJA; la reconciliación es sobre **válidos**.
- Jerarquía CIRCUITO ⊃ SERIE ⊃ ZONA.

### Esquema CSV de origen (referencia — el ETL lo mapea al contrato en 1.4)
`PARTIDO, DEPTO, CIRCUITO, SERIES, ESCRUTINIO, PRECANDIDATO, HOJA, CNT_VOTOS, ZONA`
> Verificar (OQ): ¿el CSV de balotaje/nacionales tiene HOJA vacía o esquema distinto? El contrato debe tolerar ambos. (Mary V3 — se confirma con el dataset real en 1.4; acá el contrato debe ser tolerante por diseño.)

### File structure
- `src/lib/contracts/` (election.ts, votes.ts, manifest.ts, guards.ts, index.ts, README.md, `__fixtures__/`).
- Solo TS nuevo; no toca el scaffold de 1.1 salvo quizás re-export. Sin cambios de runtime/UI.

### Testing
- `astro check` (strict) verde con los 3 fixtures = la validación de esta historia (compile-time). El fixture de balotaje SIN hoja es la prueba clave de la polimorfia (AC3). Type guards: ejercitarlos en un fixture o un pequeño script de assert.

### References
- [Source: docs/bmad-output/planning-artifacts/epics.md#Story 1.2] — historia + ACs.
- [Source: docs/bmad-output/planning-artifacts/architecture.md#Data Architecture] — átomo, opcion polimórfica, manifest, equivalencia.
- [Source: docs/bmad-output/planning-artifacts/architecture.md#Decisiones de diseño (party mode)] — modelo de datos Mary, contrato genérico.
- [Source: docs/bmad-output/project-context.md] — invariantes de dominio (voto canónico, cardinalidad, blanco/anulado).
- [Source: docs/bmad-output/implementation-artifacts/1-1-inicializar-proyecto-astro-vue-vercel.md] — aprendizajes (verbatimModuleSyntax, gotcha LFS, sin deps nuevas).

## Dev Agent Record

### Agent Model Used

Amelia (dev) — claude-opus-4-8[1m]

### Debug Log References

- `astro check`: 0 errores / 0 warnings / 0 hints (15 files). El fixture de balotaje (OpcionCandidato sin HOJA) compila contra el contrato → polimorfia validada (AC3).
- Self-test de guards en runtime vía esbuild bundle + node (runner temporal `._run_contract.ts`, borrado tras correr): "OK shard internas/nacionales/balotaje", "OK guards de opción", "OK guard detecta violación (votos negativos)".
- `npm run build`: verde, sin regresión (el contrato es types-only; no afecta el runtime/UI).

### Completion Notes List

- ✅ Las 5 ACs satisfechas. Contrato genérico polimórfico (no moldeado a internas): `Opcion` = `OpcionHoja | OpcionCandidato` discriminada; `Eleccion.tipo` discrimina los 4 tipos.
- ✅ AC3 (la prueba load-bearing de Winston): balotaje SIN HOJA compila → el contrato soporta el 2º tipo de elección ANTES de construir encima.
- Gancho de equivalencia cross-año (`EntidadCanonica`) presente pero opcional/vacío en Fase 1 (juicio editorial, no dato).
- Gotcha LFS de Story 1.1 respetado: fixtures como `.ts` bajo `src/`, NO `.json` bajo public/data.
- Sin dependencias nuevas (guards a mano, no zod). Sin tocar runtime/UI de Story 1.1.
- El self-test (`runContractSelfTest`) queda listo para el test runner de Story 1.10.

### File List

**Nuevos:**
- `src/lib/contracts/election.ts`
- `src/lib/contracts/votes.ts`
- `src/lib/contracts/manifest.ts`
- `src/lib/contracts/guards.ts`
- `src/lib/contracts/index.ts`
- `src/lib/contracts/README.md`
- `src/lib/contracts/__fixtures__/internas-2024.fixture.ts`
- `src/lib/contracts/__fixtures__/nacionales-2019.fixture.ts`
- `src/lib/contracts/__fixtures__/balotaje.fixture.ts`
- `src/lib/contracts/__fixtures__/validate.ts`

**Sin cambios a archivos de Story 1.1** (contrato aislado en `src/lib/contracts/`).

### Change Log

- 2026-05-30: Story 1.2 implementada. Data Contract v1 polimórfico (tipos + guards + fixtures). astro check 0 errores; polimorfia balotaje validada; guards verificados en runtime. Status → review.

## Senior Developer Review (AI)

**Fecha:** 2026-05-30 · **Modo:** full (3 lentes inline sobre 451 líneas TS) · **Outcome:** APPROVED (tras 1 hardening)

### Action Items
- [x] **[Medium] M1** `assertVotosShard` no verificaba que el ganador fuera el de más votos (confiaba en el campo del ETL). **RESUELTO:** check "ganador = max(porOpcion)" agregado a `guards.ts`; caso negativo en el self-test verifica que dispara. astro check 0 errores + runtime OK.
- [ ] **[Low] L1** `manifest.ts` usa `import('./election')` inline en vez de `import type` arriba. Cosmético.
- [ ] **[Low] L2** Cobertura del self-test ampliada parcialmente (votos negativos + ganador!=max); geoId-duplicado / escrutinio-no-definitivo quedan para el test runner de Story 1.10.

### Acceptance Criteria
AC1 ✅ · AC2 ✅ · AC3 (balotaje sin HOJA compila) ✅ · AC4 ✅ · AC5 (guards runtime) ✅. Sin violaciones de spec.

**Nota:** El check de reconciliación válidos↔suma y la integridad referencial opcion→partido son territorio de los gates del ETL (Story 1.6), no del guard estructural. Historia aprobada y marcada `done`.

### Change Log
- 2026-05-30: Code review aplicó M1 (guard ganador=max) + caso negativo. Status → done.
