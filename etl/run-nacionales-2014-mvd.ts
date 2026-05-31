/**
 * Orquestador ETL — Montevideo nacionales-2014, nivel LEMA (Story 7.7).
 *
 * Mismo schema y agregador que nacionales-2019 (`aggregateNacionalesMvd`: HOJA_EN + VOTO_LEMA,
 * filtra Departamento=MO, slug de lema sin prefijo "Partido "). El desglose 2014 es de los 19
 * deptos; el agregador filtra MO. Reusa el mapping CRV→BARRIO (no regenera geometría).
 * Nivel lema (no HOJA) → usa el OpcionSelector estándar, sin catálogo. Gates: reconciliación
 * (losslessness) + cobertura barrios↔geometría.
 *
 * Ejecutar: `npm run etl:nacionales-2014-mvd`.
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

const CSV = 'data/raw/electoral/nacionales-2014/desglose-de-votos.csv';
const MAPPING_IN = 'data/mappings/montevideo-circuito-barrio.json';
const GEO_IN = 'public/data/geo/montevideo/zona.topo.json';
const SHARD_OUT = 'public/data/nacionales-2014/montevideo/votes.json';
const OPCIONES_OUT = 'public/data/nacionales-2014/montevideo/opciones.json';

function main(): void {
  console.log('=== ETL Montevideo nacionales-2014 (nivel lema, Story 7.7) ===');
  const rows = parseCsv(CSV);
  const { crvToBarrio } = JSON.parse(readFileSync(MAPPING_IN, 'utf8')) as { crvToBarrio: Record<string, string> };

  const agg = aggregateNacionalesMvd(rows, crvToBarrio);
  console.log(
    `CSV ${rows.length} filas → barrios ${agg.zonas.length} · ${agg.opciones.length} lemas · ` +
      `total ${agg.totalCanonico.toLocaleString('es-UY')} · unmapped ${agg.unmappedVotos.toLocaleString('es-UY')} (${agg.circuitosSinBarrio.length} circuitos)`,
  );

  const shard = buildShard(agg.zonas, { eleccionId: 'nacionales-2014', departamento: 'montevideo', tipo: 'nacionales', nivel: 'zona', outPath: SHARD_OUT });
  writeShard(shard, SHARD_OUT);
  mkdirSync(dirname(OPCIONES_OUT), { recursive: true });
  writeFileSync(OPCIONES_OUT, JSON.stringify({ opciones: agg.opciones }), 'utf8');
  console.log(`Shard + opciones escritos: ${SHARD_OUT}`);

  console.log('\n--- Gate: reconciliación (losslessness) ---');
  const rec = reconcile(shard, agg.totalCanonico, agg.unmappedVotos);
  console.log(`sum-in=${rec.sumIn.toLocaleString('es-UY')} sum-out=${rec.sumOut.toLocaleString('es-UY')} delta=${rec.delta} ✅`);

  console.log('\n--- Gate: cobertura barrios↔geometría ---');
  const topo = JSON.parse(readFileSync(GEO_IN, 'utf8'));
  const fc = feature(topo, topo.objects['zonas'] as GeometryCollection) as FeatureCollection;
  const geoNames = fc.features.map((f) => String((f.properties as { name: string }).name));
  const cov = checkCoverage({ shard, geoBarrioNames: geoNames, totalCanonico: agg.totalCanonico });
  console.log(
    `placement ${(cov.placement * 100).toFixed(1)}% (≥95%) · barrio-fill ${cov.barriosConVotos}/${cov.geoBarrios} = ${(cov.barrioFill * 100).toFixed(1)}% (≥75%)`,
  );
  if (cov.shardSinMatch.length > 0) console.log(`⚠️ geoIds sin match (${cov.shardSinMatch.length}): ${cov.shardSinMatch.join(', ')}`);

  console.log('\n=== nacionales-2014 MVD: gates PASARON ✅ ===');
}

main();
