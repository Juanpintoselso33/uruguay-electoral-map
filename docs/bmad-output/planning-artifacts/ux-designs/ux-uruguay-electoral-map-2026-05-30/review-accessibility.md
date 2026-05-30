# Revisión de Accesibilidad — Uruguay Electoral Map

> Especialista en accesibilidad. Objetivo declarado: **WCAG 2.2 AA** (NFR2). Revisión de `DESIGN.md` + `EXPERIENCE.md` + `.decision-log.md` (todos 2026-05-30, status draft).
> Los ratios de contraste se computaron a partir de los tokens hex (algoritmo WCAG relative luminance). Las distancias color-blind se simularon con matrices Machado 2009 (severidad 1.0) para deuteranopía y protanopía.

---

## Veredicto en una frase

El spine acierta en lo estructural (sigla-como-texto, pill de respaldo, fallback de nivel de datos), y el respaldo oscuro de la etiqueta **sí rescata** el problema de la franja blanca del FA — pero hay **dos fallos AA reales no mitigados** (la etiqueta de zona a 9px y la falta de tabla de datos accesible para el choropleth), un **fallo crítico de visión cromática** (PC rojo vs CA verde, y FA-rojo vs Colorado-rojo) que la regla de sigla mitiga solo parcialmente, y **varios contratos sin cifras verificables** (targets táctiles, estado de foco, resize de texto) que deben fijarse antes de implementación.

---

## Hallazgos (peor primero)

### `[crítico]` El choropleth no tiene alternativa de datos accesible real (tabla) — §EXPERIENCE Accessibility Floor / State Patterns
El spine dice que "al enfocar/seleccionar una zona se anuncia '{zona}: {partido} ganador, {votos} votos, {%}'" y que los cambios de superficie usan `aria-live`. Eso describe el *anuncio puntual de una zona enfocada*, **no** una alternativa de datos completa para todo el mapa. El patrón canónico de a11y para mapas coropléticos (WCAG SC 1.1.1 Non-text Content, y la guía de "accessible data visualization") exige una **tabla de datos equivalente** navegable (zona → partido ganador → votos → %) que un usuario de lector de pantalla pueda recorrer sin tener que "tabular" zona por zona dentro de un SVG. Sin esto, un ciego no puede responder "¿quién ganó en el departamento?" globalmente, solo zona-por-zona si logra enfocar cada polígono. **Acción:** especificar una tabla `<table>` (o lista) sincronizada con el mapa, idealmente toggle "ver como tabla", como ciudadano de primera clase, no como anuncio efímero.

### `[crítico]` Contraste de etiqueta sobre fondos claros — DEPENDE 100% del pill; si el pill no se renderiza o es parcialmente translúcido, falla — token `party-on-fill #FFFFFF`, `zone-label-backing rgba(26,25,22,0.78)`
Computé los ratios de texto blanco directo sobre los rellenos (sin pill):

| Texto blanco sobre… | Ratio | ¿AA? (4.5 normal / 3.0 ≥18.66px·700) |
|---|---|---|
| FA franja blanca `#FFFFFF` | **1.00** | FALLA — invisible (el caso que el brief marca como crítico) |
| PN celeste `#55B5E5` | **2.30** | FALLA |
| FA violeta `#A569BD` (solo leyenda) | 3.92 | FALLA normal; pasa solo si ≥18.66px bold |
| PC rojo `#E52828` | 4.50 | Pasa AA normal (al límite) |
| FA franja roja `#D52B1E` | 5.01 | Pasa |
| CA verde `#2D7D3E` | 5.10 | Pasa |
| PI morado `#7B2CBF` | 7.11 | Pasa |
| FA franja azul `#0038A8` | 9.85 | Pasa |

La franja blanca del FA + texto blanco = **1.00:1, literalmente invisible**. El diseño **sí prevé esto**: el token `zone-label-backing rgba(26,25,22,0.78)` es un pill oscuro obligatorio bajo la sigla. Composité ese pill sobre la peor base:
- pill sobre franja blanca FA → color efectivo `#4C4C49` → texto blanco = **8.62:1** ✔
- pill sobre celeste PN → `#273B44` → texto blanco = **11.70:1** ✔

**Conclusión:** el problema de la franja blanca **está mitigado correctamente por el pill** — *siempre que el pill se renderice opaco al 0.78 y nunca se omita*. El riesgo residual es de implementación: DESIGN.md dice "backing is mandatory, not optional", pero `zone-name` (6.6px, el nombre del barrio bajo la sigla) lleva `color: party-on-fill` (blanco) y **NO** se le asigna pill ni backing en el spec de componente. Ese nombre de zona en blanco sobre franja blanca FA o celeste PN es **invisible (1.00 / 2.30)**. **Acción:** extender el pill (o un color de texto adaptativo) también a `zone-name`, o declararlo explícitamente decorativo.

### `[alto]` Etiqueta de zona a 9px y nombre de zona a 6.6px — demasiado chico para AA y para superar el ruido del fondo — `typography.zone-label` (9px/700), `typography.zone-name` (6.6px/500)
WCAG 2.2 no fija un mínimo de tamaño de fuente per se, pero 9px/6.6px chocan con varios criterios prácticos: (1) **SC 1.4.4 Resize Text** — el texto debe poder ampliarse al 200% sin pérdida; texto pintado *dentro* de un SVG/canvas del mapa típicamente **no** escala con el zoom de fuente del navegador, así que 9px se queda en 9px → fallo probable de 1.4.4. (2) A 6.6px el nombre de zona es ilegible para baja visión y casi seguro irreproducible en Android gama baja (NFR6). (3) El umbral de "texto grande" AA (3:1) requiere ≥18.66px en bold — 9px no califica, así que la sigla debe cumplir el **4.5:1 normal**, lo cual el pill garantiza pero deja cero margen. **Acción:** subir `zone-label` a ≥11px, tratar `zone-name` como progressive-disclosure (mostrarlo solo en la ficha, no pintado en el mapa), y garantizar que las etiquetas escalen con el resize de texto o se ofrezcan en la tabla alternativa.

### `[alto]` Visión cromática: PC rojo vs CA verde, y FA-rojo vs Colorado-rojo — colapsan bajo daltonismo; la sigla mitiga pero no elimina el riesgo — tokens `party-pc #E52828`, `party-ca #2D7D3E`, `fa-flag-red #D52B1E`
Simulación Machado (distancia RGB; menor = más confundibles):

| Par | Normal | Deuteranopía | Protanopía |
|---|---|---|---|
| PC rojo vs CA verde | 204 | **28** | 77 |
| FA franja roja vs PC rojo | 19 | **10** | 11 |
| FA violeta vs PI morado (solo leyenda) | 74 | 86 | 88 |

- **PC rojo vs CA verde**: caída de 204→28 en deuteranopía — prácticamente indistinguibles (el clásico rojo-verde). Dos zonas adyacentes ganadas por Colorado y Cabildo se ven idénticas en color.
- **FA-rojo vs Colorado-rojo**: ya ~19 en visión normal (el choque documentado en decision-log línea 16); ~10 bajo CVD — esencialmente el mismo color. La Variante A (bandera literal) **conserva** este choque a propósito.
- Buena noticia: **FA violeta vs PI morado NO colisiona** bajo CVD (~86) — y además en el mapa el FA es la bandera, no el violeta, así que ese par del brief es un no-issue en el mapa (solo coexisten en la leyenda, donde sí se distinguen).

La **regla "ganador nunca solo por color" + sigla de texto** es la mitigación correcta y es load-bearing aquí. Residual: la mitigación **solo funciona si la sigla es legible** (ver hallazgos de 9px y pill arriba) y si la sigla está presente en *cada* zona, incluso las diminutas donde quizá no entre el pill+texto. **Acción:** definir comportamiento cuando la zona es más chica que la etiqueta (¿leader line? ¿la tabla alternativa cubre esas zonas?); confirmar borde nítido por zona (`stroke: paper 2px`) como segunda señal no-cromática — está bien especificado, mantenerlo.

### `[alto]` Targets táctiles ≥44px afirmados pero sin número verificable y en tensión con polígonos chicos — FR4, §EXPERIENCE Interaction Primitives / Layout & Spacing
DESIGN.md dice "Tap targets on map zones and sheet controls meet a 44px minimum even where the visual element is smaller" y EXPERIENCE lo repite. **WCAG 2.2 SC 2.5.8 Target Size (Minimum) es 24×24px** (AA); 44×44px es el nivel AAA / guía Apple-Android. Que apunten a 44 es bueno, pero: (1) no hay especificación de *cómo* un polígono geográfico de 8px obtiene un target de 44px sin solaparse con vecinos (¿hit-area inflada? ¿colisión de targets adyacentes?). Targets solapados violan la intención de 2.5.8. (2) El **grip del sheet** usa `color hairline` pero no tiene dimensión de target declarada. (3) Botón compartir: `padding 13px` + texto body — probablemente ≥44px de alto pero no está afirmado. **Acción:** declarar dimensiones concretas (≥24px obligatorio AA, ≥44px objetivo) para grip, swatches de leyenda tocables, botón compartir y la hit-area de zona; resolver la colisión de targets en zonas densas (Montevideo tiene barrios chicos).

### `[medio]` Estado de foco: token referenciado pero no definido, y posible bajo contraste del anillo — §EXPERIENCE State Patterns "Foco (teclado)"
EXPERIENCE dice "Anillo de foco visible con `{colors.accent}` / token de focus". Problemas: (1) **no existe un `focus` token** en DESIGN.md — es un contrato roto, hay que definirlo. (2) Usar `accent` (oxblood `#8A1C1C`) como anillo de foco: en claro contrasta 8.45:1 contra paper (ok como indicador no-textual, SC 1.4.11 pide ≥3:1) — **pasa**. Pero en **modo oscuro** `accent` oxblood sobre `paper-dark` da **1.85:1 → FALLA SC 1.4.11** (3:1 para componentes UI / indicadores de foco). El propio DESIGN.md reconoce que oxblood falla en oscuro para links y por eso creó `accent-dark #E0A6A6` (8.32:1 ✔). **El anillo de foco en oscuro debe usar `accent-dark`, no `accent`.** **Acción:** crear `focus`/`focus-dark` tokens explícitos; usar `accent-dark` en oscuro; especificar grosor/offset visible (SC 2.4.13 Focus Appearance, nuevo en 2.2).

### `[alto]` El borde de zona seleccionada se vuelve invisible en modo oscuro — no hay `stroke-selected-dark` — `map-zone.stroke-selected: {colors.ink}`
Gemelo en la superficie del mapa del hallazgo del token de foco. `map-zone` define solo `stroke: {colors.paper}` y `stroke-selected: {colors.ink}` (#1A1916, casi negro), **sin override oscuro**. DESIGN.md §Elevation afirma explícitamente que "selected state is communicated by stroke weight/color, **not by glow**" — pero en oscuro ese stroke negro es imperceptible:
- ink `#1A1916` selected-stroke sobre paper-dark `#151B2B` = **1.02:1** (invisible)
- ink sobre PI morado `#7B2CBF` = 2.47:1 · sobre FA azul `#0038A8` = 1.78:1 — ambos por debajo de 3:1

Resultado: en modo oscuro **el estado seleccionado no tiene indicador perceptible** (falla SC 1.4.11 Non-text Contrast y SC 2.4.13 Focus Appearance), y como el diseño prohíbe el glow no hay señal de respaldo. **Acción:** definir `stroke-selected-dark` (p. ej. `ink-dark #E8ECF6`, que da alto contraste sobre los rellenos) y confirmar que el stroke separador por defecto recolorea sensatamente en oscuro (paper claro entre zonas oscuras también necesita revisión).

### `[medio]` El separador de 2px (`paper`) — segunda señal no-cromática — desaparece entre vecinos claros — `map-zone.stroke: {colors.paper}`
Apoyo la regla de borde nítido por zona como señal no-cromática load-bearing para la mitigación CVD, pero su propio contraste no es universal. El stroke es paper `#F7F4EE`: entre dos rellenos *claros* (franja blanca FA `#FFFFFF` ↔ celeste PN `#55B5E5`) el separador da **1.10:1 y 2.10:1** — es decir, se desvanece justo entre vecinos claros similares. Funciona donde el decision-log se preocupaba (paper vs rojos adyacentes) pero no entre zonas FA-blanco y PN-celeste contiguas. **Acción:** considerar un stroke de contraste adaptativo (oscuro entre rellenos claros) o apoyarse en que la sigla+pill cubre ese caso; documentar la dependencia.

### `[medio]` `accent-dark #E0A6A6` como color de link/texto en oscuro — pasa AA pero verificar sobre TODAS las superficies — token `accent-dark`
Computé `#E0A6A6` sobre las tres superficies oscuras: paper-dark 8.32:1, panel-dark 7.32:1, card-dark (`#28324A`) **6.18:1**. Todas **pasan AA** (4.5:1) cómodamente, incluida la peor (card). Bien resuelto. Nota menor: el link es oxblood-italic-subrayado en claro; el subrayado satisface SC 1.4.1 (no solo color) — mantener el subrayado también en oscuro para no depender del matiz rosado.

### `[bajo]` Contrastes del chrome — todos sólidos, sin acción
Verificados y holgados: ink `#1A1916` sobre paper `#F7F4EE` = **16.0:1** ✔; ink-dark `#E8ECF6` sobre paper-dark `#151B2B` = **14.5:1** ✔; ink-soft `#5C574E` sobre paper = **6.53:1** ✔ (el sello de verificación y metadata pasan AA); ink-soft-dark `#93A0BC` sobre paper-dark = **6.53:1** ✔. El chrome editorial está bien calibrado. Único cuidado: ink-soft a 11px (`meta`) y 10px (`label-caps`) está al límite de legibilidad para baja visión aunque el ratio sobre — preferir no bajar de ahí.

### `[bajo]` Reduce Motion bien cubierto; falta cubrir el feedback efímero — §EXPERIENCE Accessibility Floor / State Patterns
"Reduce Motion" respeta `prefers-reduced-motion` y vuelve instantáneas las transiciones — correcto (SC 2.3.3). La confirmación "Link copiado ~2s" es no-bloqueante (bien, evita SC 2.2.1 issues), pero debe **anunciarse por `aria-live="polite"`** para lectores de pantalla — no está especificado. La marca FA amarilla (`fa-brand-yellow #FFCD00`) con glifo azul: texto/glifo sobre amarillo da contrastes bajos (blanco sobre amarillo = 1.50:1); como es asset TBD, **flag para que el glifo use el azul `#0038A8` (no blanco) y cumpla 3:1 como gráfico**.

---

## Resumen de acciones prioritarias

1. **Especificar tabla de datos accesible** equivalente al choropleth (no solo anuncio de zona enfocada). [crítico]
2. **Extender el pill de respaldo a `zone-name`** o declararlo decorativo; el pill ya resuelve la franja blanca FA para la sigla. [crítico]
3. **Subir `zone-label` a ≥11px**, sacar `zone-name` 6.6px del mapa, garantizar resize de texto (SC 1.4.4). [alto]
4. **Definir comportamiento de sigla en zonas diminutas** (la mitigación CVD depende de que la sigla siempre sea legible). [alto]
5. **Declarar dimensiones de target** (≥24px AA / 44px objetivo) para grip, swatches, compartir y hit-area de zona; resolver solapamientos. [alto]
6. **Definir `stroke-selected-dark`** — el borde de seleccción negro es invisible (1.02:1) en oscuro. [alto]
7. **Crear tokens `focus`/`focus-dark`**; usar `accent-dark` (no `accent`) para el anillo en oscuro (oxblood falla 1.85:1). [medio]
8. **Revisar el separador `paper`** entre vecinos claros (FA-blanco ↔ PN-celeste, 1.10–2.10:1). [medio]
9. **Anunciar "Link copiado" vía `aria-live`**; glifo FA en azul sobre amarillo, no blanco. [bajo]

---

*Archivo: `docs/bmad-output/planning-artifacts/ux-designs/ux-uruguay-electoral-map-2026-05-30/review-accessibility.md`*
