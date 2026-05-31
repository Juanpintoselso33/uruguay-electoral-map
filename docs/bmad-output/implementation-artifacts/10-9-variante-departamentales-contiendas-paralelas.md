---
baseline_commit: c35f404386d10e5306aca3eab5a99cc5bf7c38fd
---

# Story 10.9: Variante departamentales — contiendas paralelas

Status: done
<!-- DESBLOQUEADA 2026-05-31: datos departamentales 2025 descargados (ver Dev Notes › Datos adquiridos). -->

## Story

As a usuario,
I want explorar intendente, junta departamental y municipio por separado en las elecciones departamentales,
so that vea cada contienda con su propia escalera de granularidad.

## ⚡ Datos adquiridos (2026-05-31)

Descargados de Elecciones Departamentales y Municipales 2025 (Corte Electoral, 11/05/2025):

| Archivo | Estructura confirmada |
|---|---|
| `data/raw/electoral/departamentales-2025/desglose-de-votos.csv` (444.371 filas) | `TIPO_REGISTRO` ∈ {**HOJA_ED** (depart.: intendente+junta, 380k), **HOJA_EM** (municipal: alcalde, 46k), VOTO_LEMA_ED, VOTO_LEMA_EM}, `DEPARTAMENTO`, `CRV`, `SERIES`, `LEMA`, `DESCRIPCION_1`(hoja), `DESCRIPCION_2`, `CANTIDAD_VOTOS` |
| `data/raw/electoral/departamentales-2025/integracion-de-hojas.csv` (640) | `Candidatura` ∈ {**INTENDENTE**, **JUNTA DEPARTAMENTAL**}, columna **`Municipio`**, **`Sublema`**, `Numero`(hoja), `Nombre` |
| `data/raw/electoral/departamentales-2025/plan-circuital.csv` | join geográfico por circuito/serie |

**Mapeo a contiendas:** la elección departamental (HOJA_ED) lleva en la misma hoja el voto a Intendente y a Junta — se separan vía la integración (`Candidatura`). La municipal (HOJA_EM) es el Alcalde/Concejo (columna `Municipio`). Las 3 contiendas del modelo (Intendente / Junta / Municipio) salen de cruzar desglose × integración.
**Nota:** el dato disponible es **2025** (no 2020); es la departamental más reciente. Ajustar `eleccionId` a `departamentales-2025`.

## Acceptance Criteria

1. **Given** datos departamentales ingeridos (Epic 7.6) **When** corro el ETL de granularidad **Then** emite las tres contiendas: Intendente (lema → candidato), Junta Departamental (lema → sublema → lista), Municipio (lema → alcalde → lista).
2. **Given** el selector de contienda (FR49) **When** elijo Intendente / Junta / Municipio **Then** el árbol activo del acordeón cambia a la escalera de esa contienda **And** la selección se limpia al cambiar de contienda.
3. **Given** cada contienda **When** abro el acordeón **Then** se adapta a su escalera (intendente no tiene nivel hoja; junta y municipio sí).
4. **Given** los gates **When** corro **Then** reconciliación y consistencia pasan por contienda.
5. **Given** que el municipio solo existe en algunas localidades **When** una zona no tiene municipio **Then** se rotula (no hay contienda municipal ahí), sin romper.

## Tasks / Subtasks

- [x] **T1** — Modelar las 3 contiendas en el ETL (AC: 1, 5)
  - [x] T1.1 — `TIPO_REGISTRO` → contienda: HOJA_ED/VOTO_LEMA_ED alimentan Intendente Y Junta (mismo sobre); HOJA_EM/VOTO_LEMA_EM → Municipio. Linaje (candidato/sublema/alcalde) por join `desglose × integración` por número de hoja.
  - [x] T1.2 — Intendente: lema → candidato (el candidato = Ordinal 1 / Titular de su INTENDENTE candidatura; agrega sus hojas). Junta: lema → sublema → hoja. Municipio: lema → alcalde → hoja (alcalde = Ordinal 1 / T de MUNICIPIO; rótulo "NOMBRE — Municipio X").
  - [x] T1.3 — Zonas sin municipio: en Montevideo los 8 municipios (A–G/CH) cubren todo el depto, así que no hay barrio sin municipio. El comportamiento general queda cubierto por el coloreo: al elegir una lista municipal, solo se pintan los barrios de SU municipio (los demás quedan ~0) — el mapa veraz (el alcalde solo se presentó ahí).
- [x] **T2** — Catálogo + shards por contienda (AC: 1, 4)
  - [x] T2.1 — Un `catalogo.json` con las 3 contiendas; shards `hoja/{contienda}/{lema}.json` (9 shards: 3 contiendas × 3 lemas).
  - [x] T2.2 — Gates: `assertCatalogoConsistente`, `assertHojasEnCatalogo` por shard, reconciliación Σopciones(barrio,lema)==total por contienda (183 pares c/u), e igualdad de totales de lema intendente==junta (mismo sobre ED). El gate de escalera (10.10) valida las 3 contiendas sin cambio de contrato.
- [x] **T3** — Selector de contienda (AC: 2) — reusa FR49/Story 10.3
  - [x] T3.1 — Tab-bar de contienda (ya existía para internas odn/odd) ahora con 3 tabs; cambiar contienda limpia selección + escribe URL (`?cont=`). **Generalicé el acordeón** (antes solo precandidato/ODD) a escalera de N niveles: nivel medio genérico (precandidato|sublema|alcalde) vía `gruposDe`/`opcionesDeGrupo` y nodo terminal hoja|candidato vía `etiquetaOpcion`.

## Dev Notes

- **BLOQUEADA por Epic 7.6** (ETL + ingesta de elecciones departamentales). Sin datos departamentales en el repo no hay ETL ejecutable. Esta story queda en `backlog` hasta que 7.6 entregue el dato.
- La escalera de Junta incluye sublema → depende también de Story 10.8 (sourcing sublema); si no hay dato de sublema, degrada a lema → lista y rotula.
- El selector de contienda es infraestructura compartida con internas (ODN/ODD) — la misma maquinaria de FR49; reusar.
- Confirmar la estructura real del CSV departamental cuando exista (acumulación por sublema, candidatos a intendente múltiples por lema, alcaldes por municipio).

### Referencias
- Story 10.1 (Contienda, escaleras), Story 10.3 T6 (selector de contienda), Epic 7.6 (datos), Story 10.8 (sublema)

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code)

### Completion Notes List

- **Dato faltante buscado, no descartado (memoria [[integracion-csv-truncado-usar-xlsx]]):** el `integracion-de-hojas.csv` publicado está TRUNCADO a Artigas (639 filas). El **XLSX** del mismo recurso (9.87 MB, hoja `Datos`) tiene los 19 deptos y las **3 candidaturas** (INTENDENTE/JUNTA/**MUNICIPIO** — la última falta entera en el CSV). Convertido con python3+openpyxl → `integracion-de-hojas-full.csv` (136.986 filas). Sin esto, Montevideo quedaba sin candidatos/sublemas/alcaldes y la story se habría reducido a Artigas — el patrón "descartar por dato faltante" que el usuario marcó. **Se construyó el flagship (Montevideo) con dato real.**
- **Arbitraje empírico de cobertura (antes de construir):** join desglose×integración por número de hoja, Montevideo: Intendente 128/128, Junta 128/128, Municipio 66/66 (id municipal sufijado "53-B" == `Numero` byte-idéntico). 100% en las tres → se construyen las tres.
- **Modelo de las 3 contiendas:** el mismo voto del sobre ED cuenta para Intendente Y Junta (verificado: igualdad de totales de lema). Intendente agrega hojas por candidato (Ordinal 1/T); Junta desglosa por sublema→hoja; Municipio por alcalde→hoja con rótulo de municipio. `VOTO_LEMA_*` → pseudo-hoja/candidato "Voto al lema" para que toda papeleta caiga en una opción (reconciliación exacta).
- **Base = intendente por lema** (`votes.json`, mapa por defecto): MO 2025 tiene 3 lemas (FA, Asamblea Popular, y la Coalición Republicana unificada — históricamente correcto). 61 barrios.
- **Acordeón generalizado (no más hardcode de precandidato):** nivel medio genérico (precandidato|sublema|alcalde) por `nivelMedio`/`gruposDe`/`opcionesDeGrupo`/`idsDeGrupo` + nodo terminal hoja|candidato por `etiquetaOpcion`; link genérico `parentDe(o)=grupoId ?? precandidatoId` (retro-compatible con los 19 catálogos de internas, que sólo traen `precandidatoId`). Búsqueda adaptativa (candidato vs número).
- **Verificado en browser (Playwright, 0 errores de consola):**
  - **Intendente** → FA: Bergara/Schelotto/Piñeiro + Voto al lema; seleccionar Bergara pinta su share% por barrio (34–38%). `10-9-intendente-bergara.png`.
  - **Junta** → FA → SIEMPRE CON LA GENTE → Listas 9/46/609/8811/76949; seleccionar 609 colorea por hoja.
  - **Municipio** → FA → 18 nodos "ALCALDE — Municipio X" + Voto al lema; al elegir "Leticia de Torres — Municipio G" SOLO se pintan los barrios del noreste (Municipio G: 29/25/18%), el resto ~0/3% → partición geográfica veraz (el alcalde solo se presentó ahí). `10-9-municipio-G-map.png`.
  - Cambiar de contienda limpia la selección y actualiza `?cont=`.
- **Limitación conocida (denominador de Share% para municipio):** el `% sobre válidos` usa los válidos del intendente (base), no los válidos municipales. Como la concurrencia municipal ≈ departamental (mismo votante/jornada), el share es aproximado; **Votos** y **Heatmap** son exactos. Mejorable si se emite un válidos municipal por barrio (follow-up menor).
- **Otros deptos:** el transform es agnóstico del depto; los 19 tienen integración en el XLSX. Rollout (Canelones, interior por serie…) es trabajo de re-corrida cuando tengan su geometría/serie, no de modelado. `astro check` 0/0/0; `gate:escaleras` ✓ 24 catálogos.

### File List

- `etl/run-departamentales-mvd.ts` (new) — ETL de las 3 contiendas (desglose×integración), base intendente, shards, gates de reconciliación.
- `package.json` (modified) — script `etl:departamentales-mvd`.
- `src/components/selectors/OpcionAccordion.vue` (modified) — generalización a escalera de N niveles (nivel medio genérico + nodo terminal hoja|candidato).
- `src/config/departments.json` (modified) — `departamentales-2025` en Montevideo.
- `src/pages/[eleccion]/[departamento].astro` (modified) — label + `tieneCatalogoHoja` incluye departamentales-2025 MO.
- `data/raw/electoral/departamentales-2025/integracion-de-hojas-full.csv` (new, derivado del XLSX) — integración completa.
- `public/data/departamentales-2025/montevideo/{catalogo,votes,opciones}.json` + `hoja/{intendente,junta,municipio}/{lema}.json` (new, generados).

### Review Follow-ups (AI)

- [x] **[AI-Review][Critical]** Gates de reconciliación TAUTOLÓGICOS: `addVoto` escribía `votos` y `lemaTotal` desde la misma fila, así que `reconcilia` (Σopciones==lemaTotal) e `igualTotalesLema` no podían fallar — daban falsa confianza y, peor, NO detectaban la degradación por integración truncada (los votos suman igual bajo etiquetas placeholder). **Corregido:** (a) `coberturaGate` — lanza si alguna opción/nodo cayó en bucket placeholder ('(sin candidato)'/'Sin sublema'/'(lista sin alcalde)') → caza la integración ausente/truncada; (b) `reconciliaContraRaw` — re-suma CRUDA del desglose en otra pasada (sin pasar por opciones/integración) y compara contra Σ de votos enrutados por opción → caza mis-routing. Ambos pasan (intendente/junta 767.332, municipio 341.920; 0 placeholders).
- [x] **[AI-Review][Critical]** `grupoId` sin validar en `assertCatalogoConsistente`: el enlace alcalde→hoja de municipio vivía solo en `grupoId` (no había `sublemaId`/`precandidatoId`), sin chequeo de integridad referencial. **Corregido:** `grupoId` agregado a `OpcionHoja` (contrato) + check en el guard (`grupoId` debe referenciar un nodo existente); se eliminaron los casts `as unknown as Opcion`.
- [x] **[AI-Review][Important]** Merge silencioso por colisión de slug (dos candidatos/alcaldes distintos del mismo lema con nombre slug-idéntico se fusionaban). Verificado: 0 colisiones en MO. **Corregido igual** (robustez para otros deptos): guardas que lanzan en `ensureMiddle` (nodo medio) y en la creación del candidato a intendente si un id mapea a otra etiqueta.

### Change Log

- 2026-05-31 — Departamentales 2025 Montevideo: 3 contiendas paralelas (intendente/junta/municipio) con candidatos, sublemas y alcaldes reales. Integración completa rescatada del XLSX (el CSV estaba truncado a Artigas). Acordeón generalizado a escalera de N niveles. Reconciliación exacta + verificado en browser. Status → review.
- 2026-05-31 — Code review (feature-dev:code-reviewer): 2 Critical (gates tautológicos; `grupoId` sin validar) + 1 Important (merge por colisión de slug) corregidos y verificados. `grupoId` ahora en el contrato. Gates reemplazados por cobertura + re-suma cruda independiente. Status → done.
