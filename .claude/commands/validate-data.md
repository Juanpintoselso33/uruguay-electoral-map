# /validate-data Command

Validate electoral data files for a department without modifying the system.

## Usage
```
/validate-data <department_name>
/validate-data --all
```

## Arguments
- `department_name` - Name of department to validate
- `--all` - Validate all configured departments

## Examples
```
/validate-data montevideo
/validate-data treinta_y_tres
/validate-data --all
```

## Validation Checks

### CSV Validation

#### Schema Validation
- All required columns present:
  - PARTIDO, DEPTO, CIRCUITO, SERIES, ESCRUTINIO
  - PRECANDIDATO, HOJA, CNT_VOTOS, ZONA
- UTF-8 encoding
- Comma delimiter

#### Data Quality
- CNT_VOTOS contains valid integers (≥0)
- HOJA contains valid list numbers
- No duplicate HOJA + ZONA combinations
- All referenced zones exist in GeoJSON

#### Consistency
- Party-candidate relationships consistent
- Vote totals reasonable (no extreme outliers)

### GeoJSON Validation

#### Structure
- Valid GeoJSON format
- FeatureCollection type
- Non-empty features array

#### Properties
- Each feature has zone identifier (BARRIO, texto, or zona)
- No null geometries
- Valid polygon/multipolygon types

#### Geography
- Coordinates within Uruguay bounds
- No self-intersecting polygons
- File size ≤3MB

### Cross-Validation
- All CSV zones match GeoJSON properties
- All GeoJSON zones have corresponding CSV data

## Output

### Per-Department Report
```
Validation Report: montevideo
═══════════════════════════════

ODN CSV: public/montevideo_odn.csv
├── Status: ✓ Valid
├── Rows: 15,234
├── Lists: 245
├── Zones: 62
└── Total Votes: 1,250,000

ODD CSV: public/montevideo_odd.csv
├── Status: ✓ Valid
├── Rows: 14,892
├── Lists: 238
├── Zones: 62
└── Total Votes: 1,180,000

GeoJSON: public/montevideo_map.json
├── Status: ✓ Valid
├── Size: 2.1 MB
├── Features: 62
└── Center: [-34.82, -56.23]

Cross-Validation:
├── Zone Match: 62/62 (100%)
└── Status: ✓ All zones matched

Overall: ✓ VALID
```

### Validation with Issues
```
Validation Report: canelones
═══════════════════════════════

ODN CSV: public/canelones_odn.csv
├── Status: ⚠ Warnings
├── Rows: 8,456
├── Issues:
│   ├── Row 234: CNT_VOTOS is negative (-15)
│   └── Row 1,892: Duplicate HOJA+ZONA (Lista 501, Ciudad de la Costa)

GeoJSON: public/canelones_map.json
├── Status: ✗ Error
├── Size: 18.5 MB (exceeds 3MB limit)
└── Action: Run '/optimize-geojson canelones'

Overall: ✗ NEEDS ATTENTION
```

### All Departments Summary
```
System Validation Summary
═════════════════════════

Department      ODN    ODD    GeoJSON  Cross   Status
─────────────────────────────────────────────────────
montevideo      ✓      ✓      ✓        ✓       ✓ OK
maldonado       ✓      ✓      ✓        ✓       ✓ OK
colonia         ✓      ✓      ✓        ✓       ✓ OK
treinta_y_tres  ✓      ✓      ⚠        ✓       ⚠ Warning

Total: 4 departments
Valid: 3
Warnings: 1
Errors: 0
```

## Error Codes

| Code | Description | Severity |
|------|-------------|----------|
| E001 | Missing required column | Error |
| E002 | Invalid file encoding | Error |
| E003 | GeoJSON parse error | Error |
| E004 | File not found | Error |
| W001 | Negative vote count | Warning |
| W002 | Duplicate row | Warning |
| W003 | Zone name mismatch | Warning |
| W004 | File size exceeds limit | Warning |

## Related Commands
- `/add-department` - Add a new department
- `/optimize-geojson` - Reduce GeoJSON file size
