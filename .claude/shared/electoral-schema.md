# Electoral Data Schema

## Overview

This document defines the data schema for electoral CSV files used in the Uruguay Electoral Map application.

## CSV File Structure

### File Types

| Type | Filename Pattern | Description |
|------|------------------|-------------|
| ODN | `{department}_odn.csv` | Orden Departamental Nacional data |
| ODD | `{department}_odd.csv` | Orden Departamental Departamental data |

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
- **Constraints**: Must match a zone in the corresponding GeoJSON
- **Description**: Geographic zone/neighborhood name
- **Example Values**:
  - `"Centro"`
  - `"Pocitos"`
  - `"Ciudad Vieja"`

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
5. **Zone Existence**: All `ZONA` values must exist in GeoJSON

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

## GeoJSON Cross-Reference

### Zone Property Names
GeoJSON features may use different property names for zones:

| Priority | Property | Example |
|----------|----------|---------|
| 1 | `BARRIO` | `{ "BARRIO": "Centro" }` |
| 2 | `texto` | `{ "texto": "Centro" }` |
| 3 | `zona` | `{ "zona": "Centro" }` |

### Zone Normalization
```javascript
function getZoneName(feature) {
  const props = feature.properties;
  return props.BARRIO || props.texto || props.zona || '';
}
```

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
