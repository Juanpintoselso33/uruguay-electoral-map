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

## Utilidades y auditoría

- `extract-vivir-sin-miedo.py` — extrae el Sí/No del plebiscito 2019 desde el PDF oficial, circuito por circuito.
- `sweep-party-consistency.py` — normaliza ids y nombres canónicos de partidos en todas las elecciones.
- `audit-grises.py` / `audit-ganador.py` — auditorías de cobertura geográfica y de "ganador" por zona.
- `enrich-votes-local.py`, `build-votes-local-*.py`, `votes_local_lib.py` — construcción del nivel "local de votación".

> Requisitos Python: ver imports de cada script. Los `.py` se invocan vía los scripts `npm run etl:*` correspondientes.
