# Revisión Estructural — PRD Uruguay Electoral Map (Rebuild)

> Método: BMAD Editorial Review — Structure. Revisión de ESTRUCTURA (cortes, reorganización, redundancia, orden, referencias cruzadas). NO se reescribe prosa ni se cuestionan ideas (CONTENT IS SACROSANCT).

## Resumen del documento

- **Propósito:** PRD de un explorador-archivo electoral mobile-first; alinear alcance, FRs, métricas y riesgos antes de Arquitectura.
- **Audiencia:** equipo de producto/arquitectura (dev solo + revisores BMAD).
- **Reader type:** `humans`.
- **Modelo estructural:** Strategic/Context (Pyramid) — conclusión arriba (§1), contexto agrupado debajo, MECE, evidencia que apoya sin liderar.
- **Longitud actual:** ~2.300 palabras en 10 secciones (§1–§10).
- **Veredicto:** estructura sólida y bien ordenada para el modelo Pyramid; los hallazgos son refinamientos de redundancia y de límite con el addendum, no problemas de arquitectura del documento.

## Tabla de hallazgos

| # | Tipo | Ubicación | Hallazgo | Acción propuesta | Impacto | Severidad |
|---|------|-----------|----------|------------------|---------|-----------|
| H1 | CONDENSE | §4 UJ-1 paso 2 (L45), §4 UJ-2 pasos 2 y 4 (L58, L60) vs §10 (L229–234) | Las assumptions A2, A4, A5 se transcriben **con su texto completo inline** dentro de los journeys, y el mismo texto vuelve a aparecer en el §10 Índice de Assumptions (registro canónico) — y A2 además es el cuerpo literal de FR26. Tres copias del mismo enunciado. | Reducir las menciones inline en §4 a la **etiqueta desnuda** `_[A2]_` / `_[A4]_` / `_[A5]_` (puntero), dejando el texto completo solo en §10. FR26 conserva su redacción (es el requisito, no una cita). | ~60–80 palabras | Media |
| H2 | QUESTION / MERGE | §5 línea 67 ("la columna de alcance se consolida en §6") vs tags inline en FR18 (L95), FR32 (L119), F8/FR23-24, y §9 OQ1 (L219) | La fase se declara fuente única en §6, pero los tags `(Fase 2)` / `(Best-effort, Fase 2)` viven también inline en FR18/FR32/F8 y la resolución "F8 → Fase 2" aparece otra vez en OQ1. **No hay contradicción** (F8, OQ1 y §6 coinciden). Es duplicación de fuente, no error. | Mantener §6 como única fuente de verdad de fase; conservar los tags inline solo como **punteros breves** ("ver §6"), no como redefinición del alcance. Decisión del autor: cuánto puntero dejar. | ~15–25 palabras | Baja |
| H3 | QUESTION (límite con addendum) | §9 R5 (L213) y R7 (L215) | Los riesgos arrastran **directivas de stack tecnológico** que por diseño viven en el addendum: R5 nombra Satori/TopoJSON/SVG build-time; R7 nombra **Astro** + `client:only` + `transition:persist`. R7 ya remite "(addendum)". El stack en el cuerpo del PRD rompe la decisión de diseño "tech-stack en addendum". | Mover las directivas stack-específicas al addendum y dejar en §9 el riesgo en términos de capacidad ("OG-image no puede ser screenshot del mapa"; "estado SPA entre rutas puede causar jank"). **No cortar el riesgo**: necesita algo de concreción para seguir siendo real. | ~20–30 palabras | Baja |
| H4 | PRESERVE | §2 Glosario vs FR7 (L78) y FR12 (L87) | El glosario define "opción electoral" y "escrutinio definitivo"; FR7 y FR12 vuelven a explicarlos en el punto de uso. **No es redundancia verdadera**: es refuerzo en el punto de uso (un FR debe ser legible solo). El glosario §2 está bien ubicado (dependency-first: términos usados intensamente en §4–§5). | **Conservar** ambos. No mover ni recortar el glosario. Item nombrado explícitamente en el encargo: se evalúa y se mantiene a propósito. | 0 (preservar) | — |
| H5 | QUESTION | §9 R3 mitigación + A6 estado (L234) + OQ2 (L220) + OQ5 (L223) | A6 ("hueco competitivo") queda rastreada por **dos** preguntas abiertas: OQ2 ("Confirmar/corregir A1–A6") y OQ5 ("Verificación competitiva (R3)"). Solapamiento de tracking, no error de referencia. | Decidir un único dueño de A6 (OQ5, que es específico) y que OQ2 cubra A1–A5. Cambio menor. | ~5 palabras | Muy baja |
| H6 | PRESERVE | §1 bullets vs §3/§4; punteros FR→FR (FR3→FR16, FR16→FR28, FR18→FR32); §1 nota A6 | El resumen §1 previsualiza usuarios/diferenciador del cuerpo (§3/§4) — refuerzo legítimo del modelo Pyramid (la conclusión va arriba). Los punteros FR→FR son tejido conectivo, no duplicación. | **Conservar todo.** No tratar como redundancia. | 0 (preservar) | — |

## Integridad de referencias cruzadas (verificación)

- **FR1–FR32:** todos definidos una sola vez en §5; sin huecos ni duplicados. OK.
- **F1–F10 ↔ §6:** todas las capacidades citadas en §6 (F1–F10) existen en §5. OK.
- **M1–M8:** definidos en §7; M8 referenciado correctamente desde §2, FR14, NFR4, CM5. OK.
- **NFR1–NFR8:** definidos en §8; citados consistentemente (NFR1↔M2/CM2, NFR4↔M8/FR12/FR31/FR27). OK.
- **R1–R8:** definidos en §9; R1↔FR18/FR32, R5↔FR22/M7, R8↔FR3/F3/FR25. OK.
- **CM1–CM5:** definidos en §7. OK.
- **OQ1–OQ5:** definidos en §9; OQ3↔FR12, OQ4↔NFR1. OK.
- **A1–A6:** definidos en §10; A1↔UJ-1, A2↔FR26, A4↔FR19, A5↔§6. OK.
- **Único cruce algo redundante:** A6 rastreada por OQ2 y OQ5 (ver H5). No es referencia rota; es doble-tracking.

**Conclusión de integridad:** no se detectaron referencias rotas (ningún FR/§/OQ/A/M/NFR/R/CM apunta a un ID inexistente). El único punto a limpiar es el doble tracking de A6.

## Orden de secciones (modelo Pyramid)

El orden §1 Resumen → §2 Glosario → §3 Usuarios → §4 Journeys → §5 Features/FR → §6 Alcance → §7 Métricas → §8 NFR → §9 Riesgos/OQ → §10 Assumptions respeta el modelo:
- Conclusión/headline arriba (§1). OK.
- Glosario temprano por dependency-first (términos usados en §4–§5). OK — **conservar** (no mover al final ni al addendum).
- Soporte (alcance, métricas, NFR, riesgos) agrupado debajo, de lo más a lo menos crítico. OK.
- §10 como registro/apéndice de assumptions al final. OK.

No se recomienda reordenar secciones.

## Resumen

- **Total de recomendaciones accionables:** 3 (H1 apply, H2 consider, H3 consider) + 1 menor (H5).
- **Preservar explícitamente:** 2 (H4 glosario+refuerzo en FR7/FR12, H6 resumen Pyramid + punteros FR→FR).
- **Reducción estimada:** ~100–135 palabras (~5% del documento) si se aceptan H1–H3 y H5. Reducción modesta: el documento ya es denso.
- **Cumple objetivo de longitud:** no se especificó objetivo; el documento no está inflado.
- **Compromisos de comprensión:** H1 reduce texto inline en journeys → preservar el puntero `_[Ax]_` evita pérdida de trazabilidad (el lector salta a §10). Sin riesgo de comprensión si se mantienen los punteros.
- **Referencias cruzadas:** íntegras; único ajuste el doble-tracking de A6 (H5).
