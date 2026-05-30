# Revisión de prosa — PRD Uruguay Electoral Map (Rebuild)

**Tipo de revisión:** copy-editing clínico (solo comunicación: claridad, ambigüedad, vaguedad, terminología inconsistente, frases difíciles de parsear). NO estructura.

**Criterio:** intervención mínima. Se preservan la voz rioplatense, el registro telegráfico del documento y la informalidad intencional de los journeys. Los términos de dominio (§2 Glosario) son intencionales y NO se marcan.

**Convención de severidad:** `[apply]` = fix de claridad/parseo/referente inequívoco; `[consider]` = juicio editorial, se sugiere como consulta.

| Cita | Problema | Fix sugerido |
|------|----------|--------------|
| _(FR16)_ "**Modo comparación dual** … **por defecto a nivel partido/lema** (estable entre años), a nivel zona/circuito." | `[apply]` Dos sintagmas "a nivel" seguidos nombran dimensiones distintas (unidad de comparación vs. granularidad geográfica) y colisionan: se lee como si "zona/circuito" fuera otra unidad de comparación, no la granularidad espacial. | "**Modo comparación dual** … **por defecto a nivel partido/lema** (estable entre años), con granularidad **zona/circuito**." (o: "…a nivel partido/lema, **desagregado por** zona/circuito.") |
| _(FR14)_ "Mostrar un **sello de origen y etapa del dato** en la UI (ej. …), y que la reconciliación de §NFR4 sea un gate de build (no un cálculo en runtime)." | `[apply]` El FR coordina un infinitivo ("Mostrar") con una cláusula subjuntiva ("y que … sea"), que no son paralelos y rompen la lectura. Además mezcla dos requisitos distintos en un solo bullet. | Separar en dos cláusulas paralelas: "Mostrar un **sello de origen y etapa del dato** en la UI (ej. …). La reconciliación de §NFR4 **es** un gate de build, no un cálculo en runtime." |
| _(M2)_ "**LCP de la primera respuesta**: "quién ganó acá" visible (medido como Largest Contentful Paint, no percepción)" | `[consider]` "no percepción" es elíptico; se entiende pero exige al lector completar la oposición. | "…(medido como Largest Contentful Paint real, **no como percepción de velocidad**)" |
| _(M5)_ "mobile ≥ 60%, bounce mobile < desktop" | `[consider]` "bounce mobile < desktop" compara magnitudes heterogéneas en su forma literal (bounce vs. desktop); el sentido es "bounce mobile < bounce desktop". | "mobile ≥ 60%; **bounce mobile menor que bounce desktop**" |
| _(§1 Resumen)_ "No compite por velocidad la noche electoral" | `[consider]` "la noche electoral" cuelga sin preposición; se lee con un micro-tropiezo. | "No compite por velocidad **en** la noche electoral" |
| _(§2 Glosario, encabezado)_ "**Lema / partido:**" vs. cuerpo del PRD "partido/lema" (FR16, F10, §6) y "opción/partido" (FR1) | `[consider]` Orden del par invertido entre el glosario y el cuerpo. Bajo valor; solo por consistencia terminológica. Sugerencia: unificar a "partido/lema" (el orden dominante en el cuerpo) también en el encabezado del glosario. | Encabezar el término como "**Partido / lema:**" para alinearlo con el uso del resto del documento. |
| _(FR7)_ "Seleccionar **opción electoral** según el tipo: HOJA (internas/legislativas) y/o candidato/lema (balotaje/presidencial)." | `[consider]` "y/o" es ambiguo sobre si ambos pueden coexistir en una misma elección o son mutuamente excluyentes por tipo. El resto del PRD sugiere que el tipo determina la opción (excluyente). | "…: HOJA (internas/legislativas) **o** candidato/lema (balotaje/presidencial), **según corresponda al tipo**." |
| _(FR2)_ "**degradar al nivel disponible más fino y rotularlo explícitamente**" | `[consider]` "el nivel disponible más fino" puede leerse como "el más granular disponible"; pero al degradar normalmente se sube a un nivel más grueso. Verificar que "más fino" exprese la intención (¿el nivel más detallado que sí tiene datos?). | Si la intención es "el nivel más detallado con datos": "…degradar al **nivel más detallado que tenga datos** y rotularlo explícitamente". |

---

## Notas de no-intervención (revisado y conservado a propósito)

- **"Orden Departamental Nacional / Departamental Departamental"** (§2): "Departamental Departamental" parece dittografía pero es el término real (ODD). No se marca.
- Registro telegráfico, corridas en negrita, asides con em-dash, fragmentos de bullet: voz intencional del documento. No se marca.
- Informalidad de los User Journeys (UJ-1/UJ-2): intencional. No se marca.
- Términos de dominio (HOJA, lema, ESCRUTINIO, voto canónico, opción electoral, choropleth, deep-link, bottom sheet, progressive disclosure): definidos en §2 e intencionales. No se marcan como jerga.
