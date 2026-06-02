# etl/geometry

Construcción y optimización de la geometría (GeoJSON → TopoJSON) y el join geográfico de los votos.

| Archivo | Función |
|---------|---------|
| `build-topojson.ts` | GeoJSON → TopoJSON simplificado. Dedup de bordes compartidos + *simplify* (Visvalingam) reducen el payload. Canonicaliza la propiedad de nombre a `properties.name` (el cliente siempre lee esa clave) y descarta el resto. |
| `build-circuito-barrio.ts` | **(legacy)** builder TS de un mapping CIRCUITO → BARRIO por dirección → coords → PIP. **Superado** por el generador por-ciclo en Python (ver abajo); ya no lo usa ningún runner. |
| `dissolve-empty.ts` | Fusión dinámica de barrios sin datos: si un barrio no recibió votos (sus votantes votaron en barrios vecinos), su polígono se disuelve en el barrio con votos con el que comparte mayor borde. Evita huecos grises sin inventar votos. |

## Generador vigente: mapeo CRV → barrio POR CICLO (Python)

El sistema en uso vive en `scripts/`, no acá:

- **`scripts/build-circuito-barrio-cycles.py`** — genera un `data/mappings/montevideo-circuito-barrio.{ciclo}.json` por ciclo electoral (2014, internas-2019, 2019, departamentales-2020, referendum-2022, departamentales-2025, 2024). Tiers de asignación, de más a menos preciso: **dir** (street-key exacta → coords georef → PIP) → **geo** (coord geocodificada del cache → PIP) → **coarse** (calle sin número, barrio único) → **tok** (voto por token de nombre de calle) → **serie** (barrio dominante de la serie, fallback). Tras el geocoding el fallback-serie quedó en **~0,4–3,6%**.
- **`scripts/geocode-missing-barrios.py`** — geocodifica (Nominatim/OSM) las direcciones ausentes del georef-2024; cachea en `data/mappings/montevideo-geocode-cache.json` (commiteado → build reproducible sin red). Guard: el PIP descarta calles homónimas fuera de Montevideo.

## Advertencia clave (no replicar el bug de Carrasco)

El número de circuito (CRV) **se reutiliza entre elecciones para ubicaciones distintas**. Aplicar un único mapeo CRV→barrio a todas las elecciones produce joins incorrectos (ej.: "FA 66,5% en Carrasco 2014" es voto de Malvín Norte / Punta Gorda mal etiquetado). El mapeo se construye **por ciclo**, con el **mismo método** en todos (incl. 2024) para que la comparación entre años sea coherente. Decisión completa: [`docs/adr/0001-circuito-barrio-por-ciclo.md`](../../docs/adr/0001-circuito-barrio-por-ciclo.md); diagnóstico original: [`docs/AUDIT-carrasco-2014-circuito-barrio.md`](../../docs/AUDIT-carrasco-2014-circuito-barrio.md).

## Fuentes

- Georef Corte (lat/lon por circuito, nacionales-2024): `data/raw/geographic/plan-circuital-georreferencia-nacional-2024.csv`
- Plan circuital por ciclo (circuito → dirección): `data/raw/electoral/{eleccion}/plan-circuital.csv`
- Geometría de barrios: `public/v_sig_barrios.json`
