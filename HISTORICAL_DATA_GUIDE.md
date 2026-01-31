# Historical Electoral Data Guide

Complete guide to working with historical electoral data in Uruguay Electoral Map.

---

## Table of Contents

1. [Available Elections](#available-elections)
2. [Data Characteristics](#data-characteristics)
3. [Using the Frontend](#using-the-frontend)
4. [Comparison Features](#comparison-features)
5. [ETL Pipeline](#etl-pipeline)
6. [Data Structure](#data-structure)
7. [Troubleshooting](#troubleshooting)

---

## Available Elections

### Implemented Elections

| Election | Date | Type | Departments | Status |
|----------|------|------|-------------|---------|
| **Internas 2024** | June 30, 2024 | Internas | 19 | ✅ Full |
| **Nacionales 2019** | Oct 27, 2019 | Nacionales | 19 | ✅ Full |

### Catalog (Available for Implementation)

| Election | Date | Type | Notes |
|----------|------|------|-------|
| Nacionales 2014 | Oct 26, 2014 | Nacionales | Ready for ETL |
| Internas 2019 | June 30, 2019 | Internas | Ready for ETL |
| Departamentales 2020 | Sep 27, 2020 | Departamentales | Requires special handling |
| Balotaje 2024 | Nov 24, 2024 | Balotaje | Ready for ETL |

---

## Data Characteristics

### Internas (Party Primaries)

**When**: June (every 5 years)
**What**: Presidential candidates from each party
**Data Includes**:
- ✅ Candidate names (precandidatos)
- ✅ Party affiliations
- ✅ Vote distribution by zone (barrio/circuito)
- ✅ Separate ODN (president) and ODD (department) files

**CSV Format**:
```csv
PARTIDO,DEPTO,CIRCUITO,SERIES,ESCRUTINIO,PRECANDIDATO,HOJA,CNT_VOTOS,ZONA
FRENTE AMPLIO,MO,,AAA,COSSE GARRIDO,,Ana Carolina,90,1
```

**Use Cases**:
- Compare pre-candidates within same party
- Analyze candidate popularity by neighborhood
- Track primary voter turnout trends

---

### Nacionales (National Elections)

**When**: October (every 5 years)
**What**: President, Vice President, Senators, Deputies
**Data Includes**:
- ✅ Party vote totals
- ✅ List numbers (hojas de votación)
- ❌ No candidate names (only party)
- ❌ No zone-level detail (uses CRV/Series as proxy)

**CSV Format**:
```csv
TipoRegistro,Departamento,CRV,Series,Lema,Descripcion1,CantidadVotos
HOJA_EN,MO,1,AAA,Partido Frente Amplio,9,4
```

**Use Cases**:
- Compare party performance across years
- Analyze electoral shifts (e.g., 2019 vs 2024)
- Study voting patterns by electoral circuit

---

### Schema Comparison Table

| Feature | Internas | Nacionales | Departamentales | Balotaje |
|---------|----------|------------|-----------------|----------|
| **Candidate Names** | ✅ Yes | ❌ No | ❌ No | ✅ Yes |
| **Zone Detail** | ✅ Barrio | ❌ CRV/Series | ✅ Municipality | ❌ CRV |
| **File Structure** | ODN + ODD | Single CSV | Dept + Municipal | Single CSV |
| **Parties** | Multiple | Multiple | Multiple | 2 only |
| **Complexity** | High | Medium | Very High | Low |

---

## Using the Frontend

### Viewing a Single Election

1. **Open the app** at http://localhost:5179
2. **Select Election**:
   - Scroll to "Elecciones Disponibles" section
   - Click on an election card (e.g., "Nacionales 2019")
3. **Select Department**: Choose from department dropdown
4. **View Results**: Map updates with selected election data

### Switching Between Elections

Elections persist per department. When you switch elections:
- Map data reloads automatically
- Available lists update based on election type
- Statistics panel refreshes with new data

**Keyboard Shortcuts**:
- None currently (future enhancement)

---

## Comparison Features

### Activating Comparison Mode

1. Click **"Comparar"** button in header (icon: ⎇)
2. Button turns blue when active
3. Sidebar and stats panel hide
4. Comparison view appears

### Using the Comparison View

#### **Election Selection**

```
[Elección Base ▼]  vs  [Elección a Comparar ▼]
  Nacionales 2019        Internas 2024
```

- **Left**: Base election (reference point)
- **Right**: Comparison election
- Auto-loads first two available elections

#### **Statistics Displayed**

1. **Total Votes Card**
   ```
   Votos Totales                           ↑

   Nacionales 2019          →    Internas 2024
   893,359 votos                 750,234 votos

   -143,125 (-16.0%)
   ```

2. **Party Changes (Top 5)**
   ```
   Partido Frente Amplio
   450,000  ↑  480,000
   +30,000 (+6.7%)
   ```

### Comparison Examples

#### Example 1: Party Growth Analysis

**Scenario**: Compare Frente Amplio performance 2019 → 2024

**Steps**:
1. Activate comparison mode
2. Select: Nacionales 2019 vs Internas 2024
3. Choose: Montevideo department
4. Observe: Vote changes in stats panel

**Expected Insights**:
- Absolute vote change
- Percentage change
- Trend direction (↑↓)

#### Example 2: Electoral Shift Detection

**Scenario**: Identify which party gained/lost most votes

**Steps**:
1. Compare elections from same year (Internas → Nacionales)
2. Look at "Cambios por Partido" section
3. Sort by largest absolute change

**Insights**:
- Which parties mobilized voters between primaries and general election
- Turnout differences
- Coalition effects

---

## ETL Pipeline

### Downloading a New Election

```bash
# Download Nacionales 2014
node etl/index.js extract --election nacionales-2014

# Process the data
node etl/index.js transform --election nacionales-2014

# Load to public directory
node etl/index.js load --election nacionales-2014

# Or all at once
node etl/index.js run --election nacionales-2014
```

### Directory Structure

```
data/
├── raw/electoral/
│   ├── internas-2024/
│   │   ├── desglose-de-votos.csv
│   │   └── integracion-hojas.csv
│   └── nacionales-2019/
│       ├── desglose-de-votos.csv (master)
│       ├── montevideo_odd.csv (split)
│       └── ...
├── processed/electoral/
│   ├── internas-2024/
│   │   ├── montevideo/
│   │   │   ├── odn.json
│   │   │   ├── odd.json
│   │   │   └── metadata.json
│   │   └── ...
│   └── nacionales-2019/
│       └── ...
└── ...

public/
└── data/
    ├── elections-meta.json          # Available elections
    ├── electoral/
    │   ├── internas-2024/...
    │   └── nacionales-2019/...
    └── geographic/
        └── montevideo_map.json
```

### Schema Detection

The ETL automatically detects CSV format:

```typescript
// Internas schema
if (headers.includes('PARTIDO') && headers.includes('ZONA'))
  → Use internas parser

// Nacionales schema
if (headers.includes('TipoRegistro') && headers.includes('Lema'))
  → Use nacionales parser
```

### Data Normalization

All elections are normalized to:

```json
{
  "metadata": {
    "type": "odd",
    "schemaType": "nacionales",
    "department": "montevideo",
    "election": "nacionales-2019",
    "stats": { "totalVotes": 893359, ... }
  },
  "data": {
    "votosPorListas": { "90": { "1": 150, "2": 200 } },
    "maxVotosPorListas": { "90": 500 },
    "partiesByList": { "90": "Partido Frente Amplio" },
    "zoneList": ["1", "2", "3"],
    "partyList": ["Frente Amplio", "Partido Nacional"]
  }
}
```

---

## Data Structure

### regions.json (Enhanced)

```json
{
  "name": "Montevideo",
  "slug": "montevideo",
  "availableElections": ["internas-2024", "nacionales-2019"],
  "defaultElection": "internas-2024",
  "odnJsonPath": "/data/electoral/internas-2024/montevideo/odn.json",
  "oddJsonPath": "/data/electoral/internas-2024/montevideo/odd.json",
  "mapCenter": [-34.8211, -56.225],
  "mapZoom": 11.5
}
```

### elections-meta.json

```json
{
  "availableElections": ["nacionales-2019", "internas-2024"],
  "departmentsByElection": {
    "nacionales-2019": ["montevideo", "canelones", ...],
    "internas-2024": ["montevideo", "canelones", ...]
  },
  "generatedAt": "2026-01-31T02:19:37.829Z"
}
```

### elections-catalog.json

Full metadata for all elections (2014-2025):

```json
{
  "elections": [
    {
      "id": "nacionales-2019",
      "year": 2019,
      "type": "nacionales",
      "name": "Elecciones Nacionales 2019",
      "date": "2019-10-27",
      "datasetUrl": "https://catalogodatos.gub.uy/...",
      "resources": {
        "desgloseVotos": { "url": "..." }
      },
      "available": true
    }
  ]
}
```

---

## Troubleshooting

### Issue: "Election not available for this department"

**Cause**: Department doesn't have data for selected election

**Solution**:
1. Check `regions.json` → `availableElections` array
2. Run ETL for that election if data exists
3. Verify department code in source CSV

### Issue: "No data loads in comparison view"

**Cause**: JSON file missing or incorrect path

**Solution**:
1. Check `/data/electoral/{election}/{dept}/odd.json` exists
2. Verify department slug matches folder name
3. Run `node etl/index.js load --election {id}`

### Issue: "Wrong vote counts displayed"

**Cause**: Schema mismatch or CSV parsing error

**Solution**:
1. Check `metadata.schemaType` in JSON file
2. Verify ETL transform detected correct schema
3. Inspect raw CSV for encoding issues (BOM)

### Issue: "Comparison shows 0% change"

**Cause**: Comparing same election twice

**Solution**:
- Select different elections in dropdowns
- Ensure both elections have data

### Issue: "Map doesn't update when switching elections"

**Cause**: Store not reloading data

**Solution**:
1. Check browser console for errors
2. Verify `store.switchElection()` is called
3. Ensure `fetchRegionData()` handles election parameter

---

## Performance Notes

### JSON vs CSV Loading

- **JSON** (processed): ~100-500KB per department
- **CSV** (raw): ~5-20MB for all departments

**Recommendation**: Always use processed JSON for production

### Comparison Data Loading

- Loads two elections in parallel
- ~200-1000KB total per comparison
- Client-side calculation (no server needed)

### Browser Caching

Elections data is cached by browser:
- Elections metadata: Cache indefinitely
- Department data: Cache with versioning
- Clear cache: Hard refresh (Ctrl+Shift+R)

---

## Future Enhancements

- [ ] Side-by-side map comparison
- [ ] Time-series charts (multi-year trends)
- [ ] Export comparison data to Excel
- [ ] Share comparison URL
- [ ] Keyboard shortcuts (C for compare, ESC to exit)
- [ ] Animated transitions between elections
- [ ] Historical turnout analysis

---

## References

- **ETL Documentation**: See `ELECTIONS_STRUCTURE.md`
- **Frontend Design**: See `FRONTEND_MODERNIZATION.md`
- **Data Sources**: https://catalogodatos.gub.uy/organization/corte-electoral
- **Corte Electoral**: https://www.gub.uy/corte-electoral

---

**Last Updated**: 2026-01-31
**Version**: 1.0.0
**Maintainer**: Uruguay Electoral Map Team
