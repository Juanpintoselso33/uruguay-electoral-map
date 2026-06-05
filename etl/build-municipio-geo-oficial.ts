/**
 * Geometría de municipios desde la CAPA OFICIAL de IDE Uruguay (reemplaza la disolución de series).
 *
 * Motivo (pedido de Juan): la geometría por unión de series (build-municipio-geo.ts) producía
 * artefactos de topología — bordes de serie visibles, MultiPolygons partidos, slivers ("San Carlos
 * se ve raro"). La fuente de verdad es la capa oficial de municipios de IDEuy, construida por la
 * propia IDE a partir de las series electorales según las Circulares de la Corte Electoral.
 *
 * Fuente (descargada a data/raw/geo-ide/, ver README): WFS de IDEuy
 *   https://mapas.ide.uy/geoserver-vectorial/ideuy/wfs  typeName=ideuy:municipios_20250507 | municipios_2020
 *   outputFormat=application/json  srsName=EPSG:4326
 *
 * Join al dato: el polígono oficial trae `municipio` (nombre, a veces con erratas de fuente p.ej.
 * "Berlén"/"Ordoóez"/"Constituci�n") y `series` (composición oficial). Resolvemos el nombre CANÓNICO
 * de nuestros votos por SERIES (robusto a las erratas y a Montevideo "A".."G"→"Municipio A"..),
 * usando el mapeo serie→municipio del repo; si no hay series, caemos a match por nombre normalizado.
 *
 * Salidas (idénticas a build-municipio-geo.ts → drop-in):
 *   public/data/geo/{depto}/municipio{SUFFIX}.topo.json
 *   public/data/geo/_nacional/municipio{SUFFIX}.topo.json   (nombre compuesto "MUNICIPIO · Depto")
 *
 * Uso: npx tsx etl/build-municipio-geo-oficial.ts [departamentales-2025|departamentales-2020]
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { FeatureCollection, Feature, Polygon, MultiPolygon } from 'geojson';
import { topojsonFromFC } from './geometry/build-topojson';
import { assertGeometryBudget } from './gates/geometry-size';
import { normName } from './lib/normalize';

const CYCLE = process.argv[2] || 'departamentales-2025';
const YEAR = (CYCLE.match(/\d{4}/) ?? [''])[0];
const SUFFIX = CYCLE === 'departamentales-2025' ? '' : `.${YEAR}`;
// Capa oficial por ciclo: 2025 = boundaries 2025-2030 (Circular 12208); 2020 = período 2020-2025.
const SRC_GEOJSON = `data/raw/geo-ide/municipios_${YEAR}.geojson`;
// Votos del ciclo municipal correspondiente (para validar que el polígono tiene dato).
const MUNI_ELECCION = `municipales-${YEAR}`;

const BUDGET_DEPTO_GZIP = 500 * 1024;
const BUDGET_NACIONAL_GZIP = 256 * 1024;
const SIMPLIFY_STEPS = [0.2, 0.15, 0.1, 0.05, 0.02, 0.01, 0.005];

const DEPTOS = [
  'artigas', 'canelones', 'cerro_largo', 'colonia', 'durazno', 'flores', 'florida',
  'lavalleja', 'maldonado', 'montevideo', 'paysandu', 'rio_negro', 'rivera', 'rocha',
  'salto', 'san_jose', 'soriano', 'tacuarembo', 'treinta_y_tres',
];

// Nombre de depto OFICIAL (UPPERCASE, con/sin acento) → slug del repo.
const DEPTO_SLUG: Record<string, string> = {
  ARTIGAS: 'artigas', CANELONES: 'canelones', 'CERRO LARGO': 'cerro_largo', COLONIA: 'colonia',
  DURAZNO: 'durazno', FLORES: 'flores', FLORIDA: 'florida', LAVALLEJA: 'lavalleja',
  MALDONADO: 'maldonado', MONTEVIDEO: 'montevideo', PAYSANDU: 'paysandu', 'RIO NEGRO': 'rio_negro',
  RIVERA: 'rivera', ROCHA: 'rocha', SALTO: 'salto', 'SAN JOSE': 'san_jose', SORIANO: 'soriano',
  TACUAREMBO: 'tacuarembo', 'TREINTA Y TRES': 'treinta_y_tres',
};

interface SerieMunicipioEntry { serie: string; municipio: string }
interface MuniProps { depto?: string; municipio?: string; series?: string }

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

/** serie→municipio (nuestro nombre canónico) para el ciclo, por depto. */
function loadMapping(depto: string): Map<string, string> {
  const p = `public/data/mappings/${depto}/serie-municipio.${CYCLE}.json`;
  if (!existsSync(p)) return new Map();
  const arr = JSON.parse(readFileSync(p, 'utf8')) as SerieMunicipioEntry[];
  return new Map(arr.map((e) => [e.serie.trim().toUpperCase(), e.municipio]));
}

/** geoIds de municipio que tienen voto en el ciclo, por depto (set normalizado → display). */
function loadVotesNames(depto: string): Map<string, string> {
  const p = `public/data/${MUNI_ELECCION}/${depto}/votes.json`;
  if (!existsSync(p)) return new Map();
  const v = JSON.parse(readFileSync(p, 'utf8')) as { zonas: { geoId: string }[] };
  return new Map(v.zonas.map((z) => [normName(z.geoId), z.geoId]));
}

/** Resuelve el polígono oficial a NUESTRO nombre de municipio (por series; fallback por nombre). */
function resolveName(props: MuniProps, mapping: Map<string, string>, votes: Map<string, string>): string | null {
  // 1) match directo por nombre normalizado contra los geoIds de votos.
  const byName = votes.get(normName(props.municipio ?? ''));
  if (byName) return byName;
  // 2) por SERIES: la mayoría de las series del polígono resuelven a un único municipio nuestro.
  const series = (props.series ?? '').replace(/,/g, '-').split('-').map((s) => s.trim().toUpperCase()).filter(Boolean);
  const counts = new Map<string, number>();
  for (const s of series) {
    const muni = mapping.get(s);
    if (muni) counts.set(muni, (counts.get(muni) ?? 0) + 1);
  }
  let best: string | null = null; let bestN = 0;
  for (const [muni, n] of counts) if (n > bestN) { best = muni; bestN = n; }
  // El nombre resuelto por series debe existir en los votos (si no, es un municipio sin dato).
  if (best) { const disp = votes.get(normName(best)); if (disp) return disp; }
  return null;
}

function main(): void {
  console.log(`=== ETL: Municipios desde capa OFICIAL IDE (${CYCLE}) ===\n`);
  if (!existsSync(SRC_GEOJSON)) {
    throw new Error(`No existe ${SRC_GEOJSON}. Descargar del WFS de IDEuy (ver cabecera del script).`);
  }
  const src = JSON.parse(readFileSync(SRC_GEOJSON, 'utf8')) as FeatureCollection;

  // Agrupar features oficiales por depto.
  const byDepto = new Map<string, Feature[]>();
  for (const f of src.features) {
    const props = f.properties as MuniProps;
    const slug = DEPTO_SLUG[normName(props.depto ?? '')];
    if (!slug) continue;
    (byDepto.get(slug) ?? byDepto.set(slug, []).get(slug)!).push(f);
  }

  const nacional: Feature[] = [];
  const sinResolver: string[] = [];
  const sinPoligono: string[] = [];
  let fail = 0;

  for (const depto of DEPTOS) {
    const oficiales = byDepto.get(depto) ?? [];
    if (oficiales.length === 0) { console.warn(`⚠️  ${depto}: sin municipios en la capa oficial`); continue; }
    const mapping = loadMapping(depto);
    const votes = loadVotesNames(depto);

    const features: Feature[] = [];
    const cubiertos = new Set<string>();
    for (const f of oficiales) {
      const name = resolveName(f.properties as MuniProps, mapping, votes);
      if (!name) { sinResolver.push(`${depto}:${(f.properties as MuniProps).municipio}`); continue; }
      cubiertos.add(normName(name));
      features.push({
        type: 'Feature',
        properties: { name, departamento: depto },
        geometry: f.geometry as Polygon | MultiPolygon,
      });
    }
    // Municipios con voto pero sin polígono oficial resuelto (debería ser 0).
    for (const [k, disp] of votes) if (!cubiertos.has(k)) sinPoligono.push(`${depto}:${disp}`);

    if (features.length === 0) { console.warn(`⚠️  ${depto}: 0 municipios resueltos`); continue; }
    const fc: FeatureCollection = { type: 'FeatureCollection', features };
    try {
      const s = serializeWithBudget(fc, BUDGET_DEPTO_GZIP, depto);
      const out = `public/data/geo/${depto}/municipio${SUFFIX}.topo.json`;
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, s, 'utf8');
      nacional.push(...features);
      console.log(`✅ ${depto}: ${features.length} municipios → ${out}`);
    } catch (err) {
      console.error(`❌ ${depto}: ${err instanceof Error ? err.message : String(err)}`);
      fail++;
    }
  }

  // Nacional: nombre compuesto "MUNICIPIO · Depto" (igual que build-municipio-geo.ts → join idéntico).
  const deptos = JSON.parse(readFileSync('src/config/departments.json', 'utf8')) as { id: string; label: string }[];
  const deptoLabel = new Map(deptos.map((d) => [d.id, d.label]));
  if (nacional.length > 0) {
    const composite: Feature[] = nacional.map((f) => {
      const p = f.properties as { name: string; departamento: string };
      return { ...f, properties: { ...p, name: `${p.name} · ${deptoLabel.get(p.departamento) ?? p.departamento}` } };
    });
    const fc: FeatureCollection = { type: 'FeatureCollection', features: composite };
    const s = serializeWithBudget(fc, BUDGET_NACIONAL_GZIP, '_nacional');
    const out = `public/data/geo/_nacional/municipio${SUFFIX}.topo.json`;
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, s, 'utf8');
    console.log(`✅ _nacional: ${nacional.length} municipios (${(s.length / 1024).toFixed(0)} KB) → ${out}`);
  }

  if (sinResolver.length > 0) console.warn(`\n⚠️  ${sinResolver.length} polígono(s) oficial(es) sin resolver a un municipio con voto: ${sinResolver.join(', ')}`);
  if (sinPoligono.length > 0) console.warn(`⚠️  ${sinPoligono.length} municipio(s) con voto SIN polígono oficial: ${sinPoligono.join(', ')}`);
  if (fail > 0) { console.error(`\n❌ ${fail} departamento(s) fallaron — BUILD FAILED`); process.exit(1); }
  console.log('\n=== Build municipio (oficial): completado ✅ ===');
}

main();
