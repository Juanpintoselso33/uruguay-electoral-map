# etl/mappings

Carpeta reservada para lógica de mapeo geográfico. **Las tablas de mapeo en sí no viven acá**, sino en:

- `data/mappings/` — fuentes curadas/generadas:
  - `{depto}-series-locality.json` / `{ciudad}-serie-barrio.json` — **SERIE → localidad/barrio** (interior).
  - **`montevideo-circuito-barrio.{ciclo}.json`** — **CIRCUITO (CRV) → barrio**, uno **por ciclo electoral** (2014, internas-2019, 2019, departamentales-2020, referendum-2022, departamentales-2025, 2024). Los CRV se reasignan entre elecciones, por eso **no se comparte un único mapeo** (ver bug de Carrasco abajo).
  - `montevideo-geocode-cache.json` — cache de geocoding (street-key → barrio) para direcciones ausentes del georef-2024. **Commiteado** → build reproducible sin red.
  - `montevideo-circuito-barrio.json` — **legacy**, ya no se consume.
- `public/data/mappings/` — mapeos desplegados que consume la app.

La generación y los tipos viven en:

- [`scripts/build-circuito-barrio-cycles.py`](../../scripts/) — **genera los mapeos CRV → barrio por ciclo** (dir → geo → coarse → tok → serie). Reemplaza al viejo `etl/geometry/build-circuito-barrio.ts`.
- [`scripts/geocode-missing-barrios.py`](../../scripts/) — geocodifica (Nominatim) y mantiene el cache.
- [`etl/lib/serie-localidad.ts`](../lib/) — tipo/carga **SERIE → localidad**. Generado por `npm run etl:serie-localidad`.
- [`etl/lib/serie-barrio.ts`](../lib/) — tipo del mapeo **SERIE → barrio** (capitales).

> Dominio: el mapeo serie↔barrio se cura **manualmente por capital**; no existe un join espacial automático correcto. El mapeo CRV→barrio es **por ciclo**. Ver [`public/data/README.md`](../../public/data/README.md) y [`docs/adr/0001-circuito-barrio-por-ciclo.md`](../../docs/adr/0001-circuito-barrio-por-ciclo.md).
