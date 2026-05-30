/**
 * Construye el mapping CIRCUITO(internas) → BARRIO por geolocalización oficial (Story de fix grises).
 *
 * Cadena correcta (reemplaza el serie-dominante de montevideo-crv-barrio.json):
 *   circuito internas → dirección de calle (plan internas) → coords oficiales (georef Corte)
 *   → point-in-polygon contra v_sig_barrios (62) → barrio exacto.
 * Fallback (direcciones sin match): circuito → serie → barrio dominante de esa serie,
 * calculado con PIP de las coords reales (no por área como antes).
 *
 * Fuentes:
 *  - Georef Corte (lat/lon por circuito, Nacionales-2024): data/raw/geographic/plan-circuital-georreferencia-nacional-2024.csv
 *  - Plan circuital internas (circuito→dirección): data/raw/electoral/plan-circuital.csv
 *  - Geometría barrios: public/v_sig_barrios.json
 * Nota: NO se joina por número de circuito (se reusa entre elecciones para otra ubicación);
 * el join es por dirección de CALLE (lo que sigue al último "-"), robusto a que el nombre
 * de la institución difiera entre internas y nacionales.
 */
import { readFileSync } from 'node:fs';
import type { FeatureCollection, Polygon, MultiPolygon, Position } from 'geojson';

const DEPTO = 'MO';
const DEPTO_GEOREF = 'Montevideo';

/** Normaliza la dirección de calle: toma lo que sigue al último "-" y limpia. */
function streetKey(local: string): string {
  const parts = (local ?? '').split('-');
  const tail = parts.length > 1 ? parts[parts.length - 1] : local;
  return (tail ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toNum(s: string): number {
  return parseFloat(String(s).replace(/["\s]/g, ''));
}

/** Parser CSV con comillas (coma). */
function parseLineComma(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

// --- point-in-polygon (ray casting, soporta huecos y multipolígono) ---
function inRing(pt: [number, number], ring: Position[]): boolean {
  const [x, y] = pt;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if (((yi > y) !== (yj > y)) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function inFeature(pt: [number, number], geom: Polygon | MultiPolygon): boolean {
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
  for (const poly of polys) {
    if (inRing(pt, poly[0] as Position[])) {
      let hole = false;
      for (let h = 1; h < poly.length; h++) if (inRing(pt, poly[h] as Position[])) { hole = true; break; }
      if (!hole) return true;
    }
  }
  return false;
}

export interface CircuitoBarrioResult {
  /** Mapa circuito(string) → barrio (igual a v_sig BARRIO). */
  circuitoToBarrio: Record<string, string>;
  /** Diagnóstico. */
  stats: { total: number; viaDireccion: number; viaSerie: number; sinAsignar: number; barrios: number };
}

export function buildCircuitoBarrio(opts: {
  georefPath: string;
  planInternasPath: string;
  barriosGeojsonPath: string;
}): CircuitoBarrioResult {
  const barrios = (JSON.parse(readFileSync(opts.barriosGeojsonPath, 'utf8')) as FeatureCollection).features.map(
    (f) => ({ name: String((f.properties as { BARRIO: string }).BARRIO), geom: f.geometry as Polygon | MultiPolygon }),
  );
  const pip = (lon: number, lat: number): string | null => {
    for (const b of barrios) if (inFeature([lon, lat], b.geom)) return b.name;
    return null;
  };

  // Georef: street-key → coords, y serie → tally de barrios (PIP de coords reales).
  const G = readFileSync(opts.georefPath, 'utf8').split(/\r?\n/);
  const gh = G[0].replace(/^﻿/, '').split(';');
  const gD = gh.indexOf('Departamento'), gDir = gh.indexOf('direccion'), gLa = gh.indexOf('Latitud'),
    gLo = gh.indexOf('Longitud'), gS = gh.indexOf('Serie');
  const streetCoord = new Map<string, [number, number]>();
  const serieTally = new Map<string, Map<string, number>>();
  for (let k = 1; k < G.length; k++) {
    if (!G[k]) continue;
    const c = G[k].split(';');
    if (c[gD] !== DEPTO_GEOREF) continue;
    const lat = toNum(c[gLa]), lon = toNum(c[gLo]);
    if (Number.isNaN(lat) || Number.isNaN(lon)) continue;
    const sk = streetKey(c[gDir]);
    if (sk && !streetCoord.has(sk)) streetCoord.set(sk, [lon, lat]);
    const b = pip(lon, lat);
    if (b) {
      const t = serieTally.get(c[gS]) ?? new Map<string, number>();
      t.set(b, (t.get(b) ?? 0) + 1);
      serieTally.set(c[gS], t);
    }
  }
  const serieBarrio = new Map<string, string>();
  for (const [s, t] of serieTally) serieBarrio.set(s, [...t.entries()].sort((a, b) => b[1] - a[1])[0][0]);

  // Plan internas: circuito → dirección + serie → barrio.
  const P = readFileSync(opts.planInternasPath, 'utf8').split(/\r?\n/);
  const ph = parseLineComma(P[0]).map((x) => x.trim());
  const pD = ph.indexOf('Departamento'), pC = ph.indexOf('NroCircuito'), pL = ph.indexOf('Local'), pS = ph.indexOf('Serie');
  const circuitoToBarrio: Record<string, string> = {};
  let viaDireccion = 0, viaSerie = 0, sinAsignar = 0;
  for (let k = 1; k < P.length; k++) {
    if (!P[k]) continue;
    const c = parseLineComma(P[k]);
    if ((c[pD] ?? '').trim() !== DEPTO) continue;
    const cc = c[pC].trim();
    const co = streetCoord.get(streetKey(c[pL]));
    if (co) {
      const b = pip(co[0], co[1]);
      if (b) { circuitoToBarrio[cc] = b; viaDireccion++; continue; }
    }
    const sb = serieBarrio.get(c[pS]);
    if (sb) { circuitoToBarrio[cc] = sb; viaSerie++; } else sinAsignar++;
  }

  const barriosConDatos = new Set(Object.values(circuitoToBarrio)).size;
  return {
    circuitoToBarrio,
    stats: { total: viaDireccion + viaSerie + sinAsignar, viaDireccion, viaSerie, sinAsignar, barrios: barriosConDatos },
  };
}
