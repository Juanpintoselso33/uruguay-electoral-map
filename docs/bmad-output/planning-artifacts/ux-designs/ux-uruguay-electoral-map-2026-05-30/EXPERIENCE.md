---
status: final
created: 2026-05-30
updated: 2026-05-31
sources:
  - ../../prds/prd-uruguay-electoral-map-2026-05-30/prd.md
  - ../../../project-context.md
  - ./.decision-log.md
  - ./DESIGN.md
  - ../../../../../src/utils/partyColors.ts
---

# EXPERIENCE.md — Uruguay Electoral Map

> Cómo funciona: arquitectura de información, comportamiento, estados, interacciones, accesibilidad y flujos. Las decisiones visuales (color, tipografía, tamaños, espaciado) viven en `DESIGN.md` y se referencian por nombre con sintaxis `{path.to.token}`. Ante conflicto sobre comportamiento, manda este documento; sobre apariencia, manda `DESIGN.md`.

## Foundation

**Form-factor:** sitio estático, **mobile-first**, también desktop/web. Sin backend de aplicación: artefactos shardeados servidos por CDN (NFR5). El usuario #1 es un ciudadano en el celular; el usuario #2 es un analista en la notebook. La portada del ciudadano no arrastra el peso del mapa hasta que se necesita (NFR1).

**Identidad visual:** `DESIGN.md` define la dirección **editorial** (registro periodístico serio, serif para titulares, autoridad, aire generoso, reglas hairline), con modo claro y oscuro. Este spine no repite ni tamaños ni colores; los nombra.

**Principio rector — progressive disclosure (FR25).** La primera pantalla responde la pregunta del ciudadano sin configuración. Las capas de profundidad (comparación, búsqueda, export) están **a un clic detrás de una acción deliberada**, nunca abiertas por defecto. Regla de diseño derivada: *ciudadano-simple por defecto, analista-profundidad un clic atrás*. Esto rige cada decisión de jerarquía en este documento.

## Information Architecture

El estado relevante vive en la URL (FR20): `elección · departamento · zona · opción · vista · zoom`. Toda ruta es un deep-link reproducible y un objetivo de preview social (FR22).

| Superficie | Se llega desde | Propósito | FR |
|---|---|---|---|
| **Overview nacional** | Entrada en frío (sin contexto en URL) | Mapa de los 19 departamentos + selector de depto. Punto de partida, no destino | FR26, FR6 |
| **Vista de departamento (héroe)** | Deep-link / selección de depto / overview | Mapa choropleth coloreado, ya respondiendo "¿quién ganó acá?" sin tocar nada | FR1–FR4 |
| **Ficha de zona (bottom sheet)** | Tap en una zona del mapa | Resultado de esa zona: ganador, votos, %, categorías blanco/anulado | FR9–FR11 |
| **Selector de elección** | Masthead de la vista de departamento | Cambiar tipo (`internas\|nacionales\|balotaje\|departamentales`) y año | FR5, FR15 |
| **Selector de opción** | Acción deliberada sobre la vista | Elegir HOJA o candidato/lema según el tipo; alterna la pregunta del mapa | FR7, FR8 |
| **Modo comparación dual** | Acción "comparar" (ficha o masthead) | Dos elecciones lado a lado, o dos opciones de una misma elección | FR16, FR17, FR18 |
| **Búsqueda** | Acción deliberada (ícono) | Saltar a lista, candidato o departamento conocido (índice estático) | FR19 |
| **Compartir / deep-link** | Botón "compartir" en ficha o masthead | Copia el deep-link de la vista actual; el preview social se genera en build-time | FR20–FR22 |

El **mapa + selector se comportan como una unidad persistente**: cambiar de departamento o elección actualiza el estado y la URL **sin re-inicializar la instancia del mapa** (NFR1, R7). La ficha de zona es un modal de un solo nivel; nunca se apila otra encima.

→ Referencia de composición: `.working/direction-editorial.html`, `.working/fa-tricolor-test.html`. El spine manda ante conflicto.

### Manejo de densidad semántica (una pregunta por pantalla)

El choropleth es propenso a la sobrecarga (R8). Regla dura: **una sola variable coloreada por pantalla** (FR3). El mapa individual responde *una* pregunta a la vez — "¿quién ganó?" **o** "¿cómo le fue a ESTA opción?" (FR8), nunca ambas superpuestas. La comparación multi-variable se hace en el modo dual explícito (FR16), nunca encimando capas en un solo mapa. Toda leyenda nombra qué representa cada color y su escala.

### Escaleras de granularidad por tipo de elección (Epic 10)

Cada tipo de elección define su propia escalera; el acordeón se construye desde estos datos, no hardcodea un árbol. **Internas está confirmado; el resto requiere research de dominio + sourcing de datos por tipo** (no inventar la escalera).

| Tipo | Contiendas (raíz) | Escalera dentro de cada contienda | Estado del dato |
|---|---|---|---|
| **Internas** | Convención Nacional · Convención Departamental | Nacional: lema → precandidato → lista. Departamental: lema → lista | ✅ construible (desglose-de-votos.csv) |
| **Nacionales** | una (legislativa) | lema → sublema → lista, con distinción lista **nacional** (Senado) / **departamental** (Diputados) | ⚠️ hoja ✅; sublema y split nacional/deptal **faltan** (sourcing) |
| **Balotaje** | una | candidato (plano, 2 opciones) | ❌ bloqueado por ingesta (Epic 7) |
| **Plebiscito** | una por pregunta | Sí / No (plano) | ❌ bloqueado por ingesta (Epic 7) |
| **Departamentales** | Intendente · Junta Departamental · Municipio | Intendente: lema → candidato. Junta: lema → sublema → lista. Municipio: lema → candidato a alcalde → lista | ❌ bloqueado por ingesta (Epic 7); escalera a confirmar con research |

**Regla de adaptación:** el acordeón muestra solo los niveles que la escalera del tipo activo declara. Un tipo plano (balotaje/plebiscito) colapsa a lista simple. Un tipo con una sola contienda oculta el nivel raíz. La UI nunca asume una escalera fija: lee la del tipo y se reconfigura (esto es lo que evita "selector de HOJA en un balotaje").

## Voice and Tone

Microcopy en **español rioplatense**, claro, sin jerga, accesible al ciudadano. Nombres humanos para partidos y listas, nunca el dato crudo. La voz de marca y la estética viven en `DESIGN.md`.

| Hacer | No hacer |
|---|---|
| "¿Quién ganó acá?" | "Seleccione una unidad geográfica" |
| "Partido Nacional — Lista 71" · "Lista 609" (el número ES el nombre humano de la lista) | "HOJA 609" (jerga interna del registro) · "ODN" sin traducir |
| "Tocá una zona" | "Haga clic en una región del mapa" |
| "Corte Electoral — escrutinio definitivo" | "Datos: ESCRUTINIO=TOTAL" |
| "comparar vs. 2019" | "Activar modo de análisis comparativo" |
| "En blanco · Anulados · Observados" (categorías nombradas) | esconderlos o fundirlos en "otros" |
| "No hay datos de zona para esta elección — se muestra a nivel circuito" | zonas vacías sin aviso |

`ESCRUTINIO`, `CIRCUITO/SERIE/ZONA`, `ODN/ODD` y `TIPO_REGISTRO` son vocabulario interno: **se traducen a nombre humano antes de llegar a la UI** (FR10) vía la capa de metadata. **Excepción deliberada (Epic 10):** el *número* de lista NO es jerga — en Uruguay la gente identifica las listas por su número ("la 609", "la 71"). Cuando una HOJA es la opción seleccionada se nombra **"Lista {número}"** como nombre humano de primera clase, con el lema/precandidato como subtítulo de contexto. Lo que se evita es la etiqueta cruda `HOJA 609` y el código de contienda `ODN` sin traducir (→ "Convención Nacional").

### Vocabulario de granularidad (Epic 10)

| Crudo | Nombre humano en UI |
|---|---|
| `HOJA 609` | **Lista 609** |
| `TIPO_REGISTRO = HOJA_ODN` | **Convención Nacional** (orden nacional) |
| `TIPO_REGISTRO = HOJA_ODD` | **Convención Departamental** (orden departamental) |
| `DESCRIPCIÓN_1 = "COSSE GARRIDO, Ana Carolina"` | **Carolina Cosse** (precandidato/a) |
| sublema (código) | nombre del sublema |
| listas a Senado / Diputados (nacionales) | **Lista nacional** / **Lista departamental** |

## Component Patterns (behavioral)

Comportamiento únicamente. Specs visuales en `DESIGN.md.Components`.

| Componente | Uso | Reglas de comportamiento |
|---|---|---|
| **Mapa choropleth** | Vista de departamento (héroe) | Una variable coloreada por vez (FR3). Tap en zona → abre/actualiza la ficha. **Cada zona lleva la sigla del partido como texto sobre el relleno** — el resultado nunca se comunica solo por color (ver Accessibility; safeguard del decision-log). Borde nítido por zona separa polígonos adyacentes (crítico donde FA-rojo y Colorado-rojo colindan). La selección activa engrosa el borde con `{colors.ink}`. |
| **Bottom sheet (patrón mobile clave)** | Ficha de zona | Superficie `{colors.card}`. Dos estados: **colapsado** (una fila: zona · sigla · lista · votos · %) y **expandido** (ficha completa). Swipe arriba expande, swipe abajo colapsa; el grip superior es affordance táctil. Colapsado deja el mapa visible. En desktop se ancla como panel lateral, no como sheet. |
| **Ficha de resultado** | Dentro del sheet | Nombres humanos (lema/partido, nº de lista, candidato) + color de partido vía los tokens planos `{colors.party-fa}` / `{colors.party-pn}` / `{colors.party-pc}` / `{colors.party-ca}` / `{colors.party-pi}` (familia `party-*`, ver DESIGN.Colors) (FR10). Muestra votos y % del ganador **sin scroll** en un teléfono típico (FR11). Blanco / Anulados / Observados aparecen como **categorías nombradas** cuando el dato los provee (FR9), nunca sumados al ganador. |
| **Selector de elección** | Masthead | Cambia tipo + año (FR5). Persiste el departamento y la zona seleccionada si existe en la nueva elección; si no existe, conserva el depto y limpia la zona. No re-inicializa el mapa (NFR1). |
| **Selector de opción (drill-down jerárquico — Epic 10)** | Acción deliberada | **Acordeón anidado** que se adapta al tipo de elección y recorre la escalera de granularidad de ese tipo (FR7). Jerarquía como árbol único: **CONTIENDA → LEMA → (PRECANDIDATO/SUBLEMA) → HOJA**. Tocar un nivel lo expande en contexto (no navega fuera); el resto queda colapsado y scrolleable. Cada nivel muestra su % agregado a la derecha. Elegir un nodo de cualquier nivel cambia la pregunta del mapa a "¿cómo le fue a ESTA opción?" (FB8) al nivel elegido — se puede colorear por lema, por precandidato o por una lista individual. Ver patrón **Acordeón de opción** abajo. La escalera concreta depende del tipo (ver IA › Escaleras de granularidad). |
| **Comparación dual** | Modo explícito | Dos modos: **lado-a-lado** (dos mapas) o **vista de cambio** (delta sobre un mapa). Por defecto a **nivel partido/lema** (estable entre años — FR16). FR17: comparar dos opciones dentro de una misma elección. FR18 (Fase 2): nivel HOJA solo donde exista tabla de equivalencias validada; si no, degrada a partido/lema y lo rotula. Entrar/salir es explícito y reversible. |
| **Búsqueda** | Acción deliberada | Salto a entidad conocida (lista, candidato, departamento) sobre índice estático — **no semántico** (FR19). Enter salta a la vista; Esc cierra sin cambiar estado. |
| **Botón compartir** | Ficha / masthead | Copia el deep-link de la vista actual al portapapeles (FR21). Confirma con feedback efímero (ver State Patterns). El preview social rico (OG-image + meta) está **pre-generado en build-time por ruta canónica** desde geometría vectorial — no es un screenshot del mapa en runtime (FR22, R5). |
| **Leyenda** | Vista de departamento | Nombra cada color, su sigla y qué representa (FR3). Lista partidos presentes con conteo de zonas. |
| **Sello de origen del dato** | Masthead, siempre visible | Estampa "Corte Electoral — escrutinio definitivo" en `{colors.ink-soft}`, separada por regla `{colors.hairline}` (FR14). Comunica fuente + etapa canónica; es confianza, no decoración. No es un cálculo en runtime: la reconciliación de válidos es gate de build (NFR4, M8). |

### Acordeón de opción (patrón clave de Epic 10)

El selector de opción es la pieza más cargada del producto: traduce la jerarquía electoral real a una navegación que el ciudadano puede ignorar y el analista puede agotar. **Conserva las capacidades del legacy (multi-selección combinable, candidato = agregado de sus listas, partido como filtro) y las unifica en un solo árbol.** Reglas de comportamiento:

- **Un solo panel, árbol colapsable.** Cada fila es un nivel de la escalera del tipo activo (contienda → lema → precandidato/sublema → lista). Tocar el **chevron** (`▸`/`▼`) expande/colapsa **en su lugar**; no abre pantalla nueva ni apila modal. Sangría progresiva marca profundidad.
- **MULTI-SELECCIÓN con checkbox, en cualquier nivel.** Cada fila tiene un **checkbox**; marcar uno o varios nodos colorea el mapa por la **suma** de su(s) voto(s) (legacy: `selectedLists` es un array). Se pueden combinar listas de distintos lemas para compararlas. El checkbox (seleccionar) y el chevron (expandir) son **hit-targets separados ≥44×44px**.
- **Selección en cualquier nivel = agregado de sus hojas.** Marcar un **lema** = suma de todas sus listas; marcar un **precandidato/candidato/alcalde** = suma de sus listas (legacy: `precandidatosByList`); marcar una **lista** = esa hoja sola. Esto reemplaza el toggle "Listas/Candidatos" del legacy con un solo árbol coherente (decisión 2026-05-31).
- **Marcar padre y luego desmarcar un hijo.** Si marcás un lema (todas sus listas) y después desmarcás una lista, el padre pasa a estado **indeterminado** y el mapa muestra la suma de las listas que quedan marcadas. Tri-estado de checkbox (vacío / parcial / lleno).
- **Partido también como filtro.** Arriba del árbol, un filtro de partido/lema (legacy `PartyFilter`) recorta qué ramas se muestran — es filtro de visibilidad, **no** selección; no pinta el mapa por sí solo. "Seleccionar todas" opera sobre lo **filtrado** y respeta selecciones fuera del filtro (legacy: union/diff con Set).
- **% agregado por fila.** Cada nivel muestra su porcentaje del total del departamento a la derecha. El número de un padre = suma de sus hijos (roll-up del ETL, no cálculo en cliente — FR13).
- **Contienda primero.** El nivel raíz es la contienda (internas: Convención Nacional / Departamental; departamentales: Intendente / Junta / Municipio). Si el tipo tiene una sola contienda (nacionales), ese nivel se auto-expande y su fila se oculta — no se hace navegar un árbol de un solo brazo. **El control de contienda (ODN/ODD) dispara recarga del dataset y limpia la selección** (legacy: re-fetch).
- **Búsqueda por número.** Campo de búsqueda que indexa listas por número (legacy `ListGrid` search, debounce 300ms): tipear "609" filtra/abre el árbol hasta esa lista. El acordeón es para explorar; la búsqueda para quien ya sabe el número.
- **La selección se limpia al cambiar de contexto.** Cambiar departamento, elección o contienda **vacía la selección** (legacy: 3 puntos de limpieza) — evita "votos fantasma" de listas que no existen en el nuevo dataset.
- **Chips de filtros/selección activos.** Una fila de chips (legacy `ActiveFilters`) resume: partido filtrado, búsqueda activa, y "N listas seleccionadas", cada uno con su ✕ y un "Limpiar todo".
- **Estado en URL.** La selección (contienda + conjunto de ids) vive en la URL (FR20). Deep-link a "Listas 609+90 en Maldonado" abre el mapa por su suma y el árbol en esas ramas.
- **Degradación por tipo plano.** En balotaje (candidato) y plebiscito (Sí/No) la escalera es de un nivel: el acordeón colapsa a una lista de opciones con checkbox, sin chevrons. El componente es el mismo; la escalera del tipo define cuántos niveles hay.

→ Escaleras concretas por tipo: IA › *Escaleras de granularidad*. Specs visuales (checkbox tri-estado, chevron, sangría, pill de %) en `DESIGN.md.Components`. El spine manda ante conflicto.

### Ficha de zona con desglose por HOJA (Epic 10)

Cuando el usuario tocó una zona, la ficha se adapta a la profundidad activa:

- **Sin opción seleccionada (default ciudadano):** comportamiento actual — ganador a nivel lema, votos, %, categorías. Sin cambios.
- **Con opción(es) seleccionada(s):** la ficha encabeza con **cómo le fue a la selección en esta zona** (votos sumados, % sobre válidos, ranking de la zona). Abajo, **desglose detallado agrupado por partido** (legacy `detailedBreakdown`): dentro de cada partido, sus listas (o candidatos) con votos en esta zona, **ordenadas desc**, truncado a **10 por partido** con "y N más…", y un **Total** de la selección. El ciudadano ve el agregado; el analista expande al detalle de lista sin salir de la zona.
- **Tooltip pegajoso (legacy):** en hover/tap, el tooltip de zona se puede **fijar** (pin) para leerlo con calma; ✕ lo cierra. En mobile, el tap fija. Conserva el affordance del legacy (`pinTooltip`).
- **Roll-up consistente:** el % de la selección en la zona = suma de sus listas en la zona. Nunca se mezcla con el % departamental.
- **Series combinadas:** si la zona es una serie compuesta ("sia-sib-sic"), los votos se **suman** de sus componentes (legacy `getVotesForZone`) — no es lookup directo.

## State Patterns

| Estado | Superficie | Tratamiento |
|---|---|---|
| **Carga (cold load)** | Vista de departamento | Skeleton del mapa (contorno del depto sin relleno, sobre `{colors.paper}`) + masthead con sello ya visible. Resuelve al cargar el shard. La "primera respuesta" (quién ganó) es el LCP objetivo < 2.5 s (M2, NFR1). |
| **Sin datos en un nivel** | Mapa | Degradar al nivel disponible más fino y **rotularlo explícitamente** (FR2): "No hay datos de zona para esta elección — se muestra a nivel circuito." Nunca zonas vacías sin aviso. |
| **Zona sin opción ganadora** | Ficha | Si una zona no tiene datos en la elección activa, la ficha lo dice en palabras claras; no inventa color ni ganador. |
| **Error de carga** | Vista de departamento | Mensaje claro en español + acción de reintento. No deja el mapa en estado ambiguo a medio colorear. |
| **Comparando** | Modo dual | Indicador persistente de que hay dos elecciones/opciones activas; ambos contextos rotulados (qué elección es cada lado). Salir vuelve a la vista simple anterior, conservando depto y zona. |
| **Búsqueda sin resultados** | Búsqueda | Estado vacío explícito: "No encontramos esa lista/candidato/departamento." Ofrece sugerencias (revisá la ortografía, probá el nombre del lema o del depto). No deja el campo en silencio ni simula un resultado. |
| **Link copiado** | Tras compartir | Confirmación efímera ("Link copiado") ~2 s; no bloquea, no abre modal. Si el preview de la ruta no estuviera listo (no debería: M7 es gate del 100%), la copia igual procede. |
| **Foco (teclado)** | Toda superficie | Anillo de foco visible: `{colors.focus-ring}` en claro, `{colors.focus-ring-dark}` en oscuro (el oxblood `{colors.accent}` falla contraste 1.85:1 sobre el slate oscuro, por eso el override). Recorrido en orden de lectura. |
| **Mapa por opción(es) seleccionada(s) (Epic 10)** | Vista de departamento | Al marcar una o varias opciones, el mapa pasa a "cómo le fue a ESTA selección" con **tres modos conmutables** (decisión 2026-05-31): **(a) Share %** — porcentaje de la selección sobre los válidos de cada zona (comparable entre zonas chicas/grandes); **(b) Votos absolutos** — magnitud de votos de la selección, escala **recalculada en cada cambio de selección** (legacy: Jenks/ColorBrewer); **(c) Heatmap** — gradiente continuo de densidad. Una sola variable por pantalla (FR3); el modo se elige en un conmutador en la leyenda. El texto por zona muestra el **valor del modo activo** (% o votos), cumpliendo "nunca solo por color" con el número. Sin selección, el default es **Ganador por lema** (vista ciudadano). |
| **Escala dependiente de la selección** | Mapa / leyenda | En modos absolutos/heatmap la escala de color se **recalcula sobre el subconjunto seleccionado** (legacy load-bearing): la misma zona cambia de color según qué tengas marcado. La leyenda nombra siempre el modo, la unidad y el rango vigente. |
| **Opción sin votos en una zona** | Mapa / ficha | Si la selección no recibió votos en una zona, esa zona se pinta en el nivel más bajo de la escala (no gris-sin-dato) y la ficha dice "0 votos para {selección} en esta zona" — distinto de "sin datos en este nivel". |

## Interaction Primitives

- **Tap para seleccionar zona** — operable con el pulgar; no requiere precisión de pinch para elegir una zona (FR4). El target táctil efectivo de cada zona respeta el mínimo de accesibilidad aun si el polígono es chico.
- **Swipe del bottom sheet** — arriba expande, abajo colapsa. Grip como affordance.
- **Pan / zoom del mapa** — gesto estándar; la instancia del mapa **persiste entre rutas, no se re-inicializa** (NFR1, R7).
- **Cambio de nivel geográfico (zona ↔ serie ↔ circuito, FR2)** — el nivel por defecto es zona/barrio. El descenso a circuito es de profundidad (analista). **[ASSUMPTION — verificar en Arquitectura]** el cambio de nivel se dispara por una acción explícita (control de nivel), no por umbral de zoom, para no sorprender al ciudadano; el slice MVP queda a nivel partido/lema (§6) y el drill-down manual a circuito puede ser Fase 2. Si un nivel no tiene datos, la degradación es automática y rotulada (ver State Patterns / FR2).
- **Toggle de pregunta** — alterna "¿quién ganó?" vs "¿cómo le fue a ESTA opción?" (FR8). Una variable por pantalla.
- **Copiar link** — un toque copia el deep-link de la vista exacta (FR21).
- **Entrar / salir de comparación** — acción explícita y reversible; nunca un estado en el que el usuario cae sin querer.
- **Búsqueda** — Enter salta, Esc cierra.
- **Prohibido:** superponer múltiples variables coloreadas en un mapa (FR3); apilar modales más de un nivel; abrir comparación/búsqueda/export por defecto (FR25/CM3); animaciones que disparen CLS o jank al navegar (NFR1/CM2).

## Accessibility Floor (behavioral)

Objetivo **WCAG 2.2 AA**. El contraste y las paletas color-blind-safe son materia de `DESIGN.md`; lo de abajo es comportamiento.

- **El ganador nunca se comunica solo por color — regla crítica.** Cada zona del mapa lleva la **sigla del partido como texto** (FA, PN, PC, CA, PI, …) sobre el relleno; la ficha y la leyenda repiten el nombre humano. Esto es load-bearing dado el choque cromático real: el relleno tricolor del FA (bandera de Otorgués, franja **roja** arriba) colisiona con el **rojo** del Partido Colorado; el borde nítido por zona + la sigla resuelven la ambigüedad sin alterar la bandera (decision-log, 2026-05-30). La sigla es texto, no decoración: es la fuente de verdad cuando el color falla.
- **Riesgo residual de visión cromática — mitigado, no eliminado.** Bajo daltonismo rojo-verde, PC (rojo) y CA (verde) colapsan a casi indistinguibles, y FA-rojo ≈ Colorado-rojo aun en visión normal (la Variante A conserva ese choque a propósito). La mitigación es la **sigla de texto obligatoria** en cada zona — por eso es load-bearing y por eso debe ser legible (≥11px, sobre pill de respaldo) y estar presente incluso en zonas diminutas. Donde la zona sea más chica que la etiqueta, el camino accesible de identificación es la **tabla/lista de datos** (abajo), no el píxel.
- **Tabla/lista de datos equivalente al choropleth — requisito, no opcional.** El mapa expone una **alternativa de datos navegable** (`<table>` o lista, idealmente con un toggle "ver como tabla") que recorre **cada zona → partido ganador → votos → %** completa para todo el departamento, alcanzable por teclado y lector de pantalla. Es el equivalente no-visual del mapa (WCAG SC 1.1.1 Non-text Content) y ciudadano de primera clase: un usuario de lector de pantalla debe poder responder "¿quién ganó en el departamento?" de forma global, no solo zona-por-zona enfocando cada polígono. El anuncio puntual de la zona enfocada (abajo) **no** sustituye esta tabla.
- **Navegación por teclado** — toda acción (seleccionar zona, abrir ficha, **expandir/seleccionar cada nivel del acordeón de opción**, comparar, buscar, compartir) alcanzable por teclado; `Tab` sigue el orden de lectura; `Esc` colapsa el nivel/sheet/modal más arriba. El acordeón es un `tree`/`disclosure` con `aria-expanded` por nodo y selección anunciada.
- **Tabla de datos en vista por lista (Epic 10)** — cuando hay una HOJA/opción seleccionada, la tabla equivalente al choropleth recorre **cada zona → votos de esa lista → % → ranking en la zona**, no solo el ganador por lema. El usuario de lector de pantalla puede responder "¿dónde rindió la Lista 609?" globalmente, igual que el vidente con el mapa de intensidad.
- **Lector de pantalla** — el mapa expone una alternativa accesible: al enfocar/seleccionar una zona se anuncia "{zona}: {partido} ganador, {votos} votos, {%}". Cambios de superficie (depto, elección, modo comparación) se anuncian vía `aria-live`. El sello de origen es leíble.
- **Targets táctiles ≥44×44px** — el grip del bottom sheet, los swatches tocables de la leyenda, el botón compartir y los selectores (elección/opción/búsqueda) tienen un target efectivo de **≥44×44px** (objetivo; mínimo AA SC 2.5.8 es 24×24px). Para zonas del mapa diminutas y adyacentes, el camino accesible de selección es la **tabla/lista de datos** o la ficha — no el toque pixel-perfect sobre el polígono — para no forzar hit-areas que se solapen con vecinos (apoya FR4).
- **Reduce Motion** — respetar la preferencia del sistema: la expansión del sheet y transiciones de color del mapa se vuelven instantáneas; el resultado se muestra sin animación.

## Key Flows

### UJ-1 — Lucía, ciudadana curiosa (mobile, domingo de elección 22:10)

Lucía, 29, Maldonado. Vota, le interesa, pero no es "de política".

1. Le llega un **link compartido** por una amiga (o por Google/redes). _[A1]_
2. El link trae depto + elección en la URL → **aterriza directo en el mapa de Maldonado, ya coloreado**, respondiendo "¿quién ganó acá?" sin tocar nada. _[A2]_
3. Toca **su zona/barrio** → sube el bottom sheet con números grandes y legibles: ganador con **nombre humano** (lema/partido, no "HOJA 609"), votos y % sin scroll, sigla + color de partido.
4. Curiosea: cambia de departamento o ve el detalle por opción, sin perder el hilo — el mapa no se re-inicializa.
5. **Climax — comparte la vista exacta.** Toca "compartir", el link se copia, y al pegarlo se ve **bien**: preview rico con el contorno de Maldonado + título "Maldonado · Internas 2024" (build-time, no screenshot). El bucle viral del producto vive en este beat.
6. _(Opcional, progressive disclosure)_ Un toque de "comparar vs. 2019" le muestra el cambio a **nivel partido/lema** respecto al comicio previo. _[A3]_

**Aterriza:** entiende cómo votó su zona en < 1 minuto y comparte un link que se ve bien.
**Fallo:** el shard tarda → skeleton del contorno + sello visible; nunca un mapa a medio colorear ni una pantalla en blanco.

### UJ-2 — Andrés, periodista/analista (desktop, lunes post-elección)

Andrés, 41, redacción/freelance de datos, armando una nota.

1. Entra buscando **profundidad**: una lista específica a través de zonas/circuitos.
2. Abre el **selector de opción** y baja por el acordeón: Convención Nacional → Frente Amplio → Carolina Cosse → **Lista 6090**. O tipea "6090" en la búsqueda y salta directo. _[A4]_
3. El mapa se recolorea por **cómo le fue a la Lista 6090** en cada barrio (modo intensidad, % como texto por zona). Toca un barrio: la ficha muestra el desempeño de esa lista ahí y, expandible, el resto de las listas de Cosse en esa zona.
4. **Climax — hallazgo granular citable.** Aísla que la Lista 6090 rinde fuerte en un cordón de barrios que ningún otro sitio desagrega, y copia el **deep-link de la vista exacta** (FR20/FR21) — contienda + lema + precandidato + lista + zoom — para incrustarlo o citarlo. Cualquier lector reproduce su hallazgo. _(Comparación dual a nivel partido/lema sigue disponible para contrastar contra 2019 — FR16/FR17.)_
5. Confía en el dato porque respeta el **voto canónico** (escrutinio definitivo; nunca suma etapas — FR12), sello visible en pantalla.

**Aterriza:** un hallazgo granular, verificable y citable vía deep-link.
**Fallo:** la búsqueda no encuentra la lista/candidato que tipea → estado vacío con sugerencias (no un silencio ni un falso match); puede recuperar probando el nombre del lema o del depto. Y si pide comparar a nivel HOJA donde no hay tabla de equivalencias validada (FR18), la comparación **degrada a partido/lema y lo rotula** explícitamente en vez de fallar — Andrés sigue con el hallazgo a ese nivel, sabiendo qué está viendo.
**Nota de alcance:** la exportación CSV/imagen (FR23/FR24, F8) es **Fase 2**; en el MVP el dato citable se sirve por deep-link, no por export. La comparación a nivel HOJA entre elecciones (FR18) es best-effort de Fase 2.

## Responsive & Platform

Mobile-first; degrada con elegancia a desktop. Sitio estático servido por CDN (NFR5). El **mapa + selector son una unidad persistente** a través de cambios de ruta (NFR1, R7).

| Viewport | Comportamiento |
|---|---|
| **Mobile (primario)** | Mapa a pantalla casi completa bajo el masthead; resultado en **bottom sheet** (colapsado/expandido por swipe). Selectores y búsqueda como acciones deliberadas, no barras siempre abiertas. |
| **Tablet / desktop chico** | El bottom sheet se ancla como **panel lateral** junto al mapa; ambos visibles a la vez. |
| **Desktop (analista)** | Mapa + panel de ficha + controles de comparación coexisten. La comparación dual lado-a-lado usa el ancho extra para dos mapas. |

Foco explícito de compatibilidad en **Android de gama baja/media** (NFR6): el presupuesto de JS inicial y el tamaño de shard se acotan para que la primera respuesta cargue fluida (NFR1). Cambiar de depto/elección/modo **no re-inicializa** la instancia del mapa.
