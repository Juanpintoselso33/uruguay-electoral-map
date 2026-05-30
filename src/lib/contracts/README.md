# Data Contract v1

Contrato de datos del proyecto. **Genérico y polimórfico**: soporta los 4 tipos de elección sin rediseño. El ETL (Story 1.4+) produce artefactos que cumplen este contrato; el cliente (Epics 2-4) lo consume.

## Archivos
- `election.ts` — `Eleccion` (discriminador `tipo`), `Opcion` polimórfica (`OpcionHoja` | `OpcionCandidato`), `Partido`, `EntidadCanonica` (gancho de equivalencia cross-año).
- `votes.ts` — `VotosShard`, `AgregadoZona` (agregados precomputados por zona), `CategoriasNoPartidarias` (blanco/anulado/observado), `Escrutinio`, `NivelGeografico`.
- `manifest.ts` — `Manifest` (índice versionado con hash), `ShardRefs` (refs a votos + geometría por nivel).
- `guards.ts` — type guards + `assertVotosShard` (validación runtime, usada por los gates del ETL). Sin dependencias.
- `__fixtures__/` — fixtures secos (internas/nacionales/balotaje) que validan la polimorfia en compile-time + `validate.ts` (self-test de guards).

## Reglas clave (project-context.md)
- **Opción polimórfica:** HOJA (internas/legislativas) | candidato/lema (balotaje/presidencial, SIN hoja). Discriminada por `Opcion.clase`.
- **Voto canónico:** etapa `definitivo`; nunca sumar etapas. Blanco/anulado/observado = categorías aparte.
- **Equivalencia cross-año:** `EntidadCanonica` = juicio editorial versionado. Vacío/identidad en Fase 1. Default de comparación = partido/lema.

## Validación
`npx astro check` (strict) valida tipos + polimorfia (el fixture de balotaje sin HOJA debe compilar). El self-test de guards: `runContractSelfTest()` en `__fixtures__/validate.ts` (ejecutable con el test runner de Story 1.10).
