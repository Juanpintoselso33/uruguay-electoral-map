# Spine Pair Review — Uruguay Electoral Map

> Rubric walker (validate.md). Revisión del par de spines (`DESIGN.md` + `EXPERIENCE.md`) como contrato para consumidores aguas abajo (Arquitectura, story-dev humano o IA). Pregunta rectora: ¿puede un consumidor source-extraer limpio, con cada referencia resolviendo y cada decisión load-bearing comprometida?

## Overall verdict

Par de spines **sólido y casi listo para handoff**. La columna vertebral visual es excepcional en disciplina: paleta de partidos tokenizada 1:1 con `partyColors.ts` (verificado), modo claro/oscuro como recolor (no rediseño), y un nivel de decision-readiness notable — la decisión del FA Variante A (relleno literal Otorgués) y el caveat del acento oscuro ("si querés sentir noche de elección, cambiá `accent-dark` a `#38E1C6` — ese es el único token que lo decide") son exactamente el tipo de llamada comprometida-pero-flageada que esta puerta premia. EXPERIENCE hereda FRs/NFRs verbatim y mantiene una sola pregunta por pantalla con rigor. El hueco real y único de severidad alta: **cuatro superficies interactivas (selector de elección, selector de opción, búsqueda, comparación dual) tienen spec de comportamiento en EXPERIENCE pero ninguna fila visual en `DESIGN.md.Components`** — y son precisamente las superficies de las que depende el clímax de UJ-2. Lo demás son ajustes de medio/bajo impacto: una referencia de token glob que no resuelve, contraste delegado sin números, y dos estados/fallos faltantes.

## 1. Flow coverage — adequate

Verificado: ambas UJ del decision-log (Lucía/UJ-1, Andrés/UJ-2) tienen Key Flow con protagonista nombrado, pasos numerados y un beat de clímax explícito (UJ-1 "comparte la vista exacta", UJ-2 "hallazgo granular citable"). El set de UJ está completo (el log no implica journeys adicionales).

### Findings
- **[medium]** UJ-2 (Andrés) no tiene **failure path** (§Key Flows, EXPERIENCE línea 131–142). UJ-1 sí lo tiene ("el shard tarda → skeleton + sello"). UJ-2 sólo trae una "Nota de alcance" sobre Fase 2, que no es un fallo. Hay fallos aplicables y citables: la **búsqueda no encuentra nada** (FR19) y la **comparación a nivel HOJA no disponible** (FR18/FR32 degrada a partido/lema). *Fix:* añadir línea "**Fallo:**" a UJ-2 cubriendo búsqueda sin resultados y degradación de comparación rotulada.

## 2. Token completeness — adequate

Extraídos todos los tokens del frontmatter (colors, typography, rounded, spacing, components) y todas las refs `{path}` en prosa de DESIGN: resuelven. Los cinco partidos mayores coinciden hex-a-hex con `src/utils/partyColors.ts` (FA `#A569BD`, PN `#55B5E5`, PC `#E52828`, CA `#2D7D3E`, PI `#7B2CBF`) — verificado. Sub-tokens de bandera Otorgués (`fa-flag-red/blue/white`, `fa-brand-yellow`) presentes con hex. Los ~14 partidos menores se delegan correctamente al código por nombre (no restatement). La estrategia de mitigación color-blind (sigla como texto, redundante al color) está bien declarada — no es un hueco.

### Findings
- **[medium]** **No hay targets numéricos de contraste para las combinaciones load-bearing**, pese a que la rúbrica los pide y EXPERIENCE (línea 107) delega explícitamente "el contraste y las paletas color-blind-safe son materia de `DESIGN.md`". DESIGN razona el contraste cualitativamente (acento oscuro falla, vibración de morados) pero no cuantifica ningún ratio. Combos sin número: (a) `party-on-fill` blanco sobre `zone-label-backing` `rgba(26,25,22,0.78)`; (b) sigla blanca sobre las franjas de la bandera FA (la franja **roja** `#D52B1E` y la **blanca** `#FFFFFF` son los casos límite); (c) `accent-dark` `#E0A6A6` como link sobre `paper-dark` `#151B2B`. *Fix:* añadir ratio objetivo (≥4.5:1 texto normal AA) a esos tres combos, o una nota explícita de que la verificación numérica es gate de Arquitectura.
- **[low]** El backing pill `zone-label-backing` es el mecanismo que rescata la legibilidad de la sigla sobre la franja blanca del FA y el celeste PN; su opacidad (0.78) está fijada pero sin objetivo de contraste resultante. Cubierto si se resuelve el finding anterior (a).

## 3. Component coverage — thin

Cross-walk de las dos listas:

| Componente | DESIGN.Components (visual) | EXPERIENCE Component Patterns (comportamiento) |
|---|---|---|
| Masthead | ✓ `masthead` | ✓ (vía Sello + selector) |
| Mapa / map-zone | ✓ `map-zone`, `FA map zone` | ✓ Mapa choropleth |
| Zone label / name | ✓ `zone-label`, `zone-name` | ✓ (dentro de Mapa) |
| Leyenda | ✓ `legend`, `legend-fa-swatch`, `legend-fa-mark` | ✓ Leyenda |
| Bottom sheet | ✓ `bottom-sheet` | ✓ Bottom sheet |
| Ficha resultado / winner | ✓ `winner-block`, `figures` | ✓ Ficha de resultado |
| Botón compartir | ✓ `button-share` | ✓ Botón compartir |
| Compare link | ✓ `compare-link` | ✓ (dentro de Comparación dual) |
| Sello de origen | ✓ (dentro de `masthead`) | ✓ Sello de origen del dato |
| **Selector de elección** | ✗ **falta fila visual** | ✓ comportamiento completo (FR5, FR15) |
| **Selector de opción** | ✗ **falta fila visual** | ✓ comportamiento completo (FR7, FR8) |
| **Búsqueda** | ✗ **falta fila visual** | ✓ comportamiento completo (FR19) |
| **Comparación dual** | ✗ **falta fila visual** | ✓ comportamiento completo (FR16–18) |

### Findings
- **[high]** **Cuatro superficies interactivas con spec de comportamiento en EXPERIENCE pero sin fila visual en `DESIGN.md.Components`**: Selector de elección, Selector de opción, Búsqueda y Comparación dual (EXPERIENCE §Component Patterns líneas 73–76; ausentes en DESIGN líneas 289–300). Son justo las superficies de las que depende el clímax de UJ-2 (buscar → comparar → deep-link) y la divulgación progresiva de UJ-1 ("comparar vs. 2019"). Un dev que construya el selector de elección, el panel de búsqueda o la vista dual/delta tiene reglas de comportamiento pero **cero contrato visual** (relleno, tipografía, tratamiento de chips/inputs, layout lado-a-lado vs delta). *Fix:* agregar filas a `DESIGN.md.Components` para `election-selector`, `option-selector`, `search` y `compare-view` (tokens de superficie, tipografía, y para compare-view la composición de dos mapas / barra delta), aunque sea mínimo. Si la intención es diferir su tratamiento visual a Arquitectura/implementación, decláralo explícitamente en DESIGN para que no lea como omisión.

## 4. State coverage — adequate

Recorridas las superficies de la IA. State Patterns cubre: cold-load (skeleton del contorno + sello), sin-datos-en-nivel (degradar + rotular, FR2), zona sin ganador, error de carga + reintento, comparando (indicador persistente), link copiado (efímero ~2 s), foco teclado. Offline se considera **defensiblemente omitido** — error-de-carga + retry cubre fallo de red para un sitio estático.

### Findings
- **[medium]** **Búsqueda no tiene estado vacío / sin-resultados.** Es superficie nombrada (IA) y componente (Component Patterns línea 76) pero State Patterns no cubre "la búsqueda no encontró nada". *Fix:* añadir fila de estado con microcopy en español rioplatense (consistente con Voice and Tone).
- **[low]** **"Overview nacional" no tiene tratamiento de cold-load/empty propio.** Sólo "Vista de departamento" tiene skeleton (State Patterns línea 85). El overview de los 19 deptos es la entrada-en-frío (IA, FR26) y carga su propia geometría. *Fix:* confirmar que reusa el skeleton de contorno o añadir nota.

## 5. Visual reference coverage — adequate

Archivos en `.working/`: `direction-editorial.html`, `direction-dark-night.html`, `fa-tricolor-test.html` (los tres referenciados en frontmatter `sources` de DESIGN y enlazados inline en EXPERIENCE línea 42); más `direction-civic-bold.html` y `direction-dataviz-minimal.html` (rejects — correctamente no referenciados). No existen carpetas `mockups/`, `wireframes/` ni `imports/` — sin huérfanos. La regla "el spine manda ante conflicto" está declarada (EXPERIENCE líneas 15 y 42).

### Findings
- **[low]** Las referencias a `.working/*.html` se citan a nivel sección general ("Referencia de composición", EXPERIENCE línea 42) pero no se ancla cada HTML al componente que ilustra (p. ej. `fa-tricolor-test.html` → componente Mapa FA / `legend-fa-swatch`). *Fix:* anclar cada HTML inline en su sección relevante y nombrar qué ilustra.
- **[low]** `legend-fa-mark` declara `glyph: 'entwined FA letters (asset TBD)'` y DESIGN línea 295 lo flagea ("no SVG glyph asset exists yet — implementation must produce it"). Bien flageado; queda como dependencia de asset para implementación, no como hueco del spine.

## 6. Bloat & overspecification — strong

Sin restatement de personas/FRs/scope (las personas viven sólo en Key Flows como protagonistas; los FRs se citan por ID, no se reescriben). DESIGN usa prosa con voz editorial (permitido); EXPERIENCE es funcional y tabular (correcto). Las tablas Do/Don't y Voice-Hacer/No-hacer son densas y útiles, no decorativas. No hay specs en píxeles donde un token alcance — los tamaños viven en frontmatter y la prosa los nombra. No detecté secciones que ningún consumidor leería.

### Findings
- *(ninguno — verdict strong)*

## 7. Inheritance discipline — strong

`sources` de ambos spines resuelven (verificado por path: `prd.md`, `project-context.md`, `.decision-log.md`, `DESIGN.md`, `partyColors.ts` — todos existen). Las refs `{path}` de EXPERIENCE resuelven a tokens de DESIGN por nombre: `{colors.ink}`, `{colors.card}`, `{colors.ink-soft}`, `{colors.hairline}`, `{colors.paper}`, `{colors.accent}` — todos OK. Nombres de FR verbatim respecto del PRD (spot-check FR2, FR3, FR16, FR18, FR22, FR25 — coinciden literal). Nombres de componente consistentes dentro de cada archivo. Glosario (FA/PN/PC/CA/PI, ODN/ODD, Otorgués) consistente entre spines, log y código.

### Findings
- **[medium]** **`{colors.party.*}` (EXPERIENCE línea 72) no resuelve a ningún token.** DESIGN define tokens planos `party-fa`, `party-pn`, etc. (con guión), no una rama anidada `party`. El `*` es notación glob/shorthand, no una referencia que un extractor pueda resolver por nombre. Es la única ref de token en EXPERIENCE que no resuelve. *Fix:* reemplazar por la convención real, p. ej. "color de partido vía tokens `{colors.party-fa}`…`{colors.party-pi}` (ver DESIGN.Colors)" o aclarar que `party.*` denota la familia `party-*`.

## 8. Shape fit — strong

DESIGN en orden canónico: Brand & Style → Colors → Typography → Layout & Spacing → Elevation & Depth → Shapes → Components → Do's and Don'ts. ✓ EXPERIENCE trae los defaults requeridos: Foundation, IA, Voice and Tone, Component Patterns, State Patterns, Interaction Primitives, Accessibility Floor, Key Flows. ✓ Required-when-applicable: **Responsive & Platform** presente (multi-surface mobile/tablet/desktop) — correcto. 

### Findings
- **[low]** **Inspiration está disparada pero manejada inline, no como sección nombrada.** Hay 4 direcciones renderizadas (sources del log) y rejects explícitos (FA Variantes B/C; dark-night neón/Space Grotesk). DESIGN las trata inline (Brand & Style, Colors §FA, Do/Don't) con rationale sólido. Se considera **defensible** — el material de inspiración y los rechazos están documentados donde importan para la decisión, no perdidos. *Fix (opcional):* una sección "Inspiration / Rejected directions" consolidaría los rechazos para consulta rápida del consumidor.

## Mechanical notes

- **Frontmatter:** ambos spines tienen `sources` completos y resolubles. DESIGN `status: draft` — apto para gate; subir a `validated`/`final` tras incorporar findings.
- **Cross-ref roto:** `{colors.party.*}` (EXPERIENCE 72) — único token no resoluble (ver §7).
- **Contradicción interna de modo oscuro (foco):** EXPERIENCE línea 91 fija el anillo de foco en `{colors.accent}` (oxblood `#8A1C1C`) "/ token de focus". Por el **propio razonamiento de DESIGN** (línea 242), oxblood sobre slate `#151B2B` falla contraste — por eso existe `accent-dark`. Entonces el anillo de foco sería ilegible en modo oscuro según el argumento del spine, y "token de focus" nombra un token inexistente. Es un ítem WCAG 2.2 AA que el doc dice cumplir. **[medium]** *Fix:* definir un token de foco explícito con par claro/oscuro (o usar `{colors.accent}` en claro y `{colors.accent-dark}` en oscuro) en DESIGN.Colors, y referenciarlo en EXPERIENCE.
- **Nombres de componente:** consistentes intra-archivo; la asimetría DESIGN↔EXPERIENCE es de cobertura (§3), no de naming.
- **Mermaid:** no se usan diagramas Mermaid; sin findings de sintaxis.
- **Sin secciones inventadas injustificadas.**

---

### Conteo de findings por severidad
- **Critical:** 0
- **High:** 1 (§3 — cuatro componentes interactivos sin contrato visual)
- **Medium:** 4 (§1 fallo UJ-2 · §2 contraste sin números · §4 búsqueda sin estado vacío · §7 `party.*` no resuelve / + foco oscuro en Mechanical)
- **Low:** 5 (§2 backing pill · §4 overview cold-load · §5 anclaje refs + glyph TBD · §8 Inspiration inline)
