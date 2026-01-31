# Add Department Skill

## Description
Automates the complete process of adding a new department to the Uruguay Electoral Map system.

## Trigger
```
/add-department <department_name>
```

## Input Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| department_name | string | Yes | Lowercase name with underscores |

## Workflow

### Phase 1: Preparation
```javascript
// 1. Normalize department name
const deptName = normalizeToSnakeCase(input);

// 2. Define expected file paths
const files = {
  odn: `public/${deptName}_odn.csv`,
  odd: `public/${deptName}_odd.csv`,
  map: `public/${deptName}_map.json`
};

// 3. Verify all files exist
for (const [type, path] of Object.entries(files)) {
  if (!fileExists(path)) {
    throw new Error(`Missing ${type} file: ${path}`);
  }
}
```

### Phase 2: CSV Validation
```javascript
// Invoke electoral-data-agent
const odnValidation = await validateCSV(files.odn);
const oddValidation = await validateCSV(files.odd);

// Check for blocking errors
if (odnValidation.hasErrors || oddValidation.hasErrors) {
  return { success: false, errors: [...odnValidation.errors, ...oddValidation.errors] };
}
```

### Phase 3: GeoJSON Processing
```javascript
// Check file size
const mapSize = getFileSizeMB(files.map);

if (mapSize > 3) {
  // Invoke geojson-map-agent for optimization
  await optimizeGeoJSON(files.map, { targetSizeMB: 3 });
}

// Calculate map parameters
const mapParams = await calculateMapParameters(files.map);
// Returns: { center: [lat, lng], zoom: number, bounds: {...} }
```

### Phase 4: Cross-Validation
```javascript
// Get zones from both sources
const csvZones = await getCSVZones(files.odn);
const geojsonZones = await getGeoJSONZones(files.map);

// Find mismatches
const missingInGeoJSON = csvZones.filter(z => !geojsonZones.includes(z));
const missingInCSV = geojsonZones.filter(z => !csvZones.includes(z));

if (missingInGeoJSON.length || missingInCSV.length) {
  console.warn('Zone mismatches found:', { missingInGeoJSON, missingInCSV });
}
```

### Phase 5: Integration
```javascript
// Read current regions config
const regionsPath = 'public/regions.json';
const regions = JSON.parse(readFile(regionsPath));

// Add new department
regions.push({
  name: formatDisplayName(deptName),
  odnCsvPath: `/${deptName}_odn.csv`,
  oddCsvPath: `/${deptName}_odd.csv`,
  geojsonPath: `/${deptName}_map.json`,
  mapCenter: mapParams.center,
  mapZoom: mapParams.zoom
});

// Save updated config
writeFile(regionsPath, JSON.stringify(regions, null, 2));
```

### Phase 6: Documentation Update
```javascript
// Update CLAUDE.md
const claudeMd = readFile('CLAUDE.md');
const updatedClaudeMd = updateDepartmentList(claudeMd, deptName);
writeFile('CLAUDE.md', updatedClaudeMd);

// Update settings.json
const settings = JSON.parse(readFile('.claude/settings.json'));
settings.departments.implemented.push(deptName);
writeFile('.claude/settings.json', JSON.stringify(settings, null, 2));
```

## Output

### Success Response
```json
{
  "success": true,
  "department": "canelones",
  "summary": {
    "odnLists": 312,
    "oddLists": 298,
    "zones": 45,
    "mapCenter": [-34.45, -56.21],
    "mapZoom": 10
  },
  "filesUpdated": [
    "public/regions.json",
    "CLAUDE.md",
    ".claude/settings.json"
  ]
}
```

### Error Response
```json
{
  "success": false,
  "department": "canelones",
  "errors": [
    {
      "phase": "preparation",
      "code": "E004",
      "message": "Missing file: public/canelones_odn.csv"
    }
  ],
  "suggestions": [
    "Create the missing CSV file with required columns",
    "Download from Corte Electoral Uruguay"
  ]
}
```

## Helper Functions

### normalizeToSnakeCase
```javascript
function normalizeToSnakeCase(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}
```

### formatDisplayName
```javascript
function formatDisplayName(snakeName) {
  return snakeName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
```

### calculateMapParameters
```javascript
async function calculateMapParameters(geojsonPath) {
  const geojson = JSON.parse(readFile(geojsonPath));
  const bbox = turf.bbox(geojson);
  const center = turf.center(geojson);

  // Calculate zoom based on bbox size
  const width = bbox[2] - bbox[0];
  const height = bbox[3] - bbox[1];
  const maxDim = Math.max(width, height);
  const zoom = Math.round(9 - Math.log2(maxDim));

  return {
    center: center.geometry.coordinates.reverse(),
    zoom: Math.max(9, Math.min(13, zoom)),
    bounds: {
      north: bbox[3],
      south: bbox[1],
      east: bbox[2],
      west: bbox[0]
    }
  };
}
```

## Dependencies
- electoral-data-agent (CSV validation)
- geojson-map-agent (GeoJSON optimization)
- @turf/turf (geographic calculations)

## Related Skills
- validate-csv
- optimize-geojson
- git-commit
