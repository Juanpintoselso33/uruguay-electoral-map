# CLAUDE.md - Uruguay Electoral Map

## Project Overview

Interactive electoral map visualization for Uruguay's 19 departments, showing vote distribution by ballot lists and candidates across geographic zones.

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Non-Negotiables

### CSV Data Schema
All electoral CSV files MUST have these columns:
```
PARTIDO, DEPTO, CIRCUITO, SERIES, ESCRUTINIO, PRECANDIDATO, HOJA, CNT_VOTOS, ZONA
```

### File Requirements
- **Encoding**: UTF-8 (mandatory)
- **GeoJSON size**: Maximum 3MB per file
- **Naming convention**: `{department}_{type}.csv` and `{department}_map.json`

### Data Types
- ODN: Orden Departamental Nacional (national order)
- ODD: Orden Departamental Departamental (departmental order)

## Departments Status

### Implemented (4)
| Department | Status | Map Size | Lists (ODN/ODD) |
|------------|--------|----------|-----------------|
| Montevideo | ✅ Complete | 2.1 MB | 245/238 |
| Maldonado | ✅ Complete | 1.8 MB | 156/142 |
| Colonia | ✅ Complete | 1.5 MB | 98/89 |
| Treinta y Tres | ✅ Complete | 2.8 MB | 67/58 |

### Pending (15)
| Priority | Departments |
|----------|-------------|
| High | Canelones, San José, Rocha |
| Medium | Florida, Lavalleja, Durazno, Flores, Soriano, Río Negro, Paysandú, Salto |
| Low | Artigas, Rivera, Tacuarembó, Cerro Largo |

## Project Structure

```
uruguay-electoral-map/
├── data/                         # ETL data directory
│   ├── raw/                      # Downloaded raw data
│   │   ├── electoral/            # CSVs from Corte Electoral
│   │   └── geographic/           # GeoJSON from IDE Uruguay
│   ├── processed/                # Transformed data
│   │   ├── electoral/{dept}/     # JSON per department
│   │   └── geographic/           # Optimized GeoJSON
│   ├── mappings/                 # Zone mapping tables
│   └── cache/                    # Download cache
├── etl/                          # ETL Pipeline
│   ├── config/                   # Sources and schemas
│   ├── extractors/               # Data download
│   ├── transformers/             # Data processing
│   └── loaders/                  # Data deployment
├── public/
│   ├── {dept}_odn.csv            # ODN electoral data (legacy)
│   ├── {dept}_odd.csv            # ODD electoral data (legacy)
│   ├── {dept}_map.json           # GeoJSON boundaries
│   ├── data/                     # New: processed data
│   ├── regions.json              # Department configuration
│   └── partidos_abrev.json       # Party abbreviations
├── src/
│   ├── App.vue                   # Main application
│   ├── components/
│   │   ├── RegionMap.vue         # Map visualization
│   │   ├── ListSelector.vue      # List/candidate selection
│   │   └── RegionSelector.vue    # Department selector
│   ├── stores/
│   │   └── electoral.ts          # Pinia state management
│   └── main.js                   # Entry point
├── scripts/
│   ├── validate-csv.js           # CSV validation
│   ├── optimize-geojson.js       # GeoJSON optimization
│   └── add-department.js         # Department integration
├── .claude/
│   ├── agents/                   # Specialized agents
│   ├── commands/                 # User commands
│   ├── skills/                   # Reusable skills
│   └── shared/                   # Constants and schemas
├── CLAUDE.md                     # This file
└── PLAN_REFACTORIZACION.md       # Detailed refactoring plan
```

## Adding a New Department

### Prerequisites
1. Obtain electoral data from Corte Electoral Uruguay
2. Obtain GeoJSON boundaries from IDE Uruguay
3. Ensure files are in UTF-8 encoding

### Using the Command
```bash
/add-department <department_name>
```

### Manual Process
1. Place files in `public/`:
   - `{dept}_odn.csv`
   - `{dept}_odd.csv`
   - `{dept}_map.json`

2. Validate data:
   ```bash
   /validate-data {dept}
   ```

3. Optimize GeoJSON if >3MB:
   ```bash
   /optimize-geojson {dept}
   ```

4. Add to `public/regions.json`:
   ```json
   {
     "name": "Department Name",
     "odnCsvPath": "/dept_odn.csv",
     "oddCsvPath": "/dept_odd.csv",
     "geojsonPath": "/dept_map.json",
     "mapCenter": [-34.0, -56.0],
     "mapZoom": 10
   }
   ```

## Tech Stack

- **Frontend**: Vue 3 (Composition API)
- **Build**: Vite
- **Maps**: Leaflet
- **CSV Parsing**: PapaParse
- **Colors**: Chroma.js
- **State**: Pinia (planned)
- **Styling**: Tailwind CSS (planned)

## Data Sources

- **Electoral Data**: [Corte Electoral Uruguay](https://www.corteelectoral.gub.uy/)
  - [Catálogo de Datos Abiertos](https://catalogodatos.gub.uy/dataset/corte-electoral-elecciones-internas-de-los-partidos-politicos-2024)
- **Geographic Data**: [IDE Uruguay](https://www.gub.uy/infraestructura-datos-espaciales/)
  - [Límites Departamentales](https://catalogodatos.gub.uy/dataset/ide-limites-departamentales)

## ETL Pipeline

The project includes an ETL (Extract, Transform, Load) pipeline to automate data acquisition and processing.

### ETL Commands

```bash
# Download raw data from official sources
npm run etl:extract

# Process and normalize data
npm run etl:transform

# Deploy to public directory
npm run etl:load

# Run full pipeline
npm run etl:run

# Validate processed data
npm run etl:validate

# Clean cache
npm run etl:clean
```

### Adding All Departments via ETL

```bash
# 1. Download all electoral data (includes all 19 departments)
npm run etl:extract --type electoral

# 2. Transform for specific department
npm run etl:transform -- --dept canelones

# 3. Or transform all at once
npm run etl:transform -- --all

# 4. Load to public
npm run etl:load
```

### Data Flow

```
Corte Electoral API → data/raw/electoral/*.csv
                           ↓
                    ETL Transform
                           ↓
              data/processed/electoral/{dept}/odn.json
                           ↓
                      ETL Load
                           ↓
               public/data/electoral/{dept}/
```

## Available Commands

| Command | Description |
|---------|-------------|
| `/add-department <name>` | Add a new department |
| `/validate-data <name>` | Validate department data |
| `/optimize-geojson <name>` | Optimize GeoJSON file |
| `/commit` | Create standardized commit |

## Available Agents

| Agent | Role | Color |
|-------|------|-------|
| electoral-data-agent | CSV validation & processing | 🟢 Green |
| geojson-map-agent | GeoJSON optimization | 🔵 Blue |
| vue-frontend-agent | Frontend development | 🟠 Orange |
| electoral-orchestrator | Workflow coordination | 🟣 Purple |

## Testing Checklist

### Manual Tests
- [ ] `npm run dev` starts without errors
- [ ] Can switch between departments
- [ ] Can toggle ODD/ODN data source
- [ ] Can select individual lists
- [ ] Can select candidates (ODN only)
- [ ] Map coloring updates correctly
- [ ] Tooltips show on hover
- [ ] Mobile responsive layout works
- [ ] Selected items panel shows correct totals

### Data Validation
- [ ] All zones in CSV exist in GeoJSON
- [ ] No duplicate HOJA+ZONA combinations
- [ ] Vote counts are non-negative
- [ ] Party-candidate relationships are consistent

## Common Issues

### GeoJSON too large
```bash
/optimize-geojson <department>
# Or manually with mapshaper:
mapshaper input.json -simplify 15% -o output.json
```

### Zone name mismatch
Check that CSV `ZONA` values match GeoJSON properties:
- `BARRIO` (primary)
- `texto` (secondary)
- `zona` (tertiary)

### Encoding issues
Ensure all files are UTF-8:
```bash
file -I filename.csv  # Check encoding
iconv -f ISO-8859-1 -t UTF-8 input.csv > output.csv  # Convert
```

## Contributing

1. Create feature branch from `master`
2. Make changes following project conventions
3. Validate data with `/validate-data`
4. Create commit with `/commit`
5. Open PR with description

## License

MIT License
