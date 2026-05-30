/**
 * Fusión dinámica de barrios sin datos (fix del "parche vacío").
 *
 * Si un barrio no recibió votos en esta elección (p.ej. no hubo local de votación
 * dentro de él — sus votantes votaron en barrios vecinos), su polígono se DISUELVE
 * en el barrio CON votos con el que comparte mayor borde. Así el mapa no deja huecos
 * grises y es honesto: el área se muestra como parte del barrio donde se votó.
 * No inventa votos: el barrio absorbente conserva exactamente sus propios votos.
 *
 * Opera sobre un FeatureCollection canonicalizado (`properties.name`).
 */
import polygonClipping from 'polygon-clipping';
import type { Feature, FeatureCollection, Polygon, MultiPolygon, Position } from 'geojson';

type MP = Position[][][];

function toMP(geom: Polygon | MultiPolygon): MP {
  return (geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates) as MP;
}
function fromMP(mp: MP): Polygon | MultiPolygon {
  return mp.length === 1
    ? { type: 'Polygon', coordinates: mp[0] as Position[][] }
    : { type: 'MultiPolygon', coordinates: mp as Position[][][] };
}

/** Vértices redondeados (clave "x,y") para medir borde compartido. */
function vertexSet(geom: Polygon | MultiPolygon): Set<string> {
  const out = new Set<string>();
  for (const poly of toMP(geom)) for (const ring of poly) for (const p of ring) {
    out.add(p[0].toFixed(6) + ',' + p[1].toFixed(6));
  }
  return out;
}

export interface DissolveResult {
  fc: FeatureCollection;
  merges: { vacio: string; absorbido_por: string; vertices: number }[];
}

/**
 * @param fc            FeatureCollection canonicalizado (properties.name).
 * @param hasVotes      Set de nombres normalizados que SÍ tienen votos.
 * @param norm          Normalizador de nombre (mismo que usa el join).
 */
export function dissolveEmpty(
  fc: FeatureCollection,
  hasVotes: Set<string>,
  norm: (s: string) => string,
): DissolveResult {
  const nameOf = (f: Feature): string => String((f.properties as { name: string }).name);
  const vacios = fc.features.filter((f) => !hasVotes.has(norm(nameOf(f))));
  const conVotos = fc.features.filter((f) => hasVotes.has(norm(nameOf(f))));
  if (vacios.length === 0) return { fc, merges: [] };

  const vsetVacios = new Map(vacios.map((f) => [nameOf(f), vertexSet(f.geometry as Polygon | MultiPolygon)]));
  const merges: DissolveResult['merges'] = [];

  for (const vacio of vacios) {
    const vv = vsetVacios.get(nameOf(vacio))!;
    // Vecino con votos con mayor cantidad de vértices compartidos.
    let best: Feature | null = null;
    let bestShared = -1;
    for (const cand of conVotos) {
      const cv = vertexSet(cand.geometry as Polygon | MultiPolygon);
      let shared = 0;
      for (const p of vv) if (cv.has(p)) shared++;
      if (shared > bestShared) { bestShared = shared; best = cand; }
    }
    if (!best || bestShared <= 0) {
      // Sin vecino con borde compartido (caso raro): se deja como está.
      continue;
    }
    // Los tipos de polygon-clipping piden Pair=[number,number]; GeoJSON Position=number[].
    // Casteamos a la firma exacta de la función (el dato es estructuralmente válido).
    type UnionArg = Parameters<typeof polygonClipping.union>[0];
    const merged = polygonClipping.union(
      toMP(best.geometry as Polygon | MultiPolygon) as UnionArg,
      toMP(vacio.geometry as Polygon | MultiPolygon) as UnionArg,
    ) as MP;
    best.geometry = fromMP(merged);
    merges.push({ vacio: nameOf(vacio), absorbido_por: nameOf(best), vertices: bestShared });
  }

  const absorbidos = new Set(merges.map((m) => norm(m.vacio)));
  const fcOut: FeatureCollection = {
    type: 'FeatureCollection',
    features: fc.features.filter((f) => !absorbidos.has(norm(nameOf(f)))),
  };
  return { fc: fcOut, merges };
}
