# /add-department Command

Add a new department to the Uruguay Electoral Map system.

## Usage
```
/add-department <department_name>
```

## Arguments
- `department_name` - Name of the department to add (lowercase, underscores for spaces)

## Examples
```
/add-department canelones
/add-department san_jose
/add-department treinta_y_tres
```

## Prerequisites

Before running this command, ensure these files exist in `public/`:

1. **ODN CSV File**: `{department}_odn.csv`
   - Electoral data for Orden Departamental Nacional

2. **ODD CSV File**: `{department}_odd.csv`
   - Electoral data for Orden Departamental Departamental

3. **GeoJSON Map**: `{department}_map.json`
   - Geographic boundaries for zones/neighborhoods

## Process

The command triggers the following workflow:

### Step 1: File Validation
- Check that all required files exist
- Verify file formats and encoding

### Step 2: CSV Validation
- Validate schema against required columns
- Check data quality and consistency
- Report any issues found

### Step 3: GeoJSON Processing
- Check file size (must be <3MB)
- Optimize if necessary
- Calculate map center and zoom level
- Extract zone names for cross-validation

### Step 4: Cross-Validation
- Match zone names in CSV with GeoJSON properties
- Report any mismatches

### Step 5: Integration
- Add department to `public/regions.json`
- Update CLAUDE.md department list

### Step 6: Verification
- Test data loading
- Verify map rendering

## Output

### Success
```
✓ Department 'canelones' added successfully

Summary:
- ODN Lists: 312
- ODD Lists: 298
- Zones: 45
- Map Center: [-34.45, -56.21]
- Map Zoom: 10

Files updated:
- public/regions.json
- CLAUDE.md
```

### Failure
```
✗ Failed to add department 'canelones'

Errors:
1. Missing file: public/canelones_odn.csv
2. GeoJSON too large: 15MB (max 3MB)

Suggested actions:
1. Add the missing CSV file
2. Run '/optimize-geojson canelones' to reduce file size
```

## Related Commands
- `/validate-data` - Validate data files without adding
- `/optimize-geojson` - Manually optimize a GeoJSON file

## Notes
- Department names must use lowercase letters and underscores
- The command will not overwrite existing department configurations
- Use `--force` flag to update an existing department
