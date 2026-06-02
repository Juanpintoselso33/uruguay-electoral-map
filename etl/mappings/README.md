# etl/mappings

Carpeta reservada para lógica de mapeo geográfico. **Las tablas de mapeo en sí no viven acá**, sino en:

- `data/mappings/` — fuentes curadas, p. ej. `{depto}-series-locality.json` (SERIE → localidad) y `montevideo-circuito-barrio.json` (CIRCUITO → barrio).
- `public/data/mappings/` — mapeos desplegados que consume la app.

La generación y los tipos viven en:

- [`etl/lib/serie-localidad.ts`](../lib/) — tipo y carga del mapeo **SERIE → localidad** (1:1 o ciudad-grande). Generado por `npm run etl:serie-localidad`.
- [`etl/lib/serie-barrio.ts`](../lib/) — tipo del mapeo **SERIE → barrio** (capitales).
- [`etl/geometry/build-circuito-barrio.ts`](../geometry/README.md) — genera el mapeo **CIRCUITO → barrio**.

> Dominio: el mapeo serie↔barrio se cura **manualmente por capital**; no existe un join espacial automático correcto. Ver [`public/data/README.md`](../../public/data/README.md).
