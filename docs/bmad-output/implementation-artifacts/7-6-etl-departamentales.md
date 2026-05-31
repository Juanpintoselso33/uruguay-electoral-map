---
baseline_commit: c35f404386d10e5306aca3eab5a99cc5bf7c38fd
---

# Story 7.6: ETL + ingesta para elecciones departamentales (interior)

Status: done

## Story

As a usuario,
I want explorar los resultados de las elecciones departamentales 2025 en todos los departamentos del interior,
so that vea cómo votó cada zona a nivel local (intendente, junta, municipio).

## Acceptance Criteria

1. **Given** los datos de la Corte Electoral para departamentales-2025 **When** corro el ETL **Then** produce shards válidos para los 18 departamentos del interior con las 3 contiendas (intendente/junta/municipio) **And** los gates de cobertura y reconciliación pasan **And** las rutas SSG `/departamentales-2025/{depto}` se generan para los 18 depts interiores.

## Tasks / Subtasks

- [x] **T1** — Crear `etl/run-departamentales-2025-interior.ts`
  - [x] T1.1 — Leer desglose CSV (UPPERCASE: TIPO_REGISTRO, DEPARTAMENTO, CRV, SERIES, LEMA, etc.) + integración full.csv
  - [x] T1.2 — Adaptar patrón MVD: geoId = SERIES (lowercase, floor+remainder para multi-serie) en vez de CRV→barrio
  - [x] T1.3 — Mismas 3 contiendas (intendente/junta/municipio), misma lógica de linaje desde integración
  - [x] T1.4 — Excluir series exteriores (XZZ) por dept — mismos códigos que nacionales-2024
  - [x] T1.5 — Gates: cobertura join (0 placeholders) + reconciliación contra re-suma cruda
  - [x] T1.6 — Salida: `public/data/departamentales-2025/{dept}/catalogo.json`, `votes.json`, `opciones.json`, `hoja/{contienda}/{lema}.json`

- [x] **T2** — Actualizar `src/config/departments.json`
  - [x] T2.1 — Agregar `"departamentales-2025"` a los 18 depts del interior

- [x] **T3** — Agregar script npm `etl:departamentales-2025-interior`

- [x] **T4** — Verificar `astro check` 0 errores; `gate:escaleras` pasa (tipo `departamentales` ya en ESCALERAS)

- [x] **T5** — Extender `tieneCatalogoHoja` a todos los depts para `departamentales-2025`
  - [x] T5.1 — Cambiar `esDepartamentalMontevideo` a `esDepartamentales2025 = eleccion === 'departamentales-2025'`

## Dev Notes

### CSV departamentales-2025
Fuente: `data/raw/electoral/departamentales-2025/desglose-de-votos.csv` (444.370 filas)
Columnas UPPERCASE: `TIPO_REGISTRO, DEPARTAMENTO, CRV, SERIES, LEMA, DESCRIPCION_1, DESCRIPCION_2, CANTIDAD_VOTOS`
Tipos de registro: `HOJA_ED` (intendente + junta), `VOTO_LEMA_ED`, `HOJA_EM` (municipio), `VOTO_LEMA_EM`

Diferencia clave vs nacionales-2024: columnas UPPERCASE (como internas-2024); mismo formato que `aggregateBySerie`.

### Integración departamentales-2025
Fuente: `data/raw/electoral/departamentales-2025/integracion-de-hojas-full.csv` (del XLSX, ver memoria integracion-csv-truncado-usar-xlsx)
Columnas: `Numero, Departamento, PartidoPolitico, Agrupacion, Candidatura, SistemaSuplentes, Sublema, Nombre, CredencialSerie, CredencialNumero, Sexo, Ordinal, TitularSuplente, Municipio`
Candidatura ∈ {INTENDENTE, JUNTA DEPARTAMENTAL, MUNICIPIO} — todos los 18 depts tienen los 3 tipos.

### Series exteriores (mismos que nacionales-2024)
AR→IZZ, CL→GZZ, CO→NZZ, DU→RZZ, FD→QZZ, FS→PZZ, LA→SZZ, PA→KZZ, RN→LZZ, RO→EZZ, RV→HZZ, SA→JZZ, SJ→OZZ, SO→MZZ, TA→TZZ, TT→FZZ
CA y MA no tienen filas ZZ en el desglose (sin votantes en el exterior).

### Patrón de implementación
Adaptar `run-departamentales-mvd.ts`:
- Reemplazar `barrioDe(crv)` por `seriesDe(seriesRaw)` → array con floor+remainder
- `normName(barrio)` → geoId = series.toLowerCase() (ya normalizado)
- `parseCsv(DESG).filter(r => r.DEPARTAMENTO === DEP)` → loop por dept

La reconciliación "contra re-suma cruda" es idéntica; solo cambia la fuente del geoId.

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

- **18/18 depts pasaron**: todos los gates de cobertura (0 placeholders) y reconciliación (enrutado == crudo) pasaron verde.
- **64 catálogos** en `gate:escaleras` (era 44 antes de nacionales-2024-hoja, subió a 64 con los 18×3 contiendas + dept dept deptmvd ya existente).
- `astro check` 0/0/0.
- `esDepartamentalMontevideo` renombrado a `esDepartamentales2025` — ahora cubre los 19 depts.
- Floor+remainder split idéntico al patrón nacionales-2024-interior garantiza reconciliación exacta.

### File List

- `etl/run-departamentales-2025-interior.ts` (new) — ETL 18 depts, 3 contiendas, gates completos
- `package.json` (modified) — script `etl:departamentales-2025-interior`
- `src/config/departments.json` (modified) — `departamentales-2025` en los 18 depts del interior
- `src/pages/[eleccion]/[departamento].astro` (modified) — `esDepartamentales2025` cubre todos los depts
- `public/data/departamentales-2025/{18 depts}/{catalogo,votes,opciones}.json` (generated)
- `public/data/departamentales-2025/{18 depts}/hoja/{intendente,junta,municipio}/{lema}.json` (generated)

### Change Log

| Date | Change |
|------|--------|
| 2026-05-31 | Story creada — departamentales-2025 interior |
| 2026-05-31 | T1–T5 implementados: ETL 18/18 ✅, departments.json actualizado, tieneCatalogoHoja extendido, gate:escaleras 64 catálogos ✅, astro check 0/0/0 ✅ |
