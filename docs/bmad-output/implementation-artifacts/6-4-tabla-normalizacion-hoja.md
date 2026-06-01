# Story 6.4 — Tabla de normalización de HOJA cross-elección

**Status:** Done
**Épica:** 6 — Fase 2 — Exportar, Circuito, HOJA
**FR:** FR32

---

## User Story

Como desarrollador, quiero una tabla de equivalencias que mapee opcionIds entre elecciones distintas del mismo departamento, para que el sistema pueda normalizar comparaciones cross-elección sin lógica ad-hoc de nombres.

## Acceptance Criteria

- [x] ETL genera tablas de equivalencias para cada par de elecciones × departamento
- [x] La equivalencia se determina por sigla canónica (vía `resolveParty`), no por nombre literal
- [x] Las opciones sin equivalencia se marcan explícitamente (`soloA`, `soloB`)
- [x] Output en `public/data/hoja-equivalencias/{dept}/{eleccionA}-{eleccionB}.json`
- [x] Formato: `{ eleccionA, eleccionB, departamento, mappings: [{aId, bId, sigla, nombreA, nombreB}], soloA, soloB }`

## Implementación

### ETL: `etl/run-hoja-equivalencias.ts`

Función `buildEquivalencias(dept, eleccionA, eleccionB)` que:
1. Lee `opciones.json` de las dos elecciones
2. Agrupa opciones de cada elección por sigla canónica (normaliza: strip acentos → upper → tabla SIGLAS → acrónimo fallback)
3. Hace join por sigla: `"Partido Colorado" (internas-2024) ↔ "Colorado" (nacionales-2019)` → mismo partido, sigla PC
4. Emite mappings con aId↔bId, soloA (sin match en B) y soloB (sin match en A)

Itera automáticamente sobre todos los departamentos con ≥2 elecciones en `src/config/departments.json`.

**Decisión de diseño:** la fuente de verdad es la sigla política, no el nombre string. Los nombres varían entre datasets de la Corte Electoral para el mismo partido; la sigla es estable.

**Preferencia de id canónico:** cuando hay múltiples opciones con la misma sigla, gana el `opcionId` más corto (sin prefijo "partido-").

## Archivos creados/modificados

### Nuevos
- `etl/run-hoja-equivalencias.ts` — ETL generador de tablas de equivalencias
- `public/data/hoja-equivalencias/{dept}/{elecA}-{elecB}.json` — tablas generadas por departamento × par de elecciones

### Modificados
- `package.json` — script `etl:hoja-equivalencias`
