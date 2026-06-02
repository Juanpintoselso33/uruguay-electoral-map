# etl/geometry

Construcción y optimización de la geometría (GeoJSON → TopoJSON) y el join geográfico de los votos.

| Archivo | Función |
|---------|---------|
| `build-topojson.ts` | GeoJSON → TopoJSON simplificado. Dedup de bordes compartidos + *simplify* (Visvalingam) reducen el payload. Canonicaliza la propiedad de nombre a `properties.name` (el cliente siempre lee esa clave) y descarta el resto. |
| `build-circuito-barrio.ts` | Construye el mapping **CIRCUITO → BARRIO** por geolocalización oficial: circuito → dirección de calle → coords del georef de la Corte → point-in-polygon contra los 62 barrios de `v_sig_barrios.json`. Fallback: circuito → serie → barrio dominante. |
| `dissolve-empty.ts` | Fusión dinámica de barrios sin datos: si un barrio no recibió votos (sus votantes votaron en barrios vecinos), su polígono se disuelve en el barrio con votos con el que comparte mayor borde. Evita huecos grises sin inventar votos. |

## Advertencia clave (no replicar el bug de Carrasco)

El número de circuito (CRV) **se reutiliza entre elecciones para ubicaciones distintas**. Aplicar un único mapeo CRV→barrio a todas las elecciones produce joins incorrectos (ej.: "FA 66,5% en Carrasco 2014" es voto de Malvín Norte / Punta Gorda mal etiquetado). Ver [`docs/AUDIT-carrasco-2014-circuito-barrio.md`](../../docs/AUDIT-carrasco-2014-circuito-barrio.md). El mapeo debe construirse **por elección**, no compartirse.

## Fuentes

- Georef Corte (lat/lon por circuito): `data/raw/geographic/…`
- Plan circuital (circuito → dirección): `data/raw/electoral/plan-circuital.csv`
- Geometría de barrios: `public/v_sig_barrios.json`
