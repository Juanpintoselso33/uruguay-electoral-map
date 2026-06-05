/**
 * ETL — Montevideo internas-2014, nivel BARRIO (geoId = nombre del barrio, 62 zonas).
 *
 * DESBLOQUEO (reemplaza el nivel-serie anterior): se recuperó el PLAN CIRCUITAL de internas-2014
 * desde Wayback (data/raw/electoral/internas-2014/planes-pdf/Montevideo.pdf → plan-circuital.csv).
 * Con el plan, el join CRV→BARRIO ahora es posible (geocodificación DIRECCIÓN→coords→point-in-polygon),
 * igual que el resto de las internas. MVD pasa de "1 zona / por serie" a 62 BARRIOS.
 *
 * IMPORTANTE: los CRV de internas-2014 se RENUMERAN vs nacionales-2014 (0% de match exacto de rango
 * en el mismo año) → el mapeo es PROPIO del ciclo (montevideo-circuito-barrio.internas-2014.json,
 * build-circuito-barrio-cycles.py). No se reusa el mapeo de otra elección (sería el bug "Carrasco").
 *
 * Fuentes:
 *   - Votos:    data/raw/electoral/internas-2014/desglose-de-votos.csv (UTF-8; DEPARTAMENTO='MO',
 *               TIPO_REGISTRO=HOJA_ODN; opcionId = slug(LEMA con prefijo "Partido ")).
 *   - Mapeo:    data/mappings/montevideo-circuito-barrio.internas-2014.json (crvToBarrio).
 *   - Geometría: public/data/geo/montevideo/zona.topo.json (62 barrios, ya existe; no se regenera).
 *
 * El nivel HOJA por barrio lo emite run-internas-2014-hoja.ts (que ahora hace MVD por barrio).
 * Los overlays circuito/local los emiten build-votes-circuito/build-votes-local (con el plan).
 *
 * Ejecutar: `npm run etl:internas-2014-mvd` (después correr el sweep de partidos + nacional).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { feature } from 'topojson-client';
import type { GeometryCollection } from 'topojson-specification';
import type { FeatureCollection } from 'geojson';
import { parseCsv } from './extract/parse-csv';
import { aggregateInternasMvdBarrio } from './transform/aggregate-internas-mvd-barrio';
import { buildShard, writeShard } from './load/emit-shard';
import { reconcile } from './gates/reconcile';
import { checkCoverage } from './gates/coverage';

const CSV = 'data/raw/electoral/internas-2014/desglose-de-votos.csv';
const MAPPING_IN = 'data/mappings/montevideo-circuito-barrio.internas-2014.json';
const GEO_IN = 'public/data/geo/montevideo/zona.topo.json';
const SHARD_OUT = 'public/data/internas-2014/montevideo/votes.json';
const OPCIONES_OUT = 'public/data/internas-2014/montevideo/opciones.json';

function main(): void {
  console.log('=== ETL Montevideo internas-2014 — nivel BARRIO (CRV→barrio por ciclo) ===');
  const rows = parseCsv(CSV, 'utf8');
  const { crvToBarrio } = JSON.parse(readFileSync(MAPPING_IN, 'utf8')) as { crvToBarrio: Record<string, string> };

  const agg = aggregateInternasMvdBarrio(rows, crvToBarrio, 'MO');
  console.log(
    `barrios ${agg.zonas.length} · ${agg.opciones.length} lemas · total ${agg.totalCanonico.toLocaleString('es-UY')} · ` +
      `unmapped ${agg.unmappedVotos.toLocaleString('es-UY')} (${agg.circuitosSinBarrio.length} circuitos)`,
  );

  const shard = buildShard(agg.zonas, {
    eleccionId: 'internas-2014', departamento: 'montevideo', tipo: 'internas', nivel: 'zona', outPath: SHARD_OUT,
  });
  writeShard(shard, SHARD_OUT);
  mkdirSync(dirname(OPCIONES_OUT), { recursive: true });
  writeFileSync(OPCIONES_OUT, JSON.stringify({ opciones: agg.opciones }), 'utf8');
  console.log(`Shard + opciones: ${SHARD_OUT}`);

  console.log('\n--- Gate: reconciliación (losslessness) ---');
  const rec = reconcile(shard, agg.totalCanonico, agg.unmappedVotos);
  console.log(`sum-in=${rec.sumIn.toLocaleString('es-UY')} sum-out=${rec.sumOut.toLocaleString('es-UY')} delta=${rec.delta} ✅`);

  console.log('\n--- Gate: cobertura barrios↔geometría ---');
  const topo = JSON.parse(readFileSync(GEO_IN, 'utf8'));
  const fc = feature(topo, topo.objects['zonas'] as GeometryCollection) as FeatureCollection;
  const geoNames = fc.features.map((f) => String((f.properties as { name: string }).name));
  const cov = checkCoverage({ shard, geoBarrioNames: geoNames, totalCanonico: agg.totalCanonico });
  console.log(
    `placement ${(cov.placement * 100).toFixed(1)}% · barrio-fill ${cov.barriosConVotos}/${cov.geoBarrios} = ${(cov.barrioFill * 100).toFixed(1)}%`,
  );
  if (cov.shardSinMatch.length > 0) console.log(`⚠️ geoIds sin match (${cov.shardSinMatch.length}): ${cov.shardSinMatch.join(', ')}`);

  console.log('\n=== internas-2014 MVD: nivel BARRIO, gates PASARON ✅ ===');
}

main();
