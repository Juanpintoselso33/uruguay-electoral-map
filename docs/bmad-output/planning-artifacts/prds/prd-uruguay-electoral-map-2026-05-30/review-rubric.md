# PRD Quality Review — Uruguay Electoral Map (Rebuild)

## Overall verdict

Este es un PRD coherente, honesto y bien acotado: tiene una tesis real ("el lugar al que se vuelve para **entender** una elección"), métricas que validan esa tesis (no solo actividad), y un manejo del alcance ejemplar para un proyecto cívico/portfolio de dev solo. Lo que aguanta: la coherencia estratégica, el shape-fit (consumer product con UJs de protagonista nombrado que cargan peso), y la honestidad de scope (Non-Goals explícitos, riesgos calibrados, decisión de stack correctamente diferida a Arquitectura). Lo que queda en riesgo es localizado, no estructural: un puñado de FRs sin consecuencia testeable ("leyenda clara", "números legibles", "indicador de confianza") y la ausencia de un Glossary en un PRD denso en jerga de dominio. **Gate: proceder con condiciones** — el déficit de criterios de aceptación es pulido normal de pre-Finalize (el propio PRD enruta a Finalize), no un bloqueo a la creación de historias.

## Decision-readiness — strong

Las decisiones se enuncian como decisiones, no se entierran como "consideraciones". §5 fija el MVP-B con una decisión atribuida explícita ("_[Decisión de Juan: histórico desde el inicio.]_") y nombra el trade-off que asume: histórico desde el inicio es ambicioso para un dev solo, y eso se reconoce sin maquillaje en R6 ("Ambición MVP-B para dev solo"). El "casi-MVP" de F8 (exportar) está argumentado con su razón ("el analista es secundario; exportar puede esperar") y queda abierto de verdad en OQ1, no como pregunta retórica con respuesta en la línea siguiente.

Los trade-offs nombran lo que se cede: NFR5 elige artefactos estáticos y, al hacerlo, descarta cualquier vista en vivo (movida a Fase futura en §5). R1 nombra la degradación aceptada si la normalización de HOJA es inviable ("degradar la comparación a nivel **partido/lema** en vez de lista"). Las preguntas abiertas (OQ1–OQ5) son genuinamente abiertas y están ruteadas a "triage en Finalize".

Crédito explícito: el stack vive en el addendum **por diseño** — el addendum dice "NO es decisión final — la fija Arquitectura". Para un PRD chain-top esto es higiene correcta, no una omisión. Un revisor que penalizara la diferición estaría equivocado.

## Substance over theater — strong

Sin teatro detectable. Dos personas, no cinco, y cada una **mueve una decisión**: el ciudadano (UJ-1) ordena el producto entero ("El producto se ordena según su éxito", §2) y genera la tensión central de progressive disclosure; el analista (UJ-2) justifica F8 y FR16/FR17 y, a la vez, su carácter secundario justifica sacar F8 del MVP. Quitá cualquiera de las dos y el PRD cambia — eso es lo opuesto a persona-furniture.

La sección de diferenciador (§1, "permanencia + granularidad + comparabilidad histórica") no es innovación-teatro porque está honestamente marcada como hipótesis a verificar (R3 + OQ5, "Hueco competitivo no verificado"), no afirmada como hecho. Los NFR evitan el boilerplate: NFR1 da umbrales product-specific (LCP < 2.5 s, INP < 200 ms, CLS < 0.1 en 4G de gama media), no "el sistema debe ser performante". La Vision (§1) no es intercambiable: "No compite por velocidad la noche electoral" es una afirmación que la mayoría de los productos electorales NO podría copiar.

## Strategic coherence — strong

Hay tesis y las features sirven a un arco unificado. La apuesta: los medios dan cobertura efímera y la Corte da datos crudos con viz pobre; el hueco es un archivo permanente, granular y comparable (§1). Cada bloque de features traza a esa tesis: la permanencia exige F5 (histórico) y F10 (ETL reproducible); la granularidad exige F1/F2/F3 (HOJA × zona/circuito); la comparabilidad exige F5 + R1 (normalización). El crecimiento se apoya en F7 (deep-links + preview social) que alimenta el bucle viral del ciudadano.

Las métricas validan la tesis, no solo miden actividad: M8 ("Integridad del dato: 0 discrepancias, gate duro") ata directamente al "confianza = razón de ser" — no es un DAU/MAU genérico. M1 (completar el JTBD) mide el corazón de UJ-1, no vanidad. Las contra-métricas existen y son específicas: CM4 ("Nunca inflar completitud sumando etapas") protege la integridad contra la apariencia, CM5 ata M3 a M7. El scope kind es de experiencia/problema (no plataforma ni revenue) y la lógica de §5 lo refleja.

## Done-ness clarity — adequate

La mayoría de los FRs cargan al menos una consecuencia testeable, y por eso esta dimensión es *adequate* con vacíos nombrados, no *thin*. Verificables tal como están: FR1 (mapa con zonas coloreadas por ganador), FR5/FR6/FR7 (selección de elección/depto/lista — comprobable), FR12 (una sola etapa de ESCRUTINIO; nunca sumar — binario y testeable), FR20 (todo el estado vive en la URL — verificable por reproducción), FR22 (OG-image pre-generada por ruta — M7 le da el umbral "100% de rutas canónicas"), FR31 (gate de cobertura mínima — falla el build bajo umbral).

Los puntos blandos son concretos y localizados:

### Findings
- **[high]** FRs con adjetivos en lugar de cotas (§4) — FR3 "con leyenda clara", FR11 "números legibles y jerarquizados en mobile", FR25 "nunca en la cara". Un ingeniero no sabe cuándo una leyenda está "clara" ni cuándo un número es "legible". *Fix:* convertir en consecuencias testeables (p. ej. FR11 → tamaño mínimo de tipografía y orden de jerarquía explícito; FR3 → la leyenda lista todas las categorías coloreadas visibles sin scroll en viewport mobile).
- **[medium]** FR14 "Indicador de confianza del dato / reconciliación con totales oficiales" (§4) — "indicador de confianza" es difuso como criterio de UI. Está parcialmente rescatado por M8 (0 discrepancias, gate duro) y NFR4, que sí dan la cota del lado del *dato*; lo que falta es la cota del lado del *indicador visible al usuario*. *Fix:* especificar qué muestra el indicador (p. ej. "% de reconciliación con el total oficial del depto" o estado verde/amarillo con umbral).
- **[medium]** FR2 y FR9 "según disponibilidad de datos" / "sin configuración" (§4) — FR2 condiciona el nivel circuito a disponibilidad sin definir el comportamiento de fallback testeable (¿qué ve el usuario cuando un depto no tiene circuitos?). *Fix:* nombrar la consecuencia observable del fallback (degradar a zona, mensaje, etc.); FR9 ya está mejor servido por FR26 (overview nacional) — referenciarlo.
- **[low]** Sin sección de Acceptance explícita — para la mayoría de FRs las consecuencias alcanzan, pero F5 (comparación) se beneficiaría de criterios de aceptación dedicados dado que es el núcleo MVP-B y el de mayor riesgo (R1). *Fix:* en Finalize, añadir AC para FR16/FR17 (qué significa "comparar lado-a-lado" correctamente a nivel zona).

## Scope honesty — strong

Las omisiones son explícitas, no inferidas. §5 tiene una sección "Fase futura (fuera del MVP)" que hace trabajo real: nombra la vista "noche electoral" en vivo, OG-image on-demand, circuitos de todo el país vía PMTiles, y comparación multi-variable avanzada — cada una es algo que un lector podría asumir silenciosamente incluido, y se descarta a la vista. El de-scoping de F8 se propone honestamente (no se hace en silencio) y queda como pregunta abierta (OQ1).

Densidad de open-items proporcional a stakes: 5 OQ + 8 riesgos + ~7 ASSUMPTION inline, sobre un PRD pre-Finalize de un proyecto solo-dev. Esto es apropiado — el documento se cierra ruteando a Finalize para el triage, así que la densidad alta es esperada y sana, no un bloqueo. Si esto fuera un green-light-to-build, los assumptions sin confirmar (A1–A5, R3) serían bloqueantes; como pre-Finalize, son exactamente el inventario que Finalize debe resolver.

Los riesgos están calibrados con severidad y mitigación, no son una lista de miedos: R1 es el único 🔴 y trae mitigación con plan B (degradar a partido/lema). El uso de `[ASSUMPTION: …]` marca inferencias que el usuario no confirmó (entrada por link, sin geoloc, búsqueda no semántica).

## Downstream usability — adequate

Este PRD alimenta UX → Arquitectura → historias, así que la dimensión pesa. Lo que funciona: los IDs FR1–FR32 son contiguos y únicos; las cross-refs internas resuelven (FR18↔FR32↔R1, FR22↔FR30↔M7, FR19↔FR29); las UJs tienen protagonistas nombrados con contexto inline (Lucía, Andrés); las features se agrupan por capacidad (F1–F10) y el mapeo capacidad→alcance está consolidado en §5. Las secciones se sostienen razonablemente extraídas solas.

Las grietas:

### Findings
- **[medium]** Sin Glossary en un PRD denso en dominio (todo el doc) — términos como `HOJA`, `ESCRUTINIO`, `voto canónico`, `lema`, `ODN/ODD`, `circuito`, `serie` se usan asumiendo conocimiento. "Serie" entra en frío en FR13 ("zona → serie → circuito → depto") y no se define en ninguna parte. UX y creación de historias source-extraen estos sustantivos; sin un glosario, el riesgo de drift downstream es real. *Fix:* añadir §Glossary con cada sustantivo de dominio definido una vez; verificar que FR13 use un término ya glosado.
- **[low-medium]** Roundtrip del índice de Assumptions roto (§4, §8) — FR19 referencia "[no semántico — A4]", FR26 referencia "[A2]", y OQ2 nombra "los supuestos A1–A5", pero **no existe un índice numerado** y los `[ASSUMPTION: …]` inline NO están numerados en su ubicación. Las referencias taquigráficas A1–A5 quedan colgando: el lector no puede resolver qué assumption es "A2". *Fix:* numerar cada `[ASSUMPTION]` inline (A1…An) y agregar un Assumptions Index al final que haga roundtrip con esas etiquetas.

## Shape fit — strong

El PRD tiene la forma correcta para lo que es. Es un consumer product mobile-first con UX significativa, y por lo tanto los UJs con protagonista nombrado son load-bearing — y están presentes y bien construidos (Lucía y Andrés cargan el contexto inline: edad, depto, dispositivo, momento, intención). No está sobre-formalizado (no hay densidad de UJ artificial para un producto de un operador) ni sub-formalizado (no es un consumer product sin UJs).

El rigor es apropiado al stake "producto serio" de dev solo: las cotas duras están donde importan (integridad de dato M8/NFR4, performance NFR1) y se mantiene liviano donde corresponde (§6 declara explícitamente "proyecto cívico/portfolio, no startup con funnel pago", evitando métricas de funnel pago que no aplican). El stack diferido al addendum es exactamente lo correcto para un chain-top que precede a la fase de Arquitectura. No hay forzamiento de shape.

## Mechanical notes

- **Glossary drift / términos sin definir:** "serie" aparece solo en FR13 sin definición; `ODN` aparece en FR7 ("cuando aplica, ODN") sin glosa en el cuerpo del PRD (está en CLAUDE.md, no en el doc). Cubierto como finding medium en Downstream usability.
- **Continuidad de IDs:** FR1–FR32 contiguos y únicos (sin saltos ni duplicados); M1–M8 y CM1–CM5 contiguos; R1–R8 y OQ1–OQ5 contiguos. Limpio.
- **Roundtrip de Assumptions:** roto — etiquetas A1–A5 referenciadas (FR19, FR26, OQ2) sin índice numerado ni numeración inline. Cubierto como finding en Downstream usability.
- **Cross-refs:** todas las internas resuelven (FR↔FR, FR↔NFR, FR↔M, FR↔R, §-refs). El addendum referenciado desde R7 existe y es consistente.
- **Secciones requeridas para el stake/tipo:** presentes (Resumen, Personas, UJs, FRs, Alcance/Non-Goals, Métricas + contra-métricas, NFRs, Riesgos + Open Questions). Falta solo el Glossary.
