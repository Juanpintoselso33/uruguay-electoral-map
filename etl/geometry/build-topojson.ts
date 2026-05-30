/**
 * GeoJSON → TopoJSON simplificado (Story 1.5).
 * TopoJSON dedup de bordes compartidos + simplify (Visvalingam vía topojson-simplify)
 * reducen el payload de geometría (el cuello de botella de NFR1).
 */
import { readFileSync } from 'node:fs';
import { topology } from 'topojson-server';
import { presimplify, simplify, quantile } from 'topojson-simplify';
import type { FeatureCollection } from 'geojson';
import type { Topology } from 'topojson-specification';

export interface BuildOptions {
  /** Percentil de puntos a descartar (0..1). 0.35 = descarta el 35% menos significativo. */
  simplifyQuantile: number;
}

/** Construye un TopoJSON simplificado a partir de un GeoJSON FeatureCollection. */
export function buildTopojson(
  geojsonPath: string,
  objectName: string,
  opts: BuildOptions,
): { topo: Topology; features: number } {
  const fc = JSON.parse(readFileSync(geojsonPath, 'utf8')) as FeatureCollection;
  const features = fc.features.length;

  // Los genéricos de topojson (GeoJsonProperties vs {}) son over-strict; casteamos
  // al tipo exacto que cada función espera en su firma.
  let topo = topology({ [objectName]: fc } as Parameters<typeof topology>[0]);
  topo = presimplify(topo as Parameters<typeof presimplify>[0]);
  const minWeight = quantile(topo as Parameters<typeof quantile>[0], opts.simplifyQuantile);
  topo = simplify(topo as Parameters<typeof simplify>[0], minWeight);

  return { topo: topo as Topology, features };
}
