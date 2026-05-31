# Story 5.3 — Sumar más departamentos

**Status:** DONE
**Épica:** 5 — Pulido y robustez

---

## User Story

Como usuario, quiero más departamentos disponibles, para explorar más allá de Montevideo y Rivera.

## Acceptance Criteria

- [x] Agregar un departamento nuevo requiere: actualizar `src/config/departments.json` + correr el ETL. No tocar ningún componente Vue/Astro.
- [x] Las rutas SSG y OG-images se generan automáticamente desde el registry.
- [x] El search-index incluye los nuevos departamentos automáticamente.
- [x] Los gates ETL validan todos los shards (reconciliación + cobertura).
- [x] Build completo sin errores: 21 páginas, 20 shards, 285 entradas de búsqueda.

## Departamentos agregados

**Antes:** Montevideo, Rivera, Treinta y Tres (3 departamentos)
**Ahora:** Los 19 departamentos del Uruguay (19 departamentos)

| Departamento | Código CSV | Series | Votos | Exterior |
|---|---|---|---|---|
| Canelones | CA | 42 | ~32k | CZZ |
| Maldonado | MA | 37 | ~15.6k | DZZ |
| Colonia | CO | 33 | ~9.1k | NZZ |
| Salto | SA | 41 | ~11.1k | JZZ |
| Paysandú | PA | ~41 | ~8.3k | KZZ |
| Cerro Largo | CL | 41 | ~7.1k | GZZ |
| Tacuarembó | TA | 35 | ~6.8k | TZZ |
| San José | SJ | 46 | ~6.2k | OZZ |
| Soriano | SO | 38 | ~6.1k | MZZ |
| Rocha | RO | 25 | ~4.4k | EZZ |
| Florida | FD | 40 | ~4.2k | QZZ |
| Artigas | AR | 24 | ~4.1k | IZZ |
| Durazno | DU | 38 | ~4.0k | RZZ |
| Lavalleja | LA | 28 | ~3.4k | SZZ |
| Río Negro | RN | 17 | ~3.3k | LZZ |
| Flores | FS | 10 | ~1.7k | PZZ |

## Arquitectura implementada

### Registry central: `src/config/departments.json`

Fuente de verdad para todos los consumidores. Estructura:
```json
[{ "id": "canelones", "label": "Canelones", "levels": ["serie"], "elecciones": ["internas-2024"] }]
```

Agregar un departamento = añadir una entrada al JSON + correr el ETL.

### ETL compartido: `etl/interior-dept.ts`

Función `runInteriorDept({ deptCode, deptName, exteriorSerie, simplifyQuantile })`.
Cada departamento tiene un script de 2 líneas que la invoca.

### Fix: series múltiples en CSV

Algunos circuitos consolidan 2 series electorales en un registro (e.g., `"PBB PBC"` en Flores).
Fix aplicado en `aggregateBySerie.ts`: expandir espacios y distribuir votos pro-rata.
Afecta: Flores, Río Negro, Cerro Largo, Florida, Maldonado, Soriano, Lavalleja, Durazno, Tacuarembó.

### Simplificación adaptativa de geometría

| Tamaño fuente | Quantile | Ejemplo |
|---|---|---|
| < 5 MB | 0.15 | Maldonado, Canelones, Colonia |
| 5-10 MB | 0.08 | Flores, Cerro Largo, Salto, San José, Artigas |
| > 10 MB | 0.05 | Rocha, Paysandú, Río Negro, Soriano, Florida, Lavalleja, Durazno, Tacuarembó |

Todos dentro del budget: máx ~150 KB gz para los departamentos más grandes.

## Archivos creados/modificados

### Nuevos
- `src/config/departments.json` — registry central (19 departamentos)
- `etl/interior-dept.ts` — función compartida ETL interior
- `etl/run-{canelones,maldonado,...,flores}.ts` — 16 scripts ETL (2 líneas c/u)
- `public/data/internas-2024/{dept}/votes.json` × 16 — shards de votos
- `public/data/internas-2024/{dept}/opciones.json` × 16 — opciones
- `public/data/geo/{dept}/serie.topo.json` × 16 — geometría TopoJSON
- `public/og/internas-2024/{dept}.png` × 16 — OG images

### Modificados
- `src/pages/[eleccion]/[departamento].astro` — lee del registry, sin hardcoding
- `src/components/map/ChoroplethMap.vue` — `availableLevels` como prop (elimina `DEPT_AVAIL`)
- `scripts/generate-og.mjs` — lee ROUTES del registry
- `scripts/generate-search-index.mjs` — lee ROUTES del registry
- `etl/transform/aggregate-by-serie.ts` — fix series múltiples (pro-rata split)
- `package.json` — scripts `etl:{dept}` para los 16 nuevos departamentos

## Gates (build final)

```
generate:og     → 20 imágenes generadas ✅
generate:search → 285 entradas → public/search-index.json ✅
gate:data       → 20 shards validados ✅
astro check     → 0 errors, 0 warnings ✅
astro build     → 21 páginas generadas ✅
```
