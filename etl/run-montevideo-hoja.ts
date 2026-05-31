/**
 * Orquestador ETL — Montevideo internas-2024 a nivel HOJA (Story 10.2, Epic 10).
 *
 * Reusa el mismo origen y mapping CIRCUITO→BARRIO que el agregado por lema (Story 1.6):
 * NO regenera geometría ni mapping. Emite el catálogo jerárquico (ODN+ODD) y un shard
 * de votos por lema (lazy-load), y corre los gates: catálogo consistente, hojas-en-catálogo,
 * reconciliación ODN exacta contra el votes.json por lema existente, y roll-up por contienda.
 *
 * Dependencia: `npm run etl:montevideo` debe haber corrido (deja el mapping y el votes.json).
 * Ejecutar: `npm run etl:montevideo-hoja`.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { CatalogoOpciones, VotosShard } from '../src/lib/contracts';
import { assertCatalogoConsistente, assertHojasEnCatalogo } from '../src/lib/contracts';
import { parseCsv } from './extract/parse-csv';
import { aggregateHojaInternas, type AggregateHojaResult } from './transform/aggregate-hoja-internas';
import { aggregateByCircuito } from './transform/aggregate-by-circuito';
import { buildShard, writeShard } from './load/emit-shard';
import { normName } from './lib/normalize';

const ODN_CSV = 'public/montevideo_odn.csv';
const ODD_CSV = 'public/montevideo_odd.csv';
const MAPPING_IN = 'data/mappings/montevideo-circuito-barrio.json';
const VOTES_LEMA_IN = 'public/data/internas-2024/montevideo/votes.json';
const CATALOGO_OUT = 'public/data/internas-2024/montevideo/catalogo.json';
const HOJA_DIR = 'public/data/internas-2024/montevideo/hoja';
const ELECCION = 'internas-2024';
const DEPTO = 'montevideo';
const ESC = 'Departamental';

function main(): void {
  console.log('=== ETL Montevideo internas-2024 — nivel HOJA (Epic 10) ===');
  const { crvToBarrio } = JSON.parse(readFileSync(MAPPING_IN, 'utf8')) as {
    crvToBarrio: Record<string, string>;
  };

  console.log('\n--- 1) Agregación por HOJA (ODN + ODD) ---');
  const odn = aggregateHojaInternas(parseCsv(ODN_CSV), {
    contienda: 'odn', conPrecandidato: true, escrutinioCanonico: ESC, crvToBarrio,
  });
  const odd = aggregateHojaInternas(parseCsv(ODD_CSV), {
    contienda: 'odd', conPrecandidato: false, escrutinioCanonico: ESC, crvToBarrio,
  });
  for (const [nombre, r] of [['ODN', odn], ['ODD', odd]] as const) {
    console.log(
      `${nombre}: ${r.contiendaCatalogo.opciones.length} hojas · ${r.contiendaCatalogo.nodos.length} nodos · ` +
        `${r.shardsPorLema.length} lemas · total ${r.totalCanonico.toLocaleString('es-UY')} · unmapped ${r.unmappedVotos}`,
    );
  }

  console.log('\n--- 2) Catálogo jerárquico + gate de consistencia ---');
  const catalogo: CatalogoOpciones = {
    eleccionId: ELECCION,
    departamento: DEPTO,
    contiendas: [odn.contiendaCatalogo, odd.contiendaCatalogo],
  };
  assertCatalogoConsistente(catalogo);
  mkdirSync(dirname(CATALOGO_OUT), { recursive: true });
  writeFileSync(CATALOGO_OUT, JSON.stringify(catalogo), 'utf8');
  console.log(`Catálogo escrito (consistente): ${CATALOGO_OUT}`);

  console.log('\n--- 3) Shards por lema + gate hojas-en-catálogo ---');
  let nShards = 0;
  for (const [contienda, r] of [['odn', odn], ['odd', odd]] as const) {
    for (const s of r.shardsPorLema) {
      const out = `${HOJA_DIR}/${contienda}/${s.lemaId}.json`;
      const shard: VotosShard = buildShard(s.zonas, {
        eleccionId: ELECCION, departamento: DEPTO, tipo: 'internas', nivel: 'zona', outPath: out,
      });
      assertHojasEnCatalogo(shard, catalogo);
      writeShard(shard, out);
      nShards++;
    }
  }
  console.log(`${nShards} shards de hoja escritos en ${HOJA_DIR}/{odn,odd}/{lema}.json`);

  console.log('\n--- 4) Gate: reconciliación exacta vs agregado por lema independiente ---');
  // ODN: contra el votes.json publicado (AC4). ODD: contra aggregateByCircuito(ODD) — fuente
  // independiente y confiable (mismo código que produce el lema), no un cross-check tautológico.
  reconcileContraLema('ODN', odn, refDesdeShard(JSON.parse(readFileSync(VOTES_LEMA_IN, 'utf8')) as VotosShard));
  reconcileContraLema('ODD', odd, refDesdeAggByCircuito(ODD_CSV, crvToBarrio));

  console.log('\n--- 5) Gate: roll-up hoja→lema por contienda ---');
  rollupOk('ODN', odn);
  rollupOk('ODD', odd);

  console.log('\n=== Todos los gates PASARON ✅ ===');
}

/** Construye la referencia barrio(norm)→lemaId→votos desde un shard por lema. */
function refDesdeShard(lema: VotosShard): Map<string, Map<string, number>> {
  const ref = new Map<string, Map<string, number>>();
  for (const z of lema.zonas) {
    const m = new Map<string, number>();
    for (const v of z.porOpcion) m.set(v.opcionId, v.votos);
    ref.set(normName(z.geoId), m);
  }
  return ref;
}

/** Referencia independiente: agrega el CSV por lema con `aggregateByCircuito` (el código confiable). */
function refDesdeAggByCircuito(csv: string, crvToBarrio: Record<string, string>): Map<string, Map<string, number>> {
  const agg = aggregateByCircuito(parseCsv(csv), { escrutinioCanonico: ESC, crvToBarrio });
  const shard: VotosShard = {
    eleccionId: ELECCION, departamento: DEPTO, nivel: 'zona', escrutinio: 'definitivo', tipo: 'internas', zonas: agg.zonas,
  };
  return refDesdeShard(shard);
}

/** Reconcilia Σ hojas por (barrio, lema) contra una referencia por lema (tolerancia 0, ambos sentidos del total). */
function reconcileContraLema(nombre: string, r: AggregateHojaResult, ref: Map<string, Map<string, number>>): void {
  let refTotal = 0;
  for (const m of ref.values()) for (const v of m.values()) refTotal += v;
  let comparados = 0;
  let mineTotal = 0;
  for (const [bKey, lemas] of r.lemaPorBarrio) {
    const refBarrio = ref.get(bKey);
    if (!refBarrio) throw new Error(`reconcile ${nombre}: barrio ${bKey} ausente en la referencia por lema`);
    for (const [lemaId, votos] of lemas) {
      mineTotal += votos;
      if (refBarrio.get(lemaId) !== votos) {
        throw new Error(`reconcile ${nombre}: ${bKey}/${lemaId} hoja-sum ${votos} ≠ lema ${refBarrio.get(lemaId)}`);
      }
      comparados++;
    }
  }
  if (mineTotal !== refTotal) {
    throw new Error(`reconcile ${nombre}: total hoja ${mineTotal} ≠ total lema ${refTotal} (entrada en lema fuera de hoja-agg)`);
  }
  console.log(
    `${nombre} reconciliado: ${comparados} pares (barrio×lema) exactos · total ${mineTotal.toLocaleString('es-UY')} = lema ✅`,
  );
}

/** Verifica que Σ hojas por lema (de los shards) == Σ votos del lema en lemaPorBarrio. */
function rollupOk(nombre: string, r: AggregateHojaResult): void {
  const desdeShards = new Map<string, number>();
  for (const s of r.shardsPorLema) {
    let t = 0;
    for (const z of s.zonas) t += z.validos;
    desdeShards.set(s.lemaId, t);
  }
  const desdeLema = new Map<string, number>();
  for (const lemas of r.lemaPorBarrio.values()) {
    for (const [lemaId, v] of lemas) desdeLema.set(lemaId, (desdeLema.get(lemaId) ?? 0) + v);
  }
  for (const [lemaId, t] of desdeShards) {
    if (desdeLema.get(lemaId) !== t) {
      throw new Error(`rollup ${nombre}: lema ${lemaId} shards ${t} ≠ lemaPorBarrio ${desdeLema.get(lemaId)}`);
    }
  }
  console.log(`${nombre} roll-up: ${desdeShards.size} lemas consistentes hoja→lema ✅`);
}

main();
