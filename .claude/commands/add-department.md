---
description: Da de alta un departamento (o una elección de un departamento) en el mapa electoral, de datos crudos hasta gates.
argument-hint: <departamento> [eleccion]
---

# /add-department

Da de alta un departamento —o una instancia electoral nueva de un departamento ya existente—
en el Mapa Electoral de Uruguay.

## Uso
```
/add-department <departamento> [eleccion]
```

- `departamento` — id en minúsculas con guiones bajos: `canelones`, `san_jose`, `treinta_y_tres`.
- `eleccion` — id de la instancia: `nacionales-2024`, `balotaje-2019`, `departamentales-2025`…

## Antes de empezar

Leer, en este orden:

1. `public/data/README.md` — contrato de datos e invariantes de dominio.
2. `etl/README.md` — cómo está armado el pipeline.
3. `src/config/departments.json` — qué cobertura ya existe (es la fuente de verdad).

Los CSV crudos de la Corte van en `data/raw/electoral/`. Los `*_odn.csv` / `*_odd.csv` sueltos
en `public/` son restos de la v1 y **no** son la entrada del pipeline.

## Proceso

### 1. Validar el CSV crudo
Esquema `PARTIDO, DEPTO, CIRCUITO, SERIES, ESCRUTINIO, PRECANDIDATO, HOJA, CNT_VOTOS, ZONA`.
Encoding UTF-8 (normalizar si viene Latin-1). Una sola etapa de `ESCRUTINIO`, la definitiva.
Blancos/anulados/observados son categorías aparte.

### 2. Resolver el join geográfico
- **Montevideo:** CIRCUITO (CRV) → barrio por geolocalización, **un mapeo por ciclo electoral**.
  `scripts/build-circuito-barrio-cycles.py` genera
  `data/mappings/montevideo-circuito-barrio.{ciclo}.json`. Ver
  `docs/adr/0001-circuito-barrio-por-ciclo.md`.
- **Interior:** serie → barrio/localidad, mapeo curado.
- Nunca unir por la columna `ZONA` directa ni por join espacial de series.

### 3. Correr el ETL
```bash
npm run etl:<runner>      # ver los scripts etl:* de package.json
```
Si la instancia no tiene runner, crear `etl/run-<algo>.ts` siguiendo uno existente del mismo
tipo y registrarlo en `package.json`.

### 4. Geometría
TopoJSON/GeoJSON ≤ 3 MB por archivo. Si excede, simplificar (ver la skill `optimize-geojson`).

### 5. Declarar la cobertura
Agregar el departamento y/o la elección en `src/config/departments.json` (`id`, `label`,
`levels`, `elecciones`).

### 6. Gates
```bash
npm run gate:data
npm run gate:escaleras
npm run gate:grises
```

## Salida

Reportar: qué se ingirió (filas, contiendas, unidades geográficas), qué gates corrieron y su
resultado, y qué quedó sin resolver. Si algo falló, decir en qué paso y por qué; no seguir
aguas abajo de un gate en rojo.

## Notas
- No commitear sin que el usuario lo pida. Si commiteás, `git add` con rutas explícitas.
- La granularidad por hoja no se downscopea a nivel-lema, aunque el join sea laborioso.
