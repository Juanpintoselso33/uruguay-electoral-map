# Research — Sourcing de sublema + split lista nacional/departamental (Story 10.8)

Estado: **resuelto**. El dato de sublema existe y fue ingerido; el `ámbito` nacional/departamental por hoja **no aplica** (límite explícito, ver §3).

## 1. ¿Dónde vive el dato de sublema?

En la **integración de hojas de votación** de cada elección (Corte Electoral, catálogo de datos abiertos `catalogodatos.gub.uy`). Columnas relevantes: `Numero` (nº de hoja), `Departamento`, `Candidatura`, **`Sublema`**, `Nombre`, `Ordinal`, `TitularSuplente`.

| Elección | Archivo en repo | Encoding | Cobertura sublema (MO) |
|---|---|---|---|
| Nacionales 2019 | `data/raw/electoral/nacionales-2019/integracion-hojas.csv` (217.933 filas, 19 deptos) | **Latin-1** | 85/85 hojas (100%) |
| Departamentales 2025 | `data/raw/electoral/departamentales-2025/integracion-de-hojas-full.csv` (del XLSX; el CSV publicado está truncado a Artigas) | UTF-8 | junta 128/128 |

**Join:** desglose × integración por `(Departamento, Numero=nº de hoja)`. Una hoja tiene MÚLTIPLES filas en la integración (una por candidato/cargo); el sublema es por hoja → deduplicar por `Numero` tomando el valor `Sublema` distinto de `"No aplica"` (la fila Presidencial trae `"No aplica"`; las de Senador/Representante traen el sublema).

## 2. Ingesta

- Nacionales 2019: el ETL `etl/run-nacionales-hoja-mvd.ts` lee la integración con `parseCsv(path, 'latin1')` (se extendió `parseCsv` con parámetro de encoding), construye `hoja→sublema` (MO) y lo pasa a `aggregateHojaNacionales`, que ahora puebla el nivel `sublema` (escalera `lema→sublema→hoja`, sin `degradado`). Reconciliación exacta intacta (la enriquecimiento no altera votos): 668 pares, total 853.439.
- Departamentales 2025 (Junta): ya consumido en Story 10.9 (`etl/run-departamentales-mvd.ts`).

## 3. Split nacional (Senado) / departamental (Diputados) — LÍMITE EXPLÍCITO (AC4)

La hipótesis inicial ("SENADOR = lista nacional; REPRESENTANTE = departamental → marcar `ambito` por hoja") **no se sostiene en el dato**: en la integración 2019 (MO) **cada hoja aparece bajo las 5 candidaturas** a la vez (Presidencial, Vicepresidencial, Senador, Representante, Junta Electoral) — histograma `{5 candidaturas: 89 hojas}`. Es decir, **una hoja de votación nacional es un único sobre** que elige presidente + senado (nacional) + diputados (departamental) simultáneamente; no hay hojas "de senado" vs "de diputados" separadas, ni un split de votos por ámbito.

**Decisión:** NO se modela `ambito` por hoja (sería el mismo nº de hoja en ambos casos, sin un conteo de votos separable). El dato no inventado: la escalera de nacionales queda `lema→sublema→hoja` (completa), sin marca de ámbito. Si en el futuro se quisiera distinguir Senado/Diputados habría que modelar los CARGOS (no las hojas) como una dimensión aparte — fuera del alcance de la granularidad de opción.

## Procedencia

- Dataset CKAN nacionales 2019: `corte-electoral-*` (elecciones nacionales 2019), recurso "Integración de las hojas de votación".
- Dataset CKAN departamentales 2025: `corte-electoral-elecciones_departamentales_y_municipales_2025` (usar el XLSX, hoja `Datos` — el CSV está truncado).
