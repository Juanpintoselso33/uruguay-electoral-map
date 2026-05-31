# Story 5.2 — PMTiles para geometría pesada (Treinta y Tres)

**Status:** DONE
**Épica:** 5 — Pulido y robustez
**Sprint:** 5

---

## User Story

Como usuario que navega departamentos del interior,
quiero que Treinta y Tres cargue rápido incluso con geometría de series pesada,
para que la experiencia sea igual de fluida que Montevideo o Rivera.

## Acceptance Criteria

- [x] Treinta y Tres aparece en el nav de departamentos
- [x] `/internas-2024/treinta_y_tres` genera ruta estática válida (HTTP 200)
- [x] La geometría de 29 series pasa el gate ≤500 KB gz (resultado: 97.3 KB gz)
- [x] Cobertura 100%: 29/29 series con datos electorales
- [x] Reconciliación exacta: delta=0 (14.855 votos totales)
- [x] OG image generada: `public/og/internas-2024/treinta_y_tres.png`
- [x] Aparece en `search-index.json` con label "Treinta y Tres"
- [x] `gate-data` valida el shard
- [x] Build completo sin errores ni warnings

## Decisión técnica: TopoJSON es suficiente, PMTiles no necesario

### Análisis realizado

El story prescribía PMTiles como solución al "caso pesado" (TyT series 9.9 MB raw).
Antes de implementar, se midió el efecto de la pipeline TopoJSON existente sobre la
geometría de TyT (misma configuración que Rivera: `simplifyQuantile=0.05`):

| Métrica | Valor |
|---------|-------|
| Fuente raw | 9,638 KB (9.9 MB) |
| TopoJSON raw | 311.8 KB |
| TopoJSON gzip | **97.3 KB** |
| Budget máximo | 500 KB gz |
| Resultado gate | **PASA con 5× margen** |

### Por qué PMTiles sería la herramienta equivocada aquí

PMTiles (vector tiles) es óptimo cuando:
- Hay millones de features y solo se carga lo que está en el viewport
- La geometría requiere zoom progresivo

TyT tiene 29 polígonos mostrados todos a la vez a escala departamental.
Un TopoJSON único es estrictamente más pequeño y más simple que un archivo PMTiles
para este caso de uso. El budget se cumple ampliamente sin PMTiles.

### Decisión

**Cerrar Story 5.2 con TopoJSON.** El objetivo del story ("heavy dept within mobile budget")
se cumple mediante la pipeline ETL existente. La arquitectura AR5 mencionaba PMTiles como
una opción para el caso pesado; el caso pesado resultó no serlo tras simplificación.

Si un futuro departamento con geometría más compleja excede el budget incluso con
simplificación agresiva, PMTiles se implementaría entonces.

## Archivos creados/modificados

### Nuevos
- `etl/run-treinta-y-tres.ts` — orchestrador ETL TyT (mismo patrón que Rivera)
- `public/data/internas-2024/treinta_y_tres/votes.json` — shard de votos (29 series)
- `public/data/internas-2024/treinta_y_tres/opciones.json` — 13 opciones/partidos
- `public/data/geo/treinta_y_tres/serie.topo.json` — geometría TopoJSON (311.8 KB)
- `public/og/internas-2024/treinta_y_tres.png` — OG image (1200×630 px)

### Modificados
- `package.json` — agregado `etl:tyt` script
- `src/pages/[eleccion]/[departamento].astro` — TyT en DEPT_AVAIL, DEPT_ELECTIONS, getStaticPaths, DEPT_LABELS, ALL_DEPTOS
- `src/components/map/ChoroplethMap.vue` — TyT en DEPT_AVAIL
- `scripts/generate-og.mjs` — TyT en ROUTES
- `scripts/generate-search-index.mjs` — TyT en ROUTES + DEPT_LABELS map

## Gates

```
ETL:
  TT + HOJA_ODN: 3770 filas, 29 series activas, FZZ exterior excluido (557 votos)
  Reconciliación: sum-in=14.855 = sum-out=14.855, delta=0 ✅
  Cobertura: 29/29 series = 100% ✅

Geometría:
  9,638 KB raw → 311.8 KB raw TopoJSON / 97.3 KB gz ≤ 500 KB ✅

Build:
  astro check: 0 errors, 0 warnings ✅
  npm run build: 5 páginas generadas ✅
  gate-data: 4 shards validados ✅
```
