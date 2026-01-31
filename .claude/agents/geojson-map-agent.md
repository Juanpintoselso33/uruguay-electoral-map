# GeoJSON Map Agent

## Role
Specialized agent for optimizing, validating, and processing GeoJSON map files for Uruguay's electoral visualization system.

## Color Code
🔵 Azul (Blue)

## Capabilities

### Primary Functions
1. **GeoJSON Optimization** - Reduce file sizes through geometry simplification
2. **Property Validation** - Ensure required properties exist
3. **Coordinate Validation** - Verify coordinate system and bounds
4. **Center/Zoom Calculation** - Compute optimal map view parameters

### Size Constraints
- **Maximum file size**: 3MB
- **Target file size**: <1MB when possible
- **Original reference**: treinta_y_tres_map.json was 24MB, target <3MB

## Required GeoJSON Properties

Each feature must have at least one of these zone identifier properties:
- `BARRIO` - Neighborhood name (primary)
- `texto` - Text label (secondary)
- `zona` - Zone identifier (tertiary)

## Optimization Techniques

### Geometry Simplification
```bash
# Using mapshaper for geometry simplification
mapshaper input.json -simplify 15% -o output.json

# Alternative with tolerance
mapshaper input.json -simplify dp interval=100 -o output.json
```

### Coordinate Precision Reduction
- Reduce decimal places to 5 (≈1m precision)
- Remove unnecessary properties
- Minimize whitespace in output

### Recommended Workflow
1. Backup original file
2. Validate structure before optimization
3. Apply simplification iteratively
4. Validate after each step
5. Test visual quality in map

## Validation Checks

### Structural Validation
- Valid GeoJSON format
- FeatureCollection type
- Non-empty features array

### Property Validation
- At least one zone identifier property per feature
- No null geometry
- Valid polygon/multipolygon types

### Geographic Validation
- Coordinates within Uruguay bounds
  - Latitude: -35.0 to -30.0
  - Longitude: -58.5 to -53.0
- No self-intersecting polygons
- No empty geometries

## Usage

### Invoke via Skill
```
/optimize-geojson <department_name>
```

### Direct Agent Call
```javascript
// Optimize a GeoJSON file
await optimizeGeoJSON('treinta_y_tres_map.json', {
  targetSizeMB: 3,
  simplifyPercent: 15
});

// Validate without optimization
await validateGeoJSON('montevideo_map.json');
```

## Output Format

### Optimization Report
```json
{
  "department": "treinta_y_tres",
  "original_size_mb": 24.5,
  "optimized_size_mb": 2.8,
  "reduction_percent": 88.6,
  "feature_count": 45,
  "simplification_level": "15%",
  "validation": {
    "status": "valid",
    "issues": []
  },
  "map_parameters": {
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

## Map Parameter Calculation

### Center Point
Calculate centroid of all features:
```javascript
const center = turf.centroid(featureCollection);
```

### Zoom Level
Based on bounding box size:
- Department level: 9-11
- City level: 11-13
- Neighborhood level: 13-15

## Integration Points
- **electoral-data-agent** - Provides zone names for CSV validation
- **electoral-orchestrator** - Reports optimization status
- **vue-frontend-agent** - Provides optimized maps for rendering

## Dependencies
- mapshaper (CLI or node package)
- @turf/turf (for geographic calculations)
