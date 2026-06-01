# Deferred Work

## Deferred from: Epic 11 / Story 11.5 — auditoría nivel barrio interior (2026-06-01)

- **Nivel barrio de capitales — EFECTIVAMENTE COMPLETO (verificado 2026-06-01, no es deuda).** Por el criterio `ciudad-grande` (capital lumpeada en ≥3 series): 8 capitales tienen barrio manual (8.5); el resto de capitales (Maldonado, **Minas**, **Mercedes**, Colonia, Canelones, Tacuarembó, Rocha, Florida, Flores, Río Negro) mapean limpio a localidad 1:1 → auto-hechas vía plan circuital, no necesitan barrio. Las únicas `ciudad-grande` sin barrio son Polanco (0.5% del depto) y José Enrique Rodó (3.4%) — pueblitos, NO capitales — excluidos a propósito por 8.5. No hay trabajo de barrio pendiente que valga la pena. (Nota separada, NO barrio: Mercedes aparece con 1 serie y Minas con 2 en el mapping de localidad — posible sub-atribución de series de la capital; revisar si interesa la calidad del mapping localidad.)


## ✅ Resuelto (2026-06-01) — barrido de deuda diferida verificada

Verificación + fixes aplicados sobre los ítems dudosos. Typecheck (`astro check`) 0 errores,
selftest del contrato 13/13 OK, mapping serie-localidad + geometría de localidades regenerados (18/18 deptos, gates 100%).

- **`toTitleCase` unicode-aware** (de 8-1/8-3) — `etl/build-serie-localidad-mapping.ts`: regex `\p{L}` con flag `u`. Mapping y `localidad.topo.json` regenerados → "Garzón", "Piriápolis" correctos (0 nombres mangleados restantes).
- **`catch {}` traga errores de topología** (de 8-2) — `etl/build-localidad-topojson.ts`: re-throw selectivo; solo el overrun `[geometry-size]` continúa, el resto se relanza con contexto y `cause`.
- **`serieProp` solo del primer feature** (de 8-2) — `etl/build-localidad-topojson.ts`: scan multi-feature hasta encontrar props con clave `serie`.
- **`opcionesNacionales` no testeado** (de 7-1) — `src/lib/contracts/__fixtures__/validate.ts`: importado + 3 aserciones de guard (es hoja, no candidato, no binaria).
- **`ganadorOpcionId` empate → FA** (de 7-2) — `etl/transform/aggregate-balotaje-by-serie.ts`: convención documentada en comentario (la nota original apuntaba por error a `run-balotaje-interior.ts`).
- **`OpcionSelector` sin rama plebiscito** (de 7-2) — `OpcionSelector.vue`: rama `'Opción (Sí / No)'` para plebiscito/referéndum.
- **`resolveParty('Sí'/'No')` output inválido** (de 7-2) — ya resuelto en `party-meta.ts` (Sí verde / No gris); verificado, sin acción.
- **`OpcionBinaria` sin mapeo a `nombre`** (de 7-2) — resuelto en runtime (los `opciones.json` de plebiscito traen `nombre`, `resolveParty` lo resuelve); verificado, sin acción.

---

## Deferred from: code review de story 7-1-data-contract-v2-tipos-eleccion (2026-05-31)

- **validate.ts no verifica guard de nacionales** — `opcionesNacionales` nunca se importa en el selftest; gap pre-existente, nacionales usa `OpcionHoja` (same as internas so transitive coverage exists, but no independent assertion).

## Deferred from: code review de story 7-2-etl-balotaje-2024 (2026-05-31)

- **Script `etl:balotaje-colo` nombre ambiguo** — el script apunta a `run-balotaje-interior.ts` (función genérica), no a un archivo Colonia-específico. Renombrar a `etl:balotaje-interior` cuando se agreguen más departamentos.
- **Filtro exterior asimétrico MVD vs interior** — `run-balotaje-mvd.ts` usa `r['Serie'] !== 'BZZ'` (exact match); `run-balotaje-interior.ts` usa `.toUpperCase().endsWith('ZZ')`. Normalizar a un patrón único en futura Story ETL.
- **`nivel` hardcodeado en `runBalotajeInteriorDept`** — `nivel: 'serie'` fijo impide usar la función para un depto interior con nivel diferente. Agregar `nivel` a `BalotajeInteriorConfig` cuando surja el caso.
- **CSV re-parseado completo en cada invocación** — `parseCsv(CSV)` carga el CSV nacional (267KB) en cada llamada a `runBalotajeInteriorDept`. Patrón pre-existente de todos los ETL de internas; optimizar cuando se procesen 19 deptos en serie.
- **`ganadorOpcionId` en empate → frente-amplio** — `acc.orsi >= acc.coa` da ganador FA en empate exacto. Los empates son prácticamente imposibles a nivel de serie/barrio nacional; documentar la convención en Story 7.5 (UI).
- **OpcionBinaria no tiene campo `nombre`** — el contrato no define cómo mapear `etiqueta: 'si'|'no'` al campo `nombre` que espera `opciones.json`. La resolución pertenece al ETL de plebiscito (Story 7.3).
- **resolveParty('Sí'/'No') producirá output inválido** — `SIGLAS` en `party-meta.ts` no tiene entradas para opciones binarias; colores y siglas se romperán al cargar data de plebiscito. Resolver en Story 7.3 o 7.5.
- **OpcionSelector.labelSelector sin rama para 'plebiscito'** — cae al genérico 'Opción', funcionalmente correcto pero semánticamente pobre. Resolver en Story 7.5.
- **departamentales no tiene fixture en el selftest** — brecha pre-existente; si se agrega lógica tipo-específica a los validators habrá cobertura ciega para este tipo.

## Deferred from: code review de story 8-1-research-tabla-serie-localidad (2026-05-31)

- **`toTitleCase` falla con nombres que inician con Ñ** — `\w` en JS es `[a-zA-Z0-9_]`; `ñ` es `\W` → capitalización incorrecta. No hay localidades uruguayas actuales afectadas; revisar si el dataset cambia.
- **Output path relativo sin CWD guard** — `public/data/mappings/...` y `data/raw/...` son relativos; si se invoca desde otro directorio escribe en lugar incorrecto. Mismo patrón en todos los ETL scripts; agregar guard `process.chdir()` a nivel de toolkit.
- **`npx tsx` vs tsx local** — usar `tsx` desde `node_modules/.bin/tsx` garantiza la versión del lockfile. Migrar cuando se añada `tsx` a devDependencies explícitamente.
- **Coverage check incluye todos los `TIPO_REGISTRO`, no solo `HOJA_*`** — actualmente los sets de series coinciden; si una elección futura introduce `PREC_ODN` con series sin `HOJA_*` correspondiente, el gate podría dispararse falsamente.
- **Sin assertion de count exacto de 18 archivos** — el script no verifica que se produzcan exactamente 18 outputs; un error en `DEPT_CODE_TO_NAME` podría producir 17 o 19 silenciosamente.

## Deferred from: code review de story 8-2-geometria-localidades-interior (2026-05-31)

- **`catch {}` genérico traga errores de topología** — el try/catch en el loop de simplificación absorbe todo, no solo budget overruns. Un error de geometría corrupta se misatribuye como "no cumple budget". Agregar re-throw selectivo cuando se disponga de una clase de error específica en `assertGeometryBudget`.
- **`serieProp` detectado solo del primer feature** — si el primer feature tiene `properties: null` o casing diferente, `serieProp` cae a `'serie'` y todos los features fallan en silencio. Igual patrón que otros ETL; agregar fallback multi-feature scan al toolkit.
- **FeatureCollection vacía (all ciudad-grande) escrita como artefacto sin failCount** — si todos los departamentos tienen solo series ciudad-grande, el script escribe archivos vacíos y sale con exit 0. Imposible con datos reales de Uruguay; agregar guard explícito cuando se tenga un caso de prueba.
- **Paths relativos sin CWD guard** — mismo patrón que 8-1 y todos los ETL scripts; agregar `process.chdir()` guard a nivel de toolkit.
- **`JSON.parse`/`readFileSync` sin try/catch** — error en un archivo JSON truncado mata todo el loop; mismo patrón pre-existente. Agregar wrapper en toolkit.
- **Object name `'zonas'` en TopoJSON** — el output usa `'zonas'` como nombre del objeto TopoJSON; los consumers (Stories 8.3/8.4) deben usar la misma clave. Documentar la convención en el contrato de datos cuando se escriba Story 8.3.

## Deferred from: code review de story 8-3-etl-join-serie-localidad-geometria (2026-05-31)

- **ciudad-grande sin geometría** — diseño intencional: el mapping es la fuente de verdad; si todos los series tienen localidad asignada los votos van al shard. Geometría ciudad-grande la provee 8.4/8.5. Gate 85% absorbe el gap hasta entonces.
- **"GarzóN Arriba" — entrada 1:1 sin polígono** — serie DEB mapea a "GarzóN Arriba" en el mapping, pero la localidad no tiene polígono en `localidad.topo.json`. 70 votos, placement se mantiene al 99.9%. Data gap aceptable mientras sea tan pequeño; revisar si se actualiza la geometría.
- **Nombres mangleados (GarzóN, PiriáPolis)** — `toTitleCase` en `etl/build-serie-localidad-mapping.ts` usa `\b\w/g` que no respeta caracteres acentuados; las mayúsculas después de vocal acentuada quedan mal (e.g. `GarzóN`). Pre-existente de Story 8.1. Los nombres se ven en la UI. Fix: reemplazar `toTitleCase` con implementación unicode-aware y regenerar el mapping.
- **`runLocalidadStep` asume `opciones.json` previo** — no escribe ni verifica `opciones.json`; si se invoca en aislamiento (antes de `runInteriorDept`) el cliente hará 404. Ordering implícito — documentar en los scripts de run o agregar guard.

## Deferred from: code review de story 8-4-deteccion-degradacion-ciudades-grandes (2026-05-31)

- **AC2 hover path pre-existente** — "pasa el mouse" nunca abre la ficha en este proyecto (diseño de Story 2.4); el hover cambia cursor/tooltip, el click abre el ZoneSheet. El rótulo de degradación solo se ve al hacer click.
- **AC3 gate cobertura sin guard específico** — deliberado: el threshold 85% absorbe el gap; la geometría ciudad-grande la provee Story 8.5. El matching genérico del gate es suficiente cuando el polígono exista en el TopoJSON.
- **`esCiudadGrande` no se setea en pre-selección por URL** — path URL→selectByName no pasa por `ciudadesGrandesSet`. No hay polígonos ciudad-grande aún; verificar cuando Story 8.5 agregue geometrías.
- **Orden de escritura ETL — writeShard antes del sidecar** — ventana de crash entre `writeShard()` y `writeFileSync(META_OUT)`. Riesgo mínimo (build step); `.catch(() => null)` en el cliente maneja el archivo faltante.
- **`SelInfo` duplicada en ChoroplethMap y ZoneSheet** — patrón pre-existente; TypeScript no fuerza sincronización entre copias. Si futuros stories agregan campos, ambas deben actualizarse manualmente.
- **`localidad-meta.json` vacío igual dispara fetch** — intencional por T2.3 (siempre escribir el archivo); guarda `ciudadesGrandesSet.size > 0` previene impacto en UI.
- **Rótulo de degradación inaccesible en estado actual** — scaffolding intencional para Story 8.5; sin polígono ciudad-grande no hay zona clickeable → `selectByName` nunca se llama para esa ciudad.
