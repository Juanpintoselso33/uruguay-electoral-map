# Epic — Votos no-partidarios (blanco / anulados / observados) + participación en todas las elecciones

- **Fecha:** 2026-06-02
- **Estado:** Diseño aprobado (brainstorming)
- **Relacionado:** [`public/data/README.md`](../../../public/data/README.md), [`docs/adr/0001-circuito-barrio-por-ciclo.md`](../../adr/0001-circuito-barrio-por-ciclo.md)

## Problema

Los campos `noPartidarios` (`enBlanco`, `anulados`, `observados`) de los shards están en **0** para
las elecciones multi-partido: nacionales (2014/19/24), internas (2019/24), departamentales (2020/25).
Solo los balotajes y el referéndum-2022 los traen (sus CSV binarios ya tienen esas columnas). Además
no se modela **habilitados/emitidos**, así que no hay participación ni abstención.

## El dato SÍ existe (verificado en CKAN)

La Corte publica, por elección, un **"Totales Generales por circuito" (CSV)** con una fila por CRV:
`Habilitados, Votos Emitidos, Votos (NO) Observados, Anulados, En Blanco`. Disponible para las 8:
- En local: nacionales-2014, internas-2019, nacionales-2019, departamentales-2020.
- En CKAN (a bajar): internas-2024 (`…/totales-generales.csv`), departamentales-2025
  (`…/totales-generales-por-comision-receptora-de-votos.csv`).

Notas de origen: nombres de columna varían (con/sin guiones bajos); **departamentales agrega
`TotalEnBlancoParcial`** (blanco en una sola de depto/municipal) → **fuera de alcance** (usamos
`TotalEnBlanco` total). El desglose multi-partido NO trae filas de blanco/anulado: el dato vive
solo en el totales.

## Decisiones de alcance

- **Cobertura:** las 8 elecciones multi-partido. Balotajes/referéndum ya están (se dejan; opcional
  unificarlos por el mismo post-pass para consistencia, sin cambiar sus valores).
- **Frontend completo:** poblar el dato + tasas derivadas (% blanco, % anulados, participación,
  abstención) + **capa de mapa** seleccionable por esas tasas.
- **Fuentes faltantes:** bajar de CKAN ahora (internas-2024, dep-2025).
- **`EnBlancoParcial`:** no se modela (YAGNI).

## Arquitectura (Enfoque A — post-pass, no toca los ~17 runners)

### 1. Extract — `scripts/fetch-totales-ckan.py` (`npm run etl:totales-fetch`)
Descarga los `totales-generales` faltantes desde CKAN a `data/raw/electoral/{eleccion}/`. Idempotente
(no re-baja si existe). Resuelve los resource URLs vía la API CKAN (`package_show`).

### 2. Ingesta — `scripts/build-no-partidarios.py` (`npm run etl:no-partidarios`)
Post-pass. Por elección con totales disponible:
- Carga el totales por CRV (parser tolerante a los dos formatos de columnas; depto = `MO` / `MONTEVIDEO`).
- Para **cada shard ya emitido** de esa elección (`public/data/{el}/{depto}/{votes,votes-local,...}.json`
  y `_nacional`), re-agrega `enBlanco/anulados/observados/habilitados/emitidos` por su `geoId` usando
  **el mismo mapeo que ese nivel** ya usa:
  - MVD barrio/zona → `crvToBarrio.{ciclo}.json`.
  - Interior serie → por columna `Serie` del totales.
  - circuito → por CRV directo; local → mapeo CRV→local existente; nacional → suma por depto.
- **Parchea** `noPartidarios` y agrega `habilitados`/`emitidos`. No reescribe los votos por opción.
- Idempotente y reproducible (sin red; usa los CSV locales).

### 3. Schema — `src/lib/contracts`
Extender `AgregadoZona`: agregar `habilitados?: number` y `emitidos?: number` (opcionales para no
romper shards viejos durante la transición). `noPartidarios` ya existe. Actualizar guards + fixtures.

### 4. Gate — `scripts/gate-no-partidarios.py` (`npm run gate:no-partidarios`)
Por zona con datos: `|emitidos − (válidos + enBlanco + anulados + observados)| ≤ tolerancia` y
`emitidos ≤ habilitados`. Reporta y falla el build si no cuadra. Tolerancia chica por redondeos de
agregación / circuitos sin mapear (se loguea el faltante, nunca se oculta).

### 5. Frontend
- **`ZoneSheet`**: bloque de tasas — participación (`emitidos/habilitados`), abstención, % en blanco
  y % anulados (sobre emitidos). Los absolutos ya se muestran.
- **`ResultadoGlobal`** (resumen agregado bajo el mapa): mismas tasas a nivel del recorte actual.
- **Capa de mapa**: nueva métrica seleccionable (`% en blanco` / `% anulados` / `participación`) que
  colorea el mapa con su propia escala, integrada al selector de opciones existente y a `MapLegend`.

## Data flow

```
CKAN ─(fetch)→ data/raw/.../totales-generales.csv
                        │
   crvToBarrio.{ciclo} ─┤ build-no-partidarios.py (re-agrega por nivel)
   serie / CRV / local ─┘
                        ▼
   public/data/{el}/{depto}/*.json  (noPartidarios + habilitados/emitidos)
                        │ gate-no-partidarios
                        ▼
   Astro/Vue: ZoneSheet · ResultadoGlobal · capa de mapa (tasas)
```

## Orden de implementación (stories)

1. **Extract:** `fetch-totales-ckan.py` + npm script; bajar internas-2024 y dep-2025.
2. **Schema:** extender contrato + fixtures + guards.
3. **Ingesta:** `build-no-partidarios.py` (todos los niveles, las 8 elecciones); regenerar.
4. **Gate:** `gate-no-partidarios.py`; integrar al build.
5. **Frontend datos:** tasas en `ZoneSheet` + `ResultadoGlobal`.
6. **Frontend capa:** métrica de mapa seleccionable + leyenda.
7. **Docs:** actualizar `public/data/README.md`, `scripts/README.md`, `etl/README.md`.

## Riesgos

- Circuitos del totales sin barrio en el mapeo (mismo ~1% del join) → se suman a "sin ubicar"; el gate
  lo reporta, no rompe la reconciliación.
- Interior: el totales trae `Serie`; el shard interior es por serie → join directo (bajo riesgo).
- Balotaje/referéndum ya poblados: al re-correr el post-pass deben quedar **byte-iguales** (validación).
