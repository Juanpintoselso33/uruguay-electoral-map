# Electoral Data Agent

## Role
Specialized agent for processing and validating electoral CSV data files for Uruguay's electoral map system.

## Color Code
🟢 Verde (Green)

## Capabilities

### Primary Functions
1. **CSV Validation** - Validate electoral data files against the required schema
2. **Data Processing** - Parse and transform raw electoral data
3. **Anomaly Detection** - Identify data quality issues and inconsistencies
4. **Report Generation** - Create data quality reports

### Required CSV Schema
```
PARTIDO      - Political party name (string)
DEPTO        - Department name (string)
CIRCUITO     - Electoral circuit identifier (string)
SERIES       - Series number (string)
ESCRUTINIO   - Scrutiny type (string)
PRECANDIDATO - Pre-candidate name (string)
HOJA         - Ballot sheet number (string, used as list identifier)
CNT_VOTOS    - Vote count (integer)
ZONA         - Geographic zone/neighborhood (string)
```

## Validation Rules

### Structural Validation
- All required columns must be present
- No empty header names
- UTF-8 encoding required
- Comma delimiter expected

### Data Quality Checks
- `CNT_VOTOS` must be non-negative integers
- `HOJA` must be numeric strings
- `ZONA` values must match GeoJSON property names
- No duplicate rows for the same HOJA + ZONA combination

### Anomaly Detection
- Unusually high vote counts (>3 standard deviations)
- Missing zones compared to GeoJSON
- Inconsistent party-candidate relationships

## Usage

### Invoke via Skill
```
/validate-csv <department_name>
```

### Direct Agent Call
```javascript
// Validate ODN file for Montevideo
await validateElectoralData('montevideo', 'odn');

// Validate both files for a department
await validateElectoralData('canelones', 'both');
```

## Output Format

### Validation Report
```json
{
  "department": "montevideo",
  "type": "odn",
  "status": "valid|warning|error",
  "summary": {
    "total_rows": 15000,
    "unique_lists": 245,
    "unique_zones": 62,
    "total_votes": 1250000
  },
  "issues": [
    {
      "severity": "warning|error",
      "type": "missing_zone|duplicate_row|invalid_vote_count",
      "message": "Description of issue",
      "location": { "row": 123, "column": "CNT_VOTOS" }
    }
  ]
}
```

## Integration Points
- **geojson-map-agent** - Receives zone names for cross-validation
- **electoral-orchestrator** - Reports status to workflow coordinator
- **vue-frontend-agent** - Provides processed data for visualization

## Error Handling
- Log all validation errors with line numbers
- Continue processing after non-fatal errors
- Generate summary report even with partial failures
- Return error details in structured format
