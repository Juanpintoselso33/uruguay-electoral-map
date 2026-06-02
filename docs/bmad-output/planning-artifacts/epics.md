---
stepsCompleted: [1, 2, 3, 4]
status: complete
lastUpdated: 2026-05-31
inputDocuments:
  - docs/bmad-output/planning-artifacts/prds/prd-uruguay-electoral-map-2026-05-30/prd.md
  - docs/bmad-output/planning-artifacts/architecture.md
  - docs/bmad-output/planning-artifacts/ux-designs/ux-uruguay-electoral-map-2026-05-30/DESIGN.md
  - docs/bmad-output/planning-artifacts/ux-designs/ux-uruguay-electoral-map-2026-05-30/EXPERIENCE.md
  - docs/bmad-output/project-context.md
---

# Uruguay Electoral Map - Epic Breakdown

## Overview

Desglose de épicas e historias para el rebuild de Uruguay Electoral Map, decomponiendo PRD + UX + Arquitectura en historias implementables. **Slice MVP:** Montevideo × {internas-2024, nacionales-2019}, nivel partido/lema, mobile impecable, compartir con preview.

## Requirements Inventory

### Functional Requirements
- **FR1** Renderizar mapa del depto con zonas coloreadas por opción/partido ganador.
- **FR2** Niveles geográficos depto/zona/circuito; degradar al nivel disponible y rotularlo.
- **FR3** Una variable coloreada por vez en el mapa individual; leyenda nombra color+escala.
- **FR4** Interacción táctil mobile (tap zona, pan, zoom) operable con el pulgar.
- **FR5** Seleccionar tipo de elección (internas|nacionales|balotaje|departamentales) y año.
- **FR6** Seleccionar departamento.
- **FR7** Seleccionar opción electoral según tipo: HOJA o candidato/lema (selector adaptativo).
- **FR8** Alternar vista: "¿quién ganó?" vs "¿cómo le fue a ESTA opción?".
- **FR9** Tap en zona → ficha con resultados (opción/partido, votos, %); blanco/anulado/observado como categorías.
- **FR10** Traducir dato crudo → nombre humano (lema, nº lista, candidato, color de partido).
- **FR11** Dato dominante (ganador + %) legible sin scroll en la ficha en mobile.
- **FR12** Voto canónico de la etapa de escrutinio DEFINITIVO; nunca sumar etapas.
- **FR13** Agregaciones (zona→serie→circuito→depto) por roll-up de válidos.
- **FR14** Sello de origen y etapa del dato en la UI; reconciliación como gate de build.
- **FR15** Navegar entre múltiples elecciones del mismo departamento.
- **FR16** Modo comparación dual (lado-a-lado o cambio) entre dos elecciones, default partido/lema, granularidad zona/circuito.
- **FR17** Comparar dos opciones dentro de una misma elección.
- **FR18** (Fase 2) Comparación a nivel HOJA donde exista tabla de equivalencias validada.
- **FR19** Buscar y saltar a lista, candidato o departamento conocido (índice estático, no semántico).
- **FR20** Estado relevante (elección, depto, zona/opción, vista, zoom) vive en la URL.
- **FR21** Botón "compartir" que copia el deep-link de la vista actual.
- **FR22** Preview social rico por ruta (meta-tags + OG-image build-time desde geometría vectorial).
- **FR23** (Fase 2) Exportar el dato de la vista actual (CSV).
- **FR24** (Fase 2) Exportar imagen del mapa/ficha.
- **FR25** La entrada responde la pregunta del ciudadano sin configuración; capas avanzadas a un clic.
- **FR26** Entrada en frío = overview nacional + selector de departamento.
- **FR27** Normalizar fuentes a UTF-8 en la ingesta (ETL).
- **FR28** Artefactos shardeados por elección×departamento + agregados precomputados.
- **FR29** Generar índice de búsqueda estático.
- **FR30** Generar OG-images por ruta canónica en build-time.
- **FR31** Validar cobertura de zonas (reporte + gate de cobertura mínima).
- **FR32** Tabla de normalización de HOJA entre elecciones (JSON declarativo, editable sin código).
- **FR33** ETL + modelo para balotaje: 2 opciones fijas (candidatos), sin HOJA, opcion_id = candidato.
- **FR34** ETL + modelo para plebiscito: opción binaria (Sí/No), texto de pregunta como metadata.
- **FR35** ETL + modelo para nacionales de años adicionales (2024, 2014, etc.) con HOJA y lemas.
- **FR36** ETL + modelo para elecciones departamentales (intendentes, ediles, alcaldes).
- **FR37** UI: selector de opción adaptado al tipo de elección (balotaje ≠ internas ≠ plebiscito).
- **FR38** Sello/etiqueta en la UI que identifica el tipo de elección y sus reglas de visualización.
- **FR39** Tabla SERIE→localidad derivada del plan circuital de la Corte Electoral; mapeo 1:1 automático para el interior.
- **FR40** Geometría de localidades del interior (IDE Uruguay — polígonos de localidades) como TopoJSON.
- **FR41** ETL join SERIE→localidad→geometría; visualización del mapa por localidad en departamentos del interior.
- **FR42** Detección de ciudades "grandes" del interior (serie repite nombre de ciudad) → degradar a ciudad como unidad con rótulo explicativo.
- **FR43** Research + tabla de equivalencia manual SERIE→barrio para ciudades grandes del interior (Salto, Paysandú, Melo, Rivera ciudad, Artigas ciudad, etc.).
- **FR44** Datos electorales + geometría + ETL para los 15 departamentos pendientes (Canelones, San José, Rocha, Florida, Lavalleja, Durazno, Flores, Soriano, Río Negro, Paysandú, Salto, Artigas, Rivera, Tacuarembó, Cerro Largo).
- **FR45** ETL: emitir catálogo de opciones JERÁRQUICO y shards de votos a nivel HOJA (lista individual), no solo agregado por lema. La escalera de granularidad (contienda → lema → precandidato/sublema → hoja) la declara cada tipo de elección; el `opcion_id` de HOJA es compuesto (contienda+lema+hoja) porque los números de lista se reusan entre departamentos.
- **FR46** UI: selector de opción como ACORDEÓN jerárquico **multi-selección** que se adapta a la escalera del tipo de elección y contienda activos; marcar uno o varios nodos (en cualquier nivel) colorea el mapa por la SUMA de la selección. Seleccionar un nodo padre = agregado de sus hojas.
- **FR47** UI: filtro de partido/lema (visibilidad, no selección), búsqueda de lista por número, "seleccionar todas" que respeta el filtro, y chips de filtros/selección activos. La selección se limpia al cambiar departamento, elección o contienda.
- **FR48** Mapa: modos de coloreo conmutables para la selección — Ganador (default sin selección) · Share % sobre válidos · Votos absolutos (escala recalculada por selección) · Heatmap. Una variable por pantalla; la leyenda nombra modo, unidad y rango.
- **FR49** Selector de CONTIENDA dentro de una elección (internas: Convención Nacional/Departamental = ODN/ODD; departamentales: Intendente/Junta/Municipio); cambia el dataset/escalera activos y se refleja en la URL.
- **FR50** Ficha de zona: desglose detallado por HOJA agrupado por partido (top-N por partido + "y N más"), totales de la selección, y tooltip pinable. Series combinadas suman sus componentes.
- **FR51** Sourcing de datos faltantes de granularidad: sublema y distinción de lista nacional (Senado) / departamental (Diputados) en nacionales — investigar y obtener de la Corte Electoral (el archivo de integración de hojas está vacío en el repo).

### NonFunctional Requirements
- **NFR1** Performance mobile: LCP<2.5s, INP<200ms, CLS<0.1 (Android gama media/4G); mapa on-demand, sin re-init entre rutas; shards geo eager ≤500 KB.
- **NFR2** Accesibilidad WCAG 2.2 AA: tabla de datos equivalente al mapa; ganador nunca solo por color (sigla texto); teclado; lector de pantalla; targets ≥44px.
- **NFR3** SEO/descubribilidad: HTML real por ruta con meta-tags; sitemap de rutas canónicas; URLs limpias.
- **NFR4** Integridad: voto etapa definitiva; reconciliación de válidos + cobertura como gates de build; UTF-8 en ingesta.
- **NFR5** Hosting: sin backend/DB; artefactos estáticos en CDN; costo ~cero; reproducible desde ETL.
- **NFR6** Compatibilidad: navegadores modernos mobile+desktop; foco Android gama baja/media.
- **NFR7** Mantenibilidad: agregar elección/depto = proceso documentado de baja fricción vía ETL.
- **NFR8** Idioma/privacidad: español (UY); sin i18n; analítica respetuosa de privacidad.

### Additional Requirements (Architecture)
- **AR1 [Starter]** Init Astro 5 (static) + @astrojs/vue + Tailwind + adapter @astrojs/vercel + TS strict. → **Epic 1, Story 1.**
- **AR2** Adoptar `vercel.ts` como config de deploy; limpiar `netlify.toml` + `vercel.json` residual.
- **AR3** Estado: contrato de URL `/{election}/{department}?zona=&opcion=&level=&vs=` + nanostores que espejan la URL (sin Pinia global, sin vue-router).
- **AR4** Mapa como isla `client:load` + `<div#map transition:persist>` singleton; `window`/MapLibre solo en onMounted.
- **AR5** Geometría: TopoJSON + mapshaper `simplify keep-shapes`; lazy-load por nivel; PMTiles para el caso pesado (TyT series).
- **AR6** Pipeline ETL (Node): extract→normalize(UTF-8)→aggregate→[gates]→emit artefactos versionados (`manifest.json`) + índice búsqueda + OG-images.
- **AR7** Gates de build en ETL: reconciliación de válidos + cobertura de zonas (mapping table explícita por depto, sin fuzzy-match runtime).
- **AR8** Modelo de datos: átomo `(elección,depto,circuito,serie,zona,escrutinio,opcion_id,votos)`; opcion_id polimórfico; DEFINITIVO indexado; mecanismo de entidad canónica versionada (vacío/identidad en Fase 1).
- **AR9** OG-image: d3-geo (geoPath)→SVG→resvg, relleno sólido por ganador; **font bundleada para build Linux**.
- **AR10** Tabla accesible del mapa = componente Astro estático (no isla).
- **AR11** Reusar `partyColors.ts` y componentes de presentación Vue.

### UX Design Requirements
- **UX-DR1** Tokens de color (DESIGN.md): chrome editorial claro + dark; tokens de partido fijos; sub-tokens bandera Otorgués (rojo/azul/blanco) + amarillo FA.
- **UX-DR2** Tipografía: Source Serif 4 (titulares) + Inter (cuerpo/UI); escalas definidas; sigla de zona ≥11px.
- **UX-DR3** Dark mode completo (set de tokens oscuros recoloreados; focus-ring-dark, stroke-selected-dark).
- **UX-DR4** Componente Mapa choropleth: FA = doble-capa (sólido↔patrón bandera Otorgués por zoom); borde nítido por zona; sigla texto sobre pill.
- **UX-DR5** Componente Bottom sheet: colapsado/expandido, swipe, grip; cierra al navegar; panel lateral en desktop.
- **UX-DR6** Componente Ficha de resultado: nombres humanos, votos, %, categorías blanco/anulado.
- **UX-DR7** Componentes selectores: elección, departamento, opción (adaptativo al tipo), nivel (Zona/Serie/Circuito, default Zona, circuito disabled Fase 2).
- **UX-DR8** Componente Comparación dual: lado-a-lado / vista de cambio; entrar/salir explícito.
- **UX-DR9** Componente Búsqueda: salto a entidad conocida; estado vacío/sin-resultados.
- **UX-DR10** Componente Compartir: copia deep-link + feedback efímero.
- **UX-DR11** Componente Leyenda: nombra color+sigla+qué representa; chip FA con bandera + marca amarilla.
- **UX-DR12** Tabla de datos accesible del mapa (zona→ganador→votos→%), teclado/SR (WCAG 1.1.1).
- **UX-DR13** Estados: idle/loading(skeleton mapa)/ready/empty/error; degradación con rótulo (FR2).
- **UX-DR14** Progressive disclosure: portada simple ciudadano; profundidad a un clic.
- **UX-DR15** Voice & tone: microcopy es-UY, nombres humanos, sin jerga.
- **UX-DR16** Accesibilidad: contraste AA (ratios verificados), color+texto, focus visible, resize, motion.

### FR Coverage Map
- FR1 → Epic 1 · FR2 → Epic 2 · FR3 → Epic 1 · FR4 → Epic 1
- FR5 → Epic 2 · FR6 → Epic 2 · FR7 → Epic 2 · FR8 → Epic 2
- FR9 → Epic 2 · FR10 → Epic 1 · FR11 → Epic 2 · FR12 → Epic 1 · FR13 → Epic 1 · FR14 → Epic 2
- FR15 → Epic 4 · FR16 → Epic 4 · FR17 → Epic 4 · **FR18 → Fase 2**
- FR19 → Epic 3 · FR20 → Epic 1 (átomo) + Epic 3 (deep-link UX) · FR21 → Epic 3 · FR22 → Epic 3
- **FR23 → Fase 2** · **FR24 → Fase 2** · FR25 → Epic 2 · FR26 → Epic 2
- FR27 → Epic 1 · FR28 → Epic 1 · FR29 → Epic 3 · FR30 → Epic 3 · FR31 → Epic 1 · FR32 → Epic 6
- FR23 → Epic 6 · FR24 → Epic 6 · FR18 → Epic 6
- FR33 → Epic 7 (balotaje ETL+contrato) · FR34 → Epic 7 (plebiscito ETL+contrato) · FR35 → Epic 7 (nacionales adicionales) · FR36 → Epic 7 (departamentales)
- FR37 → Epic 7 (UI selector adaptado) · FR38 → Epic 7 (sello tipo elección)
- FR39 → Epic 8 (SERIE→localidad plan circuital) · FR40 → Epic 8 (geo localidades interior) · FR41 → Epic 8 (ETL join) · FR42 → Epic 8 (ciudades grandes degradación)
- FR43 → Epic 8 (mapeo manual barrios ciudades grandes)
- FR44 → Epic 9 (15 departamentos pendientes)
- FR45 → Epic 10 (ETL HOJA + catálogo jerárquico) · FR46 → Epic 10 (acordeón multi-select) · FR47 → Epic 10 (filtro/búsqueda/chips) · FR48 → Epic 10 (modos de coloreo) · FR49 → Epic 10 (selector de contienda) · FR50 → Epic 10 (ficha desglose HOJA) · FR51 → Epic 10 (sourcing sublema + split nacional/deptal)
- _Nota: FR7 (selector adaptativo) y FR18/FR32 (HOJA cross-elección, Epic 6) se completan recién con Epic 10 — el core de granularidad de HOJA, omitido en el slice MVP._
- NFRs: NFR1 gate desde E1 (audit E5) · NFR2 base E1 (audit E5) · NFR3 E3 · NFR4 E1+E7 · NFR5 E1 · NFR6/7 E5 · NFR8 transversal

## Epic List

### Epic 1: El mapa confiable + el contrato (vertical slice fundacional)
Init + Data Contract v1 polimórfico (validado en seco vs nacionales-2019+balotaje) + ETL Montevideo internas-2024 + estado-en-URL + isla mapa + lazy-load por nivel + gate perf + a11y base. *El deliverable es el CONTRATO instanciado con internas.*
**FRs:** FR1,3,4,10,12,13,20(átomo),27,28,31 · AR1,2,6,7,8,11 · NFR1(gate),2(base),4,5 · UX-DR1,2,4,11,12,13

### Epic 2: Explorar una elección a fondo
Ficha bottom-sheet, selectores, control de nivel zona/serie, progressive disclosure. Todo escribe el store-URL existente.
**FRs:** FR2,5,6,7,8,9,11,14,25,26 · UX-DR5,6,7,14,15

### Epic 3: Compartir y ser encontrado
Deep-link/share, OG-image build-time, búsqueda estática, SEO. Capa pura sobre estado existente.
**FRs:** FR19,21,22,29,30 · NFR3 · AR9 · UX-DR9,10

### Epic 4: Comparar elecciones (histórico)
Cargar nacionales-2019 (instancia del contrato) + comparación dual partido/lema. URL-schema ya contempla `?a=&b=`.
**FRs:** FR15,16,17 · AR5 · UX-DR8 · _(FR18/FR32 = Fase 2)_

### Epic 5: Pulido y robustez (audita, no rescata)
Dark mode, PMTiles geometría pesada, más deptos, auditoría a11y formal.
**FRs:** NFR6,7 · UX-DR3,16 · AR5(PMTiles) · NFR1/NFR2 (audit)

### Epic 6: Fase 2 — Exportar, Circuito, HOJA
Exportar CSV/imagen, nivel circuito en ETL+UI, tabla de normalización de HOJA cross-elección, comparación a nivel HOJA donde existe equivalencia validada.
**FRs:** FR18, FR23, FR24, FR32

### Epic 7: Catálogo de elecciones ampliado
Incorporar balotaje, plebiscito, nacionales adicionales y departamentales. El data contract polimórfico ya soporta estos tipos; se trata de instanciarlos con datos reales y adaptar la UI al tipo de elección.
**FRs:** FR33, FR34, FR35, FR36, FR37, FR38 · NFR4, NFR7

### Epic 8: Mapa del interior con granularidad de localidad
Mapear las series electorales del interior a sus localidades reales vía el plan circuital (automático para ~95% del territorio) y con tablas manuales para ciudades grandes donde la serie repite el nombre de la ciudad.
**FRs:** FR39, FR40, FR41, FR42, FR43

### Epic 9: Completar los 19 departamentos
Agregar datos electorales y geometría para los 15 departamentos pendientes hasta cubrir el mapa completo del Uruguay.
**FRs:** FR44

### Epic 10: Granularidad de opción — del lema a la HOJA individual (CORE)
El núcleo del producto legacy, omitido del spec del rebuild: ver cómo le fue a **cada lista de votación** (HOJA), seleccionando una o varias, y verlas colorear cada zona del mapa. Reincorpora la escalera completa de granularidad — contienda (ODN/ODD, Intendente/Junta/Municipio) → lema → precandidato/sublema → HOJA — con multi-selección combinable, modos de coloreo (Ganador/Share/Votos/Heatmap), y ficha con desglose por HOJA. UX rediseñado desde el legacy (branch `master`, camino AppModern). Secuenciado como vertical slice (internas Montevideo end-to-end) y luego variantes por tipo, cada una gated por disponibilidad de datos.
**FRs:** FR45, FR46, FR47, FR48, FR49, FR50, FR51 · (completa FR7, FR18, FR32) · UX-DR7(reescrito)

---

## Epic 1: El mapa confiable + el contrato

Vertical slice fundacional: del proyecto vacío a un mapa de Montevideo coloreado, confiable, rápido en mobile, con estado en la URL. El deliverable es el **contrato de datos** instanciado con internas-2024.

### Story 1.1: Inicializar el proyecto Astro + Vue + Vercel
As a desarrollador, I want un proyecto Astro estático con Vue, Tailwind, TS strict y deploy en Vercel, So that haya una base limpia y desplegable desde el día uno.

**Acceptance Criteria:**
**Given** un repo limpio **When** corro el init (Astro minimal + `astro add vue` + Tailwind + `@astrojs/vercel`) **Then** `npm run build` produce salida estática sin errores **And** existe `vercel.ts` y se eliminan `netlify.toml` y `vercel.json` residual **And** un deploy de prueba sirve una página en Vercel.

### Story 1.2: Definir el Data Contract v1 polimórfico
As a desarrollador, I want un esquema TS de manifest + votes-shard + geometry con discriminador `eleccion.tipo` y `opcion` polimórfica, So that el contrato soporte internas/nacionales/balotaje sin rediseño futuro.

**Acceptance Criteria:**
**Given** el modelo de dominio (átomo elección×depto×…×opcion_id×votos) **When** defino los tipos del contrato **Then** `opcion` es polimórfica (HOJA | candidato/lema | opción-binaria) y `eleccion.tipo` discrimina **And** un fixture seco de nacionales-2019 + balotaje valida contra el esquema sin cambiarlo (test) **And** el `manifest.json` versiona los artefactos con hash.

### Story 1.3: Spike de geo-join (1 circuito end-to-end)
As a desarrollador, I want probar que el voto de un circuito cae en el polígono geográfico correcto, So that valide el riesgo más caro antes de construir el resto.

**Acceptance Criteria:**
**Given** un circuito de Montevideo hardcodeado (votos + su polígono) **When** hago el join votos↔geometría **Then** el polígono se pinta con el ganador correcto, verificable contra el dato oficial de ese circuito **And** queda documentada la clave de join (propiedad geográfica ↔ campo del CSV).

### Story 1.4: ETL — extraer y normalizar votos (Montevideo internas-2024)
As a desarrollador, I want un paso ETL que extraiga y normalice los votos a un `votes.json` shard, So that el front consuma dato limpio y agregado.

**Acceptance Criteria:**
**Given** el CSV de la Corte Electoral (Montevideo internas-2024) **When** corro extract+normalize **Then** se normaliza a UTF-8, se filtra la etapa DEFINITIVA y se emite el shard con agregados (ganador/% por zona, partido/lema) **And** blanco/anulado/observado quedan como categorías separadas, nunca sumados al ganador.

### Story 1.5: ETL — geometría a TopoJSON + lazy-load por nivel
As a desarrollador, I want la geometría optimizada como TopoJSON con carga perezosa por nivel, So that el mapa cargue rápido en mobile dentro del budget.

**Acceptance Criteria:**
**Given** el GeoJSON de Montevideo **When** corro el paso de geometría (mapshaper simplify keep-shapes → TopoJSON) **Then** el boundary del depto es eager y serie/circuito quedan como artefactos lazy separados **And** ningún artefacto eager supera el budget (≤500 KB gz) — gate de tamaño falla el build si excede.

### Story 1.6: ETL — gates de integridad (reconciliación + cobertura)
As a desarrollador, I want gates de build que validen integridad de datos, So that nunca se publique un mapa con datos mentirosos o zonas vacías.

**Acceptance Criteria:**
**Given** el shard de votos + la geometría + la mapping table explícita del depto **When** corro los gates **Then** los votos válidos reconcilian con el total oficial (delta 0) o el build falla **And** la cobertura de zonas CSV↔geometría cumple el umbral o el build falla con reporte de faltantes.

### Story 1.7: Estado vive-en-URL (nanostores + url-schema)
As a usuario, I want que la vista que estoy mirando viva en la URL, So that pueda recargar sin perder el contexto y se habiliten deep-links.

**Acceptance Criteria:**
**Given** el contrato de URL `/{election}/{department}?zona=&opcion=&level=&vs=` **When** cambia el estado del mapa **Then** la URL se actualiza y los nanostores la espejan **And** recargar reconstruye la misma vista **And** el schema ya contempla `?eleccion=` y `?a=&b=` aunque haya un solo valor.

### Story 1.8: Isla mapa choropleth + leyenda (mobile)
As a ciudadano, I want ver el mapa de mi departamento coloreado por ganador en el celular, So that entienda "quién ganó acá" sin tocar nada.

**Acceptance Criteria:**
**Given** la vista de Montevideo internas-2024 **When** abro la página en mobile **Then** una isla MapLibre `client:load` pinta las zonas por partido ganador con nombres humanos **And** cada zona muestra la sigla del partido como texto (nunca solo color) **And** una leyenda nombra cada color, su sigla y qué representa **And** el tap resalta y muestra el ganador (ficha completa = Epic 2).

### Story 1.9: Tabla de datos accesible del mapa
As a usuario de lector de pantalla, I want una tabla equivalente al mapa, So that acceda a los resultados sin depender de la visualización.

**Acceptance Criteria:**
**Given** los datos de la vista **When** se renderiza la página (HTML estático, componente Astro) **Then** existe una tabla navegable por teclado con zona → ganador → votos → % (WCAG 1.1.1) **And** la tabla refleja el mismo dato que el mapa.

### Story 1.10: Gate de perf-budget en CI + patrón a11y base
As a desarrollador, I want presupuesto de performance y accesibilidad verificado en CI desde el inicio, So that no se acumule deuda imposible de recuperar al final.

**Acceptance Criteria:**
**Given** el build del slice de Montevideo **When** corre el CI **Then** se mide LCP/INP/CLS y peso de JS inicial; si exceden el budget (NFR1), el CI falla **And** un chequeo de contraste/color+texto sobre el choropleth pasa el patrón a11y base.

## Epic 2: Explorar una elección a fondo

Sobre el mapa de Epic 1, las herramientas de drill-down. Todo escribe el store-URL existente.

### Story 2.1: Selector de elección y departamento
As a usuario, I want elegir elección y departamento, So that navegue a la vista que me interesa.

**Acceptance Criteria:**
**Given** el catálogo disponible **When** elijo elección y departamento **Then** la URL y el mapa se actualizan sin re-inicializar la instancia del mapa **And** si la zona seleccionada no existe en la nueva elección, se conserva el depto y se limpia la zona.

### Story 2.2: Selector de opción adaptativo
As a usuario, I want elegir una lista o candidato según el tipo de elección, So that vea cómo le fue a esa opción.

**Acceptance Criteria:**
**Given** una elección de un tipo dado **When** abro el selector de opción **Then** muestra HOJAS (internas/legislativas) o candidatos/lemas (balotaje/presidencial) según el tipo **And** elegir una opción cambia la pregunta del mapa.

### Story 2.3: Toggle de vista del mapa
As a usuario, I want alternar entre "quién ganó" y "cómo le fue a una opción", So that el mapa responda una pregunta por vez.

**Acceptance Criteria:**
**Given** una vista con una opción seleccionada **When** alterno la vista **Then** el coloreo cambia entre ganador-por-zona e intensidad-de-una-opción, con leyenda acorde **And** nunca se superponen dos variables en el mismo mapa (FR3).

### Story 2.4: Ficha de zona (bottom sheet)
As a ciudadano, I want tocar una zona y ver sus resultados en una ficha, So that conozca el detalle de mi barrio.

**Acceptance Criteria:**
**Given** el mapa **When** toco una zona **Then** sube un bottom sheet con ganador, votos y % en números grandes legibles sin scroll en mobile **And** incluye blanco/anulado/observado como categorías; swipe colapsa/expande; navegar cierra el sheet **And** en desktop se ancla como panel lateral.

### Story 2.5: Control de nivel geográfico (zona/serie)
As a analista, I want cambiar el nivel geográfico, So that explore a distinta granularidad.

**Acceptance Criteria:**
**Given** un control explícito Zona/Serie/Circuito (default Zona; Circuito disabled "Próximamente") **When** cambio de nivel **Then** se hace lazy-load del artefacto de ese nivel y el mapa recolorea sin re-init **And** el nivel vive en la URL (`?level=`) y la tabla accesible refleja el nivel activo.

### Story 2.6: Entrada en frío + progressive disclosure
As a ciudadano que llega sin contexto, I want un punto de partida claro, So that encuentre rápido mi departamento sin abrumarme.

**Acceptance Criteria:**
**Given** una entrada sin contexto en la URL **When** abro el sitio **Then** veo un overview nacional + selector de departamento (sin geolocalización) **And** las herramientas avanzadas están a un clic, no abiertas por defecto.

### Story 2.7: Sello de origen y etapa del dato
As a usuario, I want ver de dónde viene el dato, So that confíe en lo que muestra el mapa.

**Acceptance Criteria:**
**Given** cualquier vista **When** la observo **Then** un sello indica "Corte Electoral — escrutinio definitivo" **And** la reconciliación que respalda ese sello es un gate de build, no un cálculo en runtime.

## Epic 3: Compartir y ser encontrado

Capa de distribución sobre el estado-en-URL existente.

### Story 3.1: Deep-link y botón compartir
As a usuario, I want compartir la vista exacta que estoy mirando, So that otra persona vea lo mismo.

**Acceptance Criteria:**
**Given** una vista con estado en la URL **When** toco "compartir" **Then** se copia el deep-link con feedback efímero **And** abrir ese link reproduce exactamente la vista (depto, elección, zona, opción, nivel).

### Story 3.2: OG-image por ruta (build-time)
As a usuario que comparte en redes, I want que el link muestre una preview linda, So that invite a abrirlo.

**Acceptance Criteria:**
**Given** las rutas canónicas {elección}/{depto} **When** corre el build **Then** se genera una OG-image (d3-geo→SVG→resvg, relleno sólido por ganador) por ruta, con font bundleada (build Linux) **And** la imagen refleja el departamento/elección de esa ruta.

### Story 3.3: Meta-tags por ruta + SEO
As a usuario que busca en Google, I want que el sitio sea encontrable, So that llegue por búsqueda.

**Acceptance Criteria:**
**Given** cada ruta SSG **When** se renderiza **Then** tiene título/descripción/OG/Twitter cards propios **And** existe un sitemap de rutas canónicas y URLs limpias y estables.

### Story 3.4: Búsqueda estática
As a usuario, I want buscar y saltar a una lista, candidato o departamento, So that llegue rápido a lo que busco.

**Acceptance Criteria:**
**Given** un índice de búsqueda estático generado en build **When** busco una entidad conocida **Then** salto a la vista correspondiente **And** una búsqueda sin resultados muestra estado vacío con sugerencias (no semántico).

## Epic 4: Comparar elecciones (histórico)

Nueva instancia del contrato + comparación. Sin rediseño de esquema.

### Story 4.1: Cargar nacionales-2019 como instancia del contrato
As a desarrollador, I want incorporar nacionales-2019 vía el ETL existente, So that haya una segunda elección para comparar.

**Acceptance Criteria:**
**Given** el contrato polimórfico de Epic 1 **When** corro el ETL para Montevideo nacionales-2019 **Then** produce shards válidos (gates pasan) sin cambiar el esquema del contrato **And** el tipo de elección/opción se discrimina correctamente.

### Story 4.2: Navegación multi-elección
As a usuario, I want cambiar entre las elecciones disponibles de un departamento, So that vea cada comicio.

**Acceptance Criteria:**
**Given** un depto con varias elecciones **When** cambio de elección **Then** el mapa y la URL (`?eleccion=`) se actualizan sin re-init **And** se conserva el depto y, si aplica, la zona.

### Story 4.3: Comparación dual (partido/lema)
As a analista, I want comparar dos elecciones lado a lado, So that entienda el cambio entre comicios.

**Acceptance Criteria:**
**Given** dos elecciones de un mismo departamento **When** entro al modo comparación (`?a=&b=`) **Then** veo vista lado-a-lado o de cambio, a nivel partido/lema, a granularidad zona/circuito **And** se marca cuando una entidad no tiene continuidad entre los años **And** entrar/salir es explícito y reversible.

### Story 4.4: Comparar dos opciones en una elección
As a analista, I want comparar dos opciones dentro de una misma elección, So that contraste su desempeño por zona.

**Acceptance Criteria:**
**Given** una elección con varias opciones **When** elijo dos opciones para comparar **Then** el mapa muestra el contraste por zona con leyenda clara.

## Epic 5: Pulido y robustez

Audita y optimiza un contrato ya honrado.

### Story 5.1: Dark mode
As a usuario, I want un modo oscuro, So that lea cómodo de noche en el celular.

**Acceptance Criteria:**
**Given** los tokens dark del DESIGN.md **When** activo dark mode (o por preferencia del sistema) **Then** chrome, mapa y ficha usan el set oscuro con focus-ring-dark y stroke-selected-dark visibles **And** los colores de partido siguen distinguibles sobre fondo oscuro.

### Story 5.2: PMTiles para geometría pesada
As a desarrollador, I want servir la geometría pesada (ej. series de Treinta y Tres) como vector tiles, So that no rompa el budget mobile.

**Acceptance Criteria:**
**Given** un depto cuya geometría de serie excede el budget **When** genero PMTiles (Tippecanoe) servidos del CDN **Then** MapLibre los consume sin servidor de tiles y dentro del budget.

### Story 5.3: Sumar más departamentos
As a usuario, I want más departamentos disponibles, So that explore más allá de Montevideo.

**Acceptance Criteria:**
**Given** el proceso ETL documentado **When** agrego un departamento nuevo **Then** entra con baja fricción (mapping table + gates) sin tocar el front **And** sus rutas SSG y OG-images se generan automáticamente.

### Story 5.4: Auditoría de accesibilidad WCAG 2.2 AA
As a usuario con discapacidad, I want el sitio conforme a WCAG 2.2 AA, So that pueda usarlo plenamente.

**Acceptance Criteria:**
**Given** el producto con sus features **When** corro la auditoría (contraste, teclado, SR, targets ≥44px, resize) **Then** se verifican los criterios AA y se registran/cierran los hallazgos (verifica, no rescata deuda masiva).

### Story 5.5: Hardening de performance en gama baja
As a ciudadano con un teléfono modesto, I want que cargue rápido igual, So that no abandone.

**Acceptance Criteria:**
**Given** un Android de gama baja en 4G **When** abro una vista de departamento **Then** se cumplen LCP<2.5s / INP<200ms / CLS<0.1 **And** el mapa no re-inicializa al navegar entre rutas.

## Epic 6: Fase 2 — Exportar, Circuito, HOJA

Features prometidas en Fase 2: exportar datos, nivel circuito operativo, y comparación a nivel HOJA donde exista tabla de equivalencias validada.

### Story 6.1: Exportar datos de la vista actual como CSV
As a analista, I want descargar los datos que veo en la vista actual como un CSV, So that pueda trabajarlos en mi herramienta de análisis favorita.

**Acceptance Criteria:**
**Given** cualquier vista activa (elección × depto × opción × nivel) **When** pulso "Exportar CSV" **Then** se descarga un archivo con las columnas zona, opción, votos, % para la selección actual **And** el nombre del archivo refleja la elección y el departamento **And** el CSV está en UTF-8.

### Story 6.2: Exportar imagen del mapa
As a periodista o analista, I want exportar el mapa actual como imagen PNG, So that pueda incluirlo en notas o presentaciones.

**Acceptance Criteria:**
**Given** el mapa renderizado con una elección y un departamento activos **When** pulso "Exportar imagen" **Then** se descarga un PNG del mapa con leyenda incluida **And** la resolución es suficiente para uso editorial (≥1200px de ancho) **And** el nombre del archivo refleja la selección actual.

### Story 6.3: Nivel circuito — ETL + UI
As a analista avanzado, I want ver resultados al nivel de circuito electoral, So that tenga la granularidad más fina disponible.

**Acceptance Criteria:**
**Given** un departamento con datos a nivel circuito en el ETL **When** selecciono el nivel "Circuito" en el selector de nivel **Then** el mapa colorea por circuito en lugar de zona/serie **And** la ficha muestra los datos del circuito tocado **And** el nivel se persiste en la URL (`?level=circuito`) **And** si el nivel no está disponible para esa elección/depto, el selector lo muestra deshabilitado con etiqueta "No disponible".

### Story 6.4: Tabla de normalización de HOJA cross-elección
As a desarrollador, I want una tabla de equivalencias que mapee HOJA entre elecciones distintas, So that el sistema pueda mostrar comparaciones a nivel lista validadas editorialmente.

**Acceptance Criteria:**
**Given** dos elecciones con HOJAs comparables (ej. internas-2024 y nacionales-2024 del mismo partido) **When** se registra la equivalencia en la tabla de normalización (`hoja-equivalencias.json`) **Then** el ETL la consume y genera los agregados cross-elección correctamente **And** las HOJAs sin equivalencia se marcan explícitamente como "sin match" (no se inventan) **And** la tabla es editable sin tocar código (JSON declarativo).

### Story 6.5: Comparación a nivel HOJA cross-elección
As a analista, I want comparar el desempeño de una lista específica entre dos elecciones, So that vea si una HOJA creció, cayó o desapareció entre comicios.

**Acceptance Criteria:**
**Given** dos elecciones con equivalencias HOJA validadas en la tabla del 6.4 **When** entro al modo comparación y selecciono nivel HOJA **Then** el mapa muestra el delta de votos/% de esa HOJA por zona **And** las HOJAs sin equivalencia se excluyen del mapa con rótulo explicativo **And** el modo HOJA solo aparece habilitado cuando existen equivalencias; si no, el selector permanece en partido/lema.

## Epic 7: Catálogo de elecciones ampliado

El data contract polimórfico ya está listo desde Epic 1. Este epic instancia los tipos de elección que faltan (balotaje, plebiscito, departamentales, nacionales adicionales) y adapta la UI a sus particularidades.

### Story 7.1: Data contract v2 — discriminadores formales para tipos de elección
As a desarrollador, I want que el contrato de datos tenga discriminadores explícitos para cada tipo de elección, So that el ETL y la UI sepan cómo manejar balotajes y plebiscitos sin lógica ad-hoc.

**Acceptance Criteria:**
**Given** el contrato v1 (opcion_id polimórfico, eleccion.tipo string) **When** agrego los tipos `balotaje` y `plebiscito` al discriminador **Then** el esquema TypeScript genera error en compile-time si se omite un campo requerido para ese tipo **And** un fixture seco de balotaje-2024 y plebiscito-2024 validan contra el esquema sin modificarlo **And** el manifest.json versiona el tipo de elección.

### Story 7.2: ETL + ingesta para balotaje 2024
As a usuario, I want explorar el balotaje presidencial 2024 (Orsi vs Delgado) en el mapa, So that vea cómo votó cada zona del país en la segunda vuelta.

**Acceptance Criteria:**
**Given** los datos de la Corte Electoral para el balotaje 2024 **When** corro el ETL con `tipo=balotaje` **Then** produce shards válidos sin HOJA (opcion_id = candidato) con exactamente 2 opciones por zona **And** blanco/anulado/observado quedan como categorías separadas **And** los gates de integridad pasan (reconciliación de válidos) **And** las rutas SSG `/balotaje-2024/{depto}` se generan correctamente.

### Story 7.3: ETL + ingesta para plebiscitos 2024
As a usuario, I want explorar los plebiscitos de 2024 (seguridad pública, reforma previsional) en el mapa, So that vea la distribución territorial del Sí/No.

**Acceptance Criteria:**
**Given** los datos de la Corte Electoral para los plebiscitos 2024 **When** corro el ETL con `tipo=plebiscito` **Then** produce shards con exactamente 2 opciones (Sí / No) más categorías blanco/anulado/observado **And** el manifest incluye el texto de la pregunta del plebiscito como metadata **And** los gates de integridad pasan **And** las rutas SSG `/plebiscito-seguridad-2024/{depto}` y `/plebiscito-previsional-2024/{depto}` se generan.

### Story 7.4: ETL + ingesta para nacionales 2024 (1ª vuelta)
As a usuario, I want explorar los resultados de la primera vuelta de las elecciones nacionales 2024 en el mapa, So that vea cómo votó cada zona antes del balotaje.

**Acceptance Criteria:**
**Given** los datos de la Corte Electoral para nacionales-2024 (con HOJA, lemas y candidatos presidenciales) **When** corro el ETL **Then** produce shards con opcion_id = HOJA, agrupables por partido/lema **And** el tipo discrimina como `nacionales` **And** los gates pasan **And** las rutas SSG `/nacionales-2024/{depto}` se generan **And** la comparación con internas-2024 es posible a nivel partido/lema.

### Story 7.5: UI — selector y ficha adaptados al tipo de elección
As a usuario, I want que el selector de opciones y la ficha de resultados se adapten automáticamente al tipo de elección, So that no vea opciones sin sentido (ej. selector de HOJA en un balotaje).

**Acceptance Criteria:**
**Given** una elección de tipo `balotaje` **When** la cargo en la UI **Then** el selector de opción muestra solo los 2 candidatos (no el combo de HOJA) **And** la ficha muestra nombre del candidato y partido, no número de lista **And** dado un `plebiscito`, el selector muestra Sí/No y el texto de la pregunta aparece en la ficha como contexto **And** dado `internas` o `nacionales`, el comportamiento actual se preserva sin regresión.

### Story 7.6: ETL + ingesta para elecciones departamentales
As a usuario, I want explorar los resultados de las elecciones departamentales (intendentes, ediles, alcaldes) en el mapa, So that vea cómo votó cada zona a nivel local.

**Acceptance Criteria:**
**Given** los datos de la Corte Electoral para una elección departamental (con HOJA, lemas, candidatos a intendente) **When** corro el ETL con `tipo=departamentales` **Then** produce shards válidos con opcion_id polimórfico (HOJA o candidato a intendente según disponibilidad) **And** el nivel geográfico disponible (zona/serie/circuito) se detecta automáticamente y se rotula en la UI **And** los gates pasan **And** las rutas SSG `/departamentales-{año}/{depto}` se generan.

### Story 7.7: Ingesta histórica multi-año + referéndum (todas las elecciones del catálogo)
As a usuario, I want explorar las elecciones históricas (2014–2025) y el referéndum, So that compare el voto a través del tiempo, no solo la última elección.
*(Todos los datasets ya descargados — ver `data/raw/electoral/` y la referencia de fuentes. Cada año es una re-corrida del ETL del tipo correspondiente.)*

**Acceptance Criteria:**
**Given** los datasets descargados de la Corte Electoral **When** corro el ETL para cada instancia **Then** se ingieren con su `eleccionId` propio y su tipo: internas 2019/2024; nacionales 2014/2019/2024; balotaje 2014/2019/2024; **referéndum 2022 (LUC, tipo plebiscito Sí/No)**; plebiscitos 2024 (allanamientos + reforma previsional); departamentales 2020/2025 **And** cada instancia pasa sus gates **And** aparece en el selector de elección **And** los datos 2019 (latin-1) se normalizan a UTF-8 en la ingesta (NFR4) **And** ninguna elección del catálogo queda sin ingerir (gate de completitud opcional contra la lista de datasets).

## Epic 8: Mapa del interior con granularidad de localidad

Las series electorales del interior mapean 1:1 con localidades según el plan circuital de la Corte Electoral. Este epic automatiza ese mapeo para el 95% del territorio y provee la infraestructura para el 5% restante (ciudades grandes donde la serie repite el nombre de la ciudad).

### Story 8.1: Research + tabla SERIE→localidad del plan circuital
As a desarrollador, I want una tabla explícita que mapee cada SERIE electoral del interior a su localidad correspondiente, So that el ETL pueda asignar geometría de localidad a los votos sin fuzzy-match.

**Acceptance Criteria:**
**Given** el plan circuital publicado por la Corte Electoral **When** proceso cada departamento del interior **Then** existe un archivo `public/data/mappings/{depto}/serie-localidad.json` con entradas `{serie: string, localidad: string, tipo: "1:1" | "ciudad-grande"}` **And** la cobertura es ≥95% de las series del CSV por departamento **And** las series de ciudades grandes se marcan como `tipo: "ciudad-grande"` para tratamiento especial en 8.4.

### Story 8.2: Geometría de localidades del interior (IDE Uruguay)
As a desarrollador, I want polígonos de las localidades del interior disponibles como TopoJSON, So that el mapa pueda colorear por localidad en lugar de mostrar series abstractas.

**Acceptance Criteria:**
**Given** las capas de localidades de IDE Uruguay **When** proceso cada departamento del interior **Then** existe un `public/data/geo/{depto}/localidades.topo.json` con los polígonos de localidades del departamento **And** cada polígono tiene una propiedad `localidad` que coincide con los valores en la tabla de 8.1 **And** el tamaño del archivo (gzip) está dentro del budget de 500 KB por departamento **And** si excede, se aplica simplificación con mapshaper.

### Story 8.3: ETL join SERIE→localidad→geometría + visualización
As a usuario del interior, I want ver los resultados de mi localidad coloreados en el mapa, So that entienda cómo votó mi pueblo o ciudad pequeña.

**Acceptance Criteria:**
**Given** la tabla de 8.1 y la geometría de 8.2 para un departamento **When** corro el ETL **Then** los shards de votos incluyen `localidad` como clave geográfica adicional (junto a serie/zona/circuito) **And** el mapa puede colorear por localidad cuando el nivel "Localidad" está seleccionado **And** el nivel "Localidad" aparece en el selector de nivel para departamentos del interior **And** las zonas sin match en la tabla (si las hay) se reportan en el gate de cobertura sin bloquear el build (umbral ≥95%).

### Story 8.4: Detección y degradación de ciudades "grandes" del interior
As a usuario de una ciudad grande del interior (ej. Salto, Paysandú), I want que el mapa me muestre la ciudad como unidad aunque no tenga granularidad de barrio todavía, So que no vea un error ni datos incorrectos.

**Acceptance Criteria:**
**Given** series del CSV donde `tipo = "ciudad-grande"` en la tabla de 8.1 **When** el mapa carga el nivel Localidad **Then** la ciudad aparece como un polígono único coloreado con el resultado agregado de todas sus series **And** la ficha de esa zona muestra un rótulo "Vista de barrio no disponible aún — mostrando resultado agregado de la ciudad" **And** el selector de nivel "Localidad" permanece disponible (no se deshabilita por las ciudades grandes) **And** el gate de cobertura cuenta las ciudades grandes como cubiertas (son intencionales, no huecos).

### Story 8.5: Mapeo manual SERIE→barrio para ciudades grandes del interior
As a usuario de Salto ciudad, Paysandú ciudad, Melo, Rivera ciudad u otras ciudades grandes del interior, I want ver los resultados a nivel de barrio en el mapa, So que tenga la misma granularidad que tienen los usuarios de Montevideo.

**Acceptance Criteria:**
**Given** el research de barrios para una ciudad grande del interior (usando plano circuital de la Corte + IDE Uruguay) **When** se completa la tabla manual `public/data/mappings/{depto}/serie-barrio-{ciudad}.json` **Then** el ETL la consume y genera shards con `barrio` como clave para esa ciudad **And** el mapa muestra los barrios de esa ciudad en el nivel "Localidad/Barrio" **And** la degradación de 8.4 ya no aplica para esa ciudad **And** el proceso está documentado en una guía de mapeo manual replicable para otras ciudades grandes.

## Epic 9: Completar los 19 departamentos

Incorporar los 15 departamentos pendientes aplicando el proceso ETL establecido. Las historias están agrupadas por prioridad/disponibilidad de datos; cada grupo puede ejecutarse en paralelo entre sí.

### Story 9.1: Departamentos de alta prioridad — Canelones, San José, Rocha
As a usuario de Canelones, San José o Rocha, I want ver el mapa electoral de mi departamento, So que explore los resultados de mi zona.

**Acceptance Criteria:**
**Given** los CSVs electorales y GeoJSON de Canelones, San José y Rocha **When** corro el ETL para cada uno **Then** los gates de integridad pasan (reconciliación de válidos + cobertura de zonas ≥95%) **And** las rutas SSG y OG-images se generan para cada elección×depto **And** el departamento aparece disponible en el selector de departamento de la UI **And** el mapa colorea correctamente por zona/serie según corresponda a cada departamento.

### Story 9.2: Departamentos de media prioridad A — Florida, Lavalleja, Durazno, Flores, Soriano
As a usuario de Florida, Lavalleja, Durazno, Flores o Soriano, I want ver el mapa electoral de mi departamento, So que explore los resultados de mi zona.

**Acceptance Criteria:**
**Given** los CSVs electorales y GeoJSON de Florida, Lavalleja, Durazno, Flores y Soriano **When** corro el ETL para cada uno **Then** los gates de integridad pasan para cada departamento **And** las rutas SSG y OG-images se generan **And** cada departamento aparece en el selector de departamento **And** el mapa colorea correctamente.

### Story 9.3: Departamentos de media prioridad B — Río Negro, Paysandú, Salto
As a usuario de Río Negro, Paysandú o Salto, I want ver el mapa electoral de mi departamento, So que explore los resultados de mi zona.

**Acceptance Criteria:**
**Given** los CSVs electorales y GeoJSON de Río Negro, Paysandú y Salto **When** corro el ETL para cada uno **Then** los gates de integridad pasan para cada departamento **And** las rutas SSG y OG-images se generan **And** cada departamento aparece en el selector **And** nota: Paysandú y Salto tienen ciudades capitales grandes — el mapeo de barrios finos se delega al Epic 8.5; este story los incorpora con la degradación de 8.4.

### Story 9.4: Departamentos de baja prioridad — Artigas, Rivera, Tacuarembó, Cerro Largo
As a usuario de Artigas, Rivera, Tacuarembó o Cerro Largo, I want ver el mapa electoral de mi departamento, So que explore los resultados de mi zona.

**Acceptance Criteria:**
**Given** los CSVs electorales y GeoJSON de Artigas, Rivera, Tacuarembó y Cerro Largo **When** corro el ETL para cada uno **Then** los gates de integridad pasan para cada departamento **And** las rutas SSG y OG-images se generan **And** cada departamento aparece en el selector **And** nota: Rivera ciudad y Artigas ciudad son ciudades capitales grandes — igual que 9.3, el mapeo de barrios finos va al Epic 8.5.

---

## Epic 10: Granularidad de opción — del lema a la HOJA individual (CORE)

El núcleo del producto legacy que se omitió del spec del rebuild. La versión vieja (branch `master`, camino vivo AppModern: `ListSelectorContainer.vue` + `MapLibreView.vue` + store `electoral.ts` + `useMapColors.ts`) dejaba **seleccionar una o varias listas de votación (HOJAs)** y ver su desempeño coloreado por zona. Este epic lo reincorpora con la escalera completa de granularidad, rediseñado en UX (EXPERIENCE.md/DESIGN.md, update 2026-05-31) desde la lógica del legacy.

**Modelo de granularidad por tipo (cada tipo declara su escalera; el acordeón se construye desde el dato, no hardcodea):**

| Tipo | Contiendas (raíz del árbol) | Escalera dentro de cada contienda | Dato |
|---|---|---|---|
| Internas | Convención Nacional (ODN) · Departamental (ODD) | ODN: lema → precandidato → lista · ODD: lema → lista | ✅ construible |
| Nacionales | una (legislativa) | lema → sublema → lista (nacional/Senado · departamental/Diputados) | ⚠️ hoja ✅; sublema+split faltan |
| Balotaje | una | candidato (plano) | ❌ bloqueado Epic 7 |
| Plebiscito | una por pregunta | Sí / No (plano) | ❌ bloqueado Epic 7 |
| Departamentales | Intendente · Junta · Municipio | Int: lema→candidato · Junta: lema→sublema→lista · Mun: lema→alcalde→lista | ❌ bloqueado Epic 7 |

**Principios heredados del legacy (no perder):** multi-selección combinable (mapa = suma de la selección); seleccionar un nodo padre = agregado de sus hojas; partido como filtro (no selección); color = votos absolutos con escala recalculada por selección (+ modos share/heatmap/ganador agregados); la selección se limpia al cambiar contexto; búsqueda por número; "seleccionar todas" respeta el filtro; series combinadas suman. `opcion_id` de HOJA compuesto (contienda+lema+hoja).

**Secuencia:** vertical slice (internas Montevideo end-to-end: 10.1→10.5) antes que las variantes; cada variante gated por disponibilidad de datos.

### Story 10.1: Data Contract v3 — escalera de granularidad + contienda
As a desarrollador, I want que el contrato modele la jerarquía de opción (contienda → lema → precandidato/sublema → hoja) con un `opcion_id` compuesto y un descriptor de escalera por tipo, So that el ETL y la UI construyan el árbol desde el dato sin lógica ad-hoc por tipo.

**Acceptance Criteria:**
**Given** el contrato v2 **When** agrego el tipo `Contienda`, la escalera `GranularidadNivel` y el linaje padre en `Opcion` (lema/precandidato/sublema/hoja) **Then** un `opcion_id` de HOJA es compuesto y único entre departamentos **And** existe un descriptor `EscaleraGranularidad` por `(tipo, contienda)` que enumera los niveles disponibles **And** fixtures secos de internas ODN (3 niveles) y ODD (2 niveles) validan contra el esquema **And** `astro check` compila sin romper el ETL/contrato existentes.

### Story 10.2: ETL internas HOJA — catálogo jerárquico + shard por lista (slice Montevideo)
As a usuario, I want explorar cómo le fue a cada lista de las internas 2024 en Montevideo, So that vea el voto a nivel de lista, no solo de partido.
*(Vertical slice: el dato crudo `desglose-de-votos.csv` ya tiene LEMA + DESCRIPCIÓN_1=precandidato + DESCRIPCIÓN_2=nº de hoja + ODN/ODD.)*

**Acceptance Criteria:**
**Given** `desglose-de-votos.csv` (MO, HOJA_ODN y HOJA_ODD) **When** corro el ETL de granularidad **Then** emite un **catálogo de opciones jerárquico** (contienda → lema → precandidato → hoja con sus `opcion_id` compuestos) **And** un **shard de votos a nivel HOJA por zona**, shardeado por lema para lazy-load (eager = agregado por lema; lazy = hojas de cada lema) **And** los gates de reconciliación y cobertura pasan (la suma de hojas = el agregado por lema existente) **And** el roll-up hoja→precandidato→lema→depto es consistente.

### Story 10.3: UI — acordeón de opción multi-selección
As a usuario, I want un selector jerárquico donde marco una o varias listas/precandidatos/lemas, So that compare su desempeño combinado en el mapa.

**Acceptance Criteria:**
**Given** el catálogo jerárquico de 10.2 **When** abro el selector **Then** veo un **acordeón** contienda → lema → precandidato → hoja con **checkbox tri-estado** y chevron separados (≥44px) **And** marcar uno o varios nodos (cualquier nivel) selecciona la suma de sus hojas **And** hay filtro de partido (visibilidad), búsqueda por número, "seleccionar todas" que respeta el filtro, y chips de selección/filtros activos **And** la selección se limpia al cambiar departamento/elección/contienda **And** la selección vive en la URL (FR20) **And** el comportamiento respeta el acordeón especificado en EXPERIENCE.md.

### Story 10.4: Mapa — modos de coloreo por selección + leyenda
As a usuario, I want elegir cómo se colorea el mapa según mi selección, So that lea el dato como me sirva: ganador, share, votos o heatmap.

**Acceptance Criteria:**
**Given** una selección activa **When** elijo el modo de coloreo **Then** el mapa colorea por **Share %** (sobre válidos por zona), **Votos absolutos** (escala recalculada sobre el subconjunto seleccionado), o **Heatmap**; sin selección el default es **Ganador por lema** **And** una sola variable por pantalla (FR3) **And** la leyenda nombra modo, unidad y rango vigente **And** el texto por zona muestra el valor del modo activo (cumple "nunca solo por color") **And** el modo vive en la URL **And** "0 votos" se distingue de "sin datos".

### Story 10.5: Ficha de zona — desglose por HOJA
As a usuario, I want tocar una zona y ver el desglose por lista de mi selección ahí, So that entienda la composición del voto en ese barrio/serie.

**Acceptance Criteria:**
**Given** una selección activa y una zona tocada **When** se abre la ficha **Then** encabeza con el desempeño de la selección en esa zona (votos sumados, %, ranking) **And** muestra un **desglose agrupado por partido** con las hojas (o candidatos) y sus votos, ordenadas desc, truncado a top-N por partido ("y N más…"), con Total **And** el tooltip se puede fijar (pin) **And** las series combinadas suman sus componentes **And** el roll-up de la zona es consistente.

### Story 10.6: Rollout internas HOJA a todos los departamentos ingeridos
As a usuario del interior, I want ver el voto por lista de las internas en mi departamento, So that tenga la misma granularidad que Montevideo.

**Acceptance Criteria:**
**Given** el ETL de granularidad de 10.2 **When** lo corro para los 18 deptos del interior (nivel serie/localidad) y el ODD de Montevideo **Then** cada depto emite su catálogo jerárquico + shard de hojas **And** los gates pasan por depto **And** el selector y el mapa funcionan en todos **And** los deptos sin algún nivel degradan con rótulo (no rompen).

### Story 10.7: Variante nacionales — HOJA legislativa
As a usuario, I want ver el voto por lista en las nacionales, So that explore las listas al parlamento por zona.

**Acceptance Criteria:**
**Given** los datos de nacionales (2019 disponible; 2024 cuando Epic 7 lo ingiera) **When** corro el ETL de granularidad con la escalera de nacionales **Then** emite catálogo lema → (sublema cuando exista dato) → lista **And** el acordeón y los modos de mapa funcionan **And** **donde el dato de sublema/split nacional-deptal no exista, la escalera degrada a lema → lista y lo rotula** (no inventa niveles).

### Story 10.8: Sourcing — sublema + split lista nacional/departamental
As a desarrollador, I want obtener de la Corte Electoral los datos de sublema y de la distinción lista nacional (Senado) / departamental (Diputados), So that la escalera de nacionales y departamentales sea completa.
*(Bloqueada por dato: `integracion-hojas-de-votacion.csv` está vacío en el repo.)*

**Acceptance Criteria:**
**Given** que el archivo de integración de hojas está vacío **When** investigo las fuentes de la Corte Electoral **Then** documento dónde vive el dato de sublema y el de senado/diputados por hoja **And** lo ingiero a `data/raw/` en UTF-8 **And** extiendo el ETL para poblar el nivel sublema y la marca nacional/departamental en el catálogo **And** si una fuente no existe públicamente, queda documentado como límite explícito (no se inventa).

### Story 10.9: Variante departamentales — contiendas paralelas
As a usuario, I want explorar intendente, junta y municipio por separado en las departamentales, So that vea cada contienda con su propia escalera.
*(Bloqueada por ingesta de datos departamentales — Epic 7.6.)*

**Acceptance Criteria:**
**Given** datos departamentales ingeridos (Epic 7.6) **When** corro el ETL de granularidad **Then** emite las tres contiendas (Intendente: lema→candidato · Junta: lema→sublema→lista · Municipio: lema→alcalde→lista) **And** el selector de contienda (FR49) cambia el árbol activo **And** el acordeón se adapta a cada escalera **And** los gates pasan por contienda.

### Story 10.10: Variante balotaje/plebiscito — escalera plana + gate de escalera
As a usuario, I want que en balotaje y plebiscito el selector se simplifique a las opciones reales, So that no vea un árbol de HOJAs que no aplica.
*(Bloqueada por ingesta — Epic 7.2/7.3.)*

**Acceptance Criteria:**
**Given** una elección de tipo balotaje o plebiscito **When** abro el selector **Then** el acordeón degrada a **lista plana de opciones con checkbox** (candidatos / Sí-No), sin chevrons **And** los modos de mapa aplican (share/votos/heatmap/ganador) **And** existe un **gate** que valida que todo `(tipo, contienda)` declara su escalera de granularidad en el contrato (ningún tipo queda sin escalera) **And** la UI nunca ofrece un nivel que la escalera del tipo no declara.

---

## Epic 11: Completar el catálogo nacional en el interior

Las elecciones nacionales (balotajes, plebiscitos, referéndum, nacionales-2019) están ingeridas solo en Montevideo (+ Colonia en balotaje-2024), pero fueron contiendas de los 19 departamentos. Este epic las lleva a los 18 deptos del interior **reusando los patrones ETL ya probados** (`run-*-interior.ts`, geometría `serie.topo.json` por depto, gates de reconciliación/cobertura). No hay datos nuevos que conseguir: los CSV crudos ya están en `data/raw/electoral/` y todos traen columna `Serie`.

**Auditoría de cobertura (2026-06-01).** Lo que falta en el interior y el raw disponible:

| Elección | Estado actual | Raw disponible | Patrón |
|---|---|---|---|
| balotaje-2024 | MVD + Colonia | `balotaje-2024.csv` (19 deptos) | `run-balotaje-interior.ts` (existe) |
| balotaje-2019 / 2014 | solo MVD | `balotaje-201X.csv` | agregador con columnas de candidato propias por año |
| plebiscitos-2024 (×2) | solo MVD | `nacionales-2024/totales-generales-plebiscitos.csv` (`Serie`, `SiArt11`/`SiArt67`) | Sí/No por serie (sin join CRV→serie) |
| referendum-luc-2022 | solo MVD | `referendum-2022/*.csv` (`Serie`, `Total_SI`/`Total_NO`) | idem Sí/No por serie |
| nacionales-2019 | MVD (nuevo) / 19 legacy | `nacionales-2019-full/` | clonar `run-nacionales-2024-interior.ts` |

**Desbloqueante de integración.** Los niveles geográficos se declaran **por-departamento** (`departments.json`), no por-(elección×depto). Las nuevas elecciones interiores son serie-only → ofrecer localidad/circuito rompería el mapa (`ChoroplethMap.vue` lanza si falta el shard del nivel). Story 11.1 lo resuelve derivando `availableLevels` por elección×depto desde los shards en disco (build-time), lo que además **arregla el break latente de Colonia balotaje-2024** (hoy ofrece circuito sin dato).

**Secuencia:** vertical slice (balotaje-2024 → 18 interior, end-to-end con el fix de niveles) antes que las variantes; cada variante posterior es una variación pura de ETL con la integración ya probada. Sigue el principio de degradación de 10.6 AC4 ("sin algún nivel → degrada, no rompe").

### Story 11.1: Rebanada — balotaje-2024 al interior + niveles por elección
As a usuario del interior, I want ver el balotaje 2024 en mi departamento, So that explore la segunda vuelta presidencial donde voté, con los niveles que realmente tienen dato.
*(Vertical slice: prueba toda la cadena ETL→gates→UI→niveles una vez y desbloquea el fanout.)*

**Acceptance Criteria:**
**Given** `run-balotaje-interior.ts` (piloto Colonia) **When** lo generalizo a los 18 deptos del interior **Then** cada depto emite su `votes.json` (serie) + `opciones.json` para `balotaje-2024` **And** los gates de reconciliación (losslessness) y cobertura serie↔geometría pasan por depto **And** `departments.json` lista `balotaje-2024` en los 18 deptos del interior **And** **`availableLevels` se deriva por elección×depto** desde los shards `votes-{nivel}.json` presentes en disco (build-time), de modo que el selector solo ofrece niveles con dato (arregla también Colonia balotaje-2024) **And** abrir cualquier depto interior en balotaje-2024 renderiza el mapa por serie sin romper **And** `astro check` 0 errores.

### Story 11.2: Plebiscitos 2024 + referéndum LUC 2022 al interior
As a usuario del interior, I want ver cómo votó mi departamento los plebiscitos y el referéndum, So that explore esas consultas nacionales donde viví.

**Acceptance Criteria:**
**Given** los CSV de plebiscitos-2024 y referéndum-LUC-2022 (con columna `Serie` y conteo Sí/No) **When** corro el ETL Sí/No por serie para los 18 deptos del interior **Then** cada depto emite `votes.json` (serie) + `opciones.json` (pregunta + Sí/No) para las 3 contiendas **And** el gate de losslessness (Σ Sí+No == Σ válidos) pasa por depto **And** `departments.json` lista las 3 elecciones en los 18 deptos **And** el selector plano (10.10) y la ficha funcionan en el interior.

### Story 11.3: Balotajes históricos 2014/2019 al interior
As a usuario del interior, I want ver los balotajes 2014 y 2019 en mi departamento, So that compare las segundas vueltas históricas por zona.

**Acceptance Criteria:**
**Given** `balotaje-2014.csv` y `balotaje-2019.csv` (columnas de candidato propias de cada año) **When** generalizo el agregador de balotaje por serie a esas columnas y corro los 18 deptos **Then** cada depto emite `votes.json` + `opciones.json` con el par de candidatos correcto del año **And** los gates pasan por depto **And** `departments.json` lista ambos balotajes en los 18 deptos.

### Story 11.4: nacionales-2019 al interior
As a usuario del interior, I want ver las nacionales 2019 en mi departamento, So that tenga la elección presidencial/legislativa 2019 con la misma cobertura que 2024.

**Acceptance Criteria:**
**Given** `nacionales-2019-full/` (dataset nacional completo) **When** clono el patrón `run-nacionales-2024-interior.ts` apuntando a esa fuente **Then** los 18 deptos del interior emiten `nacionales-2019` a nivel serie con sus gates **And** `departments.json` lista `nacionales-2019` en los 18 deptos **And** (opcional) la granularidad HOJA legislativa de 10.7 se evalúa para el interior.

### Story 11.5: Auditoría del nivel barrio en el interior (¿deuda o diseño?)
As a desarrollador, I want saber por qué solo 8/18 deptos del interior tienen `votes-barrio.json`, So that decida si es deuda a completar o una decisión de diseño a documentar.
*(Investigación; no asume trabajo de ETL hasta concluir.)*

**Acceptance Criteria:**
**Given** que 8 de 18 deptos tienen nivel barrio **When** investigo el rollout serie→barrio y la geometría disponible **Then** documento si los 10 restantes carecen de barrio por falta de mapeo/geometría (deuda) o por diseño (capitales sin barrios finos) **And** queda registrado en `deferred-work.md` o como stories de completado si corresponde.

---

## Epic 12: Ficha de zona — desglose de la selección en todos los caminos (paridad con legacy)

Al clickear un polígono, el **legacy** mostraba un tooltip con el desglose de las listas/candidatos **seleccionados** en esa zona, agrupado por partido (partido: total → cada lista/candidato: votos → Total) — ver `legacy/src/composables/useTooltipContent.ts` (`generateListTooltip`/`generateCandidateTooltip`). La Story 10.5 portó esto como el bloque `desglose` ("Tu selección en esta zona") de `ZoneSheet.vue`.

**Gap detectado (2026-06-01).** El `desglose` de la ficha **solo se puebla desde `seleccionActiva`** (`ChoroplethMap.vue` → `buildDesglose(key, sel)` con `sel = seleccion[]` del acordeón de HOJA). Los caminos de selección que NO usan el acordeón no muestran desglose:
- **Selector simple `OpcionSelector`** (elecciones planas: balotaje, plebiscito, referéndum) → setea `opcion` singular → la ficha muestra solo la línea `"{sigla} en esta zona: {pct}%"` (`pctOpcionActiva`), sin desglose por opción.
- Comparación dual A/B (Story 4.4) → tampoco alimenta el desglose.

**Sin selección, la ficha actual (ganador + válidos/blanco/anulados/observados) está bien y se mantiene.** Objetivo: cuando hay cualquier selección activa, la ficha incorpora el desglose de lo seleccionado en esa zona, como el legacy.

**Secuencia:** spike de caracterización (confirmar en browser + definir UX) antes de implementar.

### Story 12.1: Spike — caracterizar el comportamiento actual vs legacy y definir la UX
As a desarrollador, I want confirmar exactamente en qué caminos de selección aparece (o no) el desglose por zona y cómo lo hacía el legacy, So that la implementación cubra todos los casos sin romper el caso "sin selección".

**Acceptance Criteria:**
**Given** el app corriendo **When** clickeo una zona en (a) internas/nacionales con HOJA seleccionada en el acordeón, (b) una elección plana (balotaje/plebiscito) con opción elegida en el selector simple, (c) sin selección **Then** documento qué muestra hoy cada caso **And** lo contrasto con el tooltip del legacy (`useTooltipContent`) **And** defino la UX objetivo del desglose unificado (qué agrupa, totales, top-N, orden) **And** queda claro si requiere cargar shards adicionales (en planos no hay shard de HOJA — la opción vive en `votes.json`).

### Story 12.2: Desglose de la selección en la ficha para todos los caminos
As a usuario, I want que al tocar una zona vea el desempeño de lo que tengo seleccionado ahí (cada lista/opción, agrupado por partido, con total), So that tenga la misma lectura por zona que daba el legacy, sin importar el tipo de elección.

**Acceptance Criteria:**
**Given** una selección activa (HOJA múltiple, opción simple, candidato de balotaje o Sí/No de plebiscito) y una zona tocada **When** se abre la ficha **Then** muestra el desglose de la selección en esa zona (agrupado por partido cuando aplica, con votos por ítem y total + % sobre válidos) **And** el caso "sin selección" mantiene la ficha actual **And** los tipos planos resuelven el desglose desde `votes.json` (no piden shards de HOJA inexistentes) **And** la comparación dual A/B también refleja su desglose **And** `astro check` 0 errores y verificación en browser.

---

## Epic 13: Coloreo del mapa — limpieza del toggle + modo ganador, y decomiso de A/B

Auditoría del conmutador de coloreo (2026-06-01). Hay **dos toggles**: el de opción simple (`vistaMode`: Ganador/Intensidad) y el de selección múltiple HOJA (`coloreoMode`: Share %/Votos/Heatmap). En el de selección múltiple:
- **`Votos` y `Heatmap` son redundantes**: ambos codifican magnitud absoluta de votos (Votos = escala por cuantil + paleta mono; Heatmap = lineal sum/máx + paleta heat). Solo `Share %` es conceptualmente distinto (proporción sobre válidos).
- **Falta el modo "Ganador/Banderas"**: con una selección activa no se puede ver quién lidera cada zona con banderas (el toggle de opción simple sí lo tiene). El render de banderas ya existe (`drawFlagOverlay`, lee `props.flagPattern`).

Decisiones de diseño (Juan, 2026-06-01): (1) quedarse con **Heatmap** como único modo absoluto → toggle = `{Ganador, Share %, Heatmap}`, se elimina `Votos`; (2) el modo **Ganador** muestra el **ganador ENTRE las opciones seleccionadas** en cada zona (cuál de mis listas lidera ahí, con su bandera/color), no el ganador global.

Además: la **comparación dual A/B (Story 4.4) queda decomisada** por ahora (se quita de la UI).

### Story 13.1: Decomiso de la comparación A/B
As a usuario, I want que la UI no ofrezca la comparación dual A/B (no la usamos por ahora), So that el selector quede más simple.

**Acceptance Criteria:**
**Given** el `OpcionSelector` con chips "Comparar vs:" y el header dual A/B **When** decomiso la feature **Then** se quitan de la UI los chips "Comparar vs", el header dual y sus handlers (`compararVs`/`salirDual`) **And** se quita el import muerto de `CompareControls` en `[departamento].astro` **And** la rama dual del desglose de la ficha (12.2) se retira **And** `astro check` 0 errores. (El store `$comparison` puede quedar inerte; no se borra el contrato.)

### Story 13.2: Toggle de coloreo — {Ganador, Share %, Heatmap} con ganador entre lo seleccionado
As a usuario, I want elegir entre ver el ganador de mi selección (con banderas), el share % o el heatmap, So that lea el mapa de mi selección como me sirva, sin un modo redundante.

**Acceptance Criteria:**
**Given** una selección múltiple activa **When** abro el conmutador de coloreo **Then** las opciones son `Ganador` / `Share %` / `Heatmap` (se elimina `Votos`) **And** en modo **Ganador** cada zona se colorea con la opción seleccionada que más votos tiene ahí (color de partido + bandera vía `drawFlagOverlay`), y la leyenda lista las opciones seleccionadas **And** `Share %` y `Heatmap` mantienen su comportamiento **And** una URL vieja con `modo=votos` degrada a un modo válido (no rompe) **And** `astro check` 0 errores y verificación en browser.

---

## Epic 14: Ingestar el plebiscito "Vivir sin Miedo" (2019)

El plebiscito **"Vivir sin Miedo"** (reforma constitucional de seguridad impulsada por Jorge Larrañaga) se votó el 27/10/2019 junto a las nacionales 2019, pero **no está ingestado**. Es una iniciativa binaria Sí/No → mismo patrón que los plebiscitos 2024 y el referéndum LUC (Epics 7.3 / 11.2): agregación Sí/No por SERIE (interior) y por barrio/circuito (Montevideo), con su color de papeleta.

**Sourcing:** a diferencia de los plebiscitos 2024 (`totales-generales-plebiscitos.csv`), el dato del 2019 hay que ubicarlo en la Corte Electoral (API CKAN — ver [[corte-electoral-datos-abiertos]]). Posible columna Sí/No en un dataset de totales del plebiscito 2019; verificar antes de asumir formato.

> ✅ **DESBLOQUEADO (2026-06-01).** El desglose por serie/CRV **no está en datos abiertos** (CKAN solo expone `TotalSoloSi` = "sobres con ÚNICAMENTE la hoja del sí" ≈0,6%, no el ~46,8% real), PERO el **PDF oficial** "Resultados del plebiscito, por circuito" (gub.uy/corte-electoral) tiene la columna **"Papeleta por SI"** = el Sí completo por CRV. `scripts/extract-vivir-sin-miedo.py` (pdfplumber, parseo por posición + carry-forward del circuito/serie) lo extrae a `data/raw/electoral/plebiscito-2019/vivir-sin-miedo-2019-por-crv.csv` (7229 CRV: Depto, Circuito, Serie, Emitidos, EnBlanco, Anulados, Si, No). **Validado:** Sí=1.139.433 (nacional oficial exacto) + emitidos por (depto,serie) 717/717 vs `totales-generales-por-CRV`. No = Emitidos − Sí. → 14.2 puede correr el ETL binaria.

### Story 14.1: Sourcing — dataset crudo del plebiscito 2019
As a desarrollador, I want ubicar e ingerir a `data/raw/` el dato del plebiscito Vivir sin Miedo 2019, So that el ETL pueda agregarlo. **AC:** **Given** la API de la Corte Electoral **When** busco el resultado del plebiscito 2019 **Then** documento la fuente y descargo el CSV (UTF-8) con la columna Sí/No por CRV/serie **And** si no existe públicamente queda como límite explícito (no se inventa).

### Story 14.2: ETL Vivir sin Miedo → MVD + 18 interior
As a usuario, I want ver cómo votó cada zona el plebiscito Vivir sin Miedo, So that explore esa consulta de 2019. **AC:** **Given** el raw 14.1 **When** corro el ETL Sí/No (reusando `aggregate-binaria-by-serie`/`run-binaria-interior` + un runner MVD) **Then** los 19 deptos emiten `votes.json` + `opciones.json` (pregunta + Sí/No) para `plebiscito-vivir-sin-miedo-2019` **And** los gates de losslessness y cobertura pasan.

### Story 14.3: Cableado + color de papeleta + verificación
As a usuario, I want que la iniciativa aparezca en el selector con su color de papeleta, So that se identifique como las otras. **AC:** **Given** los shards 14.2 **When** agrego `plebiscito-vivir-sin-miedo-2019` a `departments.json` y su entrada en `PAPELETA_COLORS` (color oficial del Sí) **Then** aparece en el catálogo de elecciones con su color **And** `astro check` 0 errores y verificación en browser.

---

## Epic 15: Vista nacional con granularidad toggleable

Hoy la exploración es **por departamento** (elegís un depto y ves sus polígonos). Este epic suma una **vista NACIONAL** del país entero, con dos granularidades **toggleables**:
- **Departamental:** los 19 departamentos como polígonos, coloreados por el ganador agregado de cada depto (separación entre departamentos).
- **Zona:** todos los polígonos de zona/serie que ya tenemos por-departamento, **combinados** en un solo mapa nacional (reuso de la geometría existente, sin regenerar).

El usuario alterna la granularidad como hoy alterna nivel dentro de un depto. Reusa el contrato, el coloreo (ganador/share/heatmap), las banderas y la ficha.

**Decisiones abiertas (a refinar en spike):** ruta (`/{eleccion}` nacional vs `/nacional/{eleccion}`); nivel default (departamental); performance del nivel zona nacional (todos los polígonos del país → posible lazy-load / PMTiles / budget, ver Story 5.2); cómo agrega el voto a nivel departamental (suma de shards por-depto).

### Story 15.1: Spike — arquitectura de la vista nacional
As a desarrollador, I want definir geometría, agregación y ruta de la vista nacional, So that la implementación sea sólida. **AC:** **Given** la geometría existente (`uruguayDepartamentos.geojson`, `{depto}_map.json`, los `serie.topo.json`/zona por depto) **When** evalúo opciones **Then** defino: (a) geometría departamental (fuente + budget), (b) cómo se combinan las zonas de los 19 deptos en un FC nacional y su peso, (c) la agregación de votos por depto, (d) ruta y default **And** queda documentado.

### Story 15.2: Geometría + agregación nacional (ETL)
As a usuario, I want el mapa del país por departamento, So that vea el resultado nacional de un vistazo. **AC:** **Given** el spike 15.1 **When** construyo la geometría departamental nacional + el shard de votos agregado por departamento (por elección) **Then** existe `votes.json` nivel `departamento` por elección **And** los gates pasan (la suma por depto reconcilia contra los shards por-depto).

### Story 15.3: Página nacional + nivel departamental
As a usuario, I want abrir el mapa nacional y ver el ganador por departamento, So that tenga la foto país. **AC:** **Given** 15.2 **When** abro la ruta nacional **Then** el mapa muestra los 19 deptos coloreados por ganador (con banderas), la leyenda y la ficha por depto **And** el coloreo (ganador/share/heatmap) y el selector de opción funcionan a nivel departamental.

### Story 15.4: Toggle de granularidad departamental ↔ zona
As a usuario, I want alternar entre ver el país por departamento o por zona, So that pase de la foto país al detalle fino. **AC:** **Given** la vista nacional **When** cambio la granularidad a `zona` **Then** el mapa combina todos los polígonos de zona/serie por-depto en un solo mapa nacional, coloreado por zona **And** el toggle es como el de nivel actual **And** el estado vive en la URL.

### Story 15.5: Performance del nivel zona nacional
As a usuario, I want que la vista nacional por zona cargue rápido, So that sea usable. **AC:** **Given** el nivel zona nacional (todos los polígonos del país) **When** mido el peso **Then** cumple el budget de geometría (NFR1) vía lazy-load por viewport / simplificación / PMTiles (Story 5.2) **And** los gates de performance pasan.

---

## Epic 17: Circuito geolocalizado en todas las elecciones — anclaje por LOCAL

> _(Numerado 17 por pedido explícito; Epic 16 queda libre/reservado. Epic 15 es el último previo.)_

Hoy el nivel **circuito** solo existe en `internas-2024`, y su geometría (`geo/{depto}/circuito.topo.json`, puntos por número de circuito) sale de un único insumo: `data/raw/geographic/plan-circuital-georreferencia-nacional-2024.csv` (el ÚNICO plan circuital con lat/lon). El problema de fondo: **entre elecciones el número de circuito y el corte de credenciales "rotan", pero el LOCAL de votación (la escuela, el club) es estable**. Reusar la geo 2024 para elecciones viejas mal-ubicaría los votos.

Este epic lleva el nivel circuito a **todas** las elecciones que tienen desglose por CRV, **geolocalizando por LOCAL** (no por número de circuito), y renderizando **un punto por local** con los votos agregados de los circuitos que votan ahí.

**Evidencia / decisiones (verificado 2026-06-01):**
- **No existe georef oficial 2019.** La página "Plan circuital nacional con georreferencia" (gub.uy/corte-electoral) es un producto único de las Nacionales 2024; CKAN no expone ningún dataset `georreferencia` (ni para 2019 ni otro año). Ningún "Plan Circuital" de CKAN trae lat/lon (cols `…Localidad, Local/Direccion, …`). → la geo histórica **no se sourcea, se construye** anclando al georef-2024.
- **Votos por circuito (con HOJA) SÍ existen** para `nacionales-2019`, `internas-2019`, `nacionales-2014`, `balotaje-2019/2014` (vía totales por CRV), `referendum-luc-2022` y `departamentales-2020/2025` — recurso "Desglose de votos" por CRV, llave `(Departamento, Series, CRV)`, p. ej. cols `TipoRegistro, Departamento, CRV, Series, Lema, Descripcion1(hoja), CantidadVotos`. El plebiscito Vivir sin Miedo 2019 ya quedó por CRV (Epic 14). → el dato fino existe para todas; no es solo internas-2024.
- **Por qué anclar al local (medido):** el **número de circuito migra ~94%** entre 2019 y 2024 (inservible como llave). El **solapamiento de rango de credencial** `(Serie, Desde–Hasta)` cubre **99,9%** de los circuitos pero un circuito viejo se reparte en **2–3 locales** (5751 casos) → da el área, no el local exacto. El **nombre/dirección del LOCAL** es el ancla semántica estable (las series solapan 100% entre 2014/2019/2024; los locales persisten: "BIBLIOTECA JUNTA DEPARTAMENTAL - MANUEL ORIBE 1456" ≈ "Biblioteca Junta Departamental - Manuel Oribe 1456 esq…"), pero **no coincide idénticamente** (mayúsculas, acentos, sufijo "esq.", cross-street) → requiere **fuzzy matching**, y ~10% de locales cambian entre elecciones.
- **Estrategia de geolocalización (jerarquía explícita):** (1) **fuzzy-match del local** (nombre normalizado + calle + número) dentro de la serie como primario; (2) **solapamiento de rango de credencial** como validador/desempate y relleno cuando el fuzzy es ambiguo; (3) **centroide de serie** como último recurso, **marcado** como aproximado. NUNCA se inventa un punto; los no-resueltos se loguean (sin recortes silenciosos).
- **Modelo de render:** **punto por LOCAL** (estable entre elecciones), votos **agregados** de sus circuitos. Es más honesto (no finge precisión por circuito) y esquiva el split de rangos. **Cambia el contrato actual** (hoy el nivel es por circuito); migrar `internas-2024` al modelo local se decide en 17.7.
- **Rollout:** Fase 1 = familia 2024 (geo ya correcta, mismo ciclo del georef → solo ingerir y agregar votos) → Fase 2 = motor de local + las 4 contiendas de 2019 → Fase 3 = 2014 / referéndum-2022 / departamentales 2020-2025.

### Story 17.1: Spike + contrato del modelo "local"
As a desarrollador, I want definir el catálogo de LOCALES y el contrato geo/votos por local, So that el resto del epic construya sobre una base estable. **AC:** **Given** el georef-2024 (`Serie, NroCircuito, Desde, Hasta, direccion, Localidad, Latitud, Longitud, Habilitados`) **When** derivo el catálogo de locales por departamento (deduplicando circuitos que comparten dirección+coordenada) **Then** existe `geo/{depto}/local.topo.json` (puntos keyed por `localId` estable, con `nombre`, `direccion`, `habilitados` sumados, y las `series`/circuitos que lo componen) **And** queda documentado el contrato `votes-local.json` (votos agregados por local, reusando el shape de `votes-circuito.json` con `geoId=localId`) y cómo el frontend deriva el nivel `local` desde disco.

### Story 17.2: Familia 2024 — votos por local (sin matching interelección)
As a usuario, I want explorar nacionales-2024 y balotaje-2024 a nivel local, So that vea el detalle fino donde la geo ya es correcta. **AC:** **Given** el catálogo 17.1 y los desgloses por CRV de `nacionales-2024`/`balotaje-2024` (mismo ciclo 2024 → la dirección de cada circuito ya está en el georef, sin fuzzy) **When** corro el ETL circuito→local + agregación **Then** ambas elecciones emiten `votes-local.json` por los 19 deptos **And** el nivel `local` aparece en el selector **And** el gate de losslessness pasa (Σ votos por local = Σ por depto).

### Story 17.3: Motor circuito→local con fuzzy matching (interelección)
As a desarrollador, I want un motor que mapee cualquier circuito (de cualquier elección) a un local del catálogo 2024, So that geolocalice elecciones sin georef propia. **AC:** **Given** un plan-circuital con `(Serie, NroCircuito, Desde, Hasta, Direccion, Localidad)` **When** lo corro contra el catálogo de locales 17.1 **Then** cada circuito resuelve a un `localId` por la jerarquía (1) fuzzy-match nombre/dirección dentro de la serie → (2) validación/relleno por solapamiento de rango de credencial → (3) centroide de serie (fallback marcado) **And** emite un **reporte de cobertura** por método (% exacto / fuzzy / rango / centroide) y la lista de circuitos no-resueltos **And** ningún recorte es silencioso.

### Story 17.4: 2019 a nivel local (nacionales, internas, balotaje, Vivir sin Miedo)
As a usuario, I want ver las 4 contiendas de 2019 por local, So that explore 2019 con el detalle fino. **AC:** **Given** el motor 17.3 y los desgloses por CRV de 2019 **When** mapeo circuito→local y agrego votos **Then** `nacionales-2019`, `internas-2019`, `balotaje-2019` y `plebiscito-vivir-sin-miedo-2019` emiten `votes-local.json` por depto **And** la cobertura geolocalizada cumple el umbral acordado (p. ej. ≥95% de habilitados ubicados en un local real, no centroide) con el resto explícito en el reporte **And** los gates pasan.

### Story 17.5: Frontend — nivel "local" (punto por local agregado)
As a usuario, I want que el mapa muestre un punto por local con sus votos, So that lea el resultado por local. **AC:** **Given** los shards `votes-local.json` + `local.topo.json` **When** elijo el nivel `local` **Then** el mapa renderiza un punto por local (coloreo ganador/heatmap/share, banderas, ficha por local con desglose y HOJA, tooltip con nombre del local) **And** el gating del nivel por elección se deriva de disco (presencia de `votes-local.json`) **And** la performance cumple el budget con miles de puntos (Story 5.2: clustering/viewport).

### Story 17.6: Fase 3 — 2014, referéndum-2022, departamentales 2020/2025
As a usuario, I want el resto de las elecciones con desglose por CRV a nivel local, So that el catálogo quede completo. **AC:** **Given** el motor 17.3 **When** lo aplico a `nacionales-2014`, `balotaje-2014`, `referendum-luc-2022`, `departamentales-2020`, `departamentales-2025` **Then** emiten `votes-local.json` con su reporte de cobertura **And** 2014 (la peor cobertura: su plan trae `Direccion` pero no la columna `Local` y los locales rotaron más) deja sus límites explícitos **And** los gates pasan.

### Story 17.7: Auditoría de cobertura + unificación de internas-2024
As a desarrollador, I want una matriz de cobertura elección×depto y un solo modelo de circuito, So that no convivan dos contratos. **AC:** **Given** todo lo anterior **When** genero la matriz (por elección/depto: ¿hay votos por CRV?, % geolocalizado por método, # no-resueltos) **And** decido sobre `internas-2024` (migrar de circuito→local o documentar por qué se mantiene) **Then** el reporte queda en `docs/` **And** el nivel circuito legacy queda unificado bajo `local` (o el motivo de la excepción está escrito) **And** `astro check` 0 errores.
