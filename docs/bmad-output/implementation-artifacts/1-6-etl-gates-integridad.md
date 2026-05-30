---
baseline_commit: c8dc9786f4c236832a3e17b5b1302cb0a6e741c1
---

# Story 1.6: ETL — gates de integridad (reconciliación + cobertura)

Status: done

## Story

As a desarrollador,
I want gates de build que validen integridad de datos (reconciliación lossless + cobertura zonas↔geometría) usando la mapping table explícita del depto,
so that nunca se publique un mapa con datos mentirosos, votos perdidos, o zonas vacías sin que el build falle y lo reporte.

## Acceptance Criteria

1. **Given** el shard de votos + la geometría + la mapping table explícita del depto **When** corro los gates **Then** los votos válidos **reconcilian** (delta 0) o el build falla.
2. **Given** la cobertura de zonas CSV↔geometría **When** corro el gate **Then** cumple el umbral o el build falla **con reporte de faltantes**.
3. **Given** los gates **When** una violación ocurre **Then** el proceso sale con exit≠0 (rompe el build/CI), no solo loguea.

## Contexto crítico (hallazgos de investigación — leer antes de implementar)

> Esta story **corrige el join de las stories 1.4 y 1.5**. Surfaceado explícitamente (no se cambia output de stories "done" en silencio). Ver memoria del proyecto `montevideo-barrio-join`.

### El join correcto: CIRCUITO→BARRIO→geometría (NO ZONA)
- La columna `ZONA` del CSV son **etiquetas editoriales compuestas** ("Castro, Mercado Modelo, Villa Española"), NO barrios. El join naive ZONA↔geometría da **38%** (medido). **La 1.4 agregó por ZONA — hay que re-agregar por CIRCUITO.**
- La mapping table `data/mappings/montevideo-crv-barrio.json` (`crvToBarrio`) mapea **CIRCUITO(CRV)→BARRIO**, cubre **95.6%** de los circuitos (2430/2542).
- **Fuente de geometría limpia = `public/v_sig_barrios.json`** (62 barrios, UTF-8 correcto, propiedad `BARRIO` Title Case: "Bañados de Carrasco", "Mercado Modelo, Bolívar"). Sus nombres matchean **EXACTO** los valores de la mapping (normalizando NFD+upper+`.,`→espacio): **48/48, 0 sin match, sin fuzzy matching ni alias table**.

### Defecto de la 1.5 a corregir
- La 1.5 emitió `zona.topo.json` desde `public/montevideo_map.json`, que está **corrupto**: Latin-1 (byte `0xD1`=Ñ) leído como UTF-8 → **U+FFFD** ("BA�ADOS DE CARRASCO", "VILLA MU�OZ"). La ñ es **irrecuperable** de ese archivo. Además usa nombres MAYÚSCULA divergentes que NO matchean la mapping.
- **Fix:** re-emitir la geometría desde `v_sig_barrios.json` (limpio, nombres = mapping). geoId = `BARRIO`. Esto arregla los tooltips corruptos Y alinea nombres para un join limpio.

### Reconciliación = losslessness (no hay total oficial externo)
- El CSV solo tiene `ESCRUTINIO='Departamental'` (= **322.329** votos, Mvd internas-2024). **No existe** una fila/escrutinio "total oficial" independiente.
- Por lo tanto "reconcilia con total oficial (delta 0)" se implementa **honestamente como losslessness del pipeline**: `sum-in (CNT_VOTOS canónicos) == sum-out (colocados-en-barrio + bucket `unmapped` + no-partidarios)`. **Nada se descarta con `continue`.** Esto prueba que el ETL no pierde ni duplica votos. Documentarlo así, sin afirmar validación externa (eso sería el "dato mentiroso" que la story previene).

### Cobertura: DOS métricas, umbrales fijados ANTES de ver los números finales
- **Placement ponderado por votos** (`votos colocados en barrio real / total canónico`): honestidad del mapa. Umbral propuesto: **≥ 95.0%** (la mapping cubre 95.6% de circuitos; ponderar por votos puede subir).
- **Barrio-fill** (`barrios con votos / barrios de la geometría`): zonas no-vacías. **48/62 ≈ 77%** — 14 barrios reales de v_sig (Manga, Sayago, Malvín, Parque Rodó…) NO tienen circuito en la mapping → aparecerían vacíos aunque tengan votantes. Es **incompletitud upstream de la mapping**, no bug del ETL. Umbral propuesto: **≥ 75%** y **siempre reportar la lista de barrios vacíos**.
- ⚠️ Si los números reales no llegan al umbral, **el gate falla — es el resultado correcto a reportar. NO bajar el umbral para ponerlo verde.**

## Tasks / Subtasks

- [x] **Task 1: Re-emitir geometría limpia desde v_sig_barrios (corrige 1.5) (AC: 2)**
  - [x] `etl/geometry/build-topojson.ts`: parametrizar el `objectName`/propiedad de nombre. Nuevo entrypoint `etl/run-geometry-montevideo.ts` (o ajustarlo) para usar `public/v_sig_barrios.json`, geoId = propiedad `BARRIO`. Conservar gate de tamaño + round-trip.
  - [x] Verificar: TopoJSON resultante con 62 barrios, nombres con ñ correctas (sin U+FFFD), gate de tamaño PASA, round-trip 62/62.
  - [x] Sobrescribir `public/data/geo/montevideo/zona.topo.json` con la versión limpia.
- [x] **Task 2: Re-agregar votos por CIRCUITO→BARRIO (corrige 1.4) (AC: 1)**
  - [x] `etl/transform/aggregate-votes.ts` (o nuevo `aggregate-by-circuito.ts`): agregar por CIRCUITO, resolver barrio vía `crvToBarrio`. geoId = `BARRIO`. Mantener no-partidarios (en blanco/anulado/observado) por barrio.
  - [x] **Losslessness:** todo voto canónico va a un barrio **o** a un bucket explícito `unmapped` (circuito sin barrio en la mapping). Nada se descarta silenciosamente. Devolver `unmappedVotos` en el resultado para el gate de reconciliación.
  - [x] Regenerar `public/data/internas-2024/montevideo/votes.json` con geoId=BARRIO.
- [x] **Task 3: Gate de reconciliación (losslessness) (AC: 1, 3)**
  - [x] `etl/gates/reconcile.ts`: `sum-in (CNT_VOTOS canónicos del CSV) == sum-out (Σ porOpcion + Σ noPartidarios + unmapped)`. Delta ≠ 0 → throw (exit≠0). Reportar sum-in, sum-out, delta.
  - [x] Test: caso feliz (delta 0) y caso de fallo (forzar pérdida → delta≠0 lanza).
- [x] **Task 4: Gate de cobertura (AC: 2, 3)**
  - [x] `etl/gates/coverage.ts`: cruzar geoIds del shard contra los barrios de la geometría (normalizado). Calcular **placement ponderado por votos** y **barrio-fill**. Falla (throw, exit≠0) si cualquiera < su umbral. Reporte: % de cada métrica + lista de barrios de geometría SIN votos + geoIds del shard SIN match.
  - [x] Umbrales como constantes nombradas (placement ≥ 0.95, barrio-fill ≥ 0.75). Test con fixtures: pasa sobre datos reales, falla si se quita cobertura.
- [x] **Task 5: Cablear gates al pipeline (AC: 3)**
  - [x] El entrypoint del ETL Montevideo corre Task2 → Task1 → reconcile → coverage en orden; cualquier gate que falle aborta con exit≠0 y mensaje claro.
  - [x] Verificar end-to-end: ETL corre, ambos gates reportan números reales y PASAN (o, si no, reportar honestamente el número y el faltante).
- [x] **Task 6: Verificación (AC: 1-3)**
  - [x] `astro check` 0 errores · ETL completo corre · reconcile delta=0 · coverage reporta placement% + barrio-fill% + lista de vacíos · `npm run build` verde.

## Dev Notes

### Decisiones de diseño (del advisor + investigación)
- **Reconciliación fuerza contabilidad, no permite descartar.** Cada voto canónico → barrio o bucket `unmapped`. Las dos gates se entrelazan: reconcile prueba que nada se perdió; coverage mide cuánto es ubicable en geometría.
- **Bridge label→geometría = match normalizado determinístico, NO fuzzy.** Verificado: 48/48 exacto con `normName` (NFD+upper+`.,`→espacio). NO introducir similitud difusa (riesgo: votos en barrio equivocado).
- **No re-emitir alrededor de corrupción:** la fuente limpia (`v_sig_barrios.json`) existe; usarla en vez de aliasear nombres corruptos de `montevideo_map.json`.

### Normalización
- Reusar/extender `etl/lib/normalize.ts` (`normName`). El match label↔BARRIO necesita tratar `.` y `,` como separadores ("Mercado Modelo, Bolívar" ↔ "MERCADO MODELO BOLIVAR"). Confirmar que `normName` lo cubre o extenderlo (con test).

### Estructura de archivos
- Geometría compartida por depto: `public/data/geo/montevideo/zona.topo.json` (sobrescribir).
- Shard por elección: `public/data/internas-2024/montevideo/votes.json` (regenerar, geoId=BARRIO).
- Gates en `etl/gates/` (junto a `geometry-size.ts` de 1.5).

### Aprendizajes 1.1-1.5
- TS strict + `import type` + `verbatimModuleSyntax`. Ejecutar ETL vía esbuild bundle + node. `@types/node` instalado.
- 🚧 LFS acotado (1.5): `votes.json` y `zona.topo.json` = TEXTO; geometría fuente grande = LFS. `v_sig_barrios.json` (2MB) — confirmar su estado LFS; si entra al repo como fuente, va a LFS (es grande), pero el topo emitido sigue texto.
- Contrato `VotosShard`/`AgregadoZona` (1.2): `assertVotosShard` valida ganador=max. geoId ahora = BARRIO.

### Testing
- Tests unitarios de ambos gates (caso feliz + caso de fallo). Ejecución real del ETL con números reportados. `astro check` 0. `npm run build` verde.

### References
- [epics.md#Story 1.6] · [architecture.md#Data Architecture] · memoria `montevideo-barrio-join` · [1-3 spike] (38% naive) · [1-4] (agregación ZONA a corregir) · [1-5] (geometría corrupta a corregir) · [1-2 contract] (`VotosShard`).

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

### Change Log

---

## Dev Agent Record (resultado)
**Agent:** Amelia — claude-opus-4-8[1m]

### Completion Notes
- **Join corregido (1.4):** votos ahora se agregan por **CIRCUITO→BARRIO** vía `crvToBarrio`, geoId=`BARRIO`. Se reemplazó `aggregate-votes.ts` (ZONA, 38%) por `aggregate-by-circuito.ts`.
- **Geometría corregida (1.5):** re-emitida desde `public/v_sig_barrios.json` (limpia) en vez de `montevideo_map.json` (corrupto U+FFFD). `build-topojson.ts` canonicaliza la prop de nombre→`name` y descarta el resto (payload mínimo). Round-trip **62/62**, **7 con ñ, 0 corruptos**.
- **Payload:** sweep de simplify → `simplifyQuantile=0.15` ⇒ **193.8 KB raw / 69.8 KB gz** (≤500 gz PASA). (q más bajo = más chico en topojson-simplify; 0.15 conserva forma de barrios.)
- **Reconciliación (losslessness):** sum-in=sum-out=**322.329**, delta=**0**. Bucket `unmapped`=15.561 votos (112 circuitos sin barrio) contabilizado, no descartado.
- **Cobertura:** placement **95.2%** (≥95 ✅) · barrio-fill **48/62=77.4%** (≥75 ✅). 14 barrios sin votos reportados (incompletitud de la mapping CRV→barrio, no bug del ETL — Manga, Sayago, Malvín, Parque Rodó, etc.).
- **Honestidad (advisor):** no hay total oficial externo → "reconciliación" documentada como losslessness del pipeline. Bridge label↔geometría = match normalizado determinístico (48/48), **sin fuzzy matching**. Umbrales fijados antes de ver los números, no ajustados a verde.
- **LFS:** `v_sig_barrios.json` (2MB, geometría fuente) agregado a `.gitattributes` y renormalizado (consistente con política 1.5). El topo emitido (69.8KB) y el shard (38KB) siguen TEXTO. La build de Vercel sirve el topo pre-emitido (no corre el ETL) → LFS de la fuente no rompe el deploy.
- **Verificación:** `astro check` 0/0/0 · gates self-test (feliz + fallo de cada gate) OK · `npm run build` verde.

### Senior Developer Review (AI)
**2026-05-30 · inline · APPROVED.** AC1 (reconcile delta=0) ✅, AC2 (cobertura + reporte de faltantes) ✅, AC3 (gates lanzan exit≠0) ✅ — verificado con self-test de caso de fallo. Se corrigen defectos reales de 1.4 (join ZONA→CIRCUITO) y 1.5 (geometría corrupta→v_sig limpio), surfaceados explícitamente, no en silencio. Sin findings bloqueantes. Nota de seguimiento (no-bloqueante): la incompletitud de la mapping CRV→barrio (4.4% circuitos / 14 barrios vacíos) es deuda de datos upstream a documentar para futuros deptos; el gate la expone correctamente.

### File List
**Nuevos:** `etl/transform/aggregate-by-circuito.ts` · `etl/gates/reconcile.ts` · `etl/gates/coverage.ts` · `etl/gates/gates.selftest.ts` · `etl/run-montevideo.ts`
**Modificados:** `etl/geometry/build-topojson.ts` (nameProp + canonicalización) · `.gitattributes` (v_sig→LFS) · `public/data/geo/montevideo/zona.topo.json` (re-emitido limpio) · `public/data/internas-2024/montevideo/votes.json` (geoId=BARRIO)
**Eliminados (superseded):** `etl/run-geometry-montevideo.ts` (1.5) · `etl/run-montevideo-internas.ts` (1.4) · `etl/transform/aggregate-votes.ts` (agregación ZONA)

### Change Log
- Corrige join de 1.4 (ZONA→CIRCUITO) y geometría de 1.5 (montevideo_map.json corrupto → v_sig_barrios.json limpio).
- Agrega gates de integridad (reconciliación losslessness + cobertura doble-métrica) cableados al pipeline con exit≠0.
