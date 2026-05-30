/**
 * Orchestrator ETL — Montevideo internas-2024 (Story 1.6).
 * Encadena: geometría limpia (TopoJSON) → votos (CIRCUITO→BARRIO) → gate reconciliación
 * → gate cobertura. Cualquier gate que falle aborta con exit≠0 (rompe el build/CI).
 *
 * Reemplaza run-geometry-montevideo.ts (1.5) y run-montevideo-internas.ts (1.4): la
 * geometría ahora viene de v_sig_barrios.json (limpio, nombres = mapping) y los votos
 * se agregan por circuito, no por la columna ZONA. Ejecutar: esbuild bundle + node.
 */
import { mkdirSync, writeFileSync, readFileSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
import { feature } from 'topojson-client';
import type { GeometryCollection } from 'topojson-specification';
import type { FeatureCollection } from 'geojson';
import { buildTopojson } from './geometry/build-topojson';
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
const MAPPING = 'data/mappings/montevideo-crv-barrio.json';
const SHARD_OUT = 'public/data/internas-2024/montevideo/votes.json';
const OPCIONES_OUT = 'public/data/internas-2024/montevideo/opciones.json';
const ESC_CANONICO = 'Departamental';

function geometryStep(): { names: string[] } {
  console.log('--- 1) Geometría (v_sig_barrios → TopoJSON) ---');
  const srcKb = (statSync(GEO_SRC).size / 1024).toFixed(0);
  const { topo, features } = buildTopojson(GEO_SRC, GEO_OBJ, {
    // 0.15: v_sig es alta resolución (fuente 2MB); para choropleth de barrios un
    // simplify moderado conserva la forma y baja el payload ~4× (≈70KB gz). Ver sweep en story.
    simplifyQuantile: 0.15,
    nameProp: GEO_NAME_PROP,
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
  console.log('\n--- 2) Votos (CIRCUITO → BARRIO) ---');
  const rows = parseCsv(CSV);
  const crvToBarrio = (JSON.parse(readFileSync(MAPPING, 'utf8')) as { crvToBarrio: Record<string, string> })
    .crvToBarrio;
  const agg = aggregateByCircuito(rows, { escrutinioCanonico: ESC_CANONICO, crvToBarrio });
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
  console.log('=== ETL Montevideo internas-2024 (Story 1.6) ===');
  const { names } = geometryStep();
  const { shard, totalCanonico, unmappedVotos } = votesStep();

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
