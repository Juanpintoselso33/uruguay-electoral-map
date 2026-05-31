/**
 * ETL — interior internas-2019, nivel LEMA (Story 7.7).
 *
 * Mismo patrón que run-nacionales-2024-interior.ts; diferencias:
 *   - CSV latin-1, columnas UPPERCASE (TIPO_REGISTRO, DEPARTAMENTO, CRV, SERIES, LEMA, CANTIDAD_VOTOS)
 *   - Tipos: HOJA_ODN (se usa como registro canónico, equivale a HOJA_EN en nacionales)
 *   - Usa aggregateBySerie (acepta columnas UPPERCASE)
 *
 * Ejecutar: `npm run etl:internas-2019-interior`
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { feature } from 'topojson-client';
import type { GeometryCollection } from 'topojson-specification';
import type { FeatureCollection } from 'geojson';
import { parseCsv } from './extract/parse-csv';
import { aggregateBySerie } from './transform/aggregate-by-serie';
import { buildShard, writeShard } from './load/emit-shard';
import { reconcile } from './gates/reconcile';
import { checkCoverage } from './gates/coverage';

const CSV = 'data/raw/electoral/internas-2019/desglose-de-votos.csv';
const GEO_OBJ = 'zonas';
const ELECCION = 'internas-2019';

interface Cfg {
  deptCode: string;
  deptName: string;
  exteriorSerie: string;
}

const DEPTS: Cfg[] = [
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

function runInternas2019Interior(cfg: Cfg, allRows: Record<string, string>[]): void {
  const { deptCode, deptName, exteriorSerie } = cfg;
  const placementMin = 0.95;

  const GEO_IN = `public/data/geo/${deptName}/serie.topo.json`;
  const SHARD_OUT = `public/data/${ELECCION}/${deptName}/votes.json`;
  const OPCIONES_OUT = `public/data/${ELECCION}/${deptName}/opciones.json`;

  console.log(`\n=== ETL ${deptName} ${ELECCION} ===`);

  const rows = allRows.filter(
    (r) =>
      r['DEPARTAMENTO'] === deptCode &&
      r['TIPO_REGISTRO'] === 'HOJA_ODN' &&
      (r['SERIES'] ?? '').toUpperCase() !== exteriorSerie.toUpperCase(),
  );
  console.log(`${deptCode} (HOJA_ODN sin ${exteriorSerie}): ${rows.length} filas`);

  const agg = aggregateBySerie(rows);
  console.log(`Agregado: ${agg.zonas.length} series · total ${agg.totalCanonico.toLocaleString('es-UY')} votos`);

  const shard = buildShard(agg.zonas, {
    eleccionId: ELECCION,
    departamento: deptName,
    tipo: 'internas',
    nivel: 'serie',
    outPath: SHARD_OUT,
  });
  mkdirSync(dirname(SHARD_OUT), { recursive: true });
  writeShard(shard, SHARD_OUT);

  mkdirSync(dirname(OPCIONES_OUT), { recursive: true });
  writeFileSync(OPCIONES_OUT, JSON.stringify({ opciones: agg.opciones }), 'utf8');
  console.log(`Shard + opciones: ${SHARD_OUT} · ${agg.opciones.length} lemas`);

  const rec = reconcile(shard, agg.totalCanonico, 0);
  console.log(`Reconciliación: sum-in=${rec.sumIn.toLocaleString('es-UY')} delta=${rec.delta} ✅`);

  const topo = JSON.parse(readFileSync(GEO_IN, 'utf8'));
  const obj = topo.objects[GEO_OBJ] as GeometryCollection;
  const fc = feature(topo, obj) as FeatureCollection;
  const geoNames = fc.features.map((f) => String((f.properties as { name: string }).name));
  const cov = checkCoverage({ shard, geoBarrioNames: geoNames, totalCanonico: agg.totalCanonico, placementMin });
  console.log(
    `Cobertura: placement ${(cov.placement * 100).toFixed(1)}% (≥${(placementMin * 100).toFixed(0)}% ✅) · ` +
      `serie-fill ${cov.barriosConVotos}/${cov.geoBarrios} = ${(cov.barrioFill * 100).toFixed(1)}%`,
  );
  if (cov.geoSinVotos.length > 0) console.log(`Series sin votos (${cov.geoSinVotos.length}): ${cov.geoSinVotos.join(', ')}`);
  if (cov.shardSinMatch.length > 0) console.log(`⚠️ geoIds sin match (${cov.shardSinMatch.length}): ${cov.shardSinMatch.join(', ')}`);

  console.log(`=== ${deptName} ${ELECCION}: gates PASARON ✅ ===`);
}

function main(): void {
  console.log('=== ETL Interior internas-2019 — nivel lema ===');
  console.log(`Leyendo ${CSV} (latin1)...`);
  const allRows = parseCsv(CSV, 'latin1');
  console.log(`CSV total: ${allRows.length} filas`);

  let ok = 0;
  const failed: string[] = [];
  for (const cfg of DEPTS) {
    try {
      runInternas2019Interior(cfg, allRows);
      ok++;
    } catch (e) {
      console.error(`ERROR en ${cfg.deptName}:`, e);
      failed.push(cfg.deptName);
    }
  }

  console.log(`\n=== Interior internas-2019: ${ok}/${DEPTS.length} departamentos ===`);
  if (failed.length > 0) {
    console.error(`FALLARON: ${failed.join(', ')}`);
    process.exit(1);
  }
}

main();
