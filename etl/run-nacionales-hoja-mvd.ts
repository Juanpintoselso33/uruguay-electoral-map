/**
 * Orquestador ETL — Nacionales-2019 Montevideo a nivel HOJA (Story 10.7 + 10.8, Epic 10).
 *
 * Reusa el mapping CRV→BARRIO de Montevideo (no regenera geometría). Emite el catálogo
 * (contienda única, escalera lema→sublema→hoja) + shards de hoja por lema, y reconcilia
 * EXACTO contra el votes.json por lema de nacionales (Story 4.1).
 *
 * Story 10.8: el nivel `sublema` se puebla desde la INTEGRACIÓN de hojas 2019 (Latin-1),
 * uniendo por nº de hoja. El `ambito` nacional/departamental NO se modela: una hoja nacional
 * es un único sobre que elige presidente+senado(nacional)+diputados(departamental) a la vez,
 * no hay split por hoja (ver `docs/.../planning-artifacts/sublema-sourcing-research.md`).
 *
 * Ejecutar: `npm run etl:nacionales-hoja-mvd`.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { CatalogoOpciones, VotosShard } from '../src/lib/contracts';
import { assertCatalogoConsistente, assertHojasEnCatalogo } from '../src/lib/contracts';
import { parseCsv } from './extract/parse-csv';
import { aggregateHojaNacionales } from './transform/aggregate-hoja-nacionales';
import { buildShard, writeShard } from './load/emit-shard';
import { normName } from './lib/normalize';

const CSV = 'data/raw/electoral/nacionales-2019/montevideo_odd.csv';
const INTG = 'data/raw/electoral/nacionales-2019/integracion-hojas.csv'; // Latin-1
const MAPPING_IN = 'data/mappings/montevideo-circuito-barrio.2019.json';
const VOTES_LEMA_IN = 'public/data/nacionales-2019/montevideo/votes.json';
const CATALOGO_OUT = 'public/data/nacionales-2019/montevideo/catalogo.json';
const HOJA_DIR = 'public/data/nacionales-2019/montevideo/hoja';
const ELECCION = 'nacionales-2019';
const DEPTO = 'montevideo';

function main(): void {
  console.log('=== ETL Nacionales-2019 Montevideo — nivel HOJA (Story 10.7) ===');
  const { crvToBarrio } = JSON.parse(readFileSync(MAPPING_IN, 'utf8')) as { crvToBarrio: Record<string, string> };

  // Story 10.8: hoja → sublema desde la integración (Latin-1), Montevideo. Dedup por nº de hoja;
  // el sublema real es el valor != "No aplica" (Presidencial trae "No aplica"; Senador/Diputados el sublema).
  const hojaSublema = new Map<string, string>();
  for (const r of parseCsv(INTG, 'latin1')) {
    if ((r['Departamento'] ?? '') !== 'MO') continue;
    const sub = (r['Sublema'] ?? '').trim();
    const num = (r['Numero'] ?? '').trim();
    if (!num || !sub || sub.toLowerCase() === 'no aplica') continue;
    // El sublema es invariante por hoja (propiedad de la Agrupación; Senador/Diputado lo comparten).
    // Si una hoja trajera dos sublemas reales distintos, es un dato inconsistente → fallar fuerte.
    const prev = hojaSublema.get(num);
    if (prev !== undefined && prev !== sub) {
      throw new Error(`sublema inconsistente para hoja ${num}: "${prev}" vs "${sub}"`);
    }
    if (prev === undefined) hojaSublema.set(num, sub);
  }
  console.log(`Integración 2019 (MO): ${hojaSublema.size} hojas con sublema`);

  const agg = aggregateHojaNacionales(parseCsv(CSV), crvToBarrio, 'MO', hojaSublema);
  const niveles = agg.contiendaCatalogo.niveles.join('→');
  const nSublemas = agg.contiendaCatalogo.nodos.filter((n) => n.nivel === 'sublema').length;
  console.log(
    `${agg.contiendaCatalogo.opciones.length} hojas · ${agg.shardsPorLema.length} lemas · ${nSublemas} sublemas · ` +
      `total ${agg.totalCanonico.toLocaleString('es-UY')} · unmapped ${agg.unmappedVotos} · escalera ${niveles}`,
  );

  // Gate de cobertura: si la escalera declara sublema, TODA hoja real (≠ vl) debe tener su nodo
  // sublema — si no, una hoja sin join degradaría silenciosamente a hijo directo del lema (árbol mixto).
  if (agg.contiendaCatalogo.niveles.includes('sublema')) {
    for (const o of agg.contiendaCatalogo.opciones) {
      const h = o as { hoja?: string; grupoId?: string };
      if (h.hoja && h.hoja !== 'vl' && !h.grupoId) {
        throw new Error(`cobertura sublema: hoja ${h.hoja} sin sublema pese a escalera lema→sublema→hoja`);
      }
    }
    console.log('Cobertura de sublema: todas las hojas (≠ vl) tienen nodo sublema ✅');
  }

  const catalogo: CatalogoOpciones = { eleccionId: ELECCION, departamento: DEPTO, contiendas: [agg.contiendaCatalogo] };
  assertCatalogoConsistente(catalogo);
  mkdirSync(dirname(CATALOGO_OUT), { recursive: true });
  writeFileSync(CATALOGO_OUT, JSON.stringify(catalogo), 'utf8');
  console.log(`Catálogo: ${CATALOGO_OUT}`);

  let nShards = 0;
  for (const s of agg.shardsPorLema) {
    const out = `${HOJA_DIR}/unica/${s.lemaId}.json`;
    const shard = buildShard(s.zonas, { eleccionId: ELECCION, departamento: DEPTO, tipo: 'nacionales', nivel: 'zona', outPath: out });
    assertHojasEnCatalogo(shard, catalogo);
    writeShard(shard, out);
    nShards++;
  }
  console.log(`${nShards} shards de hoja escritos en ${HOJA_DIR}/unica/{lema}.json`);

  // Reconciliación exacta contra el votes.json por lema.
  const lema = JSON.parse(readFileSync(VOTES_LEMA_IN, 'utf8')) as VotosShard;
  const ref = new Map<string, Map<string, number>>();
  let refTotal = 0;
  for (const z of lema.zonas) {
    const m = new Map<string, number>();
    for (const v of z.porOpcion) { m.set(v.opcionId, v.votos); refTotal += v.votos; }
    ref.set(normName(z.geoId), m);
  }
  let mineTotal = 0;
  let pares = 0;
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
  console.log(`Reconciliado: ${pares} pares (barrio×lema) exactos · total ${mineTotal.toLocaleString('es-UY')} = lema ✅`);

  console.log('\n=== Todos los gates PASARON ✅ ===');
}

main();
