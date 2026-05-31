/**
 * Orchestrator ETL — Montevideo nacionales-2024, nivel HOJA (Story 7.4).
 *
 * Patrón idéntico a run-nacionales-hoja-mvd.ts (nacionales-2019), adaptado a los
 * paths y al encoding de la integración 2024 (UTF-8, no Latin-1).
 *
 * Emite el catálogo (escalera lema→sublema→hoja) + shards de HOJA por lema, y
 * reconcilia EXACTO contra el votes.json por lema de nacionales-2024 (etl:nacionales-2024-mvd).
 *
 * Dependencias:
 *   1. npm run etl:nacionales-2024-mvd (genera votes.json)
 *   2. etl:montevideo ya corrió (mapping CRV→barrio existe)
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { CatalogoOpciones, VotosShard } from '../src/lib/contracts';
import { assertCatalogoConsistente, assertHojasEnCatalogo } from '../src/lib/contracts';
import { parseCsv } from './extract/parse-csv';
import { aggregateHojaNacionales } from './transform/aggregate-hoja-nacionales';
import { buildShard, writeShard } from './load/emit-shard';
import { normName } from './lib/normalize';

const CSV = 'data/raw/electoral/nacionales-2024/desglose-de-votos.csv';
const INTG = 'data/raw/electoral/nacionales-2024/integracion-de-hojas.csv'; // UTF-8 (2024)
const MAPPING_IN = 'data/mappings/montevideo-circuito-barrio.json';
const VOTES_LEMA_IN = 'public/data/nacionales-2024/montevideo/votes.json';
const CATALOGO_OUT = 'public/data/nacionales-2024/montevideo/catalogo.json';
const HOJA_DIR = 'public/data/nacionales-2024/montevideo/hoja';
const ELECCION = 'nacionales-2024';
const DEPTO = 'montevideo';

function main(): void {
  console.log('=== ETL Nacionales-2024 Montevideo — nivel HOJA (Story 7.4) ===');
  const { crvToBarrio } = JSON.parse(readFileSync(MAPPING_IN, 'utf8')) as {
    crvToBarrio: Record<string, string>;
  };

  // Hoja → sublema desde la integración 2024 (UTF-8), Montevideo.
  // Dedup por nº de hoja; se descarta "No aplica" (fila presidencial).
  const hojaSublema = new Map<string, string>();
  for (const r of parseCsv(INTG)) {
    if ((r['Departamento'] ?? '') !== 'MO') continue;
    const sub = (r['Sublema'] ?? '').trim();
    const num = (r['Numero'] ?? '').trim();
    if (!num || !sub || sub.toLowerCase() === 'no aplica') continue;
    if (!hojaSublema.has(num)) hojaSublema.set(num, sub);
  }
  console.log(`Integración 2024 (MO): ${hojaSublema.size} hojas con sublema`);

  const agg = aggregateHojaNacionales(parseCsv(CSV), crvToBarrio, 'MO', hojaSublema);
  const niveles = agg.contiendaCatalogo.niveles.join('→');
  const nSublemas = agg.contiendaCatalogo.nodos.filter((n) => n.nivel === 'sublema').length;
  console.log(
    `${agg.contiendaCatalogo.opciones.length} hojas · ${agg.shardsPorLema.length} lemas · ${nSublemas} sublemas · ` +
      `total ${agg.totalCanonico.toLocaleString('es-UY')} · unmapped ${agg.unmappedVotos} · escalera ${niveles}`,
  );

  const catalogo: CatalogoOpciones = {
    eleccionId: ELECCION,
    departamento: DEPTO,
    contiendas: [agg.contiendaCatalogo],
  };
  assertCatalogoConsistente(catalogo);
  mkdirSync(dirname(CATALOGO_OUT), { recursive: true });
  writeFileSync(CATALOGO_OUT, JSON.stringify(catalogo), 'utf8');
  console.log(`Catálogo: ${CATALOGO_OUT}`);

  let nShards = 0;
  for (const s of agg.shardsPorLema) {
    const out = `${HOJA_DIR}/unica/${s.lemaId}.json`;
    const shard = buildShard(s.zonas, {
      eleccionId: ELECCION,
      departamento: DEPTO,
      tipo: 'nacionales',
      nivel: 'zona',
      outPath: out,
    });
    assertHojasEnCatalogo(shard, catalogo);
    writeShard(shard, out);
    nShards++;
  }
  console.log(`${nShards} shards de hoja en ${HOJA_DIR}/unica/{lema}.json`);

  // Reconciliación exacta contra votes.json por lema.
  const lema = JSON.parse(readFileSync(VOTES_LEMA_IN, 'utf8')) as VotosShard;
  const ref = new Map<string, Map<string, number>>();
  let refTotal = 0;
  for (const z of lema.zonas) {
    const m = new Map<string, number>();
    for (const v of z.porOpcion) {
      m.set(v.opcionId, v.votos);
      refTotal += v.votos;
    }
    ref.set(normName(z.geoId), m);
  }
  let mineTotal = 0;
  let pares = 0;
  for (const [bKey, lemas] of agg.lemaPorBarrio) {
    const refB = ref.get(bKey);
    if (!refB) throw new Error(`reconcile: barrio ${bKey} ausente en votes.json lema`);
    for (const [lemaId, votos] of lemas) {
      mineTotal += votos;
      if (refB.get(lemaId) !== votos) {
        throw new Error(`reconcile: ${bKey}/${lemaId} hoja ${votos} ≠ lema ${refB.get(lemaId)}`);
      }
      pares++;
    }
  }
  if (mineTotal !== refTotal) throw new Error(`reconcile: total hoja ${mineTotal} ≠ lema ${refTotal}`);
  console.log(
    `Reconciliado: ${pares} pares (barrio×lema) exactos · total ${mineTotal.toLocaleString('es-UY')} = lema ✅`,
  );

  console.log('\n=== Todos los gates PASARON ✅ ===');
}

main();
