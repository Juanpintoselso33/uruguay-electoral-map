/**
 * Orchestrator ETL — Montevideo internas-2024 (Story 1.6).
 * Encadena: geometría limpia (TopoJSON) → votos (CIRCUITO→BARRIO) → gate reconciliación
 * → gate cobertura. Cualquier gate que falle aborta con exit≠0 (rompe el build/CI).
 *
 * Reemplaza run-geometry-montevideo.ts (1.5) y run-montevideo-internas.ts (1.4): la
 * geometría ahora viene de v_sig_barrios.json (limpio, nombres = mapping) y los votos
 * se agregan por circuito, no por la columna ZONA. Ejecutar: esbuild bundle + node.
 */
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
import { feature } from 'topojson-client';
import type { GeometryCollection } from 'topojson-specification';
import type { FeatureCollection } from 'geojson';
import { cleanFeatureCollection, topojsonFromFC } from './geometry/build-topojson';
import { dissolveEmpty } from './geometry/dissolve-empty';
import { buildCircuitoBarrio } from './geometry/build-circuito-barrio';
import { assertGeometryBudget } from './gates/geometry-size';
import { parseCsv } from './extract/parse-csv';
import { aggregateByCircuito } from './transform/aggregate-by-circuito';
import { buildShard, writeShard } from './load/emit-shard';
import { reconcile } from './gates/reconcile';
import { checkCoverage } from './gates/coverage';

const GEO_SRC = 'public/v_sig_barrios.json'; // fuente LIMPIA (UTF-8, BARRIO = mapping)
const GEO_OUT = 'public/data/geo/montevideo/zona.topo.json';
const GEO_OBJ = 'zonas';
const GEO_NAME_PROP = 'BARRIO';
const BUDGET_GZ = 500 * 1024;

const CSV = 'public/montevideo_odn.csv';
// Geolocalización oficial: circuito → dirección → coords (georef Corte) → PIP → barrio.
// Reemplaza el serie-dominante de montevideo-crv-barrio.json (rescata los barrios grises).
const GEOREF = 'data/raw/geographic/plan-circuital-georreferencia-nacional-2024.csv';
const PLAN_INTERNAS = 'data/raw/electoral/plan-circuital.csv';
const MAPPING_OUT = 'data/mappings/montevideo-circuito-barrio.json';
const SHARD_OUT = 'public/data/internas-2024/montevideo/votes.json';
const OPCIONES_OUT = 'public/data/internas-2024/montevideo/opciones.json';
const ESC_CANONICO = 'Departamental';

/** Normalizador de nombre de barrio (mismo criterio que el join: NFD+upper+`.,`→espacio). */
const normBarrio = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();

function geometryStep(hasVotes: Set<string>): { names: string[] } {
  console.log('\n--- 2) Geometría (v_sig_barrios → fusión de vacíos → TopoJSON) ---');
  const srcKb = (statSync(GEO_SRC).size / 1024).toFixed(0);
  const clean = cleanFeatureCollection(GEO_SRC, GEO_NAME_PROP);
  // Fusión dinámica: barrios sin votos se disuelven en su vecino con votos (sin parches grises).
  const { fc: dissolved, merges } = dissolveEmpty(clean, hasVotes, normBarrio);
  for (const m of merges) {
    console.log(`  fusión: "${m.vacio}" (sin urna esta elección) → "${m.absorbido_por}" (${m.vertices} vértices de borde)`);
  }
  const { topo, features } = topojsonFromFC(dissolved, GEO_OBJ, {
    // 0.15: v_sig es alta resolución (fuente 2MB); simplify moderado conserva forma y baja ~4× el payload.
    simplifyQuantile: 0.15,
  });
  const serialized = JSON.stringify(topo);
  const size = assertGeometryBudget(serialized, BUDGET_GZ);
  console.log(
    `GeoJSON fuente ${srcKb} KB → TopoJSON ${(size.rawBytes / 1024).toFixed(1)} KB raw / ` +
      `${(size.gzipBytes / 1024).toFixed(1)} KB gz (gate ≤500 KB gz: PASA ✅)`,
  );

  const obj = topo.objects[GEO_OBJ] as GeometryCollection;
  const fc = feature(topo, obj) as FeatureCollection;
  if (fc.features.length !== features) {
    throw new Error(`Round-trip falló: ${fc.features.length} ≠ ${features}`);
  }
  const names = fc.features.map((f) => String((f.properties as { name: string }).name));
  const conEnie = names.filter((n) => /[ñÑ]/.test(n)).length;
  const corruptos = names.filter((n) => n.includes('�')).length;
  console.log(`Round-trip: ${fc.features.length}/${features} barrios ✅ · con ñ: ${conEnie} · corruptos(U+FFFD): ${corruptos}`);
  if (corruptos > 0) throw new Error(`Geometría con ${corruptos} nombres corruptos (U+FFFD)`);

  mkdirSync(dirname(GEO_OUT), { recursive: true });
  writeFileSync(GEO_OUT, serialized, 'utf8');
  console.log(`Artefacto: ${GEO_OUT}`);
  return { names };
}

function votesStep(): { shard: ReturnType<typeof buildShard>; totalCanonico: number; unmappedVotos: number } {
  console.log('--- 1) Votos (CIRCUITO → BARRIO por geolocalización oficial) ---');
  const rows = parseCsv(CSV);
  const { circuitoToBarrio, stats } = buildCircuitoBarrio({
    georefPath: GEOREF,
    planInternasPath: PLAN_INTERNAS,
    barriosGeojsonPath: GEO_SRC,
  });
  console.log(
    `circuito→barrio: ${stats.viaDireccion} via dirección + ${stats.viaSerie} via serie (fallback) = ${stats.barrios} barrios cubiertos`,
  );
  mkdirSync(dirname(MAPPING_OUT), { recursive: true });
  writeFileSync(MAPPING_OUT, JSON.stringify({ crvToBarrio: circuitoToBarrio }, null, 0), 'utf8');
  const agg = aggregateByCircuito(rows, { escrutinioCanonico: ESC_CANONICO, crvToBarrio: circuitoToBarrio });
  console.log(
    `CSV ${rows.length} filas → barrios ${agg.zonas.length} · total canónico ${agg.totalCanonico.toLocaleString('es-UY')} · ` +
      `unmapped ${agg.unmappedVotos.toLocaleString('es-UY')} (${agg.circuitosSinBarrio.length} circuitos)`,
  );

  const shard = buildShard(agg.zonas, {
    eleccionId: 'internas-2024',
    departamento: 'montevideo',
    tipo: 'internas',
    nivel: 'zona',
    outPath: SHARD_OUT,
  });
  writeShard(shard, SHARD_OUT);
  console.log(`Shard escrito (validado por assertVotosShard): ${SHARD_OUT}`);

  mkdirSync(dirname(OPCIONES_OUT), { recursive: true });
  writeFileSync(OPCIONES_OUT, JSON.stringify({ opciones: agg.opciones }), 'utf8');
  console.log(`Catálogo de opciones: ${OPCIONES_OUT} (${agg.opciones.length} opciones)`);
  return { shard, totalCanonico: agg.totalCanonico, unmappedVotos: agg.unmappedVotos };
}

function main(): void {
  console.log('=== ETL Montevideo internas-2024 ===');
  const { shard, totalCanonico, unmappedVotos } = votesStep();
  const hasVotes = new Set(shard.zonas.map((z) => normBarrio(z.geoId)));
  const { names } = geometryStep(hasVotes);

  console.log('\n--- 3) Gate: reconciliación (losslessness) ---');
  const rec = reconcile(shard, totalCanonico, unmappedVotos);
  console.log(`sum-in=${rec.sumIn.toLocaleString('es-UY')} sum-out=${rec.sumOut.toLocaleString('es-UY')} delta=${rec.delta} ✅`);

  console.log('\n--- 4) Gate: cobertura zonas↔geometría ---');
  const cov = checkCoverage({ shard, geoBarrioNames: names, totalCanonico });
  console.log(
    `placement ${(cov.placement * 100).toFixed(1)}% (≥95% ✅) · ` +
      `barrio-fill ${cov.barriosConVotos}/${cov.geoBarrios} = ${(cov.barrioFill * 100).toFixed(1)}% (≥75% ✅)`,
  );
  if (cov.geoSinVotos.length > 0) {
    console.log(`Barrios sin votos (${cov.geoSinVotos.length}, incompletitud de la mapping): ${cov.geoSinVotos.join(', ')}`);
  }
  if (cov.shardSinMatch.length > 0) {
    console.log(`⚠️ geoIds del shard sin match en geometría (${cov.shardSinMatch.length}): ${cov.shardSinMatch.join(', ')}`);
  }
  console.log('\n=== Todos los gates PASARON ✅ ===');
}

main();
