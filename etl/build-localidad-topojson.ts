/**
 * Genera polígonos de localidades del interior a partir de la geometría de series
 * (data/raw/geographic/{depto}_series_map.json) y el mapping SERIE→localidad
 * de Story 8.1 (public/data/mappings/{depto}/serie-localidad.json).
 *
 * Para cada departamento:
 *  1. Lee series geometry y mapping serie→localidad.
 *  2. Detecta la propiedad de nombre de serie (serie/SERIE/etc.).
 *  3. Agrupa polígonos de series por localidad (solo tipo "1:1"); excluye ciudad-grande.
 *  4. Convierte a TopoJSON con budget check (≤500 KB gzip).
 *  5. Escribe public/data/geo/{depto}/localidad.topo.json.
 *  6. Valida cobertura ≥90% de localidades 1:1.
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { FeatureCollection, Feature, Polygon, MultiPolygon } from 'geojson';
import { topojsonFromFC } from './geometry/build-topojson';
import { assertGeometryBudget } from './gates/geometry-size';
import { normName } from './lib/normalize';
import type { SerieLocalidadEntry } from './lib/serie-localidad';

const BUDGET_GZIP_BYTES = 500 * 1024;
const SIMPLIFY_STEPS = [0.15, 0.10, 0.05, 0.02];

const DEPT_CODE_TO_NAME: Record<string, string> = {
  AR: 'artigas',
  CA: 'canelones',
  CL: 'cerro_largo',
  CO: 'colonia',
  DU: 'durazno',
  FD: 'florida',
  FS: 'flores',
  LA: 'lavalleja',
  MA: 'maldonado',
  PA: 'paysandu',
  RN: 'rio_negro',
  RV: 'rivera',
  RO: 'rocha',
  SA: 'salto',
  SJ: 'san_jose',
  SO: 'soriano',
  TA: 'tacuarembo',
  TT: 'treinta_y_tres',
};

type PcMultiPoly = [number, number][][][];

function toMultiPoly(geom: Polygon | MultiPolygon): PcMultiPoly {
  if (geom.type === 'Polygon') {
    return [geom.coordinates] as unknown as PcMultiPoly;
  }
  return geom.coordinates as unknown as PcMultiPoly;
}

function fromMultiPoly(mp: PcMultiPoly): Polygon | MultiPolygon {
  if (mp.length === 1) {
    return { type: 'Polygon', coordinates: mp[0] } as unknown as Polygon;
  }
  return { type: 'MultiPolygon', coordinates: mp } as unknown as MultiPolygon;
}

function main(): void {
  console.log('=== ETL: Build localidad TopoJSON (series union) ===\n');

  let failCount = 0;

  for (const [, deptName] of Object.entries(DEPT_CODE_TO_NAME)) {
    const seriesGeoPath = `data/raw/geographic/${deptName}_series_map.json`;
    const mappingPath = `public/data/mappings/${deptName}/serie-localidad.json`;

    if (!existsSync(seriesGeoPath)) {
      console.warn(`⚠️  ${deptName}: sin geometría de series (${seriesGeoPath})`);
      continue;
    }
    if (!existsSync(mappingPath)) {
      console.warn(`⚠️  ${deptName}: sin mapping serie-localidad — ejecutar etl:serie-localidad primero`);
      continue;
    }

    const seriesGeo = JSON.parse(readFileSync(seriesGeoPath, 'utf8')) as FeatureCollection;
    const mapping = JSON.parse(readFileSync(mappingPath, 'utf8')) as SerieLocalidadEntry[];

    // Build serie → entry lookup (O(1) per feature)
    const serieToEntry = new Map<string, SerieLocalidadEntry>();
    for (const entry of mapping) {
      serieToEntry.set(entry.serie.toUpperCase(), entry);
    }

    // Detect serie name property (serie/SERIE/etc.)
    const sampleProps = seriesGeo.features[0]?.properties ?? {};
    const serieProp = Object.keys(sampleProps).find((k) => k.toLowerCase() === 'serie') ?? 'serie';

    // Group polygons by localidad — 1:1 only; ciudad-grande handled in Stories 8.4/8.5
    const byLocalidad = new Map<string, { display: string; polys: PcMultiPoly[] }>();
    let unmapped = 0;
    let skippedCG = 0;

    for (const feat of seriesGeo.features) {
      const serieCode = String(feat.properties?.[serieProp] ?? '').trim().toUpperCase();
      if (!serieCode) continue;
      const entry = serieToEntry.get(serieCode);
      if (!entry) { unmapped++; continue; }
      if (entry.tipo === 'ciudad-grande') { skippedCG++; continue; }

      const geom = feat.geometry as Polygon | MultiPolygon | null;
      if (!geom || (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon')) continue;

      const norm = normName(entry.localidad);
      const existing = byLocalidad.get(norm);
      if (!existing) {
        byLocalidad.set(norm, { display: entry.localidad, polys: [toMultiPoly(geom)] });
      } else {
        existing.polys.push(toMultiPoly(geom));
      }
    }

    if (unmapped > 0) console.warn(`  ⚠️  ${deptName}: ${unmapped} series sin localidad en mapping`);
    if (skippedCG > 0) console.log(`  ℹ️  ${deptName}: ${skippedCG} series ciudad-grande excluidas (→ Story 8.5)`);

    // Build FeatureCollection: one feature per 1:1 localidad (combine all series polygons)
    const features: Feature[] = [];
    for (const [, { display, polys }] of byLocalidad) {
      const combined: PcMultiPoly = [];
      for (const mp of polys) for (const polygon of mp) combined.push(polygon);
      features.push({
        type: 'Feature',
        properties: { name: display },
        geometry: fromMultiPoly(combined),
      });
    }

    const fc: FeatureCollection = { type: 'FeatureCollection', features };

    // Build TopoJSON with progressive simplification
    let serialized: string | null = null;
    let gzipBytes = 0;
    for (const q of SIMPLIFY_STEPS) {
      try {
        const { topo } = topojsonFromFC(fc, 'zonas', { simplifyQuantile: q });
        const s = JSON.stringify(topo);
        const r = assertGeometryBudget(s, BUDGET_GZIP_BYTES);
        serialized = s;
        gzipBytes = r.gzipBytes;
        break;
      } catch {
        // budget exceeded, try more aggressive simplification
      }
    }

    if (!serialized) {
      console.error(`❌ ${deptName}: no cumple budget ≤500 KB gz con ninguna simplificación`);
      failCount++;
      continue;
    }

    const outPath = `public/data/geo/${deptName}/localidad.topo.json`;
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, serialized, 'utf8');

    // Coverage check vs 1:1 entries in mapping
    const oneToOne = mapping.filter((e) => e.tipo === '1:1');
    const geoNorms = new Set(features.map((f) => normName((f.properties as { name: string }).name)));
    const covered = oneToOne.filter((e) => geoNorms.has(normName(e.localidad))).length;
    const pct = oneToOne.length > 0 ? ((covered / oneToOne.length) * 100).toFixed(1) : 'N/A';

    if (oneToOne.length > 0 && covered / oneToOne.length < 0.9) {
      console.warn(`  ⚠️  ${deptName}: cobertura 1:1 ${pct}% (${covered}/${oneToOne.length}) < 90%`);
    }

    console.log(
      `✅ ${deptName}: ${features.length} localidades, ${(gzipBytes / 1024).toFixed(0)} KB gz, cobertura 1:1 ${pct}% → ${outPath}`,
    );
  }

  if (failCount > 0) {
    console.error(`\n❌ ${failCount} departamento(s) fallaron — BUILD FAILED`);
    process.exit(1);
  }

  console.log('\n=== Build localidad TopoJSON: completado ✅ ===');
}

main();
