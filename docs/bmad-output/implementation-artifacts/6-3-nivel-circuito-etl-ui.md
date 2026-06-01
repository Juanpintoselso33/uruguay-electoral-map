# Story 6.3 — Nivel circuito — ETL + UI

**Status:** Done
**Épica:** 6 — Fase 2 — Exportar, Circuito, HOJA
**FR:** UX-DR7 Fase 2

---

## User Story

Como analista avanzado, quiero ver resultados al nivel de circuito electoral, para tener la granularidad más fina disponible.

## Acceptance Criteria

- [x] Nivel "Circuito" disponible en el LevelSelector para todos los departamentos
- [x] El mapa colorea por circuito usando geometría de puntos (bubble map)
- [x] Geometría de circuito disponible para los 19 departamentos
- [x] Shards `votes-circuito.json` generados por el ETL para `internas-2024`
- [x] El nivel vive en la URL (`?level=circuito`)
- [x] ChoroplethMap maneja la capa `zonas-circle` (type: circle) separada de la capa de polígonos

## Implementación

### ETL: `etl/run-circuito.ts`

Función `runCircuitoLevel(deptCode)` que:
1. Lee `data/raw/electoral/desglose-de-votos.csv` (HOJA_ODN) y filtra por departamento
2. Agrega votos por CRV (número de circuito)
3. Lee `data/raw/geographic/plan-circuital-georreferencia-nacional-2024.csv` para obtener lat/lon de cada circuito
4. Emite `public/data/internas-2024/{dept}/votes-circuito.json` (VotosShard nivel=circuito)
5. Emite `public/data/geo/{dept}/circuito.topo.json` (FeatureCollection de Points como TopoJSON)

**Geometría tipo Point:** los 1060+ circuitos de un departamento no son polígonos — cada uno es un punto (local de votación) georreferenciado. El mapa los renderiza como burbujas de tamaño fijo.

### UI: LevelSelector + ChoroplethMap

**LevelSelector.vue:** `circuito` es una opción más en el array NIVELES; no requiere lógica especial.

**ChoroplethMap.vue:**
- `isPointNivel = nivel === 'circuito'` — flag que distingue geometría Point vs Polygon
- Carga `votes-circuito.json` cuando `nivel === 'circuito'`
- Capa `zonas-circle` (type: circle) siempre presente; visibilidad toggled según `isPointNivel`
- Capa de polígonos (`zonas-fill`, `zonas-line`) oculta cuando nivel=circuito

## Archivos creados/modificados

### Nuevos
- `etl/run-circuito.ts` — orchestrador ETL nivel circuito (todos los deptos)
- `public/data/internas-2024/{19 deptos}/votes-circuito.json` — shards nivel circuito
- `public/data/geo/{19 deptos}/circuito.topo.json` — geometría de puntos

### Modificados
- `src/components/selectors/LevelSelector.vue` — agrega `{ key: 'circuito', label: 'Circuito' }`
- `src/components/map/ChoroplethMap.vue` — flag `isPointNivel`, carga condicional de shard, capa `zonas-circle`
- `package.json` — script `etl:circuito`
