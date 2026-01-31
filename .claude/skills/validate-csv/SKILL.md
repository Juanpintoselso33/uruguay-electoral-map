# Validate CSV Skill

## Description
Validates electoral CSV data files against the required schema and checks data quality.

## Trigger
```
/validate-csv <department_name> [--type odn|odd|both]
```

## Input Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| department_name | string | Yes | - | Department to validate |
| --type | string | No | both | Type of CSV to validate |

## Required CSV Schema

### Columns
```
PARTIDO       - Political party name (string, non-empty)
DEPTO         - Department name (string, non-empty)
CIRCUITO      - Electoral circuit (string)
SERIES        - Series number (string)
ESCRUTINIO    - Scrutiny type (string)
PRECANDIDATO  - Pre-candidate name (string)
HOJA          - Ballot sheet/list number (string, numeric)
CNT_VOTOS     - Vote count (string, parseable to non-negative integer)
ZONA          - Zone/neighborhood name (string, non-empty)
```

### Encoding Requirements
- UTF-8 encoding
- Comma (,) as delimiter
- Optional: Double quotes for fields containing commas

## Validation Logic

### Step 1: File Access
```javascript
function validateFileAccess(path) {
  if (!fileExists(path)) {
    return { valid: false, error: 'E004: File not found' };
  }

  const encoding = detectEncoding(path);
  if (encoding !== 'UTF-8') {
    return { valid: false, error: `E002: Invalid encoding (${encoding})` };
  }

  return { valid: true };
}
```

### Step 2: Schema Validation
```javascript
const REQUIRED_COLUMNS = [
  'PARTIDO', 'DEPTO', 'CIRCUITO', 'SERIES',
  'ESCRUTINIO', 'PRECANDIDATO', 'HOJA', 'CNT_VOTOS', 'ZONA'
];

function validateSchema(headers) {
  const missing = REQUIRED_COLUMNS.filter(col => !headers.includes(col));

  if (missing.length > 0) {
    return {
      valid: false,
      error: `E001: Missing columns: ${missing.join(', ')}`
    };
  }

  return { valid: true };
}
```

### Step 3: Row Validation
```javascript
function validateRow(row, rowIndex) {
  const issues = [];

  // Validate CNT_VOTOS
  const votes = parseInt(row.CNT_VOTOS, 10);
  if (isNaN(votes)) {
    issues.push({
      severity: 'error',
      code: 'E005',
      message: `Invalid vote count: "${row.CNT_VOTOS}"`,
      row: rowIndex
    });
  } else if (votes < 0) {
    issues.push({
      severity: 'warning',
      code: 'W001',
      message: `Negative vote count: ${votes}`,
      row: rowIndex
    });
  }

  // Validate HOJA
  if (!/^\d+$/.test(row.HOJA)) {
    issues.push({
      severity: 'warning',
      code: 'W005',
      message: `Non-numeric list number: "${row.HOJA}"`,
      row: rowIndex
    });
  }

  // Validate required non-empty fields
  ['PARTIDO', 'ZONA'].forEach(field => {
    if (!row[field] || row[field].trim() === '') {
      issues.push({
        severity: 'error',
        code: 'E006',
        message: `Empty required field: ${field}`,
        row: rowIndex
      });
    }
  });

  return issues;
}
```

### Step 4: Duplicate Detection
```javascript
function detectDuplicates(data) {
  const seen = new Map();
  const duplicates = [];

  data.forEach((row, index) => {
    const key = `${row.HOJA}|${row.ZONA}`;
    if (seen.has(key)) {
      duplicates.push({
        severity: 'warning',
        code: 'W002',
        message: `Duplicate HOJA+ZONA: Lista ${row.HOJA}, ${row.ZONA}`,
        rows: [seen.get(key), index + 2] // +2 for header and 1-indexed
      });
    } else {
      seen.set(key, index + 2);
    }
  });

  return duplicates;
}
```

### Step 5: Statistical Analysis
```javascript
function analyzeStatistics(data) {
  const votesByList = {};
  const votesByZone = {};

  data.forEach(row => {
    const votes = parseInt(row.CNT_VOTOS, 10) || 0;
    votesByList[row.HOJA] = (votesByList[row.HOJA] || 0) + votes;
    votesByZone[row.ZONA] = (votesByZone[row.ZONA] || 0) + votes;
  });

  return {
    totalRows: data.length,
    uniqueLists: Object.keys(votesByList).length,
    uniqueZones: Object.keys(votesByZone).length,
    totalVotes: Object.values(votesByList).reduce((a, b) => a + b, 0),
    avgVotesPerList: Object.values(votesByList).reduce((a, b) => a + b, 0) /
                     Object.keys(votesByList).length
  };
}
```

## Output Format

### Validation Report
```json
{
  "file": "public/montevideo_odn.csv",
  "department": "montevideo",
  "type": "odn",
  "status": "valid",
  "statistics": {
    "totalRows": 15234,
    "uniqueLists": 245,
    "uniqueZones": 62,
    "totalVotes": 1250000,
    "avgVotesPerList": 5102
  },
  "issues": [],
  "warnings": []
}
```

### Report with Issues
```json
{
  "file": "public/canelones_odn.csv",
  "department": "canelones",
  "type": "odn",
  "status": "warning",
  "statistics": {
    "totalRows": 8456,
    "uniqueLists": 198,
    "uniqueZones": 45,
    "totalVotes": 890000
  },
  "issues": [
    {
      "severity": "warning",
      "code": "W001",
      "message": "Negative vote count: -15",
      "row": 234
    },
    {
      "severity": "warning",
      "code": "W002",
      "message": "Duplicate HOJA+ZONA: Lista 501, Ciudad de la Costa",
      "rows": [1892, 2345]
    }
  ]
}
```

## Error Codes Reference

| Code | Severity | Description |
|------|----------|-------------|
| E001 | Error | Missing required column |
| E002 | Error | Invalid file encoding |
| E004 | Error | File not found |
| E005 | Error | Invalid vote count format |
| E006 | Error | Empty required field |
| W001 | Warning | Negative vote count |
| W002 | Warning | Duplicate row |
| W003 | Warning | Zone name mismatch |
| W005 | Warning | Non-numeric list number |

## Dependencies
- Papa Parse (CSV parsing)
- electoral-data-agent

## Related Skills
- add-department
- optimize-geojson
