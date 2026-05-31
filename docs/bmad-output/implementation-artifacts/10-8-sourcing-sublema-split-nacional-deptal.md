---
baseline_commit: c35f404386d10e5306aca3eab5a99cc5bf7c38fd
---

# Story 10.8: Sourcing — sublema + split lista nacional/departamental

Status: done
<!-- DESBLOQUEADA 2026-05-31: los datos de sublema YA fueron descargados (ver Dev Notes › Datos adquiridos). La parte de research/sourcing está hecha; queda la integración al ETL. -->

## Story

As a desarrollador,
I want obtener de la Corte Electoral los datos de sublema y la distinción lista nacional (Senado) / departamental (Diputados),
so that la escalera de granularidad de nacionales y departamentales sea completa.

## ⚡ Datos adquiridos (2026-05-31) — la sourcing está hecha

El archivo `integracion-hojas-de-votacion.csv` estaba VACÍO en el repo, pero el dato **existe y fue descargado** del catálogo de datos abiertos de la Corte Electoral:

| Archivo descargado | Qué trae |
|---|---|
| `data/raw/electoral/nacionales-2024/integracion-de-hojas.csv` (217.933 filas) | `Numero`(hoja), `Departamento`, `PartidoPolitico`, `Agrupacion`, **`Candidatura`** (PRESIDENCIAL/SENADOR/REPRESENTANTE…), **`Sublema`** (ej. "EN LUCHA POR LA SOBERANÍA"), `Nombre`, `Ordinal`, `TitularSuplente` |
| `data/raw/electoral/departamentales-2025/integracion-de-hojas.csv` (640 filas) | idem + **`Candidatura`** ∈ {INTENDENTE, JUNTA DEPARTAMENTAL}, columna **`Municipio`**, **`Sublema`** |

**Hallazgos clave:**
- El **sublema SÍ existe** en la integración de hojas (no estaba vacío en el origen; el repo tenía un placeholder vacío). Se une al desglose por `Numero` (= nº de hoja) + `Departamento`.
- El **split nacional/departamental** se deriva de `Candidatura`: SENADOR = lista nacional; REPRESENTANTE (Diputados) = departamental. La fórmula presidencial es `Candidatura=PRESIDENCIAL` (fija por lema).
- Una hoja tiene MÚLTIPLES filas en la integración (una por candidato/cargo); el sublema es por hoja. Deduplicar por `(Departamento, Numero)` para obtener `{sublema, ámbito}` de cada hoja.

## Acceptance Criteria

1. **Given** que `data/raw/electoral/integracion-hojas-de-votacion.csv` está **vacío** (0 líneas) **When** investigo las fuentes oficiales **Then** documento en `docs/bmad-output/planning-artifacts/sublema-sourcing-research.md` dónde vive el dato de sublema y el de senado/diputados por hoja (URL, dataset, formato).
2. **Given** la fuente encontrada **When** la descargo **Then** queda en `data/raw/electoral/` en UTF-8, versionada, con su origen anotado.
3. **Given** el dato ingerido **When** extiendo el ETL **Then** el catálogo jerárquico (Story 10.2/10.6/10.7) puebla el nivel `sublema` y la marca `ambito: 'nacional' | 'departamental'` en cada hoja legislativa.
4. **Given** que una fuente puede no existir públicamente **When** concluyo la investigación **Then** si el dato no está disponible, queda documentado como **límite explícito** (no se inventa); la escalera permanece degradada y rotulada (Story 10.7 AC2).

## Tasks / Subtasks

- [x] **T1** — Research de fuentes (AC: 1) → `docs/bmad-output/planning-artifacts/sublema-sourcing-research.md`
  - [x] T1.1 — El sublema vive en la **integración de hojas** (CKAN Corte Electoral); join desglose×integración por `(Departamento, Numero)`.
  - [x] T1.2 — El split Senado/Diputados NO es por hoja: cada hoja aparece bajo las 5 candidaturas a la vez (un sobre elige todo). Ver T4.
  - [x] T1.3 — Documentado: hay dato de sublema (100% MO); NO hay dato de ámbito por hoja.
- [x] **T2** — Ingesta (AC: 2)
  - [x] T2.1 — Integración 2019 ya en `data/raw/electoral/nacionales-2019/integracion-hojas.csv` (Latin-1); se lee con `parseCsv(path,'latin1')` (se extendió `parseCsv` con encoding) — strings UTF-8 correctos al emitir el JSON.
- [x] **T3** — Extender ETL (AC: 3)
  - [x] T3.1 — `aggregateHojaNacionales` ahora acepta `hojaSublema` y puebla nodos `sublema` + `grupoId`/`sublemaId` por hoja.
  - [x] T3.2 — Re-corrido sin degradación: escalera `lema→sublema→hoja`, `degradado` removido, rótulo de la UI desaparece. Reconciliación exacta intacta (668 pares, total 853.439). 29 sublemas en MO.
- [x] **T4** — Documentar límite `ambito` (AC: 4) — no se modela (sería el mismo nº de hoja para senado y diputados); documentado en el research como límite explícito, sin inventar.

## Dev Notes

- **Esta story es de investigación + adquisición de datos, no de UI.** Su entregable mínimo es el documento de research; la ingesta/ETL son condicionales a que el dato exista.
- El contrato (Story 10.1) ya modela `sublemaId?` y el nivel `'sublema'`; acá se POBLA, no se diseña.
- La marca nacional/departamental: en Uruguay una hoja a Diputados es por departamento; al Senado es nacional (lista única por lema/sublema). Confirmar la relación exacta en el dato antes de modelar `ambito`.
- Bloquea la versión COMPLETA de 10.7 (nacionales) y de 10.9 (departamentales junta). Sin esto, ambas degradan y rotulan.

### Referencias
- Archivo vacío: `data/raw/electoral/integracion-hojas-de-votacion.csv`
- Corte Electoral: https://www.corteelectoral.gub.uy/ · https://catalogodatos.gub.uy
- Story 10.1 (contrato), 10.7 (nacionales degradado)

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code)

### Completion Notes List

- **El dato existía (no se inventó ni se degradó):** la integración de hojas 2019 (`nacionales-2019/integracion-hojas.csv`, Latin-1, 19 deptos) trae el sublema por hoja. Cobertura MO 85/85 (100%); 0 hojas con solo "No aplica". Join por `Numero`.
- **Encoding:** el archivo es Latin-1; se extendió `parseCsv(path, encoding?)`. Leer Latin-1 → strings JS correctos → JSON UTF-8 al emitir (sin pasos de conversión externos en el pipeline).
- **Enriquecimiento sin tocar votos:** `aggregateHojaNacionales` ahora recibe `hojaSublema`; arma nodos `sublema` por `(lema, sublema)`, marca cada hoja con `grupoId`/`sublemaId`, y emite `niveles: ['lema','sublema','hoja']` sin `degradado`. Los **ids de hoja y los shards no cambian** (siguen siendo `opcionIdHoja('unica', lema, hoja)`) → reconciliación contra el votes.json por lema intacta (668 pares, 853.439). El acordeón (generalizado en 10.9) y el gate de escalera (10.10) lo soportan sin cambios.
- **`ambito` = límite explícito (AC4):** en la integración 2019 cada hoja figura bajo las 5 candidaturas (Presidencial/Vice/Senador/Representante/Junta) → una hoja nacional es UN sobre que elige todo; no hay split de votos por ámbito. No se modela (sería el mismo nº de hoja). Documentado en el research, no inventado.
- **Verificado en browser (0 errores):** `/nacionales-2019/montevideo` → sin rótulo "degradado"; FA → 6 sublemas reales (PROGRESISTAS, FRENTE FUTURO, MAS DESARROLLO CON IGUALDAD, UNIDAD PARA LOS CAMBIOS, PLURALISMO FRENTEAMPLISTA, CON SEREGNI Y CON ZELMAR) + Voto al lema; MAS DESARROLLO → Listas 609/624/711/1968/197119. `astro check` 0/0/0; `gate:escaleras` ✓ (nacionales ahora conforma la escalera EXACTA, ya no por subsecuencia degradada).

### File List

- `docs/bmad-output/planning-artifacts/sublema-sourcing-research.md` (new) — research + decisión de ámbito.
- `etl/extract/parse-csv.ts` (modified) — parámetro `encoding` (Latin-1).
- `etl/transform/aggregate-hoja-nacionales.ts` (modified) — pobla nivel `sublema` desde `hojaSublema`; escalera completa o degradada según haya dato.
- `etl/run-nacionales-hoja-mvd.ts` (modified) — lee la integración (Latin-1), construye `hoja→sublema` MO, lo pasa al agregador.
- `public/data/nacionales-2019/montevideo/catalogo.json` (regenerado) — `lema→sublema→hoja`, sin `degradado`.

### Review Follow-ups (AI)

- [x] **[AI-Review][Important]** "First non-No-aplica wins" sin guarda: si una hoja trajera dos sublemas reales distintos, tomaría el primero en orden de archivo silenciosamente (seguro para 2019 — el sublema es invariante por hoja/agrupación — pero sin red). **Corregido:** lanza si una hoja tiene sublemas inconsistentes.
- [x] **[AI-Review][Important]** `assertCatalogoConsistente` no exige COBERTURA de sublema: una hoja que no joinea degradaría a hijo directo del lema en un árbol declarado de 3 niveles (mixto). **Corregido:** gate en el orquestador — si la escalera incluye `sublema`, toda hoja ≠ vl debe tener `grupoId`; si no, lanza. Pasa (89/89).

### Change Log

- 2026-05-31 — Sublema de nacionales-2019 poblado desde la integración de hojas (Latin-1); escalera lema→sublema→hoja sin degradación; reconciliación exacta intacta. `ambito` documentado como límite explícito. Verificado en browser. Status → review.
- 2026-05-31 — Code review (feature-dev:code-reviewer): 0 Critical, 2 Important (guard de sublema inconsistente + gate de cobertura de sublema) — ambos agregados como guardas duras. Status → done.
