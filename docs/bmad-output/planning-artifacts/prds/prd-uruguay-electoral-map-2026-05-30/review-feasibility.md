---
title: 'Review de Factibilidad y Dominio — PRD Uruguay Electoral Map'
type: 'adversarial-feasibility-review'
reviewer_role: 'Revisor adversarial de factibilidad y dominio electoral'
target: 'prd.md (2026-05-30)'
created: 2026-05-30
---

# Review adversarial — Factibilidad y corrección de dominio

**Alcance del review:** stress-test del `prd.md` para riesgos del mundo real que una rúbrica de calidad puede pasar por alto, en dos ejes: (a) corrección del dominio electoral uruguayo, y (b) factibilidad para un dev solo. El `addendum.md` se trata como **contexto downstream** (él mismo declara "NO es decisión final — la fija Arquitectura"); por lo tanto NO se critican aquí las elecciones de stack (Astro/MapLibre/Satori). Se usa el addendum solo como evidencia de costo (p. ej. R5 confirma que FR22 es caro).

## Veredicto

El PRD está bien escrito y honesto sobre sus supuestos, pero **el modelo de datos implícito en los FRs está moldeado para "internas" (HOJA×ZONA con precandidato) y no soporta de verdad los 4 tipos de elección**, y **el pilar histórico/comparación (F5) descansa sobre una mitigación (FR18/FR32) que es un proyecto de investigación abierto, no un ítem de MVP**. Como primer release de un dev solo, MVP-B es demasiado grande; el iceberg está concentrado en 3-4 FRs. Es salvable con un re-encuadre del modelo agnóstico, invertir el default de comparación a nivel lema/partido, y un primer slice más chico que conserve la tesis.

---

## A. Corrección de dominio electoral

### [CRÍTICO] D1 — La unidad base (HOJA×ZONA) y FR7 NO son agnósticas al tipo de elección

**§ project-context "Voto canónico" + prd §4 FR7, FR12.**

El project-context afirma agnosticismo vía "`PRECANDIDATO` opcional" y define la unidad base de voto como **(HOJA × ZONA)**. Eso es insuficiente y, en un caso, directamente incorrecto:

- **Balotaje** es una segunda vuelta entre **2 candidatos** (fórmulas presidenciales). NO hay listas/hojas compitiendo a nivel de hoja en el balotaje; el voto es a **candidato/lema**, no a HOJA. La unidad base ahí no es HOJA en absoluto.
- **Nacionales** (octubre): el voto a presidente es por lema/partido vía hojas, pero la lógica de sublemas y acumulación por lema (Ley de Lemas) cambia el agregado relevante respecto a internas.
- **Departamentales** (intendente/junta): otra estructura de candidaturas y otra relación HOJA↔candidato.
- **Internas**: aquí sí HOJA→PRECANDIDATO es el modelo natural.

Hacer un campo nullable (`PRECANDIDATO` opcional) **no arregla una unidad base equivocada**. FR5 admite `internas|nacionales|balotaje|departamentales`, pero FR7 ("seleccionar lista (HOJA) y/o candidato") y FR12 (voto canónico HOJA×ZONA) no tienen lugar para el balotaje donde la entidad votable es el candidato/lema sin hoja. **Recomendación:** el modelo debe abstraer la "entidad votable" (puede ser HOJA, lema, o fórmula/candidato según el tipo) sobre la unidad geográfica ZONA, y FR7 debe expresarse en términos de esa entidad, no de HOJA. Pedir al PRD/Arquitectura una matriz explícita tipo-elección × entidad-votable × campos-requeridos antes de cerrar el modelo.

### [CRÍTICO] D2 — M8 "0 discrepancias vs totales oficiales" es inalcanzable con el esquema actual

**prd §6 M8 + §7 NFR4 + § project-context "Esquema CSV".**

Los totales oficiales por departamento **incluyen votos en blanco, anulados y observados** (y el total de habilitados/emitidos). Esas categorías **no tienen PARTIDO ni HOJA**. El esquema CSV obligatorio (`PARTIDO, DEPTO, CIRCUITO, SERIES, ESCRUTINIO, PRECANDIDATO, HOJA, CNT_VOTOS, ZONA`) **no tiene un tipo de fila** para blancos/anulados/observados. Un modelo que solo ingiere filas con HOJA **nunca** podrá reconciliar contra el total oficial: siempre faltará el voto en blanco/anulado.

Esto es una contradicción concreta: **M8 (gate duro, "0 discrepancias") vs el esquema que no contempla esas categorías**. O M8 es imposible tal como está escrito, o fuerza trabajo de esquema no documentado (filas/categorías especiales para blanco/anulado/observado, o reconciliar solo "votos válidos a hojas" — que es un total distinto del oficial). **Recomendación:** definir explícitamente contra qué total reconcilia M8 (¿votos válidos a listas? ¿total emitido?) y, si es el oficial, agregar al modelo las categorías blanco/anulado/observado. Si no, bajar M8 de "gate duro contra total oficial" a "reconciliación de votos válidos a hojas, con blanco/anulado reportados aparte".

### [ALTO] D3 — FR12 dice "una sola etapa de ESCRUTINIO" pero nunca dice CUÁL

**prd §4 FR12 + §6 M8 + §7 NFR4.**

La regla "una sola etapa, nunca sumar etapas" es correcta y crítica para no duplicar. Pero hay múltiples etapas de escrutinio precisamente porque los votos **observados se adjudican en el conteo posterior (definitivo/departamental)**. Para que M8 (reconciliación con oficiales) pase, el ingeniero debe elegir la etapa **definitiva**, no "cualquiera". FR12 es ambiguo justo en lo que decide si M8 pasa o falla: "una sola etapa" no es accionable sin nombrar **qué** etapa es canónica. **Recomendación:** FR12 debe especificar "la etapa de escrutinio **definitiva** disponible" (o nombrar el criterio de selección) y enlazar explícitamente FR12 ↔ M8 ↔ NFR4. Sin eso, dos implementaciones razonables darán totales distintos y M8 será no determinista.

### [CRÍTICO] D4 — R1/FR18/FR32: la normalización de HOJA está sub-mitigada y es la grieta portante de F5

**prd §4 FR16, FR18, FR32 + §8 R1.**

Los números de lista (HOJA) **no son identidades estables entre elecciones**: se reasignan, se dividen/fusionan, y además la HOJA de internas ≠ la HOJA de nacionales aun dentro del mismo año. "Comparar la misma lista entre años" (FR16/FR18) es semánticamente frágil y, en muchos casos, simplemente no tiene sentido a nivel HOJA. El PRD lo tiene **invertido**: trata la tabla de equivalencias (FR32) como el **mecanismo primario** y la comparación a nivel partido/lema como mero *fallback* (R1, mitigación). Debería ser al revés.

- Construir una tabla de equivalencias HOJA completa entre elecciones (FR32) es un **proyecto de investigación abierto** con curaduría manual y juicio histórico — no un ítem de línea de MVP, y un sumidero de tiempo clásico para un dev solo.
- La comparación a nivel **lema/partido es la que tiene significado robusto** entre elecciones y es trivial de computar desde el dato.

**Recomendación:** invertir el default. **Comparación a nivel lema/partido = DEFAULT del MVP** (cubre FR16 con semántica sólida); comparación a nivel HOJA = best-effort opt-in solo donde la equivalencia sea trivial/verificable. Sacar FR32 (tabla completa) del MVP-B y degradarlo a "mapeo parcial best-effort". Esto descomprime R1 de "el pilar se cae o miente" a "el pilar funciona a nivel lema, con HOJA como bonus".

### [MEDIO] D5 — Conceptos electorales omitidos o sub-especificados

- **Sublemas / Ley de Lemas:** el PRD habla de HOJA→PARTIDO (project-context) pero no menciona **sublemas** ni la acumulación por lema, que es central para nacionales/departamentales. El "nombre humano" (FR10) y la agregación por partido (FR13) deberían contemplar el nivel sublema.
- **Votos en blanco/anulados/observados:** ver D2 — no aparecen en ningún FR ni en la ficha (FR9/FR10). Para un ciudadano, "¿cómo votó mi barrio?" honesto incluye el % de blancos/anulados; omitirlos sesga el choropleth.
- **Clave de unión SERIE→barrio:** project-context advierte que algunos deptos (Rivera, Montevideo) joinean por `SERIE → barrio`, no por ZONA directa. FR13 ("zona → serie → circuito → depto") asume una jerarquía limpia; la heterogeneidad real entre deptos es un riesgo de cobertura (FR31) que el PRD subestima.

---

## B. Factibilidad para dev solo

### [ALTO] F1 — MVP-B es demasiado grande como primer release; el iceberg está concentrado

**prd §5 (MVP-B) + §8 R6.**

MVP-B junta de una sola vez: histórico multi-elección + comparación + mobile impecable + previews sociales ricos + búsqueda + ETL completo + reconciliación dura. R6 lo reconoce como riesgo "medio", pero subestima dónde está el costo. El iceberg NO está repartido parejo; se concentra en:

- **FR18 + FR32 (normalización HOJA):** open-ended (ver D4). Riesgo de tiempo ilimitado.
- **FR22 + FR30 (OG-image por ruta):** el propio addendum (R5) confirma que **Satori no captura WebGL**, así que hay que construir un pipeline aparte (SVG desde TopoJSON simplificado en build-time, o raster pre-render en ETL) — una sub-feature entera, no un meta-tag. Y M7 exige 100% de rutas canónicas con OG válida.
- **M8 a través de TODO el histórico:** depende de R2 (disponibilidad de datos a nivel circuito por elección). Reconciliar cada elección×depto histórica es trabajo lineal en número de elecciones, con datos de calidad heterogénea.
- **FR16 comparación en mobile:** ver C1 (choca con FR3).

### [ALTO] F2 — Contradicción interna FR3 vs FR16 (una variable por pantalla vs comparación lado-a-lado en mobile)

**prd §4 FR3 vs FR16 + §1/§2 (mobile-first, usuario #1).**

FR3 manda "una sola variable coloreada por vez / una historia por pantalla" como principio de UX mobile. FR16 quiere comparar **dos elecciones lado-a-lado** a nivel zona/circuito — en la superficie #1, que es mobile. Dos choropleths simultáneos en una pantalla de celular contradicen directamente FR3 y arriesgan CM1 (confusión/rage-taps). El PRD no resuelve la tensión. **Recomendación:** definir que la comparación en mobile es una vista de **cambio/delta** (un solo mapa coloreado por la diferencia), no dos mapas; reservar el lado-a-lado para desktop/analista (UJ-2). Esto reconcilia FR3 con FR16 y baja el costo de UX.

### [MEDIO] F3 — Slice inicial recomendado (de-risk sin perder la tesis)

La tesis es **permanencia + granularidad + comparabilidad**. Se puede preservar entera con un primer slice mucho más chico:

> **1 departamento × 2 elecciones comparables × comparación a nivel lema/partido × deep-link con preview.**

- Conserva los 3 pilares (es permanente, granular HOJA×ZONA dentro de cada elección, y comparable entre 2 elecciones a nivel lema).
- **Difiere:** FR32 (tabla HOJA completa → solo mapeo best-effort), FR22 rico (→ OG estática simple o una sola imagen por depto sin contorno per-ruta al inicio), FR8 (export, ya está fuera), y M8-sobre-todo-el-histórico (→ reconciliar solo las 2 elecciones del slice).
- **Des-arriesga** R1 (D4), R2 (solo 2 elecciones verificadas), R4 (mides volumen real de 1 shard antes de comprometerte al presupuesto KB de NFR1).

Esto no cierra ninguna puerta arquitectónica (el sharding por elección×depto ya escala) y le da a Juan un release demostrable en una fracción del tiempo.

---

## C. Realismo de métricas (M1–M8) con analítica privacy-friendly

| Métrica | Veredicto | Nota |
|---|---|---|
| **M1** (completar JTBD) | Medible con esfuerzo | Requiere evento custom "vio resultado de zona". Doable. |
| **M2** (tiempo a primera respuesta < 3s percibidos) | **Vanity / no medible** | "Percibido" no se mide con analítica. **Redefinir como LCP** (ya está en NFR1) — si no, es aspiracional, no métrica. |
| **M3** (tasa de compartir > 5%) | **Sistemáticamente sub-contado** | Copias al portapapeles (FR21) se subreportan; el share sheet nativo del SO es **invisible** a la analítica. El número medido será un piso, no la realidad. Documentarlo. |
| **M4** (tráfico por links compartidos) | **Atribución débil** | Sin **param-tagging** explícito en los deep-links (p. ej. `?ref=share`), no se distingue referral de deep-link de tráfico directo. Requiere instrumentar el botón de FR21 para que sea medible. |
| **M5** (salud mobile / bounce) | Parcialmente medible | % mobile sí; **"bounce" es difuso** en analítica privacy-friendly (sin cookies, sesiones aproximadas). Definir bounce operacionalmente o el target es inverificable. |
| **M6** (uso de profundidad > 10%) | Medible con esfuerzo | Eventos custom en comparación/búsqueda. Doable. |
| **M7** (preview social correcto 100%) | **Sólido** | Chequeo estático en build-time; no necesita analítica. Buen gate. |
| **M8** (integridad, 0 discrepancias) | **Sólido SOLO si se arregla D2/D3** | Gate de build determinista una vez resuelto qué total y qué etapa. Tal como está, no determinista (D3) e imposible contra total oficial (D2). |

**Síntesis métricas:** M7 y M8 son los gates fuertes (build-time, no dependen de analítica de usuarios). M2 es vanity (redefinir como LCP). M3/M4/M5 son medibles pero con sesgos importantes que el PRD no reconoce — hay que instrumentar (param-tagging, eventos custom) y documentar el subconteo, o se convierten en números engañosos.

---

## Resumen de hallazgos (priorizado)

| ID | Sev | Título | Refs |
|---|---|---|---|
| D1 | 🔴 Crítico | Unidad base (HOJA×ZONA) y FR7 no agnósticas; balotaje no encaja | §4 FR5/FR7/FR12; project-context |
| D2 | 🔴 Crítico | M8 "0 discrepancias vs oficiales" imposible: blanco/anulado/observado no están en el esquema | §6 M8; §7 NFR4; esquema CSV |
| D4 | 🔴 Crítico | R1/FR18/FR32 sub-mitigado: comparación HOJA frágil; el default debería ser lema/partido | §4 FR16/FR18/FR32; §8 R1 |
| D3 | 🟠 Alto | FR12 no dice CUÁL etapa de escrutinio; M8 queda no determinista | §4 FR12; §6 M8 |
| F1 | 🟠 Alto | MVP-B demasiado grande para dev solo; iceberg en FR18/32, FR22/30, M8-histórico | §5; §8 R6 |
| F2 | 🟠 Alto | Contradicción FR3 (1 variable/pantalla) vs FR16 (lado-a-lado en mobile) | §4 FR3/FR16 |
| D5 | 🟡 Medio | Omisiones: sublemas/Ley de Lemas, blanco/anulado en ficha, heterogeneidad SERIE→barrio | §4 FR10/FR13; project-context |
| F3 | 🟡 Medio | Slice inicial recomendado: 1 depto × 2 elecciones × nivel lema × deep-link | §5 |
| M-* | 🟡 Medio | M2 vanity (→LCP); M3/M4/M5 sub-contadas sin instrumentar | §6 |

**Recomendación de cierre para Finalize:** (1) reescribir el modelo de dominio en términos de "entidad votable" agnóstica antes de cerrar FRs (D1); (2) definir contra qué total reconcilia M8 y qué etapa es canónica (D2/D3); (3) invertir el default de comparación a lema/partido y sacar FR32 completo del MVP (D4); (4) recortar MVP-B al slice de F3; (5) instrumentar las métricas de share/referral o degradarlas a direccionales honestas.
