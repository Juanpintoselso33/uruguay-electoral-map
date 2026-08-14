---
name: add-department
description: |
  Da de alta un departamento o una instancia electoral nueva en el mapa: CSV crudo → mapeo
  geográfico → runner de ETL → geometría → cobertura declarada → gates. Usar cuando haya que
  incorporar datos electorales que el mapa todavía no cubre.
---

# Add Department

Alta de un departamento —o de una elección nueva de un departamento existente— en el Mapa
Electoral de Uruguay.

## Leer primero

1. `public/data/README.md` — contrato de datos e invariantes de dominio (mandatorio).
2. `etl/README.md` — cómo está armado el pipeline.
3. `src/config/departments.json` — **fuente de verdad de cobertura**: qué departamentos,
   niveles y elecciones ya existen.

`public/regions.json` y `elections-meta.json` son de la v1 y ya no existen en el repo. No
leerlos ni escribirlos.

## Fases

### 1. Datos crudos
Los CSV de la Corte van en `data/raw/electoral/`. Validar esquema y calidad — ver la skill
`validate-csv`. Encoding UTF-8 (el origen suele venir Latin-1). Una sola etapa de
`ESCRUTINIO`. Blancos/anulados/observados aparte.

### 2. Mapeo geográfico
Es la parte cara y donde están los bugs históricos.

- **Montevideo:** CIRCUITO (CRV) → barrio por geolocalización (dirección → coordenadas →
  point-in-polygon contra los 62 barrios). **Un mapeo por ciclo electoral**: los números de
  CRV se reasignan entre elecciones, y un mapeo único aplicado a todas produce joins falsos
  (el bug "Carrasco FA 66,5% en 2014").
  ```bash
  python3 scripts/build-circuito-barrio-cycles.py
  # → data/mappings/montevideo-circuito-barrio.{ciclo}.json
  # cache de geocoding: montevideo-geocode-cache.json
  ```
  Ver `docs/adr/0001-circuito-barrio-por-ciclo.md`.
- **Interior:** serie → barrio/localidad, mapeo curado
  (`npm run etl:serie-localidad`).
- **Nunca** unir por la columna `ZONA` directa ni por join espacial de series.

### 3. ETL
```bash
npm run etl:<runner>
```
El catálogo real de runners son los scripts `etl:*` de `package.json` (fuente de verdad).
Si la instancia no tiene runner, crear `etl/run-<algo>.ts` copiando el de una instancia del
mismo tipo y registrarlo en `package.json`.

La granularidad **por hoja** no se downscopea a nivel-lema, aunque el join sea laborioso.

### 4. Geometría
TopoJSON/GeoJSON ≤ 3 MB por archivo. Si falta o excede, ver la skill `optimize-geojson`.

### 5. Declarar cobertura
Agregar la entrada en `src/config/departments.json`:

```jsonc
{
  "id": "canelones",
  "label": "Canelones",
  "levels": ["serie", "localidad", "circuito", "local"],
  "elecciones": ["nacionales-2024", "balotaje-2024", "..."]
}
```

### 6. Gates
```bash
npm run gate:data
npm run gate:escaleras
npm run gate:grises
```
Si alguno falla, parar ahí. No seguir aguas abajo de un gate en rojo.

## Salida

Reportar qué se ingirió (filas, contiendas, unidades geográficas), qué gates corrieron y con
qué resultado, y qué quedó pendiente. Si algo falló, en qué fase y por qué.

## Notas
- No commitear sin que el usuario lo pida; si commiteás, `git add` con rutas explícitas.
- `legacy/`, `spikes/`, `_bmad/` y `docs/bmad-output/` están gitignoreados: no referenciarlos.

## Relacionadas
- `validate-csv` · `optimize-geojson` · `git-commit`
