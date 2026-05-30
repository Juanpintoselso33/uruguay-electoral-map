/**
 * GeoJSON → TopoJSON simplificado (Story 1.5, refinado en 1.6).
 * TopoJSON dedup de bordes compartidos + simplify (Visvalingam vía topojson-simplify)
 * reducen el payload de geometría (el cuello de botella de NFR1).
 *
 * 1.6: canonicaliza la propiedad de nombre a `name` (geoId del cliente). Distintas
 * fuentes usan distinta clave (`montevideo_map.json`→`name`, `v_sig_barrios.json`→`BARRIO`);
 * el cliente (Story 1.8) siempre lee `properties.name`. Además descarta el resto de
 * propiedades para achicar el payload.
 */
import { readFileSync } from 'node:fs';
import { topology } from 'topojson-server';
import { presimplify, simplify, quantile } from 'topojson-simplify';
import type { Feature, FeatureCollection } from 'geojson';
import type { Topology } from 'topojson-specification';

export interface BuildOptions {
  /** Fracción de puntos a MANTENER (los más significativos). p=0.15 → mantiene 15% (agresivo). */
  simplifyQuantile: number;
  /** Propiedad de la fuente que contiene el nombre del barrio (geoId). Se canonicaliza a `name`. */
  nameProp: string;
}

/** Lee un GeoJSON y canonicaliza la prop de nombre → `name`, descartando el resto. */
export function cleanFeatureCollection(geojsonPath: string, nameProp: string): FeatureCollection {
  const fc = JSON.parse(readFileSync(geojsonPath, 'utf8')) as FeatureCollection;
  const cleaned: Feature[] = fc.features.map((f) => {
    const name = (f.properties as Record<string, unknown> | null)?.[nameProp];
    if (typeof name !== 'string' || name.length === 0) {
      throw new Error(`[build-topojson] feature sin propiedad "${nameProp}" válida`);
    }
    return { type: 'Feature', properties: { name }, geometry: f.geometry } as Feature;
  });
  return { type: 'FeatureCollection', features: cleaned };
}

/** Construye un TopoJSON simplificado a partir de un FeatureCollection ya canonicalizado (`properties.name`). */
export function topojsonFromFC(
  fcClean: FeatureCollection,
  objectName: string,
  opts: Pick<BuildOptions, 'simplifyQuantile'>,
): { topo: Topology; features: number } {
  const features = fcClean.features.length;
  // Los genéricos de topojson (GeoJsonProperties vs {}) son over-strict; casteamos
  // al tipo exacto que cada función espera en su firma.
  let topo = topology({ [objectName]: fcClean } as Parameters<typeof topology>[0]);
  topo = presimplify(topo as Parameters<typeof presimplify>[0]);
  const minWeight = quantile(topo as Parameters<typeof quantile>[0], opts.simplifyQuantile);
  topo = simplify(topo as Parameters<typeof simplify>[0], minWeight);
  return { topo: topo as Topology, features };
}

/** Construye un TopoJSON simplificado a partir de un GeoJSON FeatureCollection (por path). */
export function buildTopojson(
  geojsonPath: string,
  objectName: string,
  opts: BuildOptions,
): { topo: Topology; features: number } {
  return topojsonFromFC(cleanFeatureCollection(geojsonPath, opts.nameProp), objectName, opts);
}
