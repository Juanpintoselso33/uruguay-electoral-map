/**
 * Orchestrator ETL — Montevideo nacionales-2019 (Story 4.1).
 * Reutiliza geometría y mapping ya generados por etl:montevideo (Story 1.6).
 * No regenera geometría ni mapping; solo agrega votos y corre los gates.
 *
 * Dependencia: correr `npm run etl:montevideo` antes de este script para que
 * existan data/mappings/montevideo-circuito-barrio.json y
 * public/data/geo/montevideo/zona.topo.json.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { feature } from 'topojson-client';
import type { GeometryCollection } from 'topojson-specification';
import type { FeatureCollection } from 'geojson';
import { parseCsv } from './extract/parse-csv';
import { aggregateNacionalesMvd } from './transform/aggregate-nacionales-mvd';
import { buildShard, writeShard } from './load/emit-shard';
import { reconcile } from './gates/reconcile';
import { checkCoverage } from './gates/coverage';

const CSV = 'data/raw/electoral/nacionales-2019/montevideo_odd.csv';
const MAPPING_IN = 'data/mappings/montevideo-circuito-barrio.2019.json';
const GEO_IN = 'public/data/geo/montevideo/zona.topo.json';
const SHARD_OUT = 'public/data/nacionales-2019/montevideo/votes.json';
const OPCIONES_OUT = 'public/data/nacionales-2019/montevideo/opciones.json';

function main(): void {
  console.log('=== ETL Montevideo nacionales-2019 ===');
  console.log('Dependencia: etl:montevideo debe haber corrido antes.');

  console.log('\n--- 1) Votos (CRV → barrio vía mapping pre-existente) ---');
  const rows = parseCsv(CSV);
  const { crvToBarrio } = JSON.parse(readFileSync(MAPPING_IN, 'utf8')) as {
    crvToBarrio: Record<string, string>;
  };
  const agg = aggregateNacionalesMvd(rows, crvToBarrio);
  console.log(
    `CSV ${rows.length} filas → barrios ${agg.zonas.length} · total canónico ${agg.totalCanonico.toLocaleString('es-UY')} · ` +
      `unmapped ${agg.unmappedVotos.toLocaleString('es-UY')} (${agg.circuitosSinBarrio.length} circuitos)`,
  );

  const shard = buildShard(agg.zonas, {
    eleccionId: 'nacionales-2019',
    departamento: 'montevideo',
    tipo: 'nacionales',
    nivel: 'zona',
    outPath: SHARD_OUT,
  });
  writeShard(shard, SHARD_OUT);
  console.log(`Shard escrito (validado por assertVotosShard): ${SHARD_OUT}`);

  mkdirSync(dirname(OPCIONES_OUT), { recursive: true });
  writeFileSync(OPCIONES_OUT, JSON.stringify({ opciones: agg.opciones }), 'utf8');
  console.log(`Catálogo de opciones: ${OPCIONES_OUT} (${agg.opciones.length} opciones)`);

  console.log('\n--- 2) Gate: reconciliación (losslessness) ---');
  const rec = reconcile(shard, agg.totalCanonico, agg.unmappedVotos);
  console.log(`sum-in=${rec.sumIn.toLocaleString('es-UY')} sum-out=${rec.sumOut.toLocaleString('es-UY')} delta=${rec.delta} ✅`);

  console.log('\n--- 3) Gate: cobertura zonas↔geometría ---');
  const topo = JSON.parse(readFileSync(GEO_IN, 'utf8'));
  const obj = topo.objects['zonas'] as GeometryCollection;
  const fc = feature(topo, obj) as FeatureCollection;
  const geoNames = fc.features.map((f) => String((f.properties as { name: string }).name));
  const cov = checkCoverage({ shard, geoBarrioNames: geoNames, totalCanonico: agg.totalCanonico });
  console.log(
    `placement ${(cov.placement * 100).toFixed(1)}% (≥95% ✅) · ` +
      `barrio-fill ${cov.barriosConVotos}/${cov.geoBarrios} = ${(cov.barrioFill * 100).toFixed(1)}% (≥75% ✅)`,
  );
  if (cov.geoSinVotos.length > 0) {
    console.log(`Barrios sin votos (${cov.geoSinVotos.length}): ${cov.geoSinVotos.join(', ')}`);
  }
  if (cov.shardSinMatch.length > 0) {
    console.log(`⚠️ geoIds sin match en geometría (${cov.shardSinMatch.length}): ${cov.shardSinMatch.join(', ')}`);
  }

  console.log('\n=== Todos los gates PASARON ✅ ===');
}

main();
