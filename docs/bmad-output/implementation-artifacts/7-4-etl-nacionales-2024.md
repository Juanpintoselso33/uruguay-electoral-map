---
baseline_commit: c35f404386d10e5306aca3eab5a99cc5bf7c38fd
---

# Story 7.4: ETL + ingesta para nacionales 2024 (1ª vuelta)

Status: done

## Story

As a usuario,
I want explorar los resultados de la primera vuelta de las elecciones nacionales 2024 en el mapa,
so that vea cómo votó cada zona antes del balotaje.

## Acceptance Criteria

1. **Given** los datos de la Corte Electoral para nacionales-2024 (con HOJA, lemas y candidatos presidenciales) **When** corro el ETL **Then** produce shards con opcion_id = HOJA, agrupables por partido/lema **And** el tipo discrimina como `nacionales` **And** los gates pasan **And** las rutas SSG `/nacionales-2024/{depto}` se generan **And** la comparación con internas-2024 es posible a nivel partido/lema.

## Tasks / Subtasks

- [x] **T1** — Crear `etl/transform/aggregate-nacionales-serie.ts`
  - [x] T1.1 — Leer columnas nacionales-2024 (Series, Lema, CantidadVotos, TipoRegistro)
  - [x] T1.2 — Sumar HOJA_EN y VOTO_LEMA sin doble conteo
  - [x] T1.3 — Pro-rata entero para CRVs multi-serie
  - [x] T1.4 — Normalizar lema: strip "Partido " prefix → slug compatible con nacionales-2019

- [x] **T2** — Crear `etl/run-nacionales-2024-mvd.ts` (Montevideo, nivel lema)
  - [x] T2.1 — Reutilizar `aggregateNacionalesMvd` + mapping CRV→barrio existente
  - [x] T2.2 — Gates: reconciliación + cobertura barrio
  - [x] T2.3 — Salida: `public/data/nacionales-2024/montevideo/votes.json` + opciones.json

- [x] **T3** — Crear `etl/run-nacionales-2024-mvd-hoja.ts` (Montevideo, nivel HOJA)
  - [x] T3.1 — Reutilizar `aggregateHojaNacionales` con integracion-2024 (UTF-8)
  - [x] T3.2 — Construir hojaSublema desde `integracion-de-hojas.csv` 2024
  - [x] T3.3 — Reconciliar exacto contra votes.json por lema
  - [x] T3.4 — Salida: catalogo.json + hoja/unica/{lema}.json

- [x] **T4** — Crear `etl/run-nacionales-2024-interior.ts` (18 depts, nivel lema)
  - [x] T4.1 — Función `runNacionales2024Interior(cfg, allRows)` reutilizable
  - [x] T4.2 — Lee CSV una vez, filtra por deptCode + HOJA_EN|VOTO_LEMA + sin exterior
  - [x] T4.3 — Llama `aggregateNacionalesSerie`, buildShard nivel='serie'
  - [x] T4.4 — Gates: reconciliación + cobertura serie para los 18 depts
  - [x] T4.5 — Salida: `public/data/nacionales-2024/{dept}/votes.json` + opciones.json

- [x] **T4b** — Crear `etl/run-nacionales-2024-interior-hoja.ts` (18 depts, nivel HOJA)
  - [x] T4b.1 — `aggregate-hoja-nacionales-interior.ts`: Series como geoId, multi-serie floor+remainder
  - [x] T4b.2 — `hojaSublema` por dept desde integracion-2024 (UTF-8), código depto 2 letras
  - [x] T4b.3 — Reconciliación exacta por (serie, lema) contra votes.json
  - [x] T4b.4 — Salida: catalogo.json + hoja/unica/{lema}.json por dept (18/18 ✅)
  - [x] T4b.5 — Extender `tieneCatalogoHoja` a `eleccion === 'nacionales-2024'` (todos los depts)

- [x] **T5** — Actualizar `src/config/departments.json`
  - [x] T5.1 — Agregar "nacionales-2024" a elecciones de los 19 departamentos
  - [x] T5.2 — Montevideo: insertar entre nacionales-2019 y balotaje-2024

- [x] **T6** — Actualizar `src/pages/[eleccion]/[departamento].astro`
  - [x] T6.1 — Agregar `'nacionales-2024': 'Elecciones Nacionales 2024'` a ELECCION_LABELS
  - [x] T6.2 — Extender `tieneCatalogoHoja` para nacionales-2024 Montevideo
  - [x] T6.3 — Verificar `astro check` pasa sin errores

- [x] **T7** — Actualizar `package.json` con scripts ETL
  - [x] T7.1 — `etl:nacionales-2024-mvd`, `etl:nacionales-2024-mvd-hoja`, `etl:nacionales-2024-interior`

- [x] **T8** — Verificar search index y OG images
  - [x] T8.1 — Regenerar search-index.json (544 entradas)
  - [x] T8.2 — Regenerar OG images (44 imágenes nuevas para nacionales-2024)

## Dev Notes

### CSV nacionales-2024

Fuente: `data/raw/electoral/nacionales-2024/desglose-de-votos.csv` (354,177 filas)
Columnas: `TipoRegistro, Departamento, CRV, Series, Lema, Descripcion1, CantidadVotos`

Diferencia clave vs internas-2024 (uppercase): columnas en mixed-case.
Tipos de registro relevantes: `HOJA_EN` (voto a lista específica) y `VOTO_LEMA` (voto al partido sin lista).

Series exterior por departamento: patrón `XZZ` (ej. AR→IZZ, MO→ninguna, RV→HZZ). Ver run-nacionales-2024-interior.ts para el mapeo completo.

### Integración nacionales-2024

`data/raw/electoral/nacionales-2024/integracion-de-hojas.csv` — UTF-8 (a diferencia de 2019 que era Latin-1).
Columnas clave: `Numero` (nº hoja), `Departamento` (código 2 letras), `Sublema`.
Se usa para poblar el nivel sublema en el catálogo de Montevideo HOJA (Story 10.8 nacionales-2024).

### Normalización de lema

Mismo patrón que `aggregateNacionalesMvd` (nacionales-2019): se elimina prefijo "Partido " antes de hacer slug.
Resultado: "frente-amplio", "nacional", "colorado", "cabildo-abierto", etc.
Esto produce opcionIds diferentes a internas-2024 para PN/PC (partido-nacional/partido-colorado),
pero iguales para FA/CA, y compatible con nacionales-2019 para comparación inter-año.

### Resultados de los gates (run 2026-05-31)

Montevideo lema: placement 97.3%, barrio-fill 100%, total 867.115 votos
Montevideo HOJA: 135 hojas, 11 lemas, 27 sublemas, total 843.842 votos, reconciliado exacto
Interior lema: todos los 18 depts gate ✅ con placement ≥95% y serie-fill ≥75%
Interior HOJA: 18/18 depts — 18+ lemas, 18+ sublemas/dept, escalera lema→sublema→hoja, reconciliado exacto

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

- T1: `aggregate-nacionales-serie.ts` lee columnas nacionales (mixed-case) y suma HOJA_EN + VOTO_LEMA. Mismo pro-rata entero que internas. Normaliza lema = strip "Partido " + slug.
- T2: Reutiliza `aggregateNacionalesMvd` sin cambios; el CSV nacionales-2024 tiene exactamente las mismas columnas que nacionales-2019. Gates: placement 97.3%, delta 0.
- T3: Reutiliza `aggregateHojaNacionales` sin cambios; integracion-2024 es UTF-8 (no latin-1). 133 hojas con sublema → escalera lema→sublema→hoja completa.
- T4: Script unificado con función `runNacionales2024Interior` + loop sobre 18 configs. Se lee el CSV una sola vez. Todos los gates verdes.
- T4b: `aggregate-hoja-nacionales-interior.ts` — nuevo agregador con Series como geoId; multi-serie usa floor+remainder igual que lema-level → reconciliación exacta garantizada. Mismo catálogo lema→sublema→hoja que Montevideo. 18/18 departamentos pasaron. `tieneCatalogoHoja` extendido de Montevideo-only a `eleccion === 'nacionales-2024'` (todos los depts).
- T5: Node script actualiza departments.json en un pase; 18 depts actualizados + 1 (montevideo) editado manualmente.
- T6: ELECCION_LABELS + tieneCatalogoHoja actualizado; astro check 0 errores.
- T7: 3 scripts npm con `npx tsx` (mismo patrón que nacionales-hoja-mvd y departamentales).
- T8: Search index: 544 entradas (antes ~506, +38 = 2×19). OG images: 44 nuevas.

### File List

- `etl/transform/aggregate-nacionales-serie.ts` — NEW: agregador interior nacionales por Series
- `etl/run-nacionales-2024-mvd.ts` — NEW: ETL Montevideo lema-level
- `etl/run-nacionales-2024-mvd-hoja.ts` — NEW: ETL Montevideo HOJA-level
- `etl/run-nacionales-2024-interior.ts` — NEW: ETL 18 depts interior
- `src/config/departments.json` — MODIFIED: nacionales-2024 en los 19 depts
- `src/pages/[eleccion]/[departamento].astro` — MODIFIED: ELECCION_LABELS + tieneCatalogoHoja
- `package.json` — MODIFIED: 3 scripts ETL
- `public/search-index.json` — MODIFIED: 544 entradas
- `public/data/nacionales-2024/montevideo/votes.json` — NEW
- `public/data/nacionales-2024/montevideo/opciones.json` — NEW
- `public/data/nacionales-2024/montevideo/catalogo.json` — NEW
- `public/data/nacionales-2024/montevideo/hoja/unica/*.json` — NEW (11 shards)
- `public/data/nacionales-2024/{18 depts}/votes.json` — NEW (18 archivos)
- `public/data/nacionales-2024/{18 depts}/opciones.json` — NEW (18 archivos)
- `etl/transform/aggregate-hoja-nacionales-interior.ts` — NEW: agregador HOJA interior (Series como geoId)
- `etl/run-nacionales-2024-interior-hoja.ts` — NEW: ETL 18 depts HOJA-level
- `public/data/nacionales-2024/{18 depts}/catalogo.json` — NEW (18 archivos)
- `public/data/nacionales-2024/{18 depts}/hoja/unica/*.json` — NEW (~11 shards × 18 depts)
- `public/og/nacionales-2024/{19 depts}.png` — NEW (19 imágenes OG)

## Change Log

| Date | Change |
|------|--------|
| 2026-05-31 | Implementación completa Story 7.4 — nacionales-2024 para los 19 departamentos |
| 2026-05-31 | T4b: interior HOJA — `aggregate-hoja-nacionales-interior.ts` + interior-hoja runner; 18/18 depts exactos; `tieneCatalogoHoja` extendido |
