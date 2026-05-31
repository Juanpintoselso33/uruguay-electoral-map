# Data Contract v3

Contrato de datos del proyecto. **Genérico y polimórfico**: soporta todos los tipos de elección sin rediseño. El ETL (Story 1.4+) produce artefactos que cumplen este contrato; el cliente (Epics 2-4) lo consume. **v3 (Epic 10)** agrega la granularidad de opción (drill-down hasta la HOJA individual).

## Archivos
- `election.ts` — `Eleccion` (discriminador `tipo`), `Opcion` polimórfica (`OpcionHoja` | `OpcionCandidato` | `OpcionBinaria`), `Partido`, `EntidadCanonica`, y **v3**: `Contienda`, `GranularidadNivel`, `NodoOpcion` + linaje de granularidad en las opciones.
- `granularidad.ts` — **v3**: `EscaleraGranularidad` + `ESCALERAS` + `escaleraDe` (escalera por `tipo×contienda`), `CatalogoOpciones`/`ContiendaCatalogo` (catálogo jerárquico), `opcionIdHoja` (id compuesto), `slugContrato`.
- `votes.ts` — `VotosShard`, `AgregadoZona` (agregados precomputados por zona), `CategoriasNoPartidarias` (blanco/anulado/observado), `Escrutinio`, `NivelGeografico`.
- `manifest.ts` — `Manifest` (índice versionado con hash, `contractVersion: 'v3'`), `ShardRefs` (refs a votos + geometría por nivel).
- `guards.ts` — type guards + `assertVotosShard`, **v3**: `assertCatalogoConsistente` + `assertHojasEnCatalogo` (validación runtime, usada por los gates del ETL). Sin dependencias.
- `__fixtures__/` — fixtures secos (internas/nacionales/balotaje/plebiscito + **internas-hoja v3**) que validan la polimorfia y la granularidad en compile-time + `validate.ts` (self-test de guards, 11 checks).

## Reglas clave (project-context.md)
- **Opción polimórfica:** HOJA (internas/legislativas) | candidato/lema (balotaje/presidencial, SIN hoja) | binaria Sí/No (plebiscito, SIN partido ni hoja). Discriminada por `Opcion.clase`.
- **Voto canónico:** etapa `definitivo`; nunca sumar etapas. Blanco/anulado/observado = categorías aparte.
- **Equivalencia cross-año:** `EntidadCanonica` = juicio editorial versionado. Vacío/identidad en Fase 1. Default de comparación = partido/lema.

## Validación
`npx astro check` (strict) valida tipos + polimorfia (el fixture de balotaje sin HOJA y el de plebiscito con `OpcionBinaria` deben compilar). El self-test de guards: `runContractSelfTest()` en `__fixtures__/validate.ts` (ejecutable con el test runner de Story 1.10).
