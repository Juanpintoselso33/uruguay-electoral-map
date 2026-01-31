# Optimize GeoJSON Skill

## Description
Optimizes GeoJSON map files by simplifying geometries and reducing file size while maintaining visual quality.

## Trigger
```
/optimize-geojson <department_name> [--target-size <MB>] [--simplify <percent>]
```

## Input Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| department_name | string | Yes | - | Department to optimize |
| --target-size | number | No | 3 | Target file size in MB |
| --simplify | number | No | auto | Simplification percentage |

## Size Constraints
- **Maximum allowed**: 3MB
- **Target optimal**: <1MB
- **Critical case**: treinta_y_tres_map.json (24MB → target <3MB)

## Optimization Workflow

### Step 1: Analyze Current File
```javascript
async function analyzeGeoJSON(path) {
  const stats = await fs.stat(path);
  const sizeMB = stats.size / (1024 * 1024);

  const geojson = JSON.parse(await fs.readFile(path, 'utf-8'));

  return {
    sizeMB,
    featureCount: geojson.features.length,
    totalVertices: countVertices(geojson),
    coordinatePrecision: detectPrecision(geojson),
    bounds: calculateBounds(geojson)
  };
}

function countVertices(geojson) {
  let count = 0;
  geojson.features.forEach(feature => {
    const coords = feature.geometry.coordinates;
    count += flattenCoordinates(coords).length;
  });
  return count;
}
```

### Step 2: Create Backup
```javascript
async function createBackup(path) {
  const backupDir = 'public/backups';
  await fs.mkdir(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = path.split('/').pop();
  const backupPath = `${backupDir}/${filename}.${timestamp}.backup`;

  await fs.copyFile(path, backupPath);
  return backupPath;
}
```

### Step 3: Apply Optimizations

#### Geometry Simplification (Primary Method)
```bash
# Using mapshaper CLI
mapshaper input.json \
  -simplify ${percent}% keep-shapes \
  -o output.json format=geojson

# Iterative approach for large files
mapshaper input.json \
  -simplify dp interval=100 \
  -clean \
  -o output.json
```

```javascript
async function simplifyWithMapshaper(inputPath, outputPath, percent) {
  const { execSync } = require('child_process');

  execSync(`mapshaper "${inputPath}" \
    -simplify ${percent}% keep-shapes \
    -o "${outputPath}" format=geojson`);
}
```

#### Coordinate Precision Reduction
```javascript
function reducePrecision(geojson, decimals = 5) {
  const round = (num) => Math.round(num * 10**decimals) / 10**decimals;

  function processCoords(coords) {
    if (typeof coords[0] === 'number') {
      return coords.map(round);
    }
    return coords.map(processCoords);
  }

  return {
    ...geojson,
    features: geojson.features.map(feature => ({
      ...feature,
      geometry: {
        ...feature.geometry,
        coordinates: processCoords(feature.geometry.coordinates)
      }
    }))
  };
}
```

#### Property Cleanup
```javascript
function cleanProperties(geojson, keepProps = ['BARRIO', 'texto', 'zona']) {
  return {
    ...geojson,
    features: geojson.features.map(feature => ({
      type: feature.type,
      geometry: feature.geometry,
      properties: Object.fromEntries(
        Object.entries(feature.properties || {})
          .filter(([key]) => keepProps.includes(key))
      )
    }))
  };
}
```

### Step 4: Validate Result
```javascript
async function validateOptimizedFile(path, originalAnalysis) {
  const analysis = await analyzeGeoJSON(path);

  const checks = {
    sizeReduced: analysis.sizeMB < originalAnalysis.sizeMB,
    underLimit: analysis.sizeMB <= 3,
    featuresPreserved: analysis.featureCount === originalAnalysis.featureCount,
    hasValidGeometry: validateGeometry(path)
  };

  return {
    valid: Object.values(checks).every(Boolean),
    checks,
    reduction: ((1 - analysis.sizeMB / originalAnalysis.sizeMB) * 100).toFixed(1)
  };
}
```

### Step 5: Calculate Map Parameters
```javascript
function calculateMapParameters(geojson) {
  const bbox = turf.bbox(geojson);
  const center = turf.center(geojson);

  // Calculate appropriate zoom level
  const width = Math.abs(bbox[2] - bbox[0]);
  const height = Math.abs(bbox[3] - bbox[1]);
  const maxSpan = Math.max(width, height);

  // Approximate zoom calculation
  const zoom = Math.min(13, Math.max(9, Math.round(8 - Math.log2(maxSpan))));

  return {
    center: [center.geometry.coordinates[1], center.geometry.coordinates[0]],
    zoom,
    bounds: {
      north: bbox[3],
      south: bbox[1],
      east: bbox[2],
      west: bbox[0]
    }
  };
}
```

## Output Format

### Success Report
```json
{
  "status": "success",
  "department": "treinta_y_tres",
  "file": "public/treinta_y_tres_map.json",
  "backup": "public/backups/treinta_y_tres_map.json.2024-01-15T10-30-00.backup",
  "optimization": {
    "originalSizeMB": 24.5,
    "optimizedSizeMB": 2.8,
    "reductionPercent": 88.6,
    "simplificationLevel": "15%",
    "coordinatePrecision": 5
  },
  "analysis": {
    "featureCount": 45,
    "originalVertices": 1250000,
    "optimizedVertices": 45000
  },
  "mapParameters": {
    "center": [-33.2211, -54.325],
    "zoom": 10.5,
    "bounds": {
      "north": -32.8,
      "south": -33.6,
      "east": -53.8,
      "west": -54.8
    }
  }
}
```

### Iterative Optimization
If first pass doesn't achieve target:
```javascript
async function iterativeOptimize(path, targetMB) {
  const percentages = [20, 15, 10, 5];
  let currentPath = path;

  for (const percent of percentages) {
    const analysis = await analyzeGeoJSON(currentPath);
    if (analysis.sizeMB <= targetMB) break;

    console.log(`Trying ${percent}% simplification...`);
    await simplifyWithMapshaper(currentPath, currentPath, percent);
  }

  return analyzeGeoJSON(currentPath);
}
```

## Visual Quality Preservation

### Simplification Guidelines
| Original Size | Recommended % | Expected Reduction |
|---------------|---------------|-------------------|
| <5MB | 20% | 40-50% |
| 5-10MB | 15% | 50-70% |
| 10-25MB | 10% | 70-85% |
| >25MB | 5% | 85-95% |

### Quality Checks
- Verify polygon boundaries still align
- Check for topology errors (gaps, overlaps)
- Test at expected zoom levels
- Compare with original visually

## Dependencies
- mapshaper (CLI or npm package)
- @turf/turf
- geojson-map-agent

## Related Skills
- validate-csv
- add-department
