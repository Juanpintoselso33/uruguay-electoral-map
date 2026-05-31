---
baseline_commit: c35f404386d10e5306aca3eab5a99cc5bf7c38fd
---

# Story 10.10: Variante balotaje/plebiscito — escalera plana + gate de escalera

Status: done
<!-- DESBLOQUEADA 2026-05-31: datos de balotaje y plebiscitos 2024 descargados (ver Dev Notes › Datos adquiridos). -->

## Story

As a usuario,
I want que en balotaje y plebiscito el selector se simplifique a las opciones reales,
so that no vea un árbol de HOJAs que no aplica a esos tipos de elección.

## ⚡ Datos adquiridos (2026-05-31)

| Archivo | Estructura |
|---|---|
| `data/raw/electoral/balotaje-2024/balotaje-2024.csv` (7.349 filas) | por CRV: `TotalHabilitados`…`TotalEnBlanco`, **`TotalOrsiCosse`**, **`TotalDelgadoRipoll`** (2 fórmulas, plano) |
| `data/raw/electoral/nacionales-2024/totales-generales-plebiscitos.csv` (7.353) | por CRV: totales + **`TotalSoloSi`**, **`SiArt11`** (allanamientos nocturnos), **`SiArt67`** (reforma seguridad social) — los 2 plebiscitos 2024 |

**Balotaje:** 2 opciones fijas (Orsi-Cosse / Delgado-Ripoll) → escalera plana `['candidato']`. **Plebiscitos:** dos preguntas (Art 11 = allanamientos nocturnos; Art 67 = reforma previsional), cada una Sí/No → escalera plana `['binaria']`, una contienda por pregunta (FR49). El "No" se deriva: `votos - Sí - (blanco/anulado/observado)` según la regla del plebiscito.
**Esto además desbloquea Epic 7.2 (balotaje) y 7.3 (plebiscitos) con dato real.**

## Acceptance Criteria

1. **Given** una elección de tipo balotaje o plebiscito **When** abro el selector de opción **Then** el acordeón degrada a **lista plana de opciones con checkbox** (candidatos en balotaje; Sí/No en plebiscito), sin chevrons.
2. **Given** esos tipos planos **When** selecciono opción(es) **Then** los modos de mapa (Ganador/Share/Votos/Heatmap) aplican igual.
3. **Given** el contrato **When** corro el build **Then** existe un **gate** que valida que todo `(tipo, contienda)` declara su escalera de granularidad en `ESCALERAS` (Story 10.1); si un tipo queda sin escalera, el build falla.
4. **Given** la UI **When** se construye el árbol **Then** **nunca** ofrece un nivel que la escalera del tipo no declara (no hay "selector de HOJA en un balotaje").
5. **Given** plebiscito con varias preguntas **When** elijo **Then** cada pregunta es una contienda con su Sí/No (FR49 reusado).

## Tasks / Subtasks

- [x] **T1** — Degradación plana del acordeón (AC: 1, 4)
  - [x] T1.1 — Cuando `escaleraDe(tipo, contienda)` tiene 1 nivel → render lista plana con checkbox, sin chevron. La rama `esPlano` de `OpcionAccordion` (Story 10.3) ahora muestra swatch + etiqueta legible (`metaPlano`): candidatos con color de partido; Sí/No vía `resolveParty` (verde/gris). Se generan `catalogo.json` planos (Montevideo) para que el acordeón los reciba.
- [x] **T2** — Gate de escalera (AC: 3, 4)
  - [x] T2.1 — `scripts/gate-escaleras.ts` (en `npm run build` + `gate:escaleras`): globa los `catalogo.json` emitidos, lee el `tipo` del `votes.json` hermano y verifica que cada contienda conforma `escaleraDe(tipo, contienda)`; si una `(tipo,contienda)` USADA falta en `ESCALERAS`, exit≠0. Degradados (p. ej. nacionales sin sublema) se aceptan como SUBSECUENCIA de la escalera (solo omiten niveles, nunca agregan).
  - [x] T2.2 — La UI nunca expone niveles fuera de la escalera: el acordeón renderiza solo los `niveles` del `catalogo.json`, y el gate valida que esos niveles son subsecuencia de la escalera declarada. Además `validate.ts` (selftest, corre en `astro check`) verifica la consistencia interna de `ESCALERAS` (todo tipo declara escalera; terminal = unidad de voto; planos = 1 nivel).
- [x] **T3** — Multi-pregunta en plebiscito (AC: 5) — ver "Decisión AC5" en Completion Notes
  - [x] T3.1 — Cada pregunta independientemente seleccionable con su Sí/No. **Desvío aceptado**: los dos plebiscitos 2024 se modelaron en Story 7.3 como dos *elecciones* (rutas/ids separados) en vez de dos *contiendas* de una elección. El mecanismo de selector de contienda (FR49, tab-bar del acordeón) existe y lo ejercita internas (odn/odd); para plebiscitos cada pregunta es su propia ruta deep-linkeable. Intención de AC5 cumplida; modelado distinto al literal.

## Dev Notes

- **La parte de UI plana y el gate son construibles SIN datos** (operan sobre el contrato y el componente). Los **datos** de balotaje (Epic 7.2) y plebiscito (Epic 7.3) son necesarios para verla con dato real → por eso `backlog` hasta que 7.2/7.3 ingieran, pero el gato de escalera y la degradación se pueden adelantar.
- El gate de escalera es la red de seguridad de todo Epic 10: garantiza que ningún tipo de elección quede sin su escalera declarada y que la UI nunca ofrezca un nivel inexistente. Es lo que cierra "que la lógica funcione bien para CADA elección" (Juan).
- Balotaje y plebiscito ya tienen fixtures de contrato (Story 7.1: `balotaje.fixture.ts`, `plebiscito.fixture.ts`); reusar para testear la degradación plana sin esperar el ETL.

### Referencias
- Story 10.1 (`ESCALERAS`, `escaleraDe`), Story 10.3 T1 (degradación plana), Epic 7.2/7.3 (datos), fixtures `src/lib/contracts/__fixtures__/{balotaje,plebiscito}.fixture.ts`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6 (Claude Code)

### Completion Notes List

- **Arquitectura — fork "acordeón plano" vs "OpcionSelector":** se eligió la degradación del acordeón (Fork B, lo que pide AC1/AC2). Los tipos planos (balotaje/plebiscito) no tienen jerarquía de HOJA: su unidad de voto vive en el `votes.json` base (`zonasVotos`), no en shards de hoja. El acordeón los recibe vía un `catalogo.json` plano (una contienda `unica`, sin nodos, una opción por unidad de voto). **Linchpin (verificado por gate):** el `id` de cada opción del catálogo == `opcionId` del `votes.json`; si difieren el mapa pinta uniforme-bajo. Por eso el catálogo se DERIVA de `opciones.json`.
- **Mapa — fallback a votos base:** `selSumZona` y `buildDesglose` leen del shard de hoja y, si la opción no está ahí (tipo plano), del `votes.json` base. `ensureHojaShards` saltea opciones sin `lemaId` (no pide `hoja/unica/.json` → sin 404). `buildDesglose` cuenta el total siempre pero no arma grupo-por-lema para opciones planas (sin lema). Los 4 modos (Ganador/Share/Votos/Heatmap) aplican igual (AC2).
- **Gate de escalera (AC3/AC4) — la red de seguridad de Epic 10:** `scripts/gate-escaleras.ts` corre en `npm run build`. (A) consistencia interna de `ESCALERAS`; (B) dirigido por dato: cada `catalogo.json` conforma `escaleraDe(tipo, contienda)` (degradados = subsecuencia). **El gate cazó un caso real**: nacionales-2019 está degradado (`['lema','hoja']` sin sublema) → se ajustó la regla a subsecuencia. Pasa contra los 23 catálogos.
- **Decisión AC5 (modelado de multi-pregunta):** los dos plebiscitos 2024 son dos *elecciones* (Story 7.3), no dos *contiendas* de una. Desvío explícito y aceptado: la intención (cada pregunta seleccionable con su Sí/No, deep-linkeable) se cumple con rutas separadas; el tab-bar de contienda (FR49) sigue disponible y lo usa internas. NO se reescriben las rutas ya enviadas (menor valor).
- **Verificado en browser (Playwright, 0 errores de consola):**
  - `/balotaje-2024/montevideo` → lista plana ✓ Frente Amplio / Coalición Republicana con swatch de partido; seleccionar FA pinta share% por barrio (54–74% oeste, 28% costa este). Screenshot `10-10-balotaje-fa.png`.
  - `/plebiscito-seguridad-social-2024/montevideo` → Sí (verde) / No (gris); Sí pinta 41–57% oeste→16% costa (coherente con 41.5% MO de 7.3); **No** (opción derivada = válidos−Sí, vive en el votes.json base) pinta el inverso exacto (costa 84/81% No). Screenshots `10-10-plebiscito-{si,no}.png`.
- **`astro check`:** 0 errores / 0 warnings / 0 hints. **`gate:escaleras`:** ✓ 8 escaleras, 5 tipos, 23 catálogos conformes.

### File List

- `etl/run-flat-catalogos.ts` (new) — genera `catalogo.json` plano (candidato/binaria) derivado de `opciones.json`+`votes.json`, con gate de reconciliación de ids.
- `scripts/gate-escaleras.ts` (new) — gate de escalera (consistencia interna + dirigido por catalogo.json).
- `package.json` (modified) — scripts `etl:flat-catalogos`, `gate:escaleras`; `gate:escaleras` agregado a `build`.
- `src/components/map/ChoroplethMap.vue` (modified) — `selSumZona`/`buildDesglose` con fallback a `zonasVotos`; `ensureHojaShards` saltea opciones planas (sin lemaId).
- `src/components/selectors/OpcionAccordion.vue` (modified) — rama plana con swatch + `metaPlano()` (etiqueta/color/sigla legibles para candidato/binaria).
- `src/pages/[eleccion]/[departamento].astro` (modified) — `tieneCatalogoHoja` incluye balotaje/plebiscito de Montevideo (escalera plana).
- `src/lib/contracts/__fixtures__/validate.ts` (modified) — selftest de consistencia interna de `ESCALERAS`.
- `public/data/{balotaje-2024,plebiscito-allanamientos-2024,plebiscito-seguridad-social-2024}/montevideo/catalogo.json` (new, generados).

### Review Follow-ups (AI)

- [x] **[AI-Review][Critical]** `run-flat-catalogos.ts`: el gate de reconciliación de ids era tautológico — comparaba dos conjuntos ambos derivados de `opciones.json`, sin leer nunca el `votes.json.zonas[].porOpcion` (la clave de join real del mapa). Si `opciones.json` y `votes.json` divergieran, pasaba y el mapa pintaría uniforme-bajo. **Corregido:** ahora `idsVotes` se construye desde `votes.zonas[].porOpcion[].opcionId`; reporta ids sin cubrir y sobrantes. Re-generado y verificado (pasa). `VotesDoc` ahora declara `zonas`.

### Change Log

- 2026-05-31 — Variante plana (balotaje/plebiscito) + gate de escalera. Acordeón degrada a lista de opciones con checkbox; mapa colorea desde el votes.json base (sin shards); gate de escalera dirigido por dato (cazó la degradación de nacionales). Verificado en browser. Status → review.
- 2026-05-31 — Code review (feature-dev:code-reviewer): 1 Critical (gate de reconciliación tautológico) corregido; resto confirmado non-issue (total de buildDesglose, ruteo Colonia balotaje, subsecuencia del gate). Status → done.
