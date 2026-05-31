/**
 * Orquestador ETL — interior, nacionales-2014, nivel HOJA (Story 7.7 / Epic 10).
 *
 * Misma maquinaria que nacionales-2024 interior HOJA, con el desglose 2014 (mismo schema:
 * HOJA_EN/VOTO_LEMA, Lema, Descripcion1=hoja). 2014 NO tiene integración → la escalera se
 * emite DEGRADADA (lema→hoja, sin sublema, con `degradado:true`). Reconcilia contra el
 * votes.json lema por dept (run-nacionales-2014-interior).
 *
 * Ejecutar: `npm run etl:nacionales-2014-interior-hoja`.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { CatalogoOpciones, VotosShard } from '../src/lib/contracts';
import { assertCatalogoConsistente, assertHojasEnCatalogo } from '../src/lib/contracts';
import { parseCsv } from './extract/parse-csv';
import { aggregateHojaNacionalesInterior } from './transform/aggregate-hoja-nacionales-interior';
import { buildShard, writeShard } from './load/emit-shard';

const CSV = 'data/raw/electoral/nacionales-2014/desglose-de-votos.csv';
const ELECCION = 'nacionales-2014';

interface Cfg { deptCode: string; deptName: string; exteriorSerie: string }

function runHojaInterior(cfg: Cfg, allRows: Record<string, string>[]): void {
  const { deptCode, deptName, exteriorSerie } = cfg;
  const VOTES_LEMA_IN = `public/data/${ELECCION}/${deptName}/votes.json`;
  const CATALOGO_OUT = `public/data/${ELECCION}/${deptName}/catalogo.json`;
  const HOJA_DIR = `public/data/${ELECCION}/${deptName}/hoja`;

  const rows = allRows.filter(
    (r) =>
      r['Departamento'] === deptCode &&
      (r['TipoRegistro'] === 'HOJA_EN' || r['TipoRegistro'] === 'VOTO_LEMA') &&
      (r['Series'] ?? '').toUpperCase() !== exteriorSerie.toUpperCase(),
  );

  // Sin integración 2014 → hojaSublema vacío → escalera degradada lema→hoja.
  const agg = aggregateHojaNacionalesInterior(rows, deptCode, exteriorSerie, new Map());
  const catalogo: CatalogoOpciones = { eleccionId: ELECCION, departamento: deptName, contiendas: [agg.contiendaCatalogo] };
  assertCatalogoConsistente(catalogo);
  mkdirSync(dirname(CATALOGO_OUT), { recursive: true });
  writeFileSync(CATALOGO_OUT, JSON.stringify(catalogo), 'utf8');

  let nShards = 0;
  for (const s of agg.shardsPorLema) {
    const out = `${HOJA_DIR}/unica/${s.lemaId}.json`;
    const shard = buildShard(s.zonas, { eleccionId: ELECCION, departamento: deptName, tipo: 'nacionales', nivel: 'serie', outPath: out });
    assertHojasEnCatalogo(shard, catalogo);
    writeShard(shard, out);
    nShards++;
  }

  const lema = JSON.parse(readFileSync(VOTES_LEMA_IN, 'utf8')) as VotosShard;
  const ref = new Map<string, Map<string, number>>();
  let refTotal = 0;
  for (const z of lema.zonas) { const m = new Map<string, number>(); for (const v of z.porOpcion) { m.set(v.opcionId, v.votos); refTotal += v.votos; } ref.set(z.geoId, m); }
  let mineTotal = 0; let pares = 0;
  for (const [serieKey, lemas] of agg.lemaPorBarrio) {
    const refZ = ref.get(serieKey);
    if (!refZ) throw new Error(`reconcile ${deptName}: serie ${serieKey} ausente en votes.json lema`);
    for (const [lemaId, votos] of lemas) {
      mineTotal += votos;
      if (refZ.get(lemaId) !== votos) throw new Error(`reconcile ${deptName}: ${serieKey}/${lemaId} hoja=${votos} ≠ lema=${refZ.get(lemaId)}`);
      pares++;
    }
  }
  if (mineTotal !== refTotal) throw new Error(`reconcile ${deptName}: total hoja ${mineTotal} ≠ lema ${refTotal}`);
  console.log(`  ${deptName}: ${agg.contiendaCatalogo.opciones.length} hojas · ${nShards} shards · ${pares} pares reconciliados ✅`);
}

function main(): void {
  console.log('=== ETL Interior nacionales-2014 HOJA (degradado lema→hoja) ===');
  const allRows = parseCsv(CSV);
  const DEPTS: Cfg[] = [
    { deptCode: 'CA', deptName: 'canelones', exteriorSerie: 'CZZ' },
    { deptCode: 'MA', deptName: 'maldonado', exteriorSerie: 'DZZ' },
    { deptCode: 'CO', deptName: 'colonia', exteriorSerie: 'NZZ' },
    { deptCode: 'SA', deptName: 'salto', exteriorSerie: 'JZZ' },
    { deptCode: 'PA', deptName: 'paysandu', exteriorSerie: 'KZZ' },
    { deptCode: 'RV', deptName: 'rivera', exteriorSerie: 'HZZ' },
    { deptCode: 'CL', deptName: 'cerro_largo', exteriorSerie: 'GZZ' },
    { deptCode: 'TA', deptName: 'tacuarembo', exteriorSerie: 'TZZ' },
    { deptCode: 'SJ', deptName: 'san_jose', exteriorSerie: 'OZZ' },
    { deptCode: 'SO', deptName: 'soriano', exteriorSerie: 'MZZ' },
    { deptCode: 'RO', deptName: 'rocha', exteriorSerie: 'EZZ' },
    { deptCode: 'FD', deptName: 'florida', exteriorSerie: 'QZZ' },
    { deptCode: 'AR', deptName: 'artigas', exteriorSerie: 'IZZ' },
    { deptCode: 'DU', deptName: 'durazno', exteriorSerie: 'RZZ' },
    { deptCode: 'TT', deptName: 'treinta_y_tres', exteriorSerie: 'FZZ' },
    { deptCode: 'LA', deptName: 'lavalleja', exteriorSerie: 'SZZ' },
    { deptCode: 'RN', deptName: 'rio_negro', exteriorSerie: 'LZZ' },
    { deptCode: 'FS', deptName: 'flores', exteriorSerie: 'PZZ' },
  ];
  let ok = 0; const failed: string[] = [];
  for (const cfg of DEPTS) {
    try { runHojaInterior(cfg, allRows); ok++; } catch (e) { console.error(`ERROR ${cfg.deptName}:`, (e as Error).message); failed.push(cfg.deptName); }
  }
  console.log(`\n=== Interior nacionales-2014 HOJA: ${ok}/${DEPTS.length} ===`);
  if (failed.length > 0) { console.error(`FALLARON: ${failed.join(', ')}`); process.exit(1); }
}

main();
