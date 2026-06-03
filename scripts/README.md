# scripts/ — Builders y quality gates

Scripts auxiliares que complementan el pipeline [`etl/`](../etl/README.md). Dos familias:

- **`.mjs`** — gates de build y generadores integrados al `npm run build` de Astro.
- **`.py`** — builders de geometría/datos para la vista nacional y casos especiales que requieren librerías de Python (geometría, extracción de PDF, auditorías).

## Quality gates

Corren en el build (`package.json → build`) y/o a demanda:

| Script | Comando | Qué valida |
|--------|---------|------------|
| `gate-data.mjs` | `npm run gate:data` | Integridad de los shards de datos. |
| `gate-escaleras.ts` | `npm run gate:escaleras` | Consistencia de las escaleras de color. |
| `gate-grises.py` | `npm run gate:grises` | Zonas sin geometría asociada (huecos grises en el mapa). |
| `perf-budget.mjs` | `npm run gate:perf` | Presupuesto de performance. |
| `a11y-check.mjs` | `npm run gate:a11y` | Chequeos de accesibilidad. |
| `measure-cwv.mjs` | `npm run gate:cwv` | Core Web Vitals. |

`npm run gate:all` ejecuta perf + a11y + cwv.

## Generadores de build

| Script | Comando | Salida |
|--------|---------|--------|
| `generate-og.mjs` | `npm run generate:og` | Imágenes Open Graph en `public/og/`. |
| `generate-search-index.mjs` | `npm run generate:search` | Índice de búsqueda. |

## Builders de la vista nacional (Python)

| Script | Comando | Función |
|--------|---------|---------|
| `build-nacional-geo.py` | `npm run etl:nacional-geo` | Geometría nacional (departamentos). |
| `build-nacional-zona-geo.py` | `npm run etl:nacional-zona-geo` | Geometría nacional por zona. |
| `build-nacional-votes.py` | `npm run etl:nacional-votes` | Votos consolidados a nivel nacional. |
| `build-annex-series.py` | `npm run etl:annex` | Anexa series sin geometría propia. |

## Mapeo CRV → barrio de Montevideo (por ciclo)

| Script | Función |
|--------|---------|
| `build-circuito-barrio-cycles.py` | Genera un `data/mappings/montevideo-circuito-barrio.{ciclo}.json` por ciclo electoral (CRV→barrio). Tiers: dir → geo (cache) → coarse → tok → serie. Los CRV se reasignan entre elecciones → **un mapeo por ciclo, no compartido**. |
| `geocode-missing-barrios.py` | Geocodifica (Nominatim/OSM) las direcciones ausentes del georef-2024 y mantiene `data/mappings/montevideo-geocode-cache.json` (resumible, **commiteado** → build reproducible). Guard: PIP descarta calles homónimas fuera de MVD. |

> Contexto y decisión: [`docs/adr/0001-circuito-barrio-por-ciclo.md`](../docs/adr/0001-circuito-barrio-por-ciclo.md) · diagnóstico: [`docs/AUDIT-carrasco-2014-circuito-barrio.md`](../docs/AUDIT-carrasco-2014-circuito-barrio.md). Tras regenerar mapeos y re-correr runners MVD, correr `sweep-party-consistency.py --apply` y `build-nacional-votes.py`.

## Votos no-partidarios (blanco / anulados / observados + participación)

| Script | Comando | Función |
|--------|---------|---------|
| `fetch-totales-ckan.py` | `npm run etl:totales-fetch` | Baja de CKAN (Corte) los `totales-generales` por circuito faltantes (internas-2024, dep-2025). |
| `build-no-partidarios.py` | `npm run etl:no-partidarios` | Post-pass: puebla `noPartidarios` + `habilitados`/`emitidos` por barrio (MVD vía `crvToBarrio.{ciclo}`), serie (interior) y departamento (`_nacional`), desde el totales por circuito. |
| `gate-no-partidarios.py` | `npm run gate:no-partidarios` | Sanidad (no-negativos) + reconciliación nacional informativa. |

> **Dominio:** `emitidos`/`habilitados` salen del *totales* (donde se emitió el voto); `validos`/`porOpcion`
> del *desglose* (donde se contó). El voto **observado** se emite en un circuito y se cuenta en el de
> origen del votante → `emitidos = válidos + blanco + anulados + observados` **no cierra por zona** (ni
> exacto a nivel país: ~2% nacionales, ~10% internas). Son dos productos oficiales distintos; no se fuerzan
> a reconciliar. Spec: [`docs/superpowers/specs/2026-06-02-votos-no-partidarios-design.md`](../docs/superpowers/specs/2026-06-02-votos-no-partidarios-design.md).

## Utilidades y auditoría

- `extract-vivir-sin-miedo.py` — extrae el Sí/No del plebiscito 2019 desde el PDF oficial, circuito por circuito.
- `sweep-party-consistency.py` — normaliza ids y nombres canónicos de partidos en todas las elecciones.
- `audit-grises.py` / `audit-ganador.py` — auditorías de cobertura geográfica y de "ganador" por zona.
- `enrich-votes-local.py`, `build-votes-local-*.py`, `votes_local_lib.py` — construcción del nivel "local de votación".
- `build-hoja-local.py` — desglose por **HOJA** agregado al nivel local → `hoja-local.json` (un archivo por elección×depto). Mismo motor circuito→local que `build-votes-local.py` (`--mode direct|match [--plan PATH]`) pero a granularidad de hoja, resolviendo el `opcionId` contra `catalogo.json`. Da el detalle por lista/sublema en la ficha del circuito (paridad con barrio/localidad) y coloreo hoja-exacto. Mapea `TIPO_REGISTRO → contienda` (nacionales `HOJA_EN/VOTO_LEMA`→`unica`; internas `HOJA_ODN/ODD`→`odn/odd`; dep-2025 `HOJA_ED`→`junta`, `HOJA_EM`→`municipio`) y resuelve el nº de hoja probando `Descripción_1` y `_2`. Filas agregadas (`PREC_*`, `SUBLEMA_*`, `VOTOS_PREC`) se ignoran. Cobertura: las 6 elecciones con desglose (nacionales 2014/2024 = 19 deptos, 2019 = MVD; internas 2019/2024 y departamentales-2025 = 19). Balotaje/plebiscito/referéndum no tienen hojas.

> Requisitos Python: ver imports de cada script. Los `.py` se invocan vía los scripts `npm run etl:*` correspondientes.
