# Plan de Refactorización Completa - Uruguay Electoral Map

## Resumen Ejecutivo

Este plan detalla la refactorización completa del proyecto para:
1. Organizar datos raw de forma estructurada
2. Implementar un ETL interno para obtener y procesar datos automáticamente
3. Escalar a los 19 departamentos de Uruguay
4. Refactorizar componentes Vue para mejor mantenibilidad

---

## 1. Análisis de Datos Actuales

### 1.1 Estructura de Datos Existente

| Departamento | ODN (filas) | ODD (filas) | GeoJSON (features) | GeoJSON Size |
|--------------|-------------|-------------|-------------------|--------------|
| Montevideo | 98,533 | 78,080 | 46 barrios | 4.7 MB |
| Maldonado | 15,597 | 19,175 | 37 zonas | 1.4 MB |
| Colonia | 9,124 | 8,642 | 33 zonas | 5.1 MB |
| Treinta y Tres | 3,770 | 3,092 | 29 zonas | 24 MB ⚠️ |

### 1.2 Problemas Identificados

#### Inconsistencias en CSV
- **Maldonado**: Columna índice vacía al inicio
- **Treinta y Tres**: BOM UTF-8 en archivo
- **Montevideo**: Nombres de zona con comillas inconsistentes, truncados

#### Inconsistencias en GeoJSON
- **Propiedades diferentes por departamento**:
  - Montevideo: `BARRIO`, `CODBA`, `GID`
  - Maldonado: `texto`, `sec_electo`, `objectid`
  - Colonia/Treinta y Tres: `zona`, `serie`, `ogc_fid`

#### Mismatch Zonas CSV ↔ GeoJSON
- Nombres no coinciden exactamente
- Zonas "Unknown" en CSV sin equivalente en GeoJSON

---

## 2. Fuentes de Datos Oficiales

### 2.1 Datos Electorales - Corte Electoral

**URL Base**: `https://catalogodatos.gub.uy/dataset/corte-electoral-elecciones-internas-de-los-partidos-politicos-2024`

| Recurso | Descripción | URL |
|---------|-------------|-----|
| Plan Circuital | Info de circuitos electorales | [CSV](https://catalogodatos.gub.uy/.../plan-circuital.csv) |
| Desglose de Votos | Votos por CRV y hoja | [CSV](https://catalogodatos.gub.uy/.../desglose-de-votos.csv) |
| Totales Generales | Habilitados, votos, observados | [CSV](https://catalogodatos.gub.uy/.../totales-generales.csv) |
| Integración Hojas | Listas por departamento/partido/precandidato | [CSV](https://catalogodatos.gub.uy/.../integracion-hojas-de-votacion.csv) |

### 2.2 Datos Geográficos - IDE Uruguay

**URL Base**: `https://catalogodatos.gub.uy/dataset/ide-limites-departamentales`

| Recurso | Descripción |
|---------|-------------|
| Límites Departamentales | GeoJSON de los 19 departamentos |
| Secciones Electorales | Por departamento (requiere proceso) |

**Fuentes Alternativas**:
- GitHub: `alotropico/uruguay.geo` - TopoJSON simplificado
- GitHub: `vierja/geojson_montevideo` - Barrios de Montevideo

---

## 3. Nueva Estructura de Directorios

```
uruguay-electoral-map/
├── data/
│   ├── raw/                          # Datos sin procesar
│   │   ├── electoral/
│   │   │   ├── plan-circuital.csv
│   │   │   ├── desglose-de-votos.csv
│   │   │   ├── totales-generales.csv
│   │   │   └── integracion-hojas.csv
│   │   └── geographic/
│   │       ├── limites-departamentales.geojson
│   │       └── secciones/
│   │           ├── montevideo_raw.geojson
│   │           ├── maldonado_raw.geojson
│   │           └── ...
│   │
│   ├── processed/                    # Datos procesados por ETL
│   │   ├── electoral/
│   │   │   ├── montevideo/
│   │   │   │   ├── odn.json          # JSON optimizado (no CSV)
│   │   │   │   ├── odd.json
│   │   │   │   └── metadata.json     # Stats, fechas, etc.
│   │   │   ├── maldonado/
│   │   │   └── ...
│   │   └── geographic/
│   │       ├── montevideo_map.json   # GeoJSON optimizado
│   │       ├── maldonado_map.json
│   │       └── ...
│   │
│   ├── mappings/                     # Tablas de mapeo
│   │   ├── zone-mappings.json        # CSV zona → GeoJSON property
│   │   ├── party-codes.json          # Partidos y abreviaturas
│   │   └── department-codes.json     # Códigos de departamentos
│   │
│   └── cache/                        # Cache de descargas
│       └── .gitkeep
│
├── etl/                              # Pipeline ETL
│   ├── config/
│   │   ├── sources.json              # URLs de fuentes
│   │   └── schemas.json              # Esquemas de validación
│   ├── extractors/
│   │   ├── electoral-extractor.js    # Descarga datos electorales
│   │   └── geo-extractor.js          # Descarga datos geográficos
│   ├── transformers/
│   │   ├── csv-normalizer.js         # Normaliza CSVs
│   │   ├── geojson-optimizer.js      # Optimiza GeoJSON
│   │   └── zone-mapper.js            # Mapea zonas CSV↔GeoJSON
│   ├── loaders/
│   │   └── data-loader.js            # Carga datos procesados
│   ├── pipeline.js                   # Orquestador principal
│   └── index.js                      # CLI del ETL
│
├── public/                           # Solo archivos estáticos finales
│   ├── data/                         # Symlink o copia de processed/
│   └── ...
│
├── src/
│   ├── components/
│   │   ├── map/                      # Componentes de mapa
│   │   │   ├── ElectoralMap.vue
│   │   │   ├── MapLegend.vue
│   │   │   ├── MapTooltip.vue
│   │   │   ├── MapControls.vue
│   │   │   └── SelectedInfo.vue
│   │   ├── selectors/                # Componentes de selección
│   │   │   ├── RegionSelector.vue
│   │   │   ├── DataSourceToggle.vue
│   │   │   ├── PartyFilter.vue
│   │   │   ├── ListGrid.vue
│   │   │   └── CandidateGrid.vue
│   │   ├── ui/                       # Componentes UI reutilizables
│   │   │   ├── LoadingSpinner.vue
│   │   │   ├── ErrorMessage.vue
│   │   │   ├── SearchInput.vue
│   │   │   └── ToggleSwitch.vue
│   │   └── layout/                   # Layout components
│   │       ├── AppHeader.vue
│   │       ├── AppFooter.vue
│   │       └── MobileDrawer.vue
│   │
│   ├── composables/                  # Lógica reutilizable
│   │   ├── useElectoralData.ts       # Carga y procesa datos
│   │   ├── useMapInteraction.ts      # Eventos del mapa
│   │   ├── useVoteCalculation.ts     # Cálculos de votos
│   │   └── useResponsive.ts          # Breakpoints responsive
│   │
│   ├── stores/                       # Pinia stores
│   │   ├── electoral.ts              # Estado electoral
│   │   ├── ui.ts                     # Estado de UI
│   │   └── index.ts                  # Export stores
│   │
│   ├── services/                     # Servicios de datos
│   │   ├── dataService.ts            # Fetch y cache de datos
│   │   └── mappingService.ts         # Mapeo de zonas
│   │
│   ├── types/                        # TypeScript types
│   │   ├── electoral.ts
│   │   ├── geographic.ts
│   │   └── index.ts
│   │
│   ├── utils/                        # Utilidades
│   │   ├── colorScale.ts             # Heat map colors
│   │   ├── formatters.ts             # Formateo de números/texto
│   │   └── validators.ts             # Validación de datos
│   │
│   ├── App.vue
│   ├── main.ts
│   └── style.css
│
├── scripts/                          # Scripts de mantenimiento
│   ├── validate-csv.js
│   ├── optimize-geojson.js
│   └── add-department.js
│
├── .claude/                          # Config Claude Code
└── ...
```

---

## 4. ETL Pipeline

### 4.1 Arquitectura

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           ETL PIPELINE                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────┐    ┌─────────────────┐    ┌─────────────────┐          │
│  │  EXTRACT    │───▶│   TRANSFORM     │───▶│     LOAD        │          │
│  └─────────────┘    └─────────────────┘    └─────────────────┘          │
│        │                    │                      │                     │
│        ▼                    ▼                      ▼                     │
│  ┌─────────────┐    ┌─────────────────┐    ┌─────────────────┐          │
│  │ Corte       │    │ Normalizar CSV  │    │ data/processed/ │          │
│  │ Electoral   │    │ - Fix encoding  │    │                 │          │
│  │ API/CSV     │    │ - Fix columns   │    │ public/data/    │          │
│  └─────────────┘    │ - Validate      │    │                 │          │
│                     └─────────────────┘    └─────────────────┘          │
│  ┌─────────────┐    ┌─────────────────┐                                 │
│  │ IDE Uruguay │    │ Optimizar GeoJSON│                                │
│  │ GeoJSON     │    │ - Simplify      │                                 │
│  └─────────────┘    │ - Reduce size   │                                 │
│                     │ - Normalize props│                                │
│                     └─────────────────┘                                 │
│                     ┌─────────────────┐                                 │
│                     │ Mapear Zonas    │                                 │
│                     │ - CSV ↔ GeoJSON │                                 │
│                     │ - Generate map  │                                 │
│                     └─────────────────┘                                 │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Configuración de Fuentes

```json
// etl/config/sources.json
{
  "electoral": {
    "baseUrl": "https://catalogodatos.gub.uy/dataset/48a4e7f5-6909-41a0-aa8a-95dc42cc201f/resource",
    "resources": {
      "planCircuital": {
        "id": "a46e47e5-72e8-4027-9c0f-f8df2a103c21",
        "filename": "plan-circuital.csv"
      },
      "desgloseVotos": {
        "id": "dec32eb5-1754-4810-af7a-8c1121259206",
        "filename": "desglose-de-votos.csv"
      },
      "totalesGenerales": {
        "id": "f7dd08cf-5978-43c2-acc5-b2854d7029dd",
        "filename": "totales-generales.csv"
      },
      "integracionHojas": {
        "id": "4937d1a4-0847-4cf7-a2e1-95688ce5c40c",
        "filename": "integracion-hojas-de-votacion.csv"
      }
    }
  },
  "geographic": {
    "departamentos": "https://catalogodatos.gub.uy/dataset/ide-limites-departamentales",
    "alternativeSources": {
      "montevideo": "https://raw.githubusercontent.com/vierja/geojson_montevideo/master/barrios.geojson",
      "uruguay": "https://raw.githubusercontent.com/alotropico/uruguay.geo/master/uruguay-departamentos.geojson"
    }
  }
}
```

### 4.3 Comandos del ETL

```bash
# Descargar todos los datos raw
npm run etl:extract

# Descargar solo datos electorales
npm run etl:extract -- --type electoral

# Descargar solo datos geográficos
npm run etl:extract -- --type geographic

# Transformar datos para un departamento
npm run etl:transform -- --dept montevideo

# Transformar todos los departamentos
npm run etl:transform -- --all

# Pipeline completo (extract + transform + load)
npm run etl:run

# Pipeline para un departamento específico
npm run etl:run -- --dept canelones

# Validar datos procesados
npm run etl:validate

# Limpiar cache
npm run etl:clean
```

---

## 5. Esquemas de Datos Normalizados

### 5.1 Datos Electorales Procesados

```typescript
// types/electoral.ts

interface ProcessedElectoralData {
  metadata: {
    department: string;
    type: 'odn' | 'odd';
    processedAt: string;
    sourceVersion: string;
    stats: {
      totalRows: number;
      uniqueLists: number;
      uniqueZones: number;
      uniqueParties: number;
      totalVotes: number;
    };
  };
  data: {
    votosPorListas: Record<string, Record<string, number>>;
    maxVotosPorListas: Record<string, number>;
    partiesByList: Record<string, string>;
    precandidatosByList: Record<string, string>;  // Solo ODN
    zoneList: string[];
    partyList: string[];
  };
}
```

### 5.2 Datos Geográficos Normalizados

```typescript
// types/geographic.ts

interface NormalizedGeoJSON {
  type: 'FeatureCollection';
  metadata: {
    department: string;
    originalSize: number;
    optimizedSize: number;
    featureCount: number;
    processedAt: string;
    center: [number, number];
    zoom: number;
    bounds: {
      north: number;
      south: number;
      east: number;
      west: number;
    };
  };
  features: Array<{
    type: 'Feature';
    geometry: GeoJSON.Geometry;
    properties: {
      id: string;           // Identificador único normalizado
      name: string;         // Nombre de zona normalizado
      originalName: string; // Nombre original
      department: string;
    };
  }>;
}
```

### 5.3 Mapeo de Zonas

```json
// data/mappings/zone-mappings.json
{
  "montevideo": {
    "csvToGeoJSON": {
      "Centro": "CENTRO",
      "Pocitos": "POCITOS",
      "Ciudad Vieja": "CIUDAD VIEJA",
      "Brazo Oriental": "BRAZO ORIENTAL",
      "Centro Desconocido": null  // Sin equivalente en GeoJSON
    },
    "geoJSONToCSV": {
      "CENTRO": "Centro",
      "POCITOS": "Pocitos"
    },
    "unmappedCSV": ["Centro Desconocido", "Unknown"],
    "unmappedGeoJSON": []
  }
}
```

---

## 6. Refactorización de Componentes Vue

### 6.1 División de RegionMap.vue (1027 líneas)

| Componente Original | Nuevos Componentes | Líneas Aprox |
|---------------------|-------------------|--------------|
| RegionMap.vue | ElectoralMap.vue | 200 |
| | MapLegend.vue | 80 |
| | MapTooltip.vue | 150 |
| | MapControls.vue | 50 |
| | SelectedInfo.vue | 200 |

### 6.2 División de ListSelector.vue (597 líneas)

| Componente Original | Nuevos Componentes | Líneas Aprox |
|---------------------|-------------------|--------------|
| ListSelector.vue | DataSourceToggle.vue | 60 |
| | PartyFilter.vue | 80 |
| | ListGrid.vue | 150 |
| | CandidateGrid.vue | 100 |

### 6.3 Composables a Crear

```typescript
// composables/useElectoralData.ts
export function useElectoralData() {
  // Carga de datos con cache
  // Procesamiento de CSV
  // Agregaciones
}

// composables/useMapInteraction.ts
export function useMapInteraction() {
  // Hover events
  // Click events
  // Tooltip management
}

// composables/useVoteCalculation.ts
export function useVoteCalculation() {
  // Cálculo de votos por zona
  // Totales por partido
  // Máximos para heat map
}
```

---

## 7. Plan de Implementación por Fases

### Fase 1: Infraestructura ETL (Prioridad Alta)
1. Crear estructura de directorios `data/` y `etl/`
2. Implementar `etl/config/sources.json`
3. Implementar extractores básicos
4. Implementar transformadores de CSV
5. Implementar optimizador de GeoJSON
6. Crear CLI del ETL

**Entregable**: `npm run etl:run` funcional

### Fase 2: Normalización de Datos Existentes
1. Procesar los 4 departamentos actuales con ETL
2. Generar mappings de zonas
3. Validar integridad de datos
4. Migrar de `public/` a `data/processed/`

**Entregable**: Datos normalizados y validados

### Fase 3: Refactorización Frontend
1. Crear tipos TypeScript
2. Crear composables
3. Dividir RegionMap.vue
4. Dividir ListSelector.vue
5. Integrar con datos normalizados

**Entregable**: Componentes modulares funcionando

### Fase 4: Agregar Departamentos Faltantes
1. Ejecutar ETL para obtener datos de todos los departamentos
2. Obtener/crear GeoJSON de secciones electorales
3. Generar mappings de zonas
4. Validar y publicar

**Entregable**: 19 departamentos funcionando

### Fase 5: Optimizaciones
1. Lazy loading de datos por departamento
2. Cache en localStorage/IndexedDB
3. Service Worker para offline
4. Optimización de bundle

**Entregable**: App optimizada para producción

---

## 8. Departamentos Faltantes - Estrategia

### 8.1 Datos Electorales
Los datos electorales de todos los departamentos están en el archivo maestro:
- `desglose-de-votos.csv` contiene TODOS los departamentos
- Se filtran por columna `DEPTO`

### 8.2 Datos Geográficos (Desafío Principal)

| Departamento | Fuente GeoJSON | Dificultad |
|--------------|----------------|------------|
| Canelones | IDE Uruguay / Crear | Media |
| San José | IDE Uruguay / Crear | Media |
| Rocha | IDE Uruguay / Crear | Media |
| Florida | IDE Uruguay / Crear | Media |
| Lavalleja | IDE Uruguay / Crear | Media |
| Durazno | IDE Uruguay / Crear | Media |
| Flores | IDE Uruguay / Crear | Baja |
| Soriano | IDE Uruguay / Crear | Media |
| Río Negro | IDE Uruguay / Crear | Media |
| Paysandú | IDE Uruguay / Crear | Media |
| Salto | IDE Uruguay / Crear | Media |
| Artigas | IDE Uruguay / Crear | Baja |
| Rivera | IDE Uruguay / Crear | Baja |
| Tacuarembó | IDE Uruguay / Crear | Baja |
| Cerro Largo | IDE Uruguay / Crear | Baja |

**Opciones para GeoJSON faltantes**:
1. **Límites departamentales simplificados**: Sin subdivisiones internas
2. **Secciones censales**: Del INE, requiere mapeo a circuitos electorales
3. **Crear manualmente**: Basado en plan circuital de Corte Electoral

---

## 9. Scripts NPM Actualizados

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",

    "etl:extract": "node etl/index.js extract",
    "etl:transform": "node etl/index.js transform",
    "etl:load": "node etl/index.js load",
    "etl:run": "node etl/index.js run",
    "etl:validate": "node etl/index.js validate",
    "etl:clean": "node etl/index.js clean",

    "validate": "node scripts/validate-csv.js",
    "optimize": "node scripts/optimize-geojson.js",
    "add-dept": "node scripts/add-department.js",

    "lint": "eslint src/",
    "type-check": "vue-tsc --noEmit"
  }
}
```

---

## 10. Dependencias Adicionales Requeridas

```json
{
  "dependencies": {
    "@turf/turf": "^6.5.0",      // Operaciones geográficas
    "axios": "^1.6.0",            // HTTP requests para ETL
    "idb": "^8.0.0"               // IndexedDB para cache
  },
  "devDependencies": {
    "@types/geojson": "^7946.0.0",
    "mapshaper": "^0.6.0"         // Simplificación de GeoJSON
  }
}
```

---

## 11. Métricas de Éxito

| Métrica | Actual | Objetivo |
|---------|--------|----------|
| Departamentos | 4 | 19 |
| Tamaño GeoJSON máx | 24 MB | 3 MB |
| Líneas componente máx | 1027 | 250 |
| Tiempo carga inicial | ~5s | <2s |
| Cache de datos | No | Sí |
| Pipeline automatizado | No | Sí |

---

## 12. Próximos Pasos Inmediatos

1. ✅ Crear este documento de plan
2. ⬜ Crear estructura de directorios `data/` y `etl/`
3. ⬜ Implementar ETL básico para extracción
4. ⬜ Migrar datos actuales a nueva estructura
5. ⬜ Refactorizar RegionMap.vue
6. ⬜ Agregar primer departamento nuevo (Canelones)
