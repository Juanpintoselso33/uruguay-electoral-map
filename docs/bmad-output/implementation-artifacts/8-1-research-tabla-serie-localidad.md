---
baseline_commit: c35f404386d10e5306aca3eab5a99cc5bf7c38fd
---

# Story 8.1: Research + tabla SERIE→localidad del plan circuital

Status: done

## Story

As a desarrollador,
I want una tabla explícita que mapee cada SERIE electoral del interior a su localidad correspondiente,
so that el ETL pueda asignar geometría de localidad a los votos sin fuzzy-match.

## Acceptance Criteria

1. **Given** el plan circuital `data/raw/electoral/plan-circuital.csv` **When** ejecuto el script de build de mapping **Then** existe un archivo `public/data/mappings/{depto}/serie-localidad.json` para cada departamento del interior (18 deptos, excluye Montevideo) con la estructura `{ serie: string, localidad: string, tipo: "1:1" | "ciudad-grande" }[]`.
2. **Given** la tabla generada **When** comparo con las series del `desglose-de-votos.csv` de internas-2024 **Then** la cobertura es ≥95% de las series presentes en cada departamento (las series del exterior como "HZZ" se excluyen explícitamente y no cuentan como no-cubiertas).
3. **Given** una serie donde TODOS los circuitos apuntan a la misma localidad **Then** `tipo = "1:1"` y `localidad` es el nombre de esa localidad.
4. **Given** una serie donde múltiples circuitos apuntan a localidades distintas **When** la localidad dominante (por cantidad de circuitos) cubre ≥80% **Then** `tipo = "1:1"` con la localidad dominante.
5. **Given** una serie donde múltiples circuitos apuntan a una misma localidad pero esa localidad es la capital departamental (o ciudad grande) que aparece en ≥3 series distintas **Then** `tipo = "ciudad-grande"` — estas series serán tratadas en Story 8.4.
6. **Given** el archivo generado **When** lo importo en TypeScript **Then** compila con el tipo `SerieLocalidadEntry[]` definido en `etl/lib/serie-localidad.ts`.

## Tasks / Subtasks

- [x] **T1** — Crear `etl/build-serie-localidad-mapping.ts` (AC: 1, 2, 3, 4, 5)
  - [x] T1.1 — Parsear `data/raw/electoral/plan-circuital.csv` con `parseCsv` existente
  - [x] T1.2 — Agrupar por `(Departamento, Serie)` → set de localidades con conteo de circuitos
  - [x] T1.3 — Para cada serie: asignar localidad dominante (la más común); T1.4 decide ciudad-grande
  - [x] T1.4 — Detectar "ciudad-grande": si una localidad aparece en ≥3 series del mismo depto → todo ese grupo es `ciudad-grande`
  - [x] T1.5 — Excluir series de exterior (código termina en "ZZ"); activos vs internas-2024 con split de SERIES compuestos
  - [x] T1.6 — Escribir un archivo por depto: `public/data/mappings/{deptName}/serie-localidad.json`

- [x] **T2** — Definir tipo TypeScript `SerieLocalidadEntry` (AC: 6)
  - [x] T2.1 — Crear `etl/lib/serie-localidad.ts` con la interfaz exportada
  - [x] T2.2 — El script importa y usa `satisfies SerieLocalidadEntry[]` al serializar

- [x] **T3** — Validar cobertura (AC: 2)
  - [x] T3.1 — Al terminar, imprimir resumen: series cubiertas / total por depto
  - [x] T3.2 — Fallar con exit≠0 si algún depto cubre <95% de sus series activas

- [x] **T4** — Agregar script npm (AC: 1)
  - [x] T4.1 — Agregar `"etl:serie-localidad": "npx tsx etl/build-serie-localidad-mapping.ts"` al `package.json`

### Review Findings

- [x] [Review][Patch] FD y FS invertidos en DEPT_CODE_TO_NAME — FD=florida, FS=flores per plan-circuital, internas-2024 y run-*.ts [etl/build-serie-localidad-mapping.ts:27-28]
- [x] [Review][Patch] Coverage default 100% cuando active.size === 0 — silencia fallos de ingestión del CSV activo [etl/build-serie-localidad-mapping.ts:148]
- [x] [Review][Patch] Depto sin filas en plan-circuital no incrementa failCount — coverage gate se salta silenciosamente [etl/build-serie-localidad-mapping.ts:101-104]
- [x] [Review][Defer] toTitleCase falla con nombres que inician con Ñ — no hay localidades actuales afectadas — deferred, pre-existing
- [x] [Review][Defer] Output path relativo sin CWD guard — mismo patrón en todos los ETL scripts del proyecto — deferred, pre-existing
- [x] [Review][Defer] npx tsx vs tsx local en package.json — patrón aceptado en el proyecto — deferred, pre-existing
- [x] [Review][Defer] Coverage check incluye todos los TIPO_REGISTRO, no solo HOJA_* — actualmente inocuo — deferred, pre-existing
- [x] [Review][Defer] Sin assertion que se produzcan exactamente 18 archivos — nice-to-have defensivo — deferred, pre-existing

## Dev Notes

### Contexto crítico

El plan circuital en `data/raw/electoral/plan-circuital.csv` tiene columnas:
```
Departamento,NroCircuito,Serie,Desde,Hasta,Localidad,Local ,Accesibilidad,TipoCircuito
```

Para departamentos del interior, cada fila es un circuito con su serie y localidad. Una SERIE puede abarcar varios circuitos que pueden repartirse entre localidades distintas.

**Ejemplo real de Artigas (AR):**
- `AR,IAA` → aparece con localidades COLONIA PINTADO, ESTIVA, GUAYUBIRA, PINTADO GRANDE (circuitos dispersos por zona rural; localidad dominante toma el nombre)
- `AR,IAC` → solo "ARTIGAS" (capital)
- `AR,IAD`, `AR,IAE`, `AR,IAF`, `AR,IAG` → todos "ARTIGAS" (capital → ciudad-grande, ≥3 series)

**Regla de detección ciudad-grande:** si la misma localidad aparece en ≥3 series distintas del mismo departamento, todas esas series son `ciudad-grande`. Esta es la señal de que es una capital o ciudad importante donde el plan circuital subdivide la ciudad en series múltiples.

### Códigos de departamento (Departamento en CSV → deptName en paths)

| CSV | deptName |
|-----|----------|
| AR  | artigas |
| CA  | canelones |
| CL  | cerro_largo |
| CO  | colonia |
| DU  | durazno |
| FD  | flores |
| FL  | florida |
| LA  | lavalleja |
| MA  | maldonado |
| MO  | *(excluir — es Montevideo)* |
| PA  | paysandu |
| RN  | rio_negro |
| RV  | rivera |
| RO  | rocha |
| SA  | salto |
| SJ  | san_jose |
| SO  | soriano |
| TA  | tacuarembo |
| TT  | treinta_y_tres |

### Series de exterior a excluir

Cada departamento tiene una serie "exterior" (ciudadanos en el extranjero). Patrón: terminan en "ZZ" (ej. "HZZ" para artigas). Ver cada `runInteriorDept` en `etl/run-*.ts` para el `exteriorSerie` correspondiente a cada depto.

Lista conocida: AR→IZZ, CA→CZZ, CL→EZZ, CO→DZZ, DU→FZZ, FD→GZZ, FL→HZZ, LA→JZZ, MA→DZZ, PA→KZZ, RN→LZZ, RV→MZZ, RO→NZZ, SA→OZZ, SJ→PZZ, SO→QZZ, TA→RZZ, TT→SZZ.

### Patrón de código existente a reutilizar

```typescript
// Reutilizar de etl/extract/parse-csv.ts:
import { parseCsv } from './extract/parse-csv';
const rows = parseCsv('data/raw/electoral/plan-circuital.csv');
// Cada fila: r['Departamento'], r['Serie'], r['Localidad'], r['NroCircuito']
```

### Tipo a crear en `etl/lib/serie-localidad.ts`

```typescript
export interface SerieLocalidadEntry {
  readonly serie: string;       // código de serie, ej. "IAA"
  readonly localidad: string;   // nombre normalizado, ej. "Colonia Pintado"
  readonly tipo: '1:1' | 'ciudad-grande';
}
export type SerieLocalidadMap = SerieLocalidadEntry[];
```

### Normalización de nombres de localidad

Usar `normName` de `etl/lib/normalize.ts` para normalizar antes de comparar, pero escribir el nombre con capitalización original del CSV (Title Case). Evitar escribir todo en mayúsculas al JSON de salida.

### Output esperado (ejemplo artigas)

```json
[
  { "serie": "IAA", "localidad": "Colonia Pintado", "tipo": "1:1" },
  { "serie": "IAC", "localidad": "Artigas", "tipo": "ciudad-grande" },
  { "serie": "IAD", "localidad": "Artigas", "tipo": "ciudad-grande" },
  { "serie": "IAE", "localidad": "Artigas", "tipo": "ciudad-grande" },
  { "serie": "IAF", "localidad": "Artigas", "tipo": "ciudad-grande" },
  { "serie": "IAG", "localidad": "Artigas", "tipo": "ciudad-grande" }
]
```

### Archivos a crear (NEW)

| Archivo | Descripción |
|---------|-------------|
| `etl/build-serie-localidad-mapping.ts` | Script principal |
| `etl/lib/serie-localidad.ts` | Tipo TypeScript exportado |
| `public/data/mappings/{depto}/serie-localidad.json` | 18 archivos, uno por depto |

### Archivos a modificar (UPDATE)

| Archivo | Cambio |
|---------|--------|
| `package.json` | Agregar script `etl:serie-localidad` |

### Referencias

- Plan circuital: `data/raw/electoral/plan-circuital.csv` (7158 filas, ya descargado)
- Parseo CSV existente: `etl/extract/parse-csv.ts`
- Normalización: `etl/lib/normalize.ts` (`normName`, `slug`)
- ETL interior existente: `etl/interior-dept.ts`, `etl/run-artigas.ts` (ver exteriorSerie)
- Serie aggregator: `etl/transform/aggregate-by-serie.ts`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

- Florida usa código `FS` (no `FL`) en plan-circuital.csv e internas-2024 — corregido en DEPT_CODE_TO_NAME.
- El campo SERIES en internas-2024/desglose-de-votos.csv puede ser compuesto (e.g. "GDB GDC"); se hace split por whitespace antes de agregar al active set. Sin este fix, 6 departamentos fallaban el gate de cobertura.
- La detección de ciudad-grande se hace exclusivamente por la regla T1.4 (≥3 series con misma localidad), NO por dominance threshold. Regla T1.3 del spec resultó innecesaria: la localidad dominante se asigna siempre, y ciudad-grande se sobreescribe después.
- 18/18 departamentos con 100% cobertura vs internas-2024. Artigas AR,IAA → `{ serie: "IAA", localidad: "Colonia Pintado", tipo: "1:1" }` coincide con ejemplo del story exactamente.
- `satisfies SerieLocalidadEntry` usado al hacer push en el array de resultado para validación de tipos en compile-time.

### File List

| Archivo | Tipo | Descripción |
|---------|------|-------------|
| `etl/build-serie-localidad-mapping.ts` | NEW | Script ETL principal: parse plan-circuital, build mapping, cobertura gate |
| `etl/lib/serie-localidad.ts` | NEW | Tipo TypeScript `SerieLocalidadEntry` y `SerieLocalidadMap` |
| `package.json` | UPDATE | Agrega script `etl:serie-localidad` |
| `public/data/mappings/artigas/serie-localidad.json` | NEW | Mapping generado (artifact) |
| `public/data/mappings/canelones/serie-localidad.json` | NEW | Mapping generado (artifact) |
| `public/data/mappings/cerro_largo/serie-localidad.json` | NEW | Mapping generado (artifact) |
| `public/data/mappings/colonia/serie-localidad.json` | NEW | Mapping generado (artifact) |
| `public/data/mappings/durazno/serie-localidad.json` | NEW | Mapping generado (artifact) |
| `public/data/mappings/flores/serie-localidad.json` | NEW | Mapping generado (artifact) |
| `public/data/mappings/florida/serie-localidad.json` | NEW | Mapping generado (artifact) |
| `public/data/mappings/lavalleja/serie-localidad.json` | NEW | Mapping generado (artifact) |
| `public/data/mappings/maldonado/serie-localidad.json` | NEW | Mapping generado (artifact) |
| `public/data/mappings/paysandu/serie-localidad.json` | NEW | Mapping generado (artifact) |
| `public/data/mappings/rio_negro/serie-localidad.json` | NEW | Mapping generado (artifact) |
| `public/data/mappings/rivera/serie-localidad.json` | NEW | Mapping generado (artifact) |
| `public/data/mappings/rocha/serie-localidad.json` | NEW | Mapping generado (artifact) |
| `public/data/mappings/salto/serie-localidad.json` | NEW | Mapping generado (artifact) |
| `public/data/mappings/san_jose/serie-localidad.json` | NEW | Mapping generado (artifact) |
| `public/data/mappings/soriano/serie-localidad.json` | NEW | Mapping generado (artifact) |
| `public/data/mappings/tacuarembo/serie-localidad.json` | NEW | Mapping generado (artifact) |
| `public/data/mappings/treinta_y_tres/serie-localidad.json` | NEW | Mapping generado (artifact) |

### Change Log

- **2026-05-31** — Implementación completa por claude-sonnet-4-6. Creados `etl/build-serie-localidad-mapping.ts` y `etl/lib/serie-localidad.ts`. Generados 18 archivos `public/data/mappings/{depto}/serie-localidad.json`. Cobertura 100% en todos los departamentos. Fix clave: Florida usa `FS` no `FL`; SERIES compuestos requieren split. Status → review.
