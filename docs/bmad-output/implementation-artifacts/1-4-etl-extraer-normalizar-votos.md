---
baseline_commit: 57f19b6ba43d1032a44e41a185157c7f3b255b22
---

# Story 1.4: ETL — extraer y normalizar votos (Montevideo internas-2024)

Status: done

## Story

As a desarrollador,
I want un paso ETL que extraiga y normalice los votos del CSV crudo a un `votes.json` shard agregado,
so that el front consuma dato limpio, canónico y validado contra el contrato (no el CSV crudo de 9.8 MB).

## Acceptance Criteria

1. **Given** el CSV `public/montevideo_odn.csv` **When** corro el ETL de extracción **Then** se parsea correctamente (incluyendo `PRECANDIDATO` con comas dentro de comillas) y se normaliza a UTF-8.
2. **Given** las filas **When** normalizo **Then** se filtra la etapa canónica (`ESCRUTINIO`='Departamental' → mapeada a 'definitivo' en el contrato) y se agrega por **(ZONA × partido/lema)**.
3. **Given** los agregados **When** emito el shard **Then** produce un `VotosShard` (contrato 1.2) por zona con: ganador, válidos, `porOpcion` (votos por partido/lema), y categorías blanco/anulado/observado (si el dato las provee; si no, 0 con nota).
4. **Given** el shard **When** lo valido **Then** pasa `assertVotosShard` (ganador=max, votos≥0, sin geoId duplicado, escrutinio definitivo).
5. **Given** el ETL **When** termina **Then** el shard se escribe en una ubicación servible y se reporta: nº de zonas, total de válidos, ganador global. Reproducible vía script.

## Tasks / Subtasks

- [x] **Task 1: Parser CSV robusto (AC: 1)**
  - [x] **Reusé el mini-parser de comillas** (sin deps nuevas) → `etl/extract/parse-csv.ts` (keyed por header). Escala bien a 98.533 filas. No hizo falta csv-parse.
- [x] **Task 2: Normalización + agregación (AC: 2)**
  - [x] `etl/transform/aggregate-votes.ts`: filtra ESCRUTINIO='Departamental', normaliza ZONA (`etl/lib/normalize.ts`), agrega por (ZONA × PARTIDO).
  - [x] Ganador por zona (max), válidos (suma); blanco/anulado/observado detectados por marcador en PARTIDO (0 si no aparecen — ver nota).
  - [x] Mapea 'Departamental' → 'definitivo' del contrato (en `emit-shard`).
- [x] **Task 3: Emisión del shard + validación (AC: 3, 4, 5)**
  - [x] `etl/load/emit-shard.ts`: arma `VotosShard` + `assertVotosShard` (lanza si viola contrato).
  - [x] Escribe `public/data/internas-2024/montevideo/votes.json` (decisión (a): LFS por el `.gitattributes` actual — ver nota).
  - [x] Reporte: nº zonas, válidos, ganador global. Entrypoint `etl/run-montevideo-internas.ts`.
- [x] **Task 4: Verificación (AC: 1-5)**
  - [x] `astro check` 0 errores. ETL ejecutado → shard válido.
  - [x] Sanity: 322.329 válidos, ganador FA 205.657 (~64%); Ciudad Vieja coincide con el spike 1.3 (1918 válidos, FA 1266). Orden de magnitud plausible.

## Dev Notes

### Hallazgos de Story 1.3 (spike geo-join) — CRÍTICOS para este ETL
- **CSV quoting:** `split(',')` se ROMPE — `PRECANDIDATO` tiene comas en comillas ("MARTÍNEZ MARUCA, Walter Gonzalo"). Usar parser con soporte de comillas (mini-parser del spike `etl/geometry/spike-geo-join.ts` o `csv-parse`).
- **`ESCRUTINIO` único = 'Departamental'.** No existe 'definitivo' literal. Mapear 'Departamental' → etapa canónica 'definitivo' del contrato. (Si en otros datasets hay más etapas, elegir la definitiva; acá solo hay una.)
- **`ZONA` = nombre de barrio** (ej. "Ciudad Vieja"), NO número. La normalización (MAYÚSCULAS, sin acentos) está en el spike.
- **NO reusar** el procesado viejo `odn.json` (keyed por series/códigos, confuso). Partir del CSV crudo.
- El **geo-join y el gate de cobertura NO son de esta historia** (son 1.5/1.6). Acá solo se produce el shard de votos keyed por ZONA normalizada. El 38% de cobertura es problema de 1.6.

### Contrato (Story 1.2, done) — reuso obligatorio
- Importar de `src/lib/contracts`: tipos `VotosShard`, `AgregadoZona`, `VotoOpcion`, `CategoriasNoPartidarias` + `assertVotosShard`.
- `opcion_id`: para internas, agregamos a **nivel partido/lema** (la comparación MVP es partido/lema). El `opcionId` del agregado puede ser el nombre/slug del partido. (HOJA-level es Fase 2.)
- Recordar: el guard valida ganador=max — si la agregación es correcta, pasa.

### 🚧 DECISIÓN: ubicación del shard + Git LFS (importante)
- Arquitectura: shards en `public/data/{election}/{department}/votes.json`. **PERO** `.gitattributes` manda `public/**/*.json` a **Git LFS** (fix de Story 1.1). Un `votes.json` ahí sería LFS.
- El shard es chico (~30-60 KB gz). Opciones para el dev (documentar la elegida):
  - (a) Escribir en `public/data/...` y aceptar LFS (es dato/artefacto; LFS es defendible).
  - (b) Escribir en una ruta no-LFS y servir desde ahí.
  - (c) Tratar el shard como artefacto de build (no commitearlo) — pero el sitio estático lo necesita servido; requeriría correr el ETL en CI/deploy.
  - **Recomendación:** (a) por ahora (consistente con la arquitectura; el shard chico en LFS es aceptable). Confirmar que no rompe el build de Astro (Astro sirve `public/` tal cual; un .json LFS smudgeado localmente se sirve bien, pero en deploy Vercel necesita LFS habilitado — anotar como riesgo de deploy, relacionado con el AC3 pendiente de 1.1).

### Aprendizajes 1.1/1.2/1.3
- TS strict + `verbatimModuleSyntax` → `import type`. `@types/node` ya instalado (1.3).
- Ejecutar TS del ETL: esbuild bundle + node (patrón establecido).
- Sin tocar runtime/UI de Astro. El ETL es Node, vive en `etl/`.

### Invariantes (project-context.md)
- Voto canónico = etapa definitiva; nunca sumar etapas.
- Válidos = suma de votos partidarios (denominador de %). Blanco/anulado/observado aparte.
- Ganador = opción con más votos.

### File structure
- `etl/extract/parse-csv.ts`, `etl/transform/aggregate-votes.ts`, `etl/load/emit-shard.ts`, + un entrypoint `etl/run-montevideo-internas.ts` (o similar) que orquesta los 3.

### Testing
- `astro check` 0 errores + ejecución del ETL produce shard que pasa `assertVotosShard` + reporte coherente (AC5). Sin framework de tests aún (1.10).

### References
- [Source: epics.md#Story 1.4] · [architecture.md#Data Architecture] (sharding, agregados) · [1-2 contract] (`VotosShard`/`assertVotosShard`) · [1-3 spike] (parser CSV, ESCRUTINIO, ZONA, normalización) · [project-context.md] (voto canónico, categorías).

## Dev Agent Record

### Agent Model Used
Amelia (dev) — claude-opus-4-8[1m]

### Debug Log References
- ETL ejecutado (esbuild+node): 98.533 filas parseadas → 62 zonas, 18 partidos, 322.329 válidos, ganador global FA 205.657. Shard 45 KB, validado por `assertVotosShard`. `astro check` 0 errores; `npm run build` verde.

### Completion Notes List
- ✅ Las 5 ACs cumplidas. ETL real (extract/transform/load) partiendo del CSV crudo, no del procesado viejo.
- ✅ Parser de comillas reusado (sin deps nuevas) — maneja el gotcha PRECANDIDATO. 98k filas OK.
- ✅ Consistencia con spike 1.3: Ciudad Vieja → FA 1266/1918. Agregación a nivel partido/lema (opcionId = slug del partido); HOJA-level es Fase 2.
- 📌 **Categorías blanco/anulado/observado:** el detector busca marcadores en PARTIDO; en este dataset no aparecen como tales (la columna PARTIDO trae solo partidos) → quedan en 0. El total de "válidos" es la suma de votos partidarios. Si la fuente provee blanco/nulo en otra columna/archivo, incorporarlo en 1.6 (reconciliación).
- 🚧 **Shard en Git LFS:** `votes.json` (45 KB) cae bajo `public/**/*.json` → LFS. Funciona local (smudge) pero LFS para un shard chico es overkill y arrastra el riesgo de deploy (Vercel necesita LFS, ligado al AC3 pendiente de 1.1). **Revisar en Story 1.5** (estrategia geometría/LFS): mover shards chicos a texto y dejar LFS solo para geometría grande.
- @types/node ya estaba (1.3). Sin tocar runtime/UI de Astro.

### File List
**Nuevos:** `etl/lib/normalize.ts` · `etl/extract/parse-csv.ts` · `etl/transform/aggregate-votes.ts` · `etl/load/emit-shard.ts` · `etl/run-montevideo-internas.ts` · `public/data/internas-2024/montevideo/votes.json` (generado, LFS)

### Change Log
- 2026-05-30: Story 1.4 implementada. ETL extract/transform/load para Montevideo internas-2024. Shard validado por contrato. Status → review.

## Senior Developer Review (AI)
**Fecha:** 2026-05-30 · **Modo:** full (inline) · **Outcome:** APPROVED
- ✅ Correctitud verificada sobre datos reales (98k filas → 62 zonas, 322.329 válidos, FA ~64%); consistente con spike 1.3; salida validada por `assertVotosShard`; astro check 0; build verde.
- 🟢 `validos`=suma partidaria (blanco/nulo no presentes en PARTIDO → 0); documentado para reconciliación en 1.6.
- 🚧 Shard chico en LFS → revisar estrategia LFS en 1.5. No bloqueante.
- AC1-5 ✅. Status → done.
