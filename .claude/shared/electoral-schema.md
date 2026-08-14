# Electoral Data Schema

## Overview

Esquema de los CSV electorales **crudos** que publica la Corte Electoral y que entran al ETL.
Describe el **origen**, no el formato publicado: los shards que consume el frontend viven en
`public/data/` y su contrato está en [`public/data/README.md`](../../public/data/README.md),
que es la fuente de verdad ante cualquier discrepancia con este archivo.

## CSV File Structure

### Ubicación

Los CSV crudos van en `data/raw/electoral/`. Los `*_odn.csv` / `*_odd.csv` sueltos en `public/`
son restos de la v1 y no son entrada del pipeline.

El modelo es **agnóstico al tipo de elección**: la unidad base es *opción electoral × unidad
geográfica* (hoja en internas y legislativas; candidato/lema en balotaje y presidencial). La
antigua dicotomía ODN/ODD es un caso particular, no la estructura general.

### Column Definitions

#### PARTIDO (Political Party)
- **Type**: String
- **Required**: Yes
- **Constraints**: Non-empty
- **Example Values**:
  - `"Frente Amplio"`
  - `"Nacional"`
  - `"Colorado"`
  - `"Independiente"`
  - `"Cabildo Abierto"`

#### DEPTO (Department)
- **Type**: String
- **Required**: Yes
- **Constraints**: Must be a valid Uruguay department name
- **Example Values**:
  - `"MONTEVIDEO"`
  - `"CANELONES"`
  - `"MALDONADO"`

#### CIRCUITO (Electoral Circuit)
- **Type**: String
- **Required**: Yes
- **Description**: Electoral circuit identifier within the department
- **Example Values**:
  - `"ABC"`
  - `"XYZ"`

#### SERIES (Series Number)
- **Type**: String
- **Required**: Yes
- **Description**: Series number within the circuit
- **Example Values**:
  - `"1"`
  - `"25"`
  - `"100"`

#### ESCRUTINIO (Scrutiny Type)
- **Type**: String
- **Required**: Yes
- **Description**: Type of vote counting
- **Example Values**:
  - `"PRIMARIO"`
  - `"SECUNDARIO"`

#### PRECANDIDATO (Pre-candidate)
- **Type**: String
- **Required**: Yes (can be empty for ODD)
- **Description**: Name of the pre-candidate (for primaries)
- **Example Values**:
  - `"YAMANDU ORSI"`
  - `"ALVARO DELGADO"`
  - `"CAROLINA COSSE"`

#### HOJA (Ballot Sheet)
- **Type**: String (numeric)
- **Required**: Yes
- **Constraints**: Must be parseable to positive integer
- **Description**: Ballot list number (unique identifier for the list)
- **Example Values**:
  - `"77"`
  - `"404"`
  - `"1001"`

#### CNT_VOTOS (Vote Count)
- **Type**: String (numeric)
- **Required**: Yes
- **Constraints**: Must be parseable to non-negative integer
- **Description**: Number of votes received
- **Example Values**:
  - `"0"`
  - `"150"`
  - `"5000"`

#### ZONA (Zone)
- **Type**: String
- **Required**: Yes
- **Constraints**: no vacío. **NO se valida contra el GeoJSON.**
- **Description**: zona declarada en el origen. **No es la clave geográfica del proyecto.**
- **Example Values**:
  - `"Centro"`
  - `"Pocitos"`
  - `"Ciudad Vieja"`

> El join geográfico real **no pasa por `ZONA`**: Montevideo une CIRCUITO (CRV) → barrio por
> geolocalización y **por ciclo electoral**; el interior usa un mapeo curado serie → localidad.
> Unir por `ZONA` directa (o por join espacial de series) es el error que produjo el bug
> "Carrasco FA 66,5% en 2014". Ver `docs/adr/0001-circuito-barrio-por-ciclo.md` y los
> invariantes en `public/data/README.md`.

## Sample CSV

```csv
PARTIDO,DEPTO,CIRCUITO,SERIES,ESCRUTINIO,PRECANDIDATO,HOJA,CNT_VOTOS,ZONA
Frente Amplio,MONTEVIDEO,ABC,1,PRIMARIO,YAMANDU ORSI,77,1250,Centro
Frente Amplio,MONTEVIDEO,ABC,1,PRIMARIO,YAMANDU ORSI,77,890,Pocitos
Nacional,MONTEVIDEO,ABC,1,PRIMARIO,ALVARO DELGADO,404,750,Centro
Nacional,MONTEVIDEO,ABC,1,PRIMARIO,ALVARO DELGADO,404,620,Pocitos
```

## Data Relationships

### Entity Relationships

```
┌─────────────────────────────────────────────────────────────────┐
│                      DATA RELATIONSHIPS                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  PARTIDO (1) ─────┬───── (N) PRECANDIDATO                       │
│                   │                                              │
│                   └───── (N) HOJA                                │
│                                                                  │
│  DEPTO (1) ───────┬───── (N) CIRCUITO                           │
│                   │                                              │
│                   └───── (N) ZONA                                │
│                                                                  │
│  HOJA (1) ────────────── (N) ZONA                               │
│            (via votes)                                           │
│                                                                  │
│  PRECANDIDATO (1) ────── (N) HOJA                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Key Relationships

1. **Party → Pre-candidates**: Each party has one or more pre-candidates
2. **Pre-candidate → Lists**: Each pre-candidate has one or more ballot lists
3. **List → Zones**: Each list has votes distributed across zones
4. **Department → Zones**: Each department contains multiple zones

## Validation Rules

### Schema Validation
```javascript
const schema = {
  columns: {
    PARTIDO: { type: 'string', required: true, minLength: 1 },
    DEPTO: { type: 'string', required: true, minLength: 1 },
    CIRCUITO: { type: 'string', required: true },
    SERIES: { type: 'string', required: true },
    ESCRUTINIO: { type: 'string', required: true },
    PRECANDIDATO: { type: 'string', required: false },
    HOJA: { type: 'string', required: true, pattern: /^\d+$/ },
    CNT_VOTOS: { type: 'string', required: true, pattern: /^\d+$/ },
    ZONA: { type: 'string', required: true, minLength: 1 }
  }
};
```

### Business Rules

1. **Unique Vote Records**: No duplicate `HOJA + ZONA` combinations
2. **Non-negative Votes**: `CNT_VOTOS >= 0`
3. **Party Consistency**: Same `HOJA` always belongs to same `PARTIDO`
4. **Candidate Consistency**: Same `HOJA` always belongs to same `PRECANDIDATO`
5. **Etapa única de escrutinio**: una sola `ESCRUTINIO` por contienda (la definitiva). Nunca
   sumar a través de etapas.
6. **Blancos / anulados / observados**: sin partido ni hoja, categorías aparte; se reconcilian
   contra votos válidos.

## Data Processing

### Aggregation by List
```javascript
// Group votes by list number
const votosPorListas = {};
data.forEach(row => {
  if (!votosPorListas[row.HOJA]) {
    votosPorListas[row.HOJA] = {};
  }
  votosPorListas[row.HOJA][row.ZONA] =
    (votosPorListas[row.HOJA][row.ZONA] || 0) + parseInt(row.CNT_VOTOS, 10);
});
```

### Aggregation by Zone
```javascript
// Get total votes for a zone across selected lists
function getVotesForZone(zone, selectedLists, votosPorListas) {
  return selectedLists.reduce((total, listNumber) => {
    return total + (votosPorListas[listNumber]?.[zone] || 0);
  }, 0);
}
```

### Party-List Mapping
```javascript
// Create mapping of list numbers to parties
const partiesByList = {};
data.forEach(row => {
  if (!partiesByList[row.HOJA]) {
    partiesByList[row.HOJA] = row.PARTIDO;
  }
});
```

## Cruce con la geometría

**No se cruza contra `ZONA`.** La unidad geográfica sale del mapeo correspondiente, no de una
columna del CSV:

| Ámbito | Mapeo | Generado por |
|--------|-------|--------------|
| Montevideo | CIRCUITO (CRV) → barrio, **uno por ciclo electoral** | `scripts/build-circuito-barrio-cycles.py` → `data/mappings/montevideo-circuito-barrio.{ciclo}.json` |
| Interior | serie → barrio/localidad, curado | `npm run etl:serie-localidad` → `data/mappings/{depto}-series-locality.json` |

Los CRV se reasignan entre elecciones: un único mapeo aplicado a todos los ciclos produce joins
falsos. Ver `docs/adr/0001-circuito-barrio-por-ciclo.md`.

El gate `npm run gate:grises` detecta unidades que quedaron sin geometría asociada.

## Data Quality Metrics

### Expected Ranges

| Metric | Montevideo | Other Departments |
|--------|------------|-------------------|
| Lists (ODN) | 200-300 | 50-150 |
| Lists (ODD) | 150-250 | 40-120 |
| Zones | 50-70 | 10-50 |
| Total Votes | 800K-1.5M | 50K-300K |

### Anomaly Detection Thresholds
- **High votes**: > Mean + 3σ
- **Zero votes**: List with all zeros (warning)
- **Missing zones**: Zone in GeoJSON but not in CSV (warning)
