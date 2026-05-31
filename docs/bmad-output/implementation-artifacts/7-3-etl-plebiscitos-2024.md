---
baseline_commit: c35f404386d10e5306aca3eab5a99cc5bf7c38fd
---

# Story 7.3: ETL + ingesta para plebiscitos 2024

Status: done

## Story

As a usuario,
I want explorar los plebiscitos de 2024 (allanamientos nocturnos, reforma de seguridad social) en el mapa,
so that vea la distribución territorial del Sí/No.

## Acceptance Criteria (resumen del epics.md)

1. ETL `tipo=plebiscito` produce shards con opción binaria Sí/No + categorías; el manifest/opciones incluye la pregunta.
2. Rutas SSG `/plebiscito-{...}-2024/{depto}` se generan.
3. Gates de integridad pasan.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code)

### Decisión de dominio (research, no inventada)

En 2024 hubo **dos** plebiscitos constitucionales (mismo sobre que las nacionales del 27-oct):
- **Art. 11 → allanamientos nocturnos** (columna `SiArt11`).
- **Art. 67 → reforma de la seguridad social** (columna `SiArt67`).

**No hay papeleta "No"**: se vota Sí poniendo la papeleta; no ponerla = No (confirmado vía Corte Electoral + prensa). Por lo tanto **No = válidos − Sí** (implícito). Denominador = `TotalVotosNoObservados`.

### Completion Notes List

- **`etl/run-plebiscitos-2024-mvd.ts` (nuevo):** lee `nacionales-2024/totales-generales-plebiscitos.csv` (MO), join CRV→BARRIO (mapping existente). Por cada plebiscito emite `votes.json` (porOpcion = [{si},{no}], ganador=max, `tipo:'plebiscito'`) + `opciones.json` ({pregunta, opciones Sí/No}). Gate de **losslessness**: Σ(sí+no) == Σválidos por barrio.
- **Resultado (Montevideo):** allanamientos **35.8% Sí**, seguridad social **41.5% Sí** (coherente con MO progresista: más Sí a la previsional, menos a allanamientos; nacional fue 39.5%/38.7%). 61 barrios cada uno, losslessness ✅.
- **UI/wiring:** `resolveParty` maneja Sí (verde `#16a34a`) / No (gris `#94a3b8`); `departments.json` y `ELECCION_LABELS` suman los dos plebiscitos a Montevideo → rutas SSG generadas.
- **Verificado en browser:** `/plebiscito-seguridad-social-2024/montevideo` renderiza 61 barrios coloreados Sí/No con sigla por zona; `astro check` 0/0/0.
- **Alcance / follow-ups:** Montevideo (los demás deptos = re-corrida cuando tengan barrio/serie + el dato por depto). El pulido de UI por-tipo (ficha que muestra la pregunta, leyenda Sí/No, índice de búsqueda sin marcar Sí/No como "partido") es **Story 7.5**. Esto además provee el dato para la variante plana de **Story 10.10**.

### File List

- `etl/run-plebiscitos-2024-mvd.ts` (new)
- `package.json` (modified) — script `etl:plebiscitos-mvd`
- `src/lib/party-meta.ts` (modified) — colores/sigla Sí/No
- `src/config/departments.json` (modified) — 2 plebiscitos en Montevideo
- `src/pages/[eleccion]/[departamento].astro` (modified) — labels
- `public/data/plebiscito-{allanamientos,seguridad-social}-2024/montevideo/{votes,opciones}.json` (new, generados)

### Change Log

- 2026-05-31 — ETL plebiscitos 2024 MO (allanamientos + seguridad social), Sí/No con No implícito, losslessness ✅. Verificado en browser. Status → done.
