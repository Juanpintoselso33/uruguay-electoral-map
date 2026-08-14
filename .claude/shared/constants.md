# Project Constants

Referencia rápida de constantes de dominio. **No es un módulo importable**: no existe un
`constants.ts` en `src/` que exporte esto. Es documentación; los valores reales viven en el
código y en `src/config/departments.json`.

Ante discrepancia, gana el código. `public/data/README.md` es la fuente de verdad del contrato
de datos.

### Electoral Data

#### Data Source Types
Categorías de la v1. El modelo actual es **agnóstico al tipo de elección** (unidad base =
opción electoral × unidad geográfica); las instancias reales se declaran en
`src/config/departments.json` bajo `elecciones`.

```javascript
const DATA_SOURCES = {
  ODN: 'odn',  // Orden Departamental Nacional
  ODD: 'odd'   // Orden Departamental Departamental
};
```

#### CSV Schema
```javascript
const CSV_COLUMNS = {
  PARTIDO: 'PARTIDO',           // Political party
  DEPTO: 'DEPTO',               // Department
  CIRCUITO: 'CIRCUITO',         // Electoral circuit
  SERIES: 'SERIES',             // Series number
  ESCRUTINIO: 'ESCRUTINIO',     // Scrutiny type
  PRECANDIDATO: 'PRECANDIDATO', // Pre-candidate
  HOJA: 'HOJA',                 // Ballot sheet (list number)
  CNT_VOTOS: 'CNT_VOTOS',       // Vote count
  ZONA: 'ZONA'                  // Geographic zone
};

const REQUIRED_COLUMNS = Object.values(CSV_COLUMNS);
```

### Geographic Constants

#### Uruguay Bounds
```javascript
const URUGUAY_BOUNDS = {
  north: -30.0,
  south: -35.0,
  east: -53.0,
  west: -58.5
};
```

#### Department Codes
```javascript
const DEPARTMENTS = {
  ARTIGAS: { code: 'AR', name: 'Artigas' },
  CANELONES: { code: 'CA', name: 'Canelones' },
  CERRO_LARGO: { code: 'CL', name: 'Cerro Largo' },
  COLONIA: { code: 'CO', name: 'Colonia' },
  DURAZNO: { code: 'DU', name: 'Durazno' },
  FLORES: { code: 'FS', name: 'Flores' },
  FLORIDA: { code: 'FD', name: 'Florida' },
  LAVALLEJA: { code: 'LA', name: 'Lavalleja' },
  MALDONADO: { code: 'MA', name: 'Maldonado' },
  MONTEVIDEO: { code: 'MO', name: 'Montevideo' },
  PAYSANDU: { code: 'PA', name: 'Paysandú' },
  RIO_NEGRO: { code: 'RN', name: 'Río Negro' },
  RIVERA: { code: 'RV', name: 'Rivera' },
  ROCHA: { code: 'RO', name: 'Rocha' },
  SALTO: { code: 'SA', name: 'Salto' },
  SAN_JOSE: { code: 'SJ', name: 'San José' },
  SORIANO: { code: 'SO', name: 'Soriano' },
  TACUAREMBO: { code: 'TA', name: 'Tacuarembó' },
  TREINTA_Y_TRES: { code: 'TT', name: 'Treinta y Tres' }
};
```

### Map Configuration

#### Default Map Settings
El mapa es **MapLibre GL 5**, no Leaflet. Los valores de vista los fija el componente
`src/components/map/ChoroplethMap.vue`; leerlo ahí antes de asumir. Rango de zoom en uso:
aproximadamente 7 (país) a 18 (local). Sin capa de tiles: solo geometría propia.

#### Color Scale (Heat Map)
```javascript
const HEAT_MAP_COLORS = [
  '#ffffb2',  // Lowest (light yellow)
  '#fecc5c',  // Low (yellow-orange)
  '#fd8d3c',  // Medium (orange)
  '#f03b20',  // High (red-orange)
  '#bd0026'   // Highest (dark red)
];
```

#### Legend Grades
```javascript
const LEGEND_GRADES = [0, 0.2, 0.4, 0.6, 0.8, 1];
```

### File Constraints

#### GeoJSON Limits
```javascript
const GEOJSON_CONSTRAINTS = {
  maxSizeMB: 3,
  targetSizeMB: 1,
  minFeatures: 1,
  coordinatePrecision: 5  // Decimal places (~1m precision)
};
```

#### File Naming Patterns
Los patrones `{department}_odn.csv` / `_odd.csv` / `_map.json` son de la v1. En la v2 los
datos publicados son shards bajo `public/data/` y la geometría es TopoJSON bajo
`public/data/geo/`. Ver `public/data/README.md` para la convención vigente, y
`data/mappings/` para los mapeos geográficos.

### Political Parties

#### Party Abbreviations
```javascript
const PARTY_ABBREVIATIONS = {
  'Frente Amplio': 'FA',
  'Partido Nacional': 'PN',
  'Partido Colorado': 'PC',
  'Partido Independiente': 'PI',
  'Cabildo Abierto': 'CA',
  'Partido Ecologista Radical Intransigente': 'PERI',
  'Partido de la Gente': 'PG',
  'Partido Digital': 'PD'
};
```

### UI Constants

#### Breakpoints
```javascript
const BREAKPOINTS = {
  mobile: 767,
  tablet: 1024,
  desktop: 1280
};
```

#### Animation Durations
```javascript
const ANIMATIONS = {
  fast: 150,
  normal: 300,
  slow: 500
};
```

### Validation Rules

#### Vote Count Limits
```javascript
const VOTE_LIMITS = {
  minVotes: 0,
  maxVotesPerZone: 50000,  // Reasonable max for anomaly detection
  outlierStdDev: 3         // Standard deviations for outlier
};
```

### API Endpoints (Future)

#### Data Sources
```javascript
const DATA_SOURCES_URLS = {
  corteElectoral: 'https://www.corteelectoral.gub.uy/',
  ideUruguay: 'https://www.gub.uy/infraestructura-datos-espaciales/'
};
```

### Cómo usar este archivo

Como referencia de lectura, no como import. Los 19 departamentos con sus niveles y elecciones
están en `src/config/departments.json`; las escaleras de color las valida
`npm run gate:escaleras`; el estado compartido del mapa está en `src/stores/map-state.ts`.
