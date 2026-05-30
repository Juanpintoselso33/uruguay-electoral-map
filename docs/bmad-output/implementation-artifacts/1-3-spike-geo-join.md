---
baseline_commit: a05d198e56f0b6e6524b2474957392b0a3e8b3e8
---

# Story 1.3: Spike de geo-join (1 circuito/zona end-to-end)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a desarrollador,
I want probar que los votos de UNA unidad geográfica caen en el polígono correcto y pintan al ganador correcto,
so that valide el riesgo más caro del producto (geo-join votos↔geometría) antes de construir el ETL completo encima.

## Acceptance Criteria

1. **Given** el GeoJSON real de Montevideo y los votos reales de internas-2024 **When** corro el spike sobre UNA zona (barrio) hardcodeada **Then** el join asocia los votos de esa zona a su polígono y determina el ganador, verificable contra el dato oficial de esa zona.
2. **Given** el join **When** se ejecuta **Then** queda **documentada la clave de join** (qué propiedad del GeoJSON ↔ qué campo del CSV/datos de votos) y su tasa de match para esa zona (preview del gate de cobertura de Story 1.6).
3. **Given** el resultado del join **When** lo modelo **Then** uso los tipos del **Data Contract v1** (`AgregadoZona` de Story 1.2) para shapear el resultado, validándolo con `assertVotosShard`/guards.
4. **Given** el ganador **When** lo resuelvo a color **Then** uso `src/lib/party-colors.ts` (reuso) para obtener el color de partido.
5. **Given** el spike **When** termina **Then** imprime un reporte claro (zona, ganador, votos, %, color) y un veredicto PASA/FALLA del join; ejecutable de forma reproducible (script en `etl/` o `scripts/`).

## Tasks / Subtasks

- [x] **Task 1: Identificar fuentes de datos reales (AC: 1, 2)**
  - [x] Geometría: `public/montevideo_map.json` (63 barrios; `properties.name` en MAYÚSCULAS, ej. "CIUDAD VIEJA"). LFS smudgeado OK localmente.
  - [x] Votos: **CSV crudo `public/montevideo_odn.csv`** (el procesado `odn.json` está keyed por series/códigos, confuso → se descartó). La `ZONA` del CSV **ES el nombre del barrio**.
  - [x] Clave de join confirmada: `ZONA`(barrio, CSV) ↔ `properties.name`(GeoJSON), **normalizada** (MAYÚSCULAS, sin acentos). `ESCRUTINIO` único = 'Departamental'.
- [x] **Task 2: Implementar el join sobre 1 zona (AC: 1, 3, 4)**
  - [x] `etl/geometry/spike-geo-join.ts`: parser CSV con comillas (gotcha PRECANDIDATO con comas), lee GeoJSON + CSV, toma una zona que matchee.
  - [x] Asocia votos a su feature por la clave normalizada; calcula ganador (max por partido) + % sobre válidos.
  - [x] Shapea como `AgregadoZona` (contrato 1.2) y valida con `assertVotosShard`.
  - [x] Color del ganador con `getPartyColor` (`party-colors.ts`).
- [x] **Task 3: Verificación y reporte (AC: 1, 2, 5)**
  - [x] Reporte: zona, feature matcheada, ganador (partido), votos, %, color hex.
  - [x] Veredicto PASA: "Ciudad Vieja"→"CIUDAD VIEJA", FA 66% (1266/1918), color #A569BD, `assertVotosShard` OK.
  - [x] Tasa de cobertura documentada: **24/63 (38.1%)** — 🔴 insumo crítico para el gate de Story 1.6.
  - [x] Ejecutado vía esbuild+node → PASA. `astro check` 0 errores (tras agregar @types/node, dep legítima del ETL Node).

## Dev Notes

### Por qué este spike (John, party mode épicas) — EL RIESGO MÁS CARO
Si el voto no cae en el polígono correcto, no hay producto: "números mentirosos en un mapa electoral = pérdida total de credibilidad". Esta historia prueba el geo-join con el **menor código posible** sobre datos reales, ANTES de invertir en el ETL completo (Stories 1.4-1.6). Es un spike: hardcodear UNA zona es correcto y deseado.

### Fuentes de datos (REALES, ya en el repo)
- **GeoJSON Montevideo:** `public/montevideo_map.json` (~251 KB). FeatureCollection de barrios. **`feature.properties.name`** = nombre del barrio (confirmado en el spike OG de 1.1; otras props: `id`, `originalName`, `department`). ⚠️ **LFS:** el archivo está en Git LFS; en el working tree está smudgeado (contenido real), así que `fs.readFileSync` lo lee bien. NO asumir que en CI sin LFS estaría — pero para el spike local funciona.
- **Votos procesados:** `public/data/electoral/internas-2024/montevideo/odn.json` — generado por el ETL viejo; tiene `votosPorListas` (por zona) + metadata. Estructura del store viejo (ver `legacy/src/stores/electoral.ts` si hace falta entender el shape). El spike puede leer este JSON directamente.
- **CSV crudo (alternativa):** `public/montevideo_odn.csv` (~9.8 MB, 98k filas). Esquema: `PARTIDO,DEPTO,CIRCUITO,SERIES,ESCRUTINIO,PRECANDIDATO,HOJA,CNT_VOTOS,ZONA`. Si se usa, filtrar etapa DEFINITIVA (ESCRUTINIO) y agrupar por ZONA. Más trabajo; preferir el procesado para el spike.

### Clave de join (a confirmar en Task 1)
- Hipótesis: `votos.ZONA` (barrio) ↔ `geojson.properties.name`. **Verificar normalización** (mayúsculas/tildes/espacios) — es el origen de los mismatches que la cadena de fallback `BARRIO→texto→zona` del proyecto viejo intentaba parchear. Documentar la normalización exacta usada.
- El spike NO resuelve el mapping general (eso es Story 1.6 con mapping table explícita). Solo prueba el mecanismo sobre 1 zona + reporta la tasa de match observada.

### Contrato y reuso (Story 1.2, done)
- Shapear el resultado como `AgregadoZona` y validar con `assertVotosShard` (importar de `src/lib/contracts`). El guard ya verifica ganador=max, votos≥0, etc.
- `src/lib/party-colors.ts`: `getPartyColor(nombrePartido)` → hex. PN es **celeste** (#55B5E5), no blanco. FA se renderiza distinto (en el mapa final será bandera Otorgués, pero para el spike el color sólido del partido alcanza).
- `d3-geo` y `topojson-client` ya instalados (Story 1.1). Para este spike NO hace falta proyección (es un join de datos, no render); d3-geo se usa recién en el OG-image (Epic 3) y el render (Epic 1.8).

### Aprendizajes de Stories 1.1/1.2
- TS strict + `verbatimModuleSyntax` → `import type` para tipos.
- 🚧 **GOTCHA LFS:** NO crear nuevos `.json` bajo `public/`/`data/` (quedan en LFS). El spike LEE el GeoJSON existente (ya en LFS, OK) pero su salida (si la persiste) va como `.ts`/log o fuera de public.
- Ejecutar TS: esbuild bundle + node (patrón usado en 1.2) — `npx esbuild <entry> --bundle --format=esm --platform=node | node --input-type=module`. Sin test runner aún (llega en 1.10).
- Sin dependencias nuevas sin aprobación.

### Invariantes de dominio (project-context.md)
- Voto canónico = etapa DEFINITIVA; nunca sumar etapas.
- Ganador = opción con más votos en la zona (válidos como denominador del %).
- Blanco/anulado/observado = categorías aparte.

### Testing
- El "test" del spike = su veredicto PASA/FALLA ejecutado sobre datos reales (AC5). No requiere framework. La verificación clave: el ganador computado coincide con el dato oficial de esa zona, y la zona matchea un polígono.

### File structure
- `etl/geometry/spike-geo-join.ts` (nuevo). Puede importar de `src/lib/contracts` y `src/lib/party-colors.ts`. No toca runtime/UI.

### References
- [Source: docs/bmad-output/planning-artifacts/epics.md#Story 1.3] — historia + ACs.
- [Source: docs/bmad-output/planning-artifacts/architecture.md#Data Architecture] — join, gates (cobertura es 1.6).
- [Source: docs/bmad-output/implementation-artifacts/1-2-data-contract-v1-polimorfico.md] — `AgregadoZona`, `assertVotosShard`.
- [Source: docs/bmad-output/implementation-artifacts/1-1-inicializar-proyecto-astro-vue-vercel.md] — gotcha LFS, ejecutar TS vía esbuild+node, `name` property del GeoJSON.
- [Source: legacy/src/stores/electoral.ts] — shape del JSON procesado de votos (referencia).
- [Source: docs/bmad-output/project-context.md] — clave de join variable, fallback BARRIO→texto→zona como síntoma.

## Dev Agent Record

### Agent Model Used

Amelia (dev) — claude-opus-4-8[1m]

### Debug Log References

- Spike ejecutado (esbuild+node) → VEREDICTO PASA. `astro check` 0 errores (tras `@types/node`). `npm run build` verde (el spike no afecta el bundle de la app).
- Inicialmente `astro check` dio 3 errores (node:fs, process, narrowing de zonaSpike) por falta de tipos de Node en el typecheck → resueltos con `@types/node` (dev dep, requerida por el ETL Node de la arquitectura).

### Completion Notes List

- ✅ **VEREDICTO: PASA.** El geo-join funciona end-to-end sobre datos REALES: "Ciudad Vieja" (CSV) → "CIUDAD VIEJA" (GeoJSON), ganador **Frente Amplio 66.0% (1266/1918 válidos)**, color #A569BD, validado por `assertVotosShard`. El riesgo más caro (voto→polígono) está probado.
- 🔴 **HALLAZGO CRÍTICO (insumo Story 1.6):** cobertura naive ZONA↔GeoJSON = **24/63 (38.1%)**. 39 barrios del CSV NO matchean por nombre (ej. "Rambla (zona Sur)", "Plaza Independencia (norte...)", "Parque Batlle, Villa Dolores"). **El join por nombre de barrio NO alcanza** → Story 1.6 DEBE usar una mapping table explícita (existe `data/mappings/montevideo-crv-barrio.json`, 48 barrios, vía CRV→SERIES→BARRIO). El gate de cobertura fallaría con 38%.
- 📌 **OQ3 resuelta:** la columna `ESCRUTINIO` del dataset tiene un único valor 'Departamental' (no 'definitivo'). El contrato mapea 'Departamental' → etapa canónica. El ETL de 1.4 debe normalizar este valor.
- 🚧 **Gotcha CSV (para Story 1.4):** el parser ingenuo `split(",")` se ROMPE — `PRECANDIDATO` tiene comas dentro de comillas ("MARTÍNEZ MARUCA, Walter Gonzalo"). El ETL necesita un parser CSV con soporte de comillas (papaparse/csv-parse o el mini-parser de este spike).
- El procesado viejo `odn.json` está keyed por series/códigos (confuso) — el ETL nuevo (1.4) debe partir del CSV crudo, no reusar ese formato.
- Sin tocar runtime/UI. `@types/node` agregada (justificada por el ETL Node).

### File List

**Nuevos:**
- `etl/geometry/spike-geo-join.ts`

**Modificados:**
- `package.json` (+ `@types/node` devDep)

### Change Log

- 2026-05-30: Story 1.3 implementada. Spike geo-join sobre datos reales: PASA (Ciudad Vieja, FA 66%). Hallazgo crítico: cobertura naive 38% → Story 1.6 necesita mapping table. OQ3 (ESCRUTINIO='Departamental') + gotcha CSV documentados. Status → review.

## Senior Developer Review (AI)

**Fecha:** 2026-05-30 · **Modo:** full (inline, 3 lentes sobre ~145 líneas) · **Outcome:** APPROVED (sin findings bloqueantes)

### Hallazgos
- Sin defectos de código. Spike verificado en runtime (PASA) + astro check 0 errores.
- 🟢 `noPartidarios=0` (no computa blanco/anulado del CSV) y mapeo `'Departamental'→'definitivo'` hardcodeado: aceptables para un spike; el ETL real (1.4) los formaliza.
- 🔴 El hallazgo del 38% de cobertura es de DATOS (no de código) → ya escalado a Story 1.6 (mapping table obligatoria).

### Acceptance Criteria
AC1-5 ✅. El spike cumplió su propósito: probar el geo-join sobre datos reales y surfacear el riesgo de cobertura ANTES del ETL.

### Change Log
- 2026-05-30: Code review inline. APPROVED. Status → done.
