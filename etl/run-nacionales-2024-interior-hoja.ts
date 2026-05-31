/**
 * Orchestrator ETL — departamentos del interior, nacionales-2024, nivel HOJA (Story 7.4).
 *
 * Genera el catálogo jerárquico (lema→sublema→hoja) + shards de HOJA por lema para
 * los 18 departamentos del interior. Reutiliza la fuente nacionales-2024 y la integración
 * de hojas 2024 (UTF-8).
 *
 * Dependencias:
 *   - npm run etl:nacionales-2024-interior (votes.json lema por dept — ya generado)
 *
 * Fuentes:
 *   - data/raw/electoral/nacionales-2024/desglose-de-votos.csv
 *   - data/raw/electoral/nacionales-2024/integracion-de-hojas.csv (UTF-8)
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { CatalogoOpciones, VotosShard } from '../src/lib/contracts';
import { assertCatalogoConsistente, assertHojasEnCatalogo } from '../src/lib/contracts';
import { parseCsv } from './extract/parse-csv';
import { aggregateHojaNacionalesInterior } from './transform/aggregate-hoja-nacionales-interior';
import { buildShard, writeShard } from './load/emit-shard';

const CSV = 'data/raw/electoral/nacionales-2024/desglose-de-votos.csv';
const INTG = 'data/raw/electoral/nacionales-2024/integracion-de-hojas.csv'; // UTF-8
const ELECCION = 'nacionales-2024';

interface NacionalesInteriorHojaConfig {
  deptCode: string;
  deptName: string;
  exteriorSerie: string;
}

function buildHojaSublema(intgRows: Record<string, string>[], deptCode: string): Map<string, string> {
  const hojaSublema = new Map<string, string>();
  for (const r of intgRows) {
    if ((r['Departamento'] ?? '') !== deptCode) continue;
    const sub = (r['Sublema'] ?? '').trim();
    const num = (r['Numero'] ?? '').trim();
    if (!num || !sub || sub.toLowerCase() === 'no aplica') continue;
    if (!hojaSublema.has(num)) hojaSublema.set(num, sub);
  }
  return hojaSublema;
}

function runHojaInterior(
  cfg: NacionalesInteriorHojaConfig,
  allRows: Record<string, string>[],
  intgRows: Record<string, string>[],
): void {
  const { deptCode, deptName, exteriorSerie } = cfg;

  const VOTES_LEMA_IN = `public/data/${ELECCION}/${deptName}/votes.json`;
  const CATALOGO_OUT = `public/data/${ELECCION}/${deptName}/catalogo.json`;
  const HOJA_DIR = `public/data/${ELECCION}/${deptName}/hoja`;

  console.log(`\n=== ETL ${deptName} ${ELECCION} HOJA ===`);

  const rows = allRows.filter(
    (r) =>
      r['Departamento'] === deptCode &&
      (r['TipoRegistro'] === 'HOJA_EN' || r['TipoRegistro'] === 'VOTO_LEMA') &&
      (r['Series'] ?? '').toUpperCase() !== exteriorSerie.toUpperCase(),
  );

  const hojaSublema = buildHojaSublema(intgRows, deptCode);
  console.log(`Integración 2024 (${deptCode}): ${hojaSublema.size} hojas con sublema`);

  const agg = aggregateHojaNacionalesInterior(rows, deptCode, exteriorSerie, hojaSublema);
  const niveles = agg.contiendaCatalogo.niveles.join('→');
  const nSublemas = agg.contiendaCatalogo.nodos.filter((n) => n.nivel === 'sublema').length;
  console.log(
    `${agg.contiendaCatalogo.opciones.length} hojas · ${agg.shardsPorLema.length} lemas · ${nSublemas} sublemas · ` +
      `total ${agg.totalCanonico.toLocaleString('es-UY')} · escalera ${niveles}`,
  );

  const catalogo: CatalogoOpciones = {
    eleccionId: ELECCION,
    departamento: deptName,
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
      departamento: deptName,
      tipo: 'nacionales',
      nivel: 'serie',
      outPath: out,
    });
    assertHojasEnCatalogo(shard, catalogo);
    writeShard(shard, out);
    nShards++;
  }
  console.log(`${nShards} shards de hoja en ${HOJA_DIR}/unica/{lema}.json`);

  // Reconciliación contra votes.json lema-nivel
  const lema = JSON.parse(readFileSync(VOTES_LEMA_IN, 'utf8')) as VotosShard;
  const ref = new Map<string, Map<string, number>>();
  let refTotal = 0;
  for (const z of lema.zonas) {
    const m = new Map<string, number>();
    for (const v of z.porOpcion) {
      m.set(v.opcionId, v.votos);
      refTotal += v.votos;
    }
    ref.set(z.geoId, m);
  }
  let mineTotal = 0;
  let pares = 0;
  for (const [serieKey, lemas] of agg.lemaPorBarrio) {
    const refZ = ref.get(serieKey);
    if (!refZ) throw new Error(`reconcile: serie ${serieKey} ausente en votes.json lema`);
    for (const [lemaId, votos] of lemas) {
      mineTotal += votos;
      if (refZ.get(lemaId) !== votos) {
        throw new Error(`reconcile: ${serieKey}/${lemaId} hoja=${votos} ≠ lema=${refZ.get(lemaId)}`);
      }
      pares++;
    }
  }
  if (mineTotal !== refTotal) throw new Error(`reconcile: total hoja ${mineTotal} ≠ lema ${refTotal}`);
  console.log(
    `Reconciliado: ${pares} pares (serie×lema) exactos · total ${mineTotal.toLocaleString('es-UY')} ✅`,
  );

  console.log(`=== ${deptName} ${ELECCION} HOJA: gates PASARON ✅ ===`);
}

function main(): void {
  console.log('=== ETL Interior nacionales-2024 HOJA — todos los departamentos ===');
  console.log(`Leyendo ${CSV}...`);
  const allRows = parseCsv(CSV);
  console.log(`CSV total: ${allRows.length} filas`);
  console.log(`Leyendo ${INTG}...`);
  const intgRows = parseCsv(INTG); // UTF-8 por defecto
  console.log(`Integración total: ${intgRows.length} filas`);

  const DEPTS: NacionalesInteriorHojaConfig[] = [
    { deptCode: 'CA', deptName: 'canelones',      exteriorSerie: 'CZZ' },
    { deptCode: 'MA', deptName: 'maldonado',      exteriorSerie: 'DZZ' },
    { deptCode: 'CO', deptName: 'colonia',        exteriorSerie: 'NZZ' },
    { deptCode: 'SA', deptName: 'salto',          exteriorSerie: 'JZZ' },
    { deptCode: 'PA', deptName: 'paysandu',       exteriorSerie: 'KZZ' },
    { deptCode: 'RV', deptName: 'rivera',         exteriorSerie: 'HZZ' },
    { deptCode: 'CL', deptName: 'cerro_largo',    exteriorSerie: 'GZZ' },
    { deptCode: 'TA', deptName: 'tacuarembo',     exteriorSerie: 'TZZ' },
    { deptCode: 'SJ', deptName: 'san_jose',       exteriorSerie: 'OZZ' },
    { deptCode: 'SO', deptName: 'soriano',        exteriorSerie: 'MZZ' },
    { deptCode: 'RO', deptName: 'rocha',          exteriorSerie: 'EZZ' },
    { deptCode: 'FD', deptName: 'florida',        exteriorSerie: 'QZZ' },
    { deptCode: 'AR', deptName: 'artigas',        exteriorSerie: 'IZZ' },
    { deptCode: 'DU', deptName: 'durazno',        exteriorSerie: 'RZZ' },
    { deptCode: 'TT', deptName: 'treinta_y_tres', exteriorSerie: 'FZZ' },
    { deptCode: 'LA', deptName: 'lavalleja',      exteriorSerie: 'SZZ' },
    { deptCode: 'RN', deptName: 'rio_negro',      exteriorSerie: 'LZZ' },
    { deptCode: 'FS', deptName: 'flores',         exteriorSerie: 'PZZ' },
  ];

  let ok = 0;
  const failed: string[] = [];
  for (const cfg of DEPTS) {
    try {
      runHojaInterior(cfg, allRows, intgRows);
      ok++;
    } catch (e) {
      console.error(`ERROR en ${cfg.deptName}:`, e);
      failed.push(cfg.deptName);
    }
  }

  console.log(`\n=== Interior nacionales-2024 HOJA completo: ${ok}/${DEPTS.length} departamentos ===`);
  if (failed.length > 0) {
    console.error(`FALLARON: ${failed.join(', ')}`);
    process.exit(1);
  }
}

main();
