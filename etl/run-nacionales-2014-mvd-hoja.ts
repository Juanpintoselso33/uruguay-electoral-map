/**
 * Orquestador ETL — Montevideo nacionales-2014, nivel HOJA (Story 7.7 / Epic 10).
 *
 * Reusa `aggregateHojaNacionales` (barrio) con el desglose 2014 (mismo schema que 2019).
 * 2014 NO tiene integración → escalera DEGRADADA lema→hoja (`degradado:true`). Reconcilia
 * exacto contra el votes.json lema de nacionales-2014 (run-nacionales-2014-mvd).
 *
 * Ejecutar: `npm run etl:nacionales-2014-mvd-hoja`.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { CatalogoOpciones, VotosShard } from '../src/lib/contracts';
import { assertCatalogoConsistente, assertHojasEnCatalogo } from '../src/lib/contracts';
import { parseCsv } from './extract/parse-csv';
import { aggregateHojaNacionales } from './transform/aggregate-hoja-nacionales';
import { buildShard, writeShard } from './load/emit-shard';
import { normName } from './lib/normalize';

const CSV = 'data/raw/electoral/nacionales-2014/desglose-de-votos.csv';
const MAPPING_IN = 'data/mappings/montevideo-circuito-barrio.json';
const VOTES_LEMA_IN = 'public/data/nacionales-2014/montevideo/votes.json';
const CATALOGO_OUT = 'public/data/nacionales-2014/montevideo/catalogo.json';
const HOJA_DIR = 'public/data/nacionales-2014/montevideo/hoja';
const ELECCION = 'nacionales-2014';
const DEPTO = 'montevideo';

function main(): void {
  console.log('=== ETL Montevideo nacionales-2014 — nivel HOJA (degradado lema→hoja) ===');
  const { crvToBarrio } = JSON.parse(readFileSync(MAPPING_IN, 'utf8')) as { crvToBarrio: Record<string, string> };

  // Sin integración 2014 → sin hojaSublema → escalera degradada lema→hoja.
  const agg = aggregateHojaNacionales(parseCsv(CSV), crvToBarrio, 'MO');
  console.log(`${agg.contiendaCatalogo.opciones.length} hojas · ${agg.shardsPorLema.length} lemas · total ${agg.totalCanonico.toLocaleString('es-UY')} · escalera ${agg.contiendaCatalogo.niveles.join('→')}`);

  const catalogo: CatalogoOpciones = { eleccionId: ELECCION, departamento: DEPTO, contiendas: [agg.contiendaCatalogo] };
  assertCatalogoConsistente(catalogo);
  mkdirSync(dirname(CATALOGO_OUT), { recursive: true });
  writeFileSync(CATALOGO_OUT, JSON.stringify(catalogo), 'utf8');

  let nShards = 0;
  for (const s of agg.shardsPorLema) {
    const out = `${HOJA_DIR}/unica/${s.lemaId}.json`;
    const shard = buildShard(s.zonas, { eleccionId: ELECCION, departamento: DEPTO, tipo: 'nacionales', nivel: 'zona', outPath: out });
    assertHojasEnCatalogo(shard, catalogo);
    writeShard(shard, out);
    nShards++;
  }

  const lema = JSON.parse(readFileSync(VOTES_LEMA_IN, 'utf8')) as VotosShard;
  const ref = new Map<string, Map<string, number>>();
  let refTotal = 0;
  for (const z of lema.zonas) { const m = new Map<string, number>(); for (const v of z.porOpcion) { m.set(v.opcionId, v.votos); refTotal += v.votos; } ref.set(normName(z.geoId), m); }
  let mineTotal = 0; let pares = 0;
  for (const [bKey, lemas] of agg.lemaPorBarrio) {
    const refB = ref.get(bKey);
    if (!refB) throw new Error(`reconcile: barrio ${bKey} ausente en votes.json lema`);
    for (const [lemaId, votos] of lemas) {
      mineTotal += votos;
      if (refB.get(lemaId) !== votos) throw new Error(`reconcile: ${bKey}/${lemaId} hoja ${votos} ≠ lema ${refB.get(lemaId)}`);
      pares++;
    }
  }
  if (mineTotal !== refTotal) throw new Error(`reconcile: total hoja ${mineTotal} ≠ lema ${refTotal}`);
  console.log(`${nShards} shards · reconciliado ${pares} pares (barrio×lema) · total ${mineTotal.toLocaleString('es-UY')} ✅`);
  console.log('\n=== nacionales-2014 MO HOJA: gates PASARON ✅ ===');
}

main();
