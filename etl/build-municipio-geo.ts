/**
 * Story 22.2 — Geometría de municipios por disolución de series.
 *
 * Reusa el patrón de `build-localidad-topojson.ts`: parte de la geometría de series
 * (`data/raw/geographic/{depto}_series_map.json`) y el mapeo serie→municipio de la
 * Story 22.1 (`public/data/mappings/{depto}/serie-municipio.{eleccion}.json`), y une
 * los polígonos de las series de cada municipio en un polígono de municipio.
 *
 * Salidas (la geometría se keyea por (departamento, nivel), compartida entre elecciones):
 *  - `public/data/geo/{depto}/municipio.topo.json`  (municipios de ese depto)
 *  - `public/data/geo/_nacional/municipio.topo.json` (todos los municipios del interior)
 *
 * Montevideo se OMITE: sus votos están por barrio y no anidan en sus 8 municipios (A–G);
 * su geometría municipal necesita CRV→municipio aparte (ver Story 22.1 / 22.6).
 * El contorno de los 19 departamentos (capa de referencia, Story 22.5) NO se genera acá:
 * se reusa `public/data/geo/_nacional/departamento.topo.json` (ya existe).
 *
 * Uso: npx tsx etl/build-municipio-geo.ts   (npm `etl:municipio-geo`)
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { FeatureCollection, Feature, Polygon, MultiPolygon } from 'geojson';
import { topojsonFromFC } from './geometry/build-topojson';
import { assertGeometryBudget } from './gates/geometry-size';
import { normName } from './lib/normalize';

const ELECCION = 'departamentales-2025';
const BUDGET_DEPTO_GZIP = 500 * 1024;
const BUDGET_NACIONAL_GZIP = 1500 * 1024;
const SIMPLIFY_STEPS = [0.2, 0.15, 0.1, 0.05, 0.02];

// Interior (Montevideo es caso especial, ver cabecera).
const DEPTOS = [
  'artigas', 'canelones', 'cerro_largo', 'colonia', 'durazno', 'flores', 'florida',
  'lavalleja', 'maldonado', 'paysandu', 'rio_negro', 'rivera', 'rocha', 'salto',
  'san_jose', 'soriano', 'tacuarembo', 'treinta_y_tres',
];

interface SerieMunicipioEntry { serie: string; municipio: string }
type PcMultiPoly = [number, number][][][];

function toMultiPoly(geom: Polygon | MultiPolygon): PcMultiPoly {
  if (geom.type === 'Polygon') return [geom.coordinates] as unknown as PcMultiPoly;
  return geom.coordinates as unknown as PcMultiPoly;
}
function fromMultiPoly(mp: PcMultiPoly): Polygon | MultiPolygon {
  if (mp.length === 1) return { type: 'Polygon', coordinates: mp[0] } as unknown as Polygon;
  return { type: 'MultiPolygon', coordinates: mp } as unknown as MultiPolygon;
}

/** Serializa una FC a topojson probando simplificaciones progresivas hasta entrar en budget. */
function serializeWithBudget(fc: FeatureCollection, budget: number, label: string): string {
  for (const q of SIMPLIFY_STEPS) {
    try {
      const { topo } = topojsonFromFC(fc, 'zonas', { simplifyQuantile: q });
      const s = JSON.stringify(topo);
      assertGeometryBudget(s, budget);
      return s;
    } catch (err) {
      if (err instanceof Error && err.message.includes('[geometry-size]')) continue;
      throw new Error(`${label}: error de topología en q=${q}: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
    }
  }
  throw new Error(`${label}: no cumple budget ≤${(budget / 1024).toFixed(0)} KB gz con ninguna simplificación`);
}

function deptoFeatures(deptName: string, grises: string[]): Feature[] {
  const seriesGeoPath = `data/raw/geographic/${deptName}_series_map.json`;
  const mappingPath = `public/data/mappings/${deptName}/serie-municipio.${ELECCION}.json`;
  if (!existsSync(seriesGeoPath) || !existsSync(mappingPath)) return [];

  const seriesGeo = JSON.parse(readFileSync(seriesGeoPath, 'utf8')) as FeatureCollection;
  const mapping = JSON.parse(readFileSync(mappingPath, 'utf8')) as SerieMunicipioEntry[];
  const serieToMuni = new Map(mapping.map((e) => [e.serie.toUpperCase(), e.municipio]));

  // Detectar la propiedad de serie (serie/SERIE/…) escaneando todos los features.
  let serieProp = 'serie';
  for (const f of seriesGeo.features) {
    const k = f.properties && Object.keys(f.properties).find((kk) => kk.toLowerCase() === 'serie');
    if (k) { serieProp = k; break; }
  }

  const geomSeries = new Set<string>();
  const byMuni = new Map<string, { display: string; polys: PcMultiPoly[] }>();
  for (const feat of seriesGeo.features) {
    const serie = String(feat.properties?.[serieProp] ?? '').trim().toUpperCase();
    if (!serie) continue;
    geomSeries.add(serie);
    const muni = serieToMuni.get(serie);
    if (!muni) continue; // serie no municipal (la mayoría del depto)
    const geom = feat.geometry as Polygon | MultiPolygon | null;
    if (!geom || (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon')) continue;
    const key = normName(muni);
    const ex = byMuni.get(key);
    if (!ex) byMuni.set(key, { display: muni, polys: [toMultiPoly(geom)] });
    else ex.polys.push(toMultiPoly(geom));
  }

  // Grises: series con municipio en el mapeo pero SIN geometría → reportar (no rompen).
  for (const e of mapping) {
    if (!geomSeries.has(e.serie.toUpperCase())) grises.push(`${deptName}/${e.serie}→${e.municipio}`);
  }

  const features: Feature[] = [];
  for (const { display, polys } of byMuni.values()) {
    const combined: PcMultiPoly = [];
    for (const mp of polys) for (const poly of mp) combined.push(poly);
    features.push({
      type: 'Feature',
      properties: { name: display, departamento: deptName },
      geometry: fromMultiPoly(combined),
    });
  }
  return features;
}

function main(): void {
  console.log('=== ETL: Build municipio TopoJSON (disolución de series) ===\n');
  const grises: string[] = [];
  const nacional: Feature[] = [];
  let fail = 0;

  for (const deptName of DEPTOS) {
    const features = deptoFeatures(deptName, grises);
    if (features.length === 0) { console.warn(`⚠️  ${deptName}: sin municipios (geometría o mapeo ausente)`); continue; }
    const fc: FeatureCollection = { type: 'FeatureCollection', features };
    try {
      const s = serializeWithBudget(fc, BUDGET_DEPTO_GZIP, deptName);
      const out = `public/data/geo/${deptName}/municipio.topo.json`;
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, s, 'utf8');
      nacional.push(...features);
      console.log(`✅ ${deptName}: ${features.length} municipios → ${out}`);
    } catch (err) {
      console.error(`❌ ${deptName}: ${err instanceof Error ? err.message : String(err)}`);
      fail++;
    }
  }

  // Nacional: todos los municipios del interior en un archivo.
  if (nacional.length > 0) {
    const fc: FeatureCollection = { type: 'FeatureCollection', features: nacional };
    const s = serializeWithBudget(fc, BUDGET_NACIONAL_GZIP, '_nacional');
    const out = 'public/data/geo/_nacional/municipio.topo.json';
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, s, 'utf8');
    console.log(`✅ _nacional: ${nacional.length} municipios (${(JSON.stringify(JSON.parse(s)).length / 1024).toFixed(0)} KB) → ${out}`);
  }

  if (grises.length > 0) {
    console.log(`\nℹ️  ${grises.length} series mapeadas SIN geometría (municipio queda incompleto, benigno): ${grises.slice(0, 12).join(', ')}${grises.length > 12 ? '…' : ''}`);
  }
  if (fail > 0) { console.error(`\n❌ ${fail} departamento(s) fallaron — BUILD FAILED`); process.exit(1); }
  console.log('\n=== Build municipio TopoJSON: completado ✅ ===');
}

main();
