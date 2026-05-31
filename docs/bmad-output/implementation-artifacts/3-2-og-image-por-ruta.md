---
baseline_commit: ff87dc9
---

# Story 3.2: OG-image por ruta (build-time)

Status: done

## Story

As a usuario que comparte en redes,
I want que el link muestre una preview visual del mapa,
so that invite a abrirlo.

## Acceptance Criteria

1. **Given** las rutas canónicas `{elección}/{depto}` **When** corre `npm run build` **Then** se genera un PNG de 1200×630 px en `public/og/{eleccion}/{departamento}.png` por cada ruta.
2. **Given** la OG-image **Then** muestra el contorno del departamento con cada zona coloreada por el ganador (relleno sólido), usando los colores oficiales de `party-colors.ts`.
3. **Given** la OG-image **Then** incluye el nombre del departamento y la elección en un banner de texto (fuente bundleada para compatibilidad Linux/Vercel).
4. **Given** la pipeline `d3-geo → SVG → @resvg/resvg-js → PNG` **Then** el script corre con Node.js puro (ESM) sin bundler en dev; y en CI (Vercel, Linux) la generación no falla por falta de fuentes del sistema.
5. **Given** `npm run build` **Then** el orden es: `generate:og` → `gate:data` → `astro build` (las imágenes están en `public/` antes que Astro las copie a `dist/`).
6. **Given** `astro check` y `npm run build` **Then** 0 errores TypeScript ni de runtime.

## Tasks / Subtasks

- [ ] **Task 1: Instalar @resvg/resvg-js (AC: 4)**
  - [ ] `npm install --save-dev @resvg/resvg-js`
  - [ ] Verificar que `@resvg/resvg-js@2.6.2` queda en `devDependencies`.

- [ ] **Task 2: Crear `scripts/generate-og.mjs` (AC: 1–4)**
  - [ ] El script enumera las rutas conocidas (hardcoded como `getStaticPaths`; ver nota de escalabilidad).
  - [ ] Por cada ruta: lee `votes.json` + `opciones.json` + `{nivel}.topo.json`.
  - [ ] Construye mapa `geoId → hexColor` usando `ganadorOpcionId` → busca en `opciones` → usa la tabla de colores inline (ver código de referencia).
  - [ ] Usa `topojson-client` (`feature()`) para convertir TopoJSON → FeatureCollection.
  - [ ] Usa `d3-geo` (`geoMercator().fitSize()` + `geoPath()`) para generar `<path d="...">` del SVG.
  - [ ] Genera SVG 1200×630 con mapa centrado + banner inferior con nombre del depto/elección.
  - [ ] Convierte SVG → PNG con `new Resvg(svg, opts).render().asPng()`.
  - [ ] Escribe `public/og/{eleccion}/{departamento}.png` (crea el directorio si no existe).
  - [ ] Exit 0 al final; exit 1 si alguna ruta falla.

- [ ] **Task 3: Bundlear una fuente TTF para texto en SVG (AC: 3, 4)**
  - [ ] Descargar `Inter-Regular.ttf` (SIL Open Font License) y colocarlo en `scripts/fonts/Inter-Regular.ttf`.
  - [ ] En el script, leer `fontBuffer = readFileSync('scripts/fonts/Inter-Regular.ttf')` y pasarlo a Resvg: `{ font: { loadSystemFonts: false, fontBuffers: [fontBuffer] } }`.
  - [ ] De este modo el texto renderiza igual en Windows dev, macOS CI, y Vercel Linux sin depender de fuentes del sistema.

- [ ] **Task 4: Integrar en `package.json` (AC: 5)**
  - [ ] Añadir script `"generate:og": "node scripts/generate-og.mjs"`.
  - [ ] Actualizar `"build"`: `"node scripts/generate-og.mjs && node scripts/gate-data.mjs && astro build"`.

- [ ] **Task 5: Verificación (AC: 1–6)**
  - [ ] `npm run generate:og` → exit 0; archivos creados en `public/og/internas-2024/montevideo.png` y `public/og/internas-2024/rivera.png`.
  - [ ] Abrir los PNG con el visor de imágenes y confirmar que muestran los mapas coloreados.
  - [ ] `npm run build` → gate:data OK + build completo.

## Dev Notes

### Datos de entrada por ruta

| Archivo | Ruta | Qué aporta |
|---------|------|------------|
| `votes.json` | `public/data/{eleccion}/{dept}/votes.json` | `zonas[].geoId`, `zonas[].ganadorOpcionId` |
| `opciones.json` | `public/data/{eleccion}/{dept}/opciones.json` | `opciones[].opcionId → nombre` |
| `{nivel}.topo.json` | `public/data/geo/{dept}/{nivel}.topo.json` | Geometrías, `feature.properties.name` = geoId |

**Cómo saber qué `{nivel}` usar:** leer `votes.json.nivel` (e.g., `"zona"` → `zona.topo.json`, `"serie"` → `serie.topo.json`).

**Cómo obtener el color:** `opcionId` → buscar en `opciones` → `nombre` → buscar en tabla de colores inline.
`ganadorOpcionId` en votes.json ES la misma que `opcionId` en opciones.json.

### `scripts/generate-og.mjs` — código de referencia completo

```mjs
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoMercator, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import { Resvg } from '@resvg/resvg-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const W = 1200, H = 630;
const MAP_PAD = 60;   // px de margen alrededor del mapa
const BANNER_H = 90;  // altura del banner inferior

// Rutas a generar (espeja getStaticPaths de [departamento].astro)
const ROUTES = [
  { eleccion: 'internas-2024', departamento: 'montevideo' },
  { eleccion: 'internas-2024', departamento: 'rivera' },
];

// Colores oficiales (subset — fuente de verdad: src/lib/party-colors.ts).
// Copia inline porque generate-og.mjs es ESM puro sin esbuild.
const COLORES = {
  'FRENTE AMPLIO': '#A569BD',
  'PARTIDO NACIONAL': '#55B5E5',
  'PARTIDO COLORADO': '#E52828',
  'PARTIDO INDEPENDIENTE': '#7B2CBF',
  'CABILDO ABIERTO': '#2D7D3E',
  'ASAMBLEA POPULAR': '#C0392B',
  'AVANZAR REPUBLICANO': '#1ABC9C',
  'BASTA YA': '#F39C12',
  'COALICIÓN REPUBLICANA': '#3498DB',
  'CONSTITUCIONAL AMBIENTALISTA': '#27AE60',
  'DEVOLUCIÓN': '#8E44AD',
  'IDENTIDAD SOBERANA': '#D35400',
  'LIBERTARIO': '#F1C40F',
  'P.E.R.I.': '#E74C3C',
  'PARTIDO DE LA ARMONÍA': '#9B59B6',
  'PATRIA ALTERNATIVA': '#16A085',
  'POR LOS CAMBIOS NECESARIOS': '#2980B9',
  'VERDE ANIMALISTA': '#2ECC71',
};

function getColor(opcionId, opciones) {
  const op = opciones.find((o) => o.opcionId === opcionId);
  if (!op) return '#cccccc';
  const nombre = op.nombre.toUpperCase().trim();
  return COLORES[nombre] ?? '#cccccc';
}

// Fuente TTF bundleada (Inter-Regular.ttf en el mismo directorio de scripts)
const fontBuffer = readFileSync(join(__dirname, 'fonts', 'Inter-Regular.ttf'));

let errCount = 0;
for (const { eleccion, departamento } of ROUTES) {
  try {
    const votes = JSON.parse(
      readFileSync(`public/data/${eleccion}/${departamento}/votes.json`, 'utf8'),
    );
    const opciones = JSON.parse(
      readFileSync(`public/data/${eleccion}/${departamento}/opciones.json`, 'utf8'),
    ).opciones;
    const nivel = votes.nivel; // 'zona' | 'serie'
    const topo = JSON.parse(
      readFileSync(`public/data/geo/${departamento}/${nivel}.topo.json`, 'utf8'),
    );

    // geoId → color
    const colorMap = {};
    for (const z of votes.zonas) {
      colorMap[z.geoId] = getColor(z.ganadorOpcionId, opciones);
    }

    const fc = feature(topo, topo.objects.zonas);

    // Proyección: ajusta el mapa al área disponible (sin el banner)
    const projection = geoMercator().fitSize(
      [W - MAP_PAD * 2, H - BANNER_H - MAP_PAD * 2],
      fc,
    );
    const pathGen = geoPath(projection);

    const paths = fc.features
      .map((f) => {
        const color = colorMap[f.properties.name] ?? '#e5e7eb';
        return `<path d="${pathGen(f)}" fill="${color}" stroke="#ffffff" stroke-width="0.8"/>`;
      })
      .join('');

    const label = `${departamento.charAt(0).toUpperCase() + departamento.slice(1)} · ${eleccion}`;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#f9fafb"/>
  <g transform="translate(${MAP_PAD},${MAP_PAD})">${paths}</g>
  <rect x="0" y="${H - BANNER_H}" width="${W}" height="${BANNER_H}" fill="#111827"/>
  <text x="${W / 2}" y="${H - BANNER_H / 2 + 10}" font-family="Inter" font-size="30"
        fill="#f9fafb" text-anchor="middle" dominant-baseline="middle">${label}</text>
</svg>`;

    const resvg = new Resvg(svg, {
      font: { loadSystemFonts: false, fontBuffers: [fontBuffer] },
    });
    const png = resvg.render().asPng();
    const outPath = `public/og/${eleccion}/${departamento}.png`;
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, png);
    console.log(`  ✓ ${outPath}`);
  } catch (err) {
    console.error(`  ✗ ${eleccion}/${departamento}: ${err.message}`);
    errCount++;
  }
}

if (errCount > 0) {
  console.error(`\n[generate:og] FALLA: ${errCount} imagen(s) no generada(s).`);
  process.exit(1);
}
console.log(`\n[generate:og] OK: ${ROUTES.length} imagen(s) generada(s).`);
```

### Fuente bundleada — cómo descargar Inter-Regular.ttf

Inter es SIL Open Font License — libre para uso comercial y bundling.

Descargar desde `npm pack @fontsource/inter` y extraer `files/400.ttf`, O directamente desde la CDN de Google Fonts, O desde el repositorio oficial de Inter en GitHub:

```
https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip
# extraer: Inter Desktop/Inter-Regular.otf → convertir a TTF, o usar el TTF incluido
```

O más simple: bajar directamente el TTF de fontsource en npm:
```bash
# El archivo está en node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2
# Pero @resvg/resvg-js necesita TTF/OTF, no woff2.
# Mejor: npm install --save-dev @fontsource-variable/inter
# o descargar manualmente Inter-Regular.ttf de https://fonts.google.com/specimen/Inter
```

**Recomendación práctica:** Descargar `Inter-Regular.ttf` de Google Fonts y colocarlo en `scripts/fonts/Inter-Regular.ttf`. Este archivo NO va en git LFS (es pequeño, ~300 KB). Si se quiere automatizar:

```bash
# En un script de setup (o en Task 3 manual):
curl -L "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2" -o /tmp/inter.woff2
# OJO: woff2 no funciona con resvg — necesitamos TTF.
```

**El path más rápido:** descargar desde GitHub oficial de Inter:
```bash
# Alternativa: usar noto-sans que suele estar en npm como TTF
npm install --save-dev @fontsource/noto-sans
# El TTF está en: node_modules/@fontsource/noto-sans/files/noto-sans-latin-400-normal.ttf
```

O aun más simple: usar `@resvg/resvg-js` con `loadSystemFonts: true` como primera aproximación, y agregar el font bundleado solo si CI falla. En el dev-agent record, anotar qué método funcionó.

### Colores inline vs importar party-colors.ts

`generate-og.mjs` es ESM puro sin esbuild — no puede importar TypeScript. Por eso los colores van inline en el script (como `COLORES` dict). Esto crea una duplicación deliberada respecto a `src/lib/party-colors.ts`. La fuente de verdad sigue siendo `party-colors.ts` para el front — el script de build tiene su propia copia inline.

Si se quiere evitar la duplicación, compilar el script con esbuild (igual que los ETL). Pero para mantener la paridad con el patrón de `gate-data.mjs`, se prefiere la copia inline.

### Integración en Base.astro / [departamento].astro

Esta story NO toca el frontend todavía — los meta-tags `og:image` los añade Story 3.3. Story 3.2 solo genera los PNG en `public/og/`.

### Escalabilidad cuando se añadan más departamentos

Las `ROUTES` están hardcoded en `generate-og.mjs`. Cuando se añada un nuevo departamento al ETL, se añade una entrada a `ROUTES`. El script podría autodiscovery leyendo `public/data/*/` pero el hardcoding es más explícito y consistente con el patrón de `getStaticPaths` en Astro.

### Archivos a crear/modificar

| Acción | Archivo |
|--------|---------|
| NEW | `scripts/generate-og.mjs` |
| NEW | `scripts/fonts/Inter-Regular.ttf` (descargar manualmente) |
| UPDATE | `package.json` — añadir `generate:og`, actualizar `build` |
| `.gitignore` | `public/og/` puede ir en gitignore (artefacto de build) |

### Referencias

- [epics.md § Story 3.2, FR22, FR30, AR9]
- [architecture.md § Infrastructure & Deployment, Naming, "etl/og/"]
- `public/data/{eleccion}/{dept}/votes.json` — `nivel`, `zonas[].geoId`, `zonas[].ganadorOpcionId`
- `public/data/{eleccion}/{dept}/opciones.json` — `opciones[].opcionId`, `opciones[].nombre`
- `public/data/geo/{dept}/{nivel}.topo.json` — TopoJSON; objeto `zonas`; prop `name`
- `src/lib/party-colors.ts` — fuente de verdad de colores (replicar inline en el script)
- `scripts/gate-data.mjs` — patrón de script ESM puro existente
- `@resvg/resvg-js@2.6.2` — última estable

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6
