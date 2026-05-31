---
baseline_commit: c35f404386d10e5306aca3eab5a99cc5bf7c38fd
---

# Story 7.7: Ingesta histórica multi-año + referéndum

Status: done

## Story

As a usuario,
I want explorar las elecciones históricas (2014–2025) y el referéndum,
so that compare el voto a través del tiempo, no solo la última elección.

## Acceptance Criteria (de epics.md)

Ingerir cada instancia con su `eleccionId` y tipo: internas 2019/2024; nacionales 2014/2019/2024; balotaje 2014/2019/2024; **referéndum 2022 (LUC, tipo plebiscito Sí/No)**; plebiscitos 2024; departamentales 2020/2025. Cada una pasa gates, aparece en el selector; 2019 (latin-1) → UTF-8.

## Estado de ingesta (Montevideo)

| Elección | eleccionId | Estado |
|---|---|---|
| Internas 2024 | `internas-2024` | ✅ (19 deptos) |
| Nacionales 2019 | `nacionales-2019` | ✅ (MO, + sublema 10.8) |
| Nacionales 2024 | `nacionales-2024` | ✅ (Story 7.4) |
| Balotaje 2024 | `balotaje-2024` | ✅ |
| Plebiscitos 2024 (×2) | `plebiscito-*-2024` | ✅ (Story 7.3) |
| Departamentales 2025 | `departamentales-2025` | ✅ (Story 10.9, 3 contiendas) |
| **Referéndum LUC 2022** | `referendum-luc-2022` | ✅ **(esta story)** |
| **Balotaje 2014** | `balotaje-2014` | ✅ **(esta story)** — FA (Vázquez) 61.0% MO |
| **Balotaje 2019** | `balotaje-2019` | ✅ **(esta story)** — FA (Martínez) 56.7% MO |
| **Nacionales 2014** | `nacionales-2014` | ✅ **(esta story)** — **HOJA** (lema→hoja degradada, sin integración 2014), 19 deptos; FA ganó 58/61 barrios MO |
| **Internas 2019** | `internas-2019` | ✅ **(esta story)** — **HOJA completa** ODN lema→precandidato→hoja + ODD lema→hoja, 19 deptos (Latin-1); FA 44 / PN 15 / PC 2 barrios |
| **Departamentales 2020** | `departamentales-2020` | ✅ **(esta story)** — **3 contiendas con HOJA** (intendente/junta/municipio), como 2025; FA (Cosse) 48 / PI-coalición (Raffo) 13 |

## Tasks / Subtasks

- [x] **T1** — Referéndum LUC 2022 (tipo plebiscito Sí/No)
  - [x] T1.1 — ETL `run-referendum-2022-mvd.ts`: `Total_SI`/`Total_NO` explícitos por CRV → barrio; válidos = Sí+No; gate NO tautológico = ancla contra el resultado publicado de MO (ganó Sí, ~56.5%) + validación estructural del contrato (assertVotosShard).
  - [x] T1.2 — Catálogo plano (binaria), wiring (departments.json, page label, ruteo flat, banner de pregunta), índice de búsqueda.
- [x] **T2a** — Balotajes históricos 2014 + 2019 (MO): ETL `run-balotaje-historico-mvd.ts` (dos columnas de candidato → `frente-amplio`/`partido-nacional`), catálogo plano, wiring, gate de ancla externa (FA ganó MO en ambos). Verificado en browser.
- [x] **T2b** — Nacionales 2014 (MO, nivel lema): ETL `run-nacionales-2014-mvd.ts` reusa `aggregateNacionalesMvd` (mismo schema que 2019), OpcionSelector estándar. Gates reales: reconciliación (delta=0) + cobertura (95.6%/100%). Verificado en browser (FA 58/61 barrios).
- [x] **T2c** — Internas 2019 (MO, nivel lema): ETL `run-internas-2019-mvd.ts` — schema RAW Latin-1 (TIPO_REGISTRO=HOJA_ODN), suma por lema. Gates reales (reconciliación delta=0, cobertura 96.6%/100%). Verificado en browser.
- [x] **T2d** — Departamentales 2020 (MO, **3 contiendas con HOJA**): ETL `run-departamentales-2020-mvd.ts` — adapta la maquinaria de 10.9 al schema 2020 (dos archivos de desglose ED+EM separados, Latin-1; integración con columnas `Numero_de_hoja`/`Titular_Suplente`, sin columna Municipio → el municipio sale del DESCRIPCION_2). Intendente: candidato = fila `Titular_Suplente='T'` (Ordinal es '0.0'). **Hallazgo histórico:** la oposición corrió a Laura Raffo bajo el lema "Partido Independiente" (coalición multicolor; verificado: Titular PI = RAFFO DEGEROMINI). Gates: cobertura por VOTOS (intendente 2.78% / junta 0.00% / municipio 1.67% en placeholder, tolerados — residual histórico de hojas sin Titular) + reconciliación NO tautológica contra re-suma cruda. **Verificado en browser:** acordeón de 3 contiendas; Intendente→PI→Raffo; Junta→FA→9 sublemas reales (Frente Líber Seregni, Sumemos, …)→hojas; Municipio→alcaldes×municipio→hojas. catálogo + 12 shards.
- [ ] **T3** — Gate de completitud opcional (lista de datasets vs ingeridos) — no implementado (opcional).

## Cierre

**Todas las elecciones del catálogo histórico están ingeridas para Montevideo** (internas 2019/2024, nacionales 2014/2019/2024, balotajes 2014/2019/2024, 2 plebiscitos 2024, referéndum LUC 2022, departamentales 2020/2025) y aparecen en el selector. La serie temporal del voto 2014→2025 es navegable, y **departamentales 2020 tiene la granularidad por HOJA completa (3 contiendas), igual que 2025** — no quedó como follow-up. El interior (18 depts) de estas elecciones lo cubrió trabajo en paralelo.

## Dev Notes

- **Decisión de validación del referéndum:** las columnas de totales del export oficial 2022 NO cierran exactamente entre sí (Sí+No+blanco+anulado=870.629 vs Total_Votos_NO_Observados=870.553, ~0.01%). Es inconsistencia del dato FUENTE (resolución de observados/recuentos), no del pipeline → **no se asume esa identidad**. Tampoco sirve un "gate de agregación mapeado+unmapped==crudo" (sería tautológico: cada fila suma su Sí al crudo Y a exactamente uno de los dos buckets). El gate REAL es un **ancla externa**: contra el resultado publicado de Montevideo (ganó el Sí ~56.5%) + la validación estructural del contrato (assertVotosShard). válidos = Sí+No (denominador del resultado).

## Review Follow-ups (AI)

- [x] **[AI-Review][Critical]** Color split-identity en `internas-2019` y `departamentales-2020`: stripear "Partido " guardaba `nombre="Independiente"` → `getPartyColor` matchea el gris genérico (`#95A5A6`) ANTES del fuzzy 'independiente'→PI, mientras la sigla mostraba "PI" (swatch gris + sigla PI). Crítico en deptal-2020 porque la coalición Raffo (PI) **gana 13 barrios**. **Corregido:** `opcionId` sigue siendo el slug sin prefijo (consistencia entre años), pero `nombre` ahora es el nombre COMPLETO ("Partido Independiente") → `resolveParty` da PI morado. Verificado en browser (cluster Raffo ahora morado, no gris).
- [x] **[AI-Review][Important]** ¿`VOTO_LEMA_ED` doble-cuenta (subtotal vs aditivo)? **Verificado con el dato:** VOTO_LEMA_ED = 18.603 = 2.3% de HOJA_ED (796.593) → es residual ADITIVO (voto al lema sin lista), no subtotal. Total 815.196 correcto, sin doble-conteo. (Mismo tratamiento que `aggregateNacionalesMvd`.)
- Nota review (no bug): colisión de slug por first-writer-wins es teórica — no ocurre en los 15 (internas-2019) ni 4 (deptal-2020) lemas reales. Reconcile + assertVotosShard confirmados como gates reales (no tautológicos).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code)

### Completion Notes List

- **Referéndum LUC 2022 (MO) entregado:** Sí (derogar) 56.5% en Montevideo — ganó el Sí en MO (a nivel nacional fue ~48.8% y NO se derogó). Mapa coherente: Sí en el oeste/centro popular; No en la costa este acomodada y el norte rural. 61 barrios, gate de ancla externa (resultado MO) + estructural, 0 errores de consola. Banner con la pregunta. `gate:escaleras` ✓ (44 catálogos), `astro check` 0/0/0.
- **Self-review:** el primer gate que escribí ("agregación mapeado+unmapped==crudo") era tautológico (mismo patrón que cazaron los reviews de 10.9/10.8); lo reemplacé por el ancla contra el resultado publicado antes de cerrar.
- **Alcance:** esta story entrega el referéndum (la pieza de TIPO nuevo); las demás instancias históricas son re-corridas del ETL del tipo correspondiente y quedan listadas como pendientes (T2). El grueso del catálogo reciente (2019/2024/2025) ya está ingerido por stories previas.
- **Interior (T2b sesión extendida):** `internas-2019`, `nacionales-2014` y `departamentales-2020` extendidos a los 18 departamentos interiores. `internas-2019-interior` y `nacionales-2014-interior`: nivel lema, gates 18/18 ✅. `departamentales-2020-interior`: 3 contiendas con catálogo, gates 18/18 ✅ (8 depts con ⚠️ de join incompleto por datos históricos, no bloqueantes). `gate:escaleras` ✅ (82 catálogos), `astro check` 0/0/0.

### File List

- `etl/run-referendum-2022-mvd.ts` (new) — ETL del referéndum (Sí/No explícitos).
- `etl/run-balotaje-historico-mvd.ts` (new) — ETL balotajes 2014 + 2019 (dos columnas de candidato).
- `etl/run-nacionales-2014-mvd.ts` (new) — ETL nacionales 2014 MO (nivel lema, reusa aggregateNacionalesMvd).
- `etl/run-internas-2019-mvd.ts` (new) — ETL internas 2019 MO (nivel lema, Latin-1, HOJA_ODN).
- `etl/run-departamentales-2020-mvd.ts` (new) — ETL departamentales 2020 MO (intendente×lema, Latin-1).
- `package.json` (modified) — scripts `etl:referendum-2022-mvd`, `etl:balotaje-historico-mvd`, `etl:nacionales-2014-mvd`, `etl:nacionales-2014-interior`, `etl:internas-2019-mvd`, `etl:internas-2019-interior`, `etl:departamentales-2020-mvd`, `etl:departamentales-2020-interior`
- `etl/run-internas-2019-interior.ts` (new) — ETL internas 2019 interior 18 deptos (nivel lema, Latin-1, HOJA_ODN, aggregateBySerie).
- `etl/run-nacionales-2014-interior.ts` (new) — ETL nacionales 2014 interior 18 deptos (nivel lema, utf-8, HOJA_EN+VOTO_LEMA, aggregateNacionalesSerie).
- `etl/run-departamentales-2020-interior.ts` (new) — ETL departamentales 2020 interior 18 deptos (3 contiendas, ED+EM Latin-1, catálogo hoja, adaptado para integración 2020).
- `src/config/departments.json` (modified) — agrega `internas-2019`, `nacionales-2014`, `departamentales-2020` a los 18 deptos interiores.
- `src/pages/[eleccion]/[departamento].astro` (modified) — agrega `departamentales-2020` a `tieneCatalogoHoja`.
- `etl/run-flat-catalogos.ts` (modified) — referendum + balotaje-2014/2019 en TARGETS.
- `src/config/departments.json` (modified) — referendum + balotaje-2014/2019 en Montevideo.
- `src/pages/[eleccion]/[departamento].astro` (modified) — labels + ruteo flat para `balotaje-*`/`referendum-*`.
- `public/data/{referendum-luc-2022,balotaje-2014,balotaje-2019}/montevideo/{votes,opciones,catalogo}.json` + `public/data/{nacionales-2014,internas-2019,departamentales-2020}/montevideo/{votes,opciones}.json` (new, generados).

### Change Log

- 2026-05-31 — Referéndum LUC 2022 (MO) ingerido como tipo plebiscito Sí/No (Total_SI/Total_NO explícitos). Gate de ancla externa contra el resultado publicado de MO (las columnas fuente no cierran exacto → no se asume; el gate de agregación sería tautológico). Verificado en browser.
- 2026-05-31 — Balotajes 2014 (FA Vázquez 61.0% MO) y 2019 (FA Martínez 56.7% MO) ingeridos (tipo balotaje, dos columnas de candidato → frente-amplio/partido-nacional), con gate de ancla externa (FA ganó MO). Verificados en browser. El selector de elección ahora abarca 2014→2025. Restantes (internas-2019, nacionales-2014, departamentales-2020): pendiente (T2b). Status → in-progress.
- 2026-05-31 — Code review (feature-dev:code-reviewer) de los ETLs de referéndum + balotajes históricos: **limpio, 0 hallazgos**. Confirmó parse correcto de columnas con espacio ("Total_Lacalle Pou_…"), gates de ancla NO tautológicos (discriminan errores de columna/join), y nombres de columnas correctos.
- 2026-05-31 — Nacionales 2014 (MO, nivel lema) ingerido reusando `aggregateNacionalesMvd` (mismo schema que 2019). Gates reales (reconciliación delta=0, cobertura 95.6%/100%). FA ganó 58/61 barrios (Vázquez dominó MO en 2014). Verificado en browser.
- 2026-05-31 — Internas 2019 (lema, Latin-1) y Departamentales 2020 (intendente×lema, Latin-1) ingeridas. Hallazgo 2020: la oposición corrió como "Partido Independiente" (coalición/Raffo, verificado en integración). Gates reales (reconciliación delta=0, cobertura ≥95%/100%). Verificadas en browser. **Todas las elecciones del catálogo histórico (2014→2025) quedan ingeridas y en el selector.** Follow-up menor: HOJA de junta/municipio 2020.
- 2026-05-31 — Code review (feature-dev:code-reviewer): 1 Critical (color split-identity de "Partido Independiente") corregido — `nombre` completo para el color, `opcionId` slug consistente; verificado en browser (PI morado). 1 Important (doble-conteo VOTO_LEMA_ED) descartado con el dato (aditivo 2.3%).
- 2026-05-31 — **internas-2019 y nacionales-2014 ELEVADAS de nivel-lema a HOJA en los 19 deptos** (NO eran extensiones opcionales — todas las elecciones deben tener la misma granularidad). `run-internas-2019-hoja.ts`: ODN = lema→**precandidato**→hoja (D1=precandidato, D2=hoja — igual que 2024) + ODD = lema→hoja; series combinadas pro-rata; reconciliación ODN tolerante a slug. `run-nacionales-2014-mvd-hoja.ts` + `run-nacionales-2014-interior-hoja.ts`: lema→hoja degradada (2014 no tiene integración → sin sublema). Verificado en browser: internas-2019 → FA → Martínez/Cosse/Bergara/Andrade → listas. `gate:escaleras` ✓ 121 catálogos, `astro check` 0/0/0. La única elección sin catálogo es balotaje-2024 Colonia (tipo plano → OpcionSelector con sus 2 candidatos, granularidad correcta).
- 2026-05-31 — **Departamentales 2020 MO ELEVADO de nivel-lema a las 3 contiendas con HOJA** (intendente/junta/municipio), igual que 2025: `run-departamentales-2020-mvd.ts` reescrito adaptando 10.9 al schema 2020 (ED+EM separados, integración con Titular_Suplente='T', municipio del DESCRIPCION_2). La granularidad por HOJA NO era despreciable — era el core; el ruteo de la página ya esperaba el catálogo (el acordeón se colgaba sin él). Guardas de colisión ahora comparan normalizado (acento/caso) para variantes de tipeo del mismo sublema; cobertura medida por VOTOS (no por conteo de opciones). Verificado en browser: acordeón 3-contiendas con drill-down a sublema/alcalde→hoja (Intendente→PI→Raffo; Junta→FA→9 sublemas). `gate:escaleras` ✓ (83 catálogos), `astro check` 0/0/0.
