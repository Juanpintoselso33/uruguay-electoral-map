# Addendum — PRD Uruguay Electoral Map (Rebuild)

_Profundidad que pertenece a documentos downstream (Arquitectura, UX, Solution Design), no al PRD en sí: rationale de alternativas, decisiones de mecanismo/transporte, el "cómo" técnico, research de stack._

---

## Restricciones arquitectónicas implícitas (del party mode — Winston)

Estas NO fijan stack, pero acotan el espacio de decisión para Arquitectura:

- **Dato inmutable** → no requiere backend de aplicación ni DB viva. El "backend" es un pipeline ETL offline; el runtime sirve artefactos estáticos vía CDN.
- **Sharding por `{elección}/{departamento}`** + agregados pre-computados → habilita comparación sin descargar granularidad completa. _Pendiente: volumen real por shard (filas HOJA×ZONA, KB vs MB)._
- **Búsqueda** = índice estático generado en ETL (tipo MiniSearch/lunr), cargado en cliente. Sin servicio de búsqueda.
- **Estado compartible** = URL como fuente de verdad. No requiere SSR.
- **Preview social/SEO** (objetivo de primer orden) = HTML por ruta con meta-tags ⇒ empuja a **SSG/pre-render** de un universo finito de rutas (no SSR vivo).
- **OG-image** = pre-generada en ETL/build para vistas canónicas; render-on-demand sólo como epic posterior.

## Research de stack (Exa) — insumo para Arquitectura

> Generado por research-agent vía Exa, 2026-05-30. NO es decisión final — la fija Arquitectura.

### Recomendación principal
**Astro 5 (output `static`) + islas Vue 3 + TS + MapLibre GL JS + Tailwind.** Única opción que parte de "HTML estático, cero JS por defecto": pre-renderiza el set finito de rutas `{election}/{department}` a HTML con meta-tags por ruta e hidrata solo el mapa/selector como isla → mejor LCP/INP en móvil (prioridad #1) + **reutiliza los componentes Vue existentes** como islas (`@astrojs/vue`). Hosting estático en CDN, costo cero.

### Alternativa viable
**Nuxt 4 en modo SSG (`nuxt generate`)** si la navegación entre deptos/elecciones debe sentirse 100% SPA (mapa persistente, estado compartido entre rutas sin gestionar islas a mano) y se prefiere quedarse full Vue. Trade-off: más JS por defecto.

### Tabla comparativa (meta-frameworks)
| Criterio | Astro 5/6 | Nuxt 4 (generate) | Next 16 (export) | SvelteKit (static) |
|---|---|---|---|---|
| SSG rutas finitas | Por defecto | `nuxt generate` | `generateStaticParams` | adapter-static |
| Meta-tags por ruta | Nativo | `useSeoMeta` | Metadata API | `<svelte:head>` |
| Islas / hidratación parcial | **Nativo granular** | SSR universal (no islas) | Vía RSC | Por `+page` |
| Perf móvil (CWV) | **Mejor: ~0 KB JS base** | Buena si se evita sobre-hidratar | Overhead React ~80-120 KB | Bundles ~15-30 KB |
| OG-image | astro-og-canvas/Satori | nuxt-og-image | @vercel/og | Manual |
| Reutilizar Vue | **Sí, como islas** | **Sí, Vue nativo** | No | No |
| Veredicto | **Mejor encaje** | Buena 2ª (SPA-feel Vue) | Sobredimensionado | Gran perf, abandona Vue |

### Mapa
**Mantener MapLibre GL JS** — caso de bajo volumen de features (19 deptos + zonas, GeoJSON ≤3MB) renderiza fluido; MIT, sin costo de tiles ni API key, soporta PMTiles para crecer, reutiliza código. Cargar solo dentro de la isla (`client:visible`/`client:only`). Caveat: MapLibre NO es el más rápido en benchmarks de polígonos densos (estudio Copernicus); la decisión se sostiene por volumen bajo + reuso + costo cero, no por rendimiento bruto.

### OG-image
Build-time con **Satori + resvg** (astro-og-canvas o endpoint `[...route].png.ts`), una por ruta. **Caveat crítico verificado: Satori NO captura un mapa WebGL de MapLibre.** Caminos: (1) dibujar el contorno del depto como **SVG inline** desde TopoJSON simplificado (recomendado, build-time, sin browser), o (2) pre-renderizar thumbnail raster en ETL.

### Búsqueda
**Pagefind** — estándar 2026 para sitios estáticos: indexa el HTML generado, shardea el índice y carga chunks on-demand (~30 KB WASM inicial). Alternativa con dataset estructurado fielded: **MiniSearch**.

### GeoJSON
1. **Mapshaper** `-simplify keep-shapes` (Visvalingam, preserva topología, evita gaps), reproyectar a WGS84, soltar campos.
2. Entregar como **TopoJSON** (bordes compartidos una vez → 40-80% más chico), `quantization ~1e5`, decodificar con `topojson-client`.
3. Si crece > ~2-5 MB o se agregan circuitos de todo el país → **vector tiles PMTiles** (Tippecanoe), servidos directo del CDN sin servidor de tiles.

### Riesgos / caveats
- **Donde Astro pelea:** mapa+selector con estado en URL = patrón "SPA con estado compartido entre rutas", debilidad de Astro. **Mitigación verificada:** ruta pre-renderizada por depto + mapa/selector como **isla Vue `client:only`** con estado sincronizado a URL, marcada **`transition:persist`** + View Transitions → mantiene viva la instancia de MapLibre al cambiar de ruta (evita re-init, clave anti-jank en móvil).
- **Satori ≠ screenshot de mapa** (ver OG-image).
- **Astro v6 en beta** → quedarse en v5 estable.
- **Reuso de Vue no es 1:1:** componentes que asumen Pinia/router global cruzando rutas deben adaptarse al modelo de islas (estado local por isla).

### Fuentes
docs.astro.build (islands, vue, view-transitions), devtoolswatch/pkgpulse/tailkits (comparativas 2026), Copernicus (benchmark mapas), vercel/satori (+issue 623), astro-og-canvas, Pagefind (dev.to morinaga), mapshaper docs, geojason (TopoJSON). Lista completa en transcript del research-agent.
