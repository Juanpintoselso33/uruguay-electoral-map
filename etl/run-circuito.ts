/**
 * ETL nivel CIRCUITO (Story 6.3 — UX-DR7 Fase 2).
 *
 * Genera VotosShard(nivel='circuito') + geometría de puntos para los 19 departamentos.
 * Usa `plan-circuital-georreferencia-nacional-2024.csv` para obtener lat/lon de cada circuito.
 * La geometría resultante son features de tipo Point → el mapa renderiza bubbles (circle layer).
 *
 * Output por departamento:
 *   public/data/{eleccion}/{dept}/votes-circuito.json   ← VotosShard nivel=circuito
 *   public/data/geo/{dept}/circuito.topo.json           ← FeatureCollection(Point) como TopoJSON
 */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { topology } from 'topojson-server';
import type { FeatureCollection, Feature, Point } from 'geojson';
import type { AgregadoZona, VotoOpcion } from '../src/lib/contracts';
import { slug } from './lib/normalize';
import { parseCsv } from './extract/parse-csv';
import { buildShard, writeShard } from './load/emit-shard';

const DESGLOSE = 'data/raw/electoral/desglose-de-votos.csv';
const PLAN = 'data/raw/geographic/plan-circuital-georreferencia-nacional-2024.csv';
const ELECCION = 'internas-2024';

/** Mapping deptCode (CSV) → { planName (plan-circuital), deptName (path), exteriorCrv (opcional) } */
const DEPT_MAP: Record<string, { planName: string; deptName: string }> = {
  AR: { planName: 'Artigas',       deptName: 'artigas' },
  CA: { planName: 'Canelones',     deptName: 'canelones' },
  CL: { planName: 'Cerro Largo',   deptName: 'cerro_largo' },
  CO: { planName: 'Colonia',       deptName: 'colonia' },
  DU: { planName: 'Durazno',       deptName: 'durazno' },
  FD: { planName: 'Florida',       deptName: 'florida' },
  FS: { planName: 'Flores',        deptName: 'flores' },
  LA: { planName: 'Lavalleja',     deptName: 'lavalleja' },
  MA: { planName: 'Maldonado',     deptName: 'maldonado' },
  MO: { planName: 'Montevideo',    deptName: 'montevideo' },
  PA: { planName: 'Paysandú',      deptName: 'paysandu' },
  RN: { planName: 'Río Negro',     deptName: 'rio_negro' },
  RO: { planName: 'Rocha',         deptName: 'rocha' },
  RV: { planName: 'Rivera',        deptName: 'rivera' },
  SA: { planName: 'Salto',         deptName: 'salto' },
  SJ: { planName: 'San José',      deptName: 'san_jose' },
  SO: { planName: 'Soriano',       deptName: 'soriano' },
  TA: { planName: 'Tacuarembó',    deptName: 'tacuarembo' },
  TT: { planName: 'Treinta y Tres',deptName: 'treinta_y_tres' },
};

/** Parsea plan-circuital (semicolon-separated, BOM) → Map<planName, Map<nroCircuito, {lat, lon, habilitados}>> */
function loadPlanCircuital(): Map<string, Map<number, { lat: number; lon: number; habilitados: number }>> {
  const raw = readFileSync(PLAN, 'utf8').replace(/^﻿/, '');
  const lines = raw.split('\n').filter(Boolean);
  const result = new Map<string, Map<number, { lat: number; lon: number; habilitados: number }>>();
  for (const line of lines.slice(1)) {
    const parts = line.split(';');
    const dept = parts[0]?.trim();
    const nro = parseInt(parts[1]?.trim(), 10);
    const habilitados = parseInt(parts[5]?.trim(), 10) || 0;
    const lat = parseFloat(parts[9]?.replace(/"/g, '').trim());
    const lon = parseFloat(parts[10]?.replace(/"/g, '').trim());
    if (!dept || !Number.isFinite(nro) || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (!result.has(dept)) result.set(dept, new Map());
    result.get(dept)!.set(nro, { lat, lon, habilitados });
  }
  return result;
}

export function runCircuitoLevel(deptCode: string): void {
  const meta = DEPT_MAP[deptCode];
  if (!meta) throw new Error(`deptCode desconocido: ${deptCode}`);
  const { planName, deptName } = meta;

  console.log(`\n=== ETL circuito: ${deptName} ===`);

  const plan = loadPlanCircuital();
  const deptPlan = plan.get(planName);
  if (!deptPlan || deptPlan.size === 0) {
    console.warn(`  ⚠ sin datos en plan-circuital para "${planName}" — saltando`);
    return;
  }
  console.log(`  plan-circuital: ${deptPlan.size} circuitos con geo`);

  // 1) Filtrar desglose a HOJA_ODN + dept
  const allRows = parseCsv(DESGLOSE);
  const rows = allRows.filter(
    (r) => r['DEPARTAMENTO'] === deptCode && r['TIPO_REGISTRO'] === 'HOJA_ODN',
  );
  console.log(`  desglose HOJA_ODN: ${rows.length} filas`);

  // 2) Agregar por CRV (número de circuito) → lema
  const porCrv = new Map<number, Map<string, number>>();
  const opcionesPorId = new Map<string, string>();

  for (const r of rows) {
    const crvRaw = (r['CRV'] ?? '').trim();
    const lema = (r['LEMA'] ?? '').trim();
    const votos = Number(r['CANTIDAD_VOTOS']);
    const nro = parseInt(crvRaw, 10);
    if (!Number.isFinite(nro) || !lema || !Number.isFinite(votos) || votos <= 0) continue;
    if (!porCrv.has(nro)) porCrv.set(nro, new Map());
    porCrv.get(nro)!.set(lema, (porCrv.get(nro)!.get(lema) ?? 0) + votos);
    opcionesPorId.set(slug(lema), lema);
  }
  console.log(`  CRVs con votos: ${porCrv.size}`);

  // 3) Construir zonas (AgregadoZona) y Features (Point)
  const zonas: AgregadoZona[] = [];
  const features: Feature<Point>[] = [];
  let sinGeo = 0;

  for (const [nro, lemas] of [...porCrv.entries()].sort((a, b) => a[0] - b[0])) {
    const geo = deptPlan.get(nro);
    if (!geo) { sinGeo++; continue; }

    const ranking = [...lemas.entries()].sort((a, b) => b[1] - a[1]);
    const validos = ranking.reduce((s, [, v]) => s + v, 0);
    const porOpcion: VotoOpcion[] = ranking.map(([l, v]) => ({ opcionId: slug(l), votos: v }));

    const geoId = String(nro);
    zonas.push({
      geoId,
      ganadorOpcionId: ranking.length ? slug(ranking[0][0]) : '',
      validos,
      porOpcion,
      noPartidarios: { enBlanco: 0, anulados: 0, observados: 0 },
    });

    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [geo.lon, geo.lat] },
      properties: { name: geoId, habilitados: geo.habilitados },
    });
  }

  console.log(`  zonas generadas: ${zonas.length} · sin geo: ${sinGeo}`);

  // 4) VotosShard votes-circuito.json
  const shard = buildShard(zonas, {
    eleccionId: ELECCION,
    departamento: deptName,
    tipo: 'internas',
    nivel: 'circuito',
    outPath: '',
  });
  const votosOut = `public/data/${ELECCION}/${deptName}/votes-circuito.json`;
  writeShard(shard, votosOut);
  console.log(`  ✓ ${votosOut}`);

  // Opciones (compartidas con zona/serie — no sobrescribir si ya existe)
  const opcionesOut = `public/data/${ELECCION}/${deptName}/opciones.json`;
  // Leer las opciones existentes (ya generadas por el ETL de zona/serie)
  // para preservar nombres canónicos
  let opcionesExistentes: { opcionId: string; nombre: string }[] = [];
  try {
    const doc = JSON.parse(readFileSync(opcionesOut, 'utf8')) as { opciones: { opcionId: string; nombre: string }[] };
    opcionesExistentes = doc.opciones;
  } catch { /* no existe todavía */ }

  // Merge: agregar opciones nuevas que no existan
  const existMap = new Map(opcionesExistentes.map((o) => [o.opcionId, o.nombre]));
  for (const [id, nombre] of opcionesPorId) {
    if (!existMap.has(id)) existMap.set(id, nombre);
  }
  const opcionesMerged = [...existMap.entries()].map(([opcionId, nombre]) => ({ opcionId, nombre }));
  mkdirSync(dirname(opcionesOut), { recursive: true });
  writeFileSync(opcionesOut, JSON.stringify({ opciones: opcionesMerged }), 'utf8');

  // 5) Geometría de puntos → TopoJSON
  const fc: FeatureCollection<Point> = { type: 'FeatureCollection', features };
  // topojson-server espera objetos nombrados; los Points van como delta-encoded (sin arcos)
  const topo = topology({ zonas: fc as unknown as FeatureCollection });

  const geoOut = `public/data/geo/${deptName}/circuito.topo.json`;
  mkdirSync(dirname(geoOut), { recursive: true });
  writeFileSync(geoOut, JSON.stringify(topo), 'utf8');

  const sizekb = (JSON.stringify(topo).length / 1024).toFixed(1);
  console.log(`  ✓ ${geoOut} (${sizekb} KB raw)`);
  console.log(`=== ${deptName} circuito OK ===`);
}

// Ejecutar todos los departamentos si se llama directamente
const ALL_CODES = Object.keys(DEPT_MAP);
for (const code of ALL_CODES) {
  try { runCircuitoLevel(code); }
  catch (e) { console.error(`  ✗ ${code}:`, e); }
}
