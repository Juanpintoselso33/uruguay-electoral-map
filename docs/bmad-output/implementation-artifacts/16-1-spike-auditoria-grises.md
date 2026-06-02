---
baseline_commit: b6f88d7
---

# Story 16.1: Spike — auditoría de polígonos grises y votos invisibles

Status: done

## Story

As a desarrollador, I want medir y categorizar los polígonos grises (zonas "sin datos") y los votos sin polígono, so that sepamos qué arreglar y qué es esperable.

## Método

Un polígono se pinta gris (`COLOR_SIN_DATOS`) cuando su `name` normalizado NO matchea ningún `geoId` del `votes.json`. `scripts/audit-grises.py` replica el `norm()` de ChoroplethMap (NFD + sin acentos + mayúsculas + `.,`→espacio) y, por elección × depto, computa: (a) grises = geometría sin voto; (b) **votos invisibles** = voto sin polígono (inverso, peor: no se ven ni en gris).

## Hallazgos — TRES causas

### A) Drift temporal de series (la mayoría, mayormente benigno)
La geometría `geo/{depto}/serie.topo.json` está fijada al padrón **~2024** (en 2024 solo 0,2-0,8% grises). En elecciones viejas, muchas de esas series no existían/no votaron → sus polígonos 2024 quedan grises. El gris escala con la antigüedad:

| elección | grises |
|---|---|
| referéndum-LUC-2022 | 4,0% |
| balotaje-2019 | 3,6% |
| nacionales-2014 / internas-2024 | 2,9% |
| nacionales-2024 / departamentales-2025 | 0,8% |
| balotaje/plebiscitos-2024 | 0,2% |

Es **correcto en su mayoría**: esa serie no tuvo votantes en esa elección. Ej. `cpb` (canelones), `ddc`/`dcg` (maldonado): grises en 2019, con voto en 2024 → series nuevas.

### B) Geometría mergeada (bug estructural — 1 caso)
`sia-sib-sic` (lavalleja): la geometría combina 3 series en UN polígono. Nunca matchea las series individuales del voto (`sia`,`sib`,`sic`) → gris permanente, Y deja `sia`/`sib` sin polígono (votos invisibles).

### C) Votos invisibles (inverso — MÁS GRAVE)
Zonas con voto pero SIN polígono. Despreciable en casi todas (~0,06-0,09%, ~1,4k votos), PERO:

| elección | zonas invisibles | votos | % |
|---|---|---|---|
| **departamentales-2025** | **143** | **11.331** | **0,55%** |
| **departamentales-2020** | **136** | **10.904** | **0,53%** |
| resto | 10-25 | ~1,4k | ~0,07% |

Causa: las departamentales traen **series especiales** (`q1`,`q2`,`q3`… en florida, p.ej.) que no existen en la geometría de series. ~140 zonas × ~11k votos no se visualizan.

## Investigación profunda de B y C (pedido de Juan 2026-06-02)

### C — los ~11k votos invisibles de departamentales son SERIES FICTICIAS (observados/especiales)
Las invisibles de departamentales-2025 se parten en:
- **127 series "especiales" (letra+número: `c1`,`d1`,`n1`,`j1`,`t20`…) = 10.184 votos.** Verificado: (1) NO están en `serie-localidad.json` (sin localidad), (2) NO existen en nacionales-2024 (0/32 canelones, 0/13 colonia), (3) patrón administrativo: 1 letra = depto + número, una tanda por depto. → Son **series no-geográficas exclusivas de las departamentales** (votos observados / comisiones especiales / voto en otra seccional). **No tienen polígono porque no son un lugar.**
- **16 series normales (3 letras: `qee`,`sia`,`sib`,`cld`…) = 1.147 votos.** Series reales con geometría faltante o mergeada (overlap con B).

**Tratamiento (16.2):** NO inventar geometría a las especiales; reconocerlas como categoría "observados/sin ubicación" y mostrarlas en el total/leyenda (sin pérdida silenciosa). Las 16 normales sí son hueco de geometría real.

### B — `sia-sib-sic` es AGREGABLE (no hay que split)
`sia` (271v) y `sib` (80v) son reales y **ambas en la localidad "Zapicán"**; `sic` no tiene votos. La geometría tiene UN polígono `sia-sib-sic` (las 3 áreas unidas). → Fix: **sumar los votos de sia+sib+sic al polígono mergeado** (mismo lugar). Regla general en el ETL: un polígono con label `a-b-c` recibe la suma de sus series constituyentes.

## Conclusión / qué arreglar
- **A (drift temporal):** esperable (serie sin votantes esa elección); decisión de UX en 16.4.
- **B (mergeado `sia-sib-sic`):** 16.3 — agregar votos de las series constituyentes al polígono mergeado.
- **C (departamentales):** 16.2 — las ~127 especiales son observados/no-geográficas → categoría aparte (no perderlas); las 16 normales = hueco de geometría real.

## Change Log
- 2026-06-02 — Auditoría con `scripts/audit-grises.py`: 3 causas cuantificadas (drift temporal, geometría mergeada, votos invisibles). Departamentales = el hueco grande (~11k votos). Status → done.
