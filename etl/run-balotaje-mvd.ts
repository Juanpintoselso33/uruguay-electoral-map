/**
 * Orchestrator ETL — Montevideo balotaje 2024.
 * Reutiliza geometría y mapping ya generados por etl:montevideo (Story 1.6).
 * No regenera geometría; solo agrega votos y corre los gates de integridad.
 *
 * Dependencia: correr `npm run etl:montevideo` antes para que existan:
 *   data/mappings/montevideo-circuito-barrio.json
 *   public/data/geo/montevideo/zona.topo.json
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { feature } from 'topojson-client';
import type { GeometryCollection } from 'topojson-specification';
import type { FeatureCollection } from 'geojson';
import { parseCsv } from './extract/parse-csv';
import { aggregateBalotajeMvd } from './transform/aggregate-balotaje-mvd';
import { buildShard, writeShard } from './load/emit-shard';
import { reconcile } from './gates/reconcile';
import { checkCoverage } from './gates/coverage';

const CSV = 'data/raw/electoral/balotaje-2024/balotaje-2024.csv';
const MAPPING_IN = 'data/mappings/montevideo-circuito-barrio.2024.json';
const GEO_IN = 'public/data/geo/montevideo/zona.topo.json';
const SHARD_OUT = 'public/data/balotaje-2024/montevideo/votes.json';
const OPCIONES_OUT = 'public/data/balotaje-2024/montevideo/opciones.json';

function main(): void {
  console.log('=== ETL Montevideo balotaje-2024 ===');
  console.log('Dependencia: etl:montevideo debe haber corrido antes.');

  console.log('\n--- 1) Votos (CRV → barrio vía mapping pre-existente) ---');
  const allRows = parseCsv(CSV);
  // Filtrar a Montevideo, excluir serie exterior (BZZ)
  const rows = allRows.filter((r) => r['Departamento'] === 'MO' && r['Serie'] !== 'BZZ');
  console.log(`Filas MO (sin BZZ): ${rows.length}`);

  const { crvToBarrio } = JSON.parse(readFileSync(MAPPING_IN, 'utf8')) as {
    crvToBarrio: Record<string, string>;
  };
  const agg = aggregateBalotajeMvd(rows, crvToBarrio);
  console.log(
    `Barrios: ${agg.zonas.length} · total canónico ${agg.totalCanonico.toLocaleString('es-UY')} · ` +
      `unmapped ${agg.unmappedVotos.toLocaleString('es-UY')} (${agg.crvsSinBarrio.length} CRVs)`,
  );
  if (agg.crvsSinBarrio.length > 0) {
    console.log(`  CRVs sin barrio: ${agg.crvsSinBarrio.slice(0, 10).join(', ')}`);
  }

  const shard = buildShard(agg.zonas, {
    eleccionId: 'balotaje-2024',
    departamento: 'montevideo',
    tipo: 'balotaje',
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
  console.log(
    `sum-in=${rec.sumIn.toLocaleString('es-UY')} sum-out=${rec.sumOut.toLocaleString('es-UY')} delta=${rec.delta} ✅`,
  );

  console.log('\n--- 3) Gate: cobertura barrios↔geometría ---');
  const topo = JSON.parse(readFileSync(GEO_IN, 'utf8'));
  const obj = topo.objects['zonas'] as GeometryCollection;
  const fc = feature(topo, obj) as FeatureCollection;
  const geoNames = fc.features.map((f) => String((f.properties as { name: string }).name));
  const cov = checkCoverage({ shard, geoBarrioNames: geoNames, totalCanonico: agg.totalCanonico });
  console.log(
    `placement ${(cov.placement * 100).toFixed(1)}% (≥95%) · ` +
      `barrio-fill ${cov.barriosConVotos}/${cov.geoBarrios} = ${(cov.barrioFill * 100).toFixed(1)}% (≥75%)`,
  );
  if (cov.geoSinVotos.length > 0) {
    console.log(`Barrios sin votos (${cov.geoSinVotos.length}): ${cov.geoSinVotos.join(', ')}`);
  }
  if (cov.shardSinMatch.length > 0) {
    console.log(`⚠️ geoIds sin match (${cov.shardSinMatch.length}): ${cov.shardSinMatch.join(', ')}`);
  }

  console.log('\n=== ETL Montevideo balotaje-2024: todos los gates PASARON ✅ ===');
}

main();
