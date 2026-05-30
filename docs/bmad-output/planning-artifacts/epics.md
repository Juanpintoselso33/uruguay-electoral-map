---
stepsCompleted: [1, 2, 3, 4]
status: complete
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
- **FR32** (Fase 2) Tabla de normalización de HOJA entre elecciones.

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
- FR27 → Epic 1 · FR28 → Epic 1 · FR29 → Epic 3 · FR30 → Epic 3 · FR31 → Epic 1 · **FR32 → Fase 2**
- NFRs: NFR1 gate desde E1 (audit E5) · NFR2 base E1 (audit E5) · NFR3 E3 · NFR4 E1 · NFR5 E1 · NFR6/7 E5 · NFR8 transversal

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
**FRs:** NFR6,7 · UX-DR3,16 · AR5(PMTiles) · NFR1/NFR2 (audit) · _(FR23/FR24 = Fase 2)_

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
