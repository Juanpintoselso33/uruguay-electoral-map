/**
 * Story 11.4 — Orchestrator ETL: nacionales-2019 (legislativas) a los 18 deptos del interior.
 *
 * Clon del patrón de `run-nacionales-2024-interior.ts` (mismo schema de CSV:
 * TipoRegistro, Departamento, CRV, Series, Lema, Descripcion1, CantidadVotos), apuntando al
 * dataset nacional completo de 2019 (`nacionales-2019-full/`). Reutiliza `serie.topo.json`
 * por depto; no regenera geometría. Nivel SERIE.
 *
 * Ejecutar: `npm run etl:nacionales-2019-interior`.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { feature } from 'topojson-client';
import type { GeometryCollection } from 'topojson-specification';
import type { FeatureCollection } from 'geojson';
import { parseCsv } from './extract/parse-csv';
import { aggregateNacionalesSerie } from './transform/aggregate-nacionales-serie';
import { buildShard, writeShard } from './load/emit-shard';
import { reconcile } from './gates/reconcile';
import { checkCoverage } from './gates/coverage';

const CSV = 'data/raw/electoral/nacionales-2019-full/desglose-de-votos.csv';
const GEO_OBJ = 'zonas';
const ELECCION = 'nacionales-2019';

interface NacionalesInteriorConfig {
  deptCode: string;
  deptName: string;
  exteriorSerie: string;
  placementMin?: number;
}

function runDept(cfg: NacionalesInteriorConfig, allRows: Record<string, string>[]): void {
  const { deptCode, deptName, exteriorSerie } = cfg;
  const placementMin = cfg.placementMin ?? 0.95;

  const GEO_IN = `public/data/geo/${deptName}/serie.topo.json`;
  const SHARD_OUT = `public/data/${ELECCION}/${deptName}/votes.json`;
  const OPCIONES_OUT = `public/data/${ELECCION}/${deptName}/opciones.json`;

  const rows = allRows.filter(
    (r) =>
      r['Departamento'] === deptCode &&
      (r['TipoRegistro'] === 'HOJA_EN' || r['TipoRegistro'] === 'VOTO_LEMA') &&
      (r['Series'] ?? '').toUpperCase() !== exteriorSerie.toUpperCase(),
  );

  const agg = aggregateNacionalesSerie(rows);

  const shard = buildShard(agg.zonas, {
    eleccionId: ELECCION,
    departamento: deptName,
    tipo: 'nacionales',
    nivel: 'serie',
    outPath: SHARD_OUT,
  });
  mkdirSync(dirname(SHARD_OUT), { recursive: true });
  writeShard(shard, SHARD_OUT);

  mkdirSync(dirname(OPCIONES_OUT), { recursive: true });
  writeFileSync(OPCIONES_OUT, JSON.stringify({ opciones: agg.opciones }), 'utf8');

  const rec = reconcile(shard, agg.totalCanonico, 0);

  const topo = JSON.parse(readFileSync(GEO_IN, 'utf8'));
  const obj = topo.objects[GEO_OBJ] as GeometryCollection;
  const fc = feature(topo, obj) as FeatureCollection;
  const geoNames = fc.features.map((f) => String((f.properties as { name: string }).name));
  const cov = checkCoverage({ shard, geoBarrioNames: geoNames, totalCanonico: agg.totalCanonico, placementMin });

  console.log(
    `  ✅ ${deptName}: ${agg.zonas.length} series · total ${agg.totalCanonico.toLocaleString('es-UY')} · ` +
      `reconcile delta=${rec.delta} · placement ${(cov.placement * 100).toFixed(1)}% · serie-fill ${(cov.barrioFill * 100).toFixed(1)}%`,
  );
}

function main(): void {
  console.log('=== ETL Interior nacionales-2019 — todos los departamentos (Story 11.4) ===');
  const allRows = parseCsv(CSV);
  console.log(`CSV total: ${allRows.length} filas`);

  const DEPTS: NacionalesInteriorConfig[] = [
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

  let ok = 0;
  const failed: string[] = [];
  for (const cfg of DEPTS) {
    try {
      runDept(cfg, allRows);
      ok++;
    } catch (e) {
      console.error(`  ❌ ${cfg.deptName}:`, e instanceof Error ? e.message : e);
      failed.push(cfg.deptName);
    }
  }

  console.log(`\n=== Interior nacionales-2019: ${ok}/${DEPTS.length} departamentos ===`);
  if (failed.length > 0) {
    console.error(`FALLARON: ${failed.join(', ')}`);
    process.exit(1);
  }
}

main();
