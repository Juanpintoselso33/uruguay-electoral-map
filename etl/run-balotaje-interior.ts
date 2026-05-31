/**
 * Orchestrator ETL — departamentos del interior, balotaje 2024.
 *
 * Reutiliza la geometría TopoJSON ya generada por el ETL de internas (etl:colo,
 * etl:artigas, etc.). No regenera geometría; solo agrega votos y corre los gates.
 *
 * Dependencia: el script etl:<dept> correspondiente debe haber corrido antes,
 * para que exista public/data/geo/<deptName>/serie.topo.json.
 *
 * Uso: importar runBalotajeInteriorDept y llamar con la config del departamento.
 * Para Colonia: ver ejemplo al final del archivo.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { feature } from 'topojson-client';
import type { GeometryCollection } from 'topojson-specification';
import type { FeatureCollection } from 'geojson';
import { parseCsv } from './extract/parse-csv';
import { aggregateBalotajeBySerie } from './transform/aggregate-balotaje-by-serie';
import { buildShard, writeShard } from './load/emit-shard';
import { reconcile } from './gates/reconcile';
import { checkCoverage } from './gates/coverage';

const CSV = 'data/raw/electoral/balotaje-2024/balotaje-2024.csv';
const GEO_OBJ = 'zonas';

export interface BalotajeInteriorConfig {
  /** Código 2 letras del departamento en el CSV (e.g., 'CO', 'AR'). */
  deptCode: string;
  /** Nombre del departamento en minúsculas con guiones bajos (e.g., 'colonia'). */
  deptName: string;
}

export function runBalotajeInteriorDept(cfg: BalotajeInteriorConfig): void {
  const { deptCode, deptName } = cfg;

  const GEO_IN = `public/data/geo/${deptName}/serie.topo.json`;
  const SHARD_OUT = `public/data/balotaje-2024/${deptName}/votes.json`;
  const OPCIONES_OUT = `public/data/balotaje-2024/${deptName}/opciones.json`;

  console.log(`=== ETL ${deptName} balotaje-2024 ===`);
  console.log(`Dependencia: public/data/geo/${deptName}/serie.topo.json debe existir.`);

  console.log('\n--- 1) Votos ---');
  const allRows = parseCsv(CSV);
  // Filtrar al departamento y excluir serie exterior (patrón xZZ)
  const rows = allRows.filter(
    (r) => r['Departamento'] === deptCode && !(r['Serie'] ?? '').toUpperCase().endsWith('ZZ'),
  );
  console.log(`Filas ${deptCode} (sin exterior): ${rows.length}`);

  const agg = aggregateBalotajeBySerie(rows);
  console.log(
    `Agregado: ${agg.zonas.length} series · total canónico ${agg.totalCanonico.toLocaleString('es-UY')} votos`,
  );

  const shard = buildShard(agg.zonas, {
    eleccionId: 'balotaje-2024',
    departamento: deptName,
    tipo: 'balotaje',
    nivel: 'serie',
    outPath: SHARD_OUT,
  });
  writeShard(shard, SHARD_OUT);
  mkdirSync(dirname(OPCIONES_OUT), { recursive: true });
  writeFileSync(OPCIONES_OUT, JSON.stringify({ opciones: agg.opciones }), 'utf8');
  console.log(`Shard: ${SHARD_OUT} · Opciones: ${agg.opciones.length} opciones`);

  console.log('\n--- 2) Gate: reconciliación (losslessness) ---');
  const rec = reconcile(shard, agg.totalCanonico, 0);
  console.log(
    `sum-in=${rec.sumIn.toLocaleString('es-UY')} sum-out=${rec.sumOut.toLocaleString('es-UY')} delta=${rec.delta} ✅`,
  );

  console.log('\n--- 3) Gate: cobertura series↔geometría ---');
  const topo = JSON.parse(readFileSync(GEO_IN, 'utf8'));
  const obj = topo.objects[GEO_OBJ] as GeometryCollection;
  const fc = feature(topo, obj) as FeatureCollection;
  const geoNames = fc.features.map((f) => String((f.properties as { name: string }).name));
  const cov = checkCoverage({ shard, geoBarrioNames: geoNames, totalCanonico: agg.totalCanonico });
  console.log(
    `placement ${(cov.placement * 100).toFixed(1)}% (≥95%) · ` +
      `serie-fill ${cov.barriosConVotos}/${cov.geoBarrios} = ${(cov.barrioFill * 100).toFixed(1)}% (≥75%)`,
  );
  if (cov.geoSinVotos.length > 0) {
    console.log(`Series sin votos (${cov.geoSinVotos.length}): ${cov.geoSinVotos.join(', ')}`);
  }
  if (cov.shardSinMatch.length > 0) {
    console.log(`⚠️ geoIds sin match (${cov.shardSinMatch.length}): ${cov.shardSinMatch.join(', ')}`);
  }

  console.log(`\n=== ${deptName} balotaje-2024: todos los gates PASARON ✅ ===`);
}

// Piloto: Colonia
if (require.main === module) {
  runBalotajeInteriorDept({ deptCode: 'CO', deptName: 'colonia' });
}
