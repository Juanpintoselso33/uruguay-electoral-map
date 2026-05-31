/**
 * Generador de OG images por ruta canónica (Story 3.2).
 * Pipeline: votes.json + opciones.json + {nivel}.topo.json → d3-geo → SVG → @resvg/resvg-js → PNG
 * Output: public/og/{eleccion}/{departamento}.png (1200×630 px)
 *
 * Corre antes de `astro build` para que las imágenes estén en public/ y sean copiadas a dist/.
 *
 * NOTA: NO usamos geoMercator().fitSize() porque d3-geo's geoBounds() devuelve el mundo entero
 * [-180,-90,180,90] para geometrías uruguayas, produciendo escala ~67 (mundo entero) y mapa invisible.
 * En cambio calculamos la escala manualmente a partir de topo.bbox.
 */
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoMercator } from 'd3-geo';
import { feature } from 'topojson-client';
import { Resvg } from '@resvg/resvg-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const W = 1200;
const H = 630;
const MAP_PAD = 60;
const BANNER_H = 90;
const MAP_W = W - MAP_PAD * 2; // 1080
const MAP_H = H - BANNER_H - MAP_PAD * 2; // 420

// Rutas a generar (espeja getStaticPaths de [departamento].astro).
const ROUTES = [
  { eleccion: 'internas-2024',   departamento: 'montevideo' },
  { eleccion: 'internas-2024',   departamento: 'rivera'     },
  { eleccion: 'nacionales-2019', departamento: 'montevideo' },
];

// Colores oficiales (fuente de verdad: src/lib/party-colors.ts — copia inline para script ESM puro).
const COLORES = {
  'FRENTE AMPLIO': '#A569BD',
  'PARTIDO NACIONAL': '#55B5E5',
  'PARTIDO COLORADO': '#E52828',
  'PARTIDO INDEPENDIENTE': '#7B2CBF',
  'CABILDO ABIERTO': '#2D7D3E',
  'ASAMBLEA POPULAR': '#C0392B',
  'AVANZAR REPUBLICANO': '#1ABC9C',
  'BASTA YA': '#F39C12',
  'COALICION REPUBLICANA': '#3498DB',
  'COALICIÓN REPUBLICANA': '#3498DB',
  'CONSTITUCIONAL AMBIENTALISTA': '#27AE60',
  'DEVOLUCION': '#8E44AD',
  'DEVOLUCIÓN': '#8E44AD',
  'IDENTIDAD SOBERANA': '#D35400',
  'LIBERTARIO': '#F1C40F',
  'P.E.R.I.': '#E74C3C',
  'PARTIDO DE LA ARMONIA': '#9B59B6',
  'PARTIDO DE LA ARMONÍA': '#9B59B6',
  'PATRIA ALTERNATIVA': '#16A085',
  'POR LOS CAMBIOS NECESARIOS': '#2980B9',
  'VERDE ANIMALISTA': '#2ECC71',
  // Nombres normalizados para nacionales-2019 (sin prefijo "Partido ")
  'NACIONAL': '#55B5E5',
  'COLORADO': '#E52828',
  'INDEPENDIENTE': '#7B2CBF',
  'CABILDO ABIERTO': '#2D7D3E',
};

function getColor(opcionId, opciones) {
  const op = opciones.find((o) => o.opcionId === opcionId);
  if (!op) return '#e5e7eb';
  const nombre = op.nombre.toUpperCase().trim();
  return COLORES[nombre] ?? '#e5e7eb';
}

/**
 * Calcula la proyección Mercator desde el bbox del TopoJSON.
 * Evita geoMercator().fitSize() que usa geoBounds() — roto para geometrías de Uruguay.
 */
function makeProjection(bbox) {
  const toRad = (d) => (d * Math.PI) / 180;
  const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + toRad(lat) / 2));

  const dLon = toRad(bbox[2] - bbox[0]);
  const dY = Math.abs(mercY(bbox[3]) - mercY(bbox[1]));

  const scale = Math.min(MAP_W / dLon, MAP_H / dY) * 0.85;
  const centerLon = (bbox[0] + bbox[2]) / 2;
  const centerLat = (bbox[1] + bbox[3]) / 2;

  return geoMercator()
    .center([centerLon, centerLat])
    .scale(scale)
    .translate([MAP_W / 2, MAP_H / 2]);
}

/**
 * Genera el atributo `d` del SVG path proyectando vértices directamente.
 * Evita geoPath() que inserta puntos interpolados en grandes círculos fuera del canvas.
 */
function buildPath(geom, proj) {
  const rings =
    geom.type === 'Polygon' ? geom.coordinates : geom.coordinates.flat(1);
  let d = '';
  for (const ring of rings) {
    let firstInRing = true;
    for (const pt of ring) {
      const [px, py] = proj(pt);
      if (!isFinite(px) || !isFinite(py) || Math.abs(px) > 9999 || Math.abs(py) > 9999)
        continue;
      d += (firstInRing ? 'M' : 'L') + px.toFixed(2) + ',' + py.toFixed(2);
      firstInRing = false;
    }
    if (!firstInRing) d += 'Z';
  }
  return d;
}

// Fuente bundleada para build Linux/CI (Inter-Regular.ttf en scripts/fonts/).
// Si no existe el archivo, resvg usará fuentes del sistema (loadSystemFonts: true).
const FONT_PATH = join(__dirname, 'fonts', 'Inter-Regular.ttf');
const fontBuffer = existsSync(FONT_PATH) ? readFileSync(FONT_PATH) : null;

const resvgOpts = fontBuffer
  ? { font: { loadSystemFonts: false, fontBuffers: [fontBuffer] } }
  : { font: { loadSystemFonts: true } };

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

    // geoId → color del ganador
    const colorMap = {};
    for (const z of votes.zonas) {
      colorMap[z.geoId] = getColor(z.ganadorOpcionId, opciones);
    }

    const fc = feature(topo, topo.objects.zonas);
    const projection = makeProjection(topo.bbox);

    const paths = fc.features
      .map((f) => {
        const color = colorMap[f.properties.name] ?? '#e5e7eb';
        const d = buildPath(f.geometry, projection);
        if (!d) return '';
        return `<path d="${d}" fill="${color}" stroke="#ffffff" stroke-width="0.8"/>`;
      })
      .filter(Boolean)
      .join('');

    const deptLabel = departamento.charAt(0).toUpperCase() + departamento.slice(1);
    const label = `${deptLabel} · ${eleccion}`;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#f9fafb"/>
  <g transform="translate(${MAP_PAD},${MAP_PAD})">${paths}</g>
  <rect x="0" y="${H - BANNER_H}" width="${W}" height="${BANNER_H}" fill="#111827"/>
  <text x="${W / 2}" y="${H - BANNER_H / 2}" font-family="Inter, sans-serif" font-size="30"
        fill="#f9fafb" text-anchor="middle" dominant-baseline="middle">${label}</text>
</svg>`;

    const resvg = new Resvg(svg, resvgOpts);
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
