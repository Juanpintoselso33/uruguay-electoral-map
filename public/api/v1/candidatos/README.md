# API v1 · Recurso candidate-centric (`/api/v1/candidatos/`)

Dimensión **persona ↔ candidatura ↔ votos de lista**, derivada de la *Integración de hojas
de votación* de la Corte Electoral. Read-only, CORS abierto. Generado por
`scripts/build-candidatos.py` (npm `etl:candidatos`) a partir de `public/data/personas/personas.json`.

## Recursos

| Archivo | Qué es |
|---------|--------|
| `index.json` | Índice de búsqueda de **legisladores** (id, nombre, cargos, partidos, elecciones). |
| `legisladores.json` | Legisladores con resultados completos: `candidaturas` + `resultados` (votos de lista por depto/elección). |
| `personas-index.json` | Índice slim de **todas** las personas candidatas (sin resultados), para cobertura/descubrimiento. |

Schemas en [`../schema/`](../schema/) (`candidatos-index.schema.json`, `legisladores.schema.json`).

## Métrica

El voto legislativo en Uruguay es **a la LISTA (hoja)**, no a la persona. Por eso los votos de
un candidato = votos de la(s) hoja(s) que integra, por departamento. **No es voto personal.**

## Cómo se identifica a una persona (matcheo)

El `personaId` y el cruce entre elecciones se construyen así:

### 1. Id duro = credencial cívica
`personaId = "{CredencialSerie}-{CredencialNumero}"`, tomado de la Integración de hojas. La
misma credencial en dos elecciones ⇒ la misma persona. **La Corte recién publica la credencial
desde 2024**, así que el id duro solo existe para:
`internas-2024`, `nacionales-2024`, `departamentales-2025`.

### 2. Puente por nombre (elecciones sin credencial)
`nacionales-2019`, `internas-2019` y `departamentales-2020` traen nómina **sin credencial**.
Tampoco hay cédula en datos abiertos, y la credencial **no es un id estable de por vida** (cambia
con el traslado: la serie corresponde al departamento de residencia). El único puente viable es
por **nombre**, así (`scripts/build-personas-historico.py`):

1. Se indexa `nombre → {credenciales}` desde la era credencial (2024-2025).
2. Normalización del nombre: se quitan tildes, se pasa a MAYÚSCULAS, se elimina la coma y se
   colapsan espacios (`"ORSI MARTINEZ, Yamandú"` → `ORSI MARTINEZ YAMANDU`).
3. Para cada candidato 2019/2020: si su nombre apunta a **una sola** credencial (unívoco) se le
   anexa esa candidatura histórica. Si es **ambiguo** (homónimo: el nombre mapea a >1 credencial)
   o no matchea ninguna credencial, **se descarta**.
4. El puente solo **extiende** personas ya existentes hacia atrás; nunca crea identidades nuevas.

**Confianza — campo `match` en cada `candidatura`:**
- `"credencial"` → identidad por credencial (dura).
- `"nombre"` → linkeada por nombre unívoco (confianza menor).

El nombre es casi-único: la tasa de homónimos medida es **0.15%** del total (**0.01%** entre
legisladores/intendentes). Los homónimos detectados se descartan, no se adivinan.

### 3. Garantía de integridad de los votos
Los votos en `resultados` se calculan **exclusivamente** a partir de candidaturas
`match: "credencial"`. Las candidaturas `match: "nombre"` (2019/2020) aparecen en `candidaturas`
como **historial**, pero **no aportan ningún voto** a `resultados`. Así, los totales publicados
quedan 100% autoritativos y no se mezclan con datos matcheados por nombre.

### Roster autoritativo
La pertenencia al conjunto de **legisladores** se decide solo con cargos de credencial dura: el
puente por nombre enriquece el historial de un legislador ya confirmado, nunca agrega a alguien
al roster.

## Cobertura actual

| Elección | Candidaturas | `match` | Votos en `resultados` |
|----------|:---:|:---:|:---:|
| internas-2024 | ✅ | `credencial` | ✅ |
| nacionales-2024 | ✅ | `credencial` | ✅ |
| departamentales-2025 | ✅ | `credencial` | ✅ |
| nacionales-2019 | ✅ | `nombre` | — (solo historial) |
| internas-2019 | ✅ | `nombre` | — (solo historial) |
| departamentales-2020 | ✅ | `nombre` | — (solo historial) |

## Deuda técnica pendiente

- **2014 — sin roster de candidatos.** La Corte **no publicó** la Integración de hojas (nómina de
  candidatos) de 2014 en datos abiertos: para ese año solo hay plan circuital, totales por
  comisión y desglose de votos (resultados, sin nombres ni hojas por candidato). Por eso **no hay
  candidaturas 2014** en este recurso. Para sumarlas habría que conseguir la fuente por fuera de
  datos abiertos: (a) **pedido de acceso a información pública** a la Corte por la integración 2014,
  o (b) parsear las **proclamaciones oficiales 2014** (PDFs en gub.uy/corte-electoral) — que cubren
  solo a los **electos** (senadores/diputados), no el roster completo. Pendiente.
- **Traslados 2024↔2025:** una persona que hizo traslado entre octubre-2024 y mayo-2025 cambia de
  credencial y podría aparecer como dos personas. Frecuencia despreciable (1 colisión de alto valor
  en 25k), por eso **no** se aplica merge por nombre dentro de la era credencial (haría más daño —
  homónimos — que bien).
- **Fuentes académicas evaluadas y descartadas como crosswalk:** Boreluy (resultados 1918-2019, no
  roster), LALD (solo electos 1984-2019), repo `guillelezama/elecciones_UY` (candidatos solo 2024;
  para años viejos solo resultados por circuito). Ninguna aporta un id estable ni el roster 2014.

## Fuente

Corte Electoral del Uruguay — Integración de hojas de votación, escrutinio definitivo
([catalogodatos.gub.uy](https://catalogodatos.gub.uy/organization/corte-electoral)).
