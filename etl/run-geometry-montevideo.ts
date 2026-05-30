/**
 * Entrypoint ETL geometría — Montevideo nivel zona/barrio (Story 1.5).
 * GeoJSON → TopoJSON simplificado → gate de tamaño → emisión + round-trip.
 */
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
import { feature } from 'topojson-client';
import type { GeometryCollection } from 'topojson-specification';
import type { FeatureCollection } from 'geojson';
import { buildTopojson } from './geometry/build-topojson';
import { assertGeometryBudget } from './gates/geometry-size';

function main(): void {
  const SRC = 'public/montevideo_map.json';
  const OUT = 'public/data/geo/montevideo/zona.topo.json';
  const OBJ = 'zonas';
  const BUDGET_GZ = 500 * 1024; // 500 KB gz (NFR1)

  console.log('=== ETL geometría Montevideo (zona) — Story 1.5 ===');
  const srcKb = (statSync(SRC).size / 1024).toFixed(1);
  const { topo, features } = buildTopojson(SRC, OBJ, { simplifyQuantile: 0.35 });
  const serialized = JSON.stringify(topo);

  const size = assertGeometryBudget(serialized, BUDGET_GZ);
  console.log(`GeoJSON fuente: ${srcKb} KB → TopoJSON: ${(size.rawBytes / 1024).toFixed(1)} KB raw / ${(size.gzipBytes / 1024).toFixed(1)} KB gz`);
  console.log(`Gate de tamaño (≤500 KB gz): PASA ✅`);

  // Round-trip: decodificar reconstruye los features.
  const obj = topo.objects[OBJ] as GeometryCollection;
  const back = feature(topo, obj) as FeatureCollection;
  if (back.features.length !== features) {
    throw new Error(`Round-trip falló: ${back.features.length} ≠ ${features} features`);
  }
  console.log(`Round-trip (topojson-client): ${back.features.length}/${features} barrios reconstruidos ✅`);

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, serialized, 'utf8');
  console.log(`\nArtefacto: ${OUT}`);
}

main();
