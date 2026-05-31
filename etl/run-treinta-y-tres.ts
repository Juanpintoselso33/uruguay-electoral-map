/**
 * Orchestrador ETL — Treinta y Tres internas-2024.
 *
 * Mapea por SERIE ELECTORAL (mismo patrón que Rivera). Código departamento: 'TT'.
 * Se excluye FZZ (serie exterior, sin geometría). Fuente canónica: desglose-de-votos.csv.
 *
 * Cadena: desglose filtrado (TT + HOJA_ODN - FZZ) → aggregateBySerie
 *   → VotosShard (nivel='serie') → gates reconciliación + cobertura.
 * Geometría: treinta_y_tres_series_map.json (29 polígonos, prop `name` = código serie
 *   en minúsculas) → TopoJSON simplificado (quantile=0.05, fuente 9.9 MB).
 */
import { runLocalidadStep, runBarrioStep } from './interior-dept';
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
import { feature } from 'topojson-client';
import type { GeometryCollection } from 'topojson-specification';
import type { FeatureCollection } from 'geojson';
import { cleanFeatureCollection, topojsonFromFC } from './geometry/build-topojson';
import { assertGeometryBudget } from './gates/geometry-size';
import { parseCsv } from './extract/parse-csv';
import { aggregateBySerie } from './transform/aggregate-by-serie';
import { buildShard, writeShard } from './load/emit-shard';
import { reconcile } from './gates/reconcile';
import { checkCoverage } from './gates/coverage';

const DESGLOSE = 'data/raw/electoral/internas-2024/desglose-de-votos.csv';
const GEO_SRC = 'data/processed/geographic/treinta_y_tres_series_map.json';
const GEO_OUT = 'public/data/geo/treinta_y_tres/serie.topo.json';
const GEO_OBJ = 'zonas';
const GEO_NAME_PROP = 'name';
const BUDGET_GZ = 500 * 1024;

const SHARD_OUT = 'public/data/internas-2024/treinta_y_tres/votes.json';
const OPCIONES_OUT = 'public/data/internas-2024/treinta_y_tres/opciones.json';

function votesStep(): { shard: ReturnType<typeof buildShard>; totalCanonico: number } {
  console.log('--- 1) Votos (desglose → agregado por SERIES) ---');
  const allRows = parseCsv(DESGLOSE);
  console.log(`CSV total: ${allRows.length} filas`);

  const ttOdn = allRows.filter(
    (r) => r['DEPARTAMENTO'] === 'TT' && r['TIPO_REGISTRO'] === 'HOJA_ODN',
  );
  console.log(`TT + HOJA_ODN: ${ttOdn.length} filas`);

  const exterior = ttOdn.filter((r) => (r['SERIES'] ?? '').trim() === 'FZZ');
  const mapRows = ttOdn.filter((r) => (r['SERIES'] ?? '').trim() !== 'FZZ');
  const votosExterior = exterior.reduce((s, r) => s + (Number(r['CANTIDAD_VOTOS']) || 0), 0);
  console.log(`Excluido exterior FZZ: ${exterior.length} filas / ${votosExterior} votos`);

  const agg = aggregateBySerie(mapRows);
  console.log(
    `Agregado: ${agg.zonas.length} series · total canónico ${agg.totalCanonico.toLocaleString('es-UY')} votos`,
  );

  const shard = buildShard(agg.zonas, {
    eleccionId: 'internas-2024',
    departamento: 'treinta_y_tres',
    tipo: 'internas',
    nivel: 'serie',
    outPath: SHARD_OUT,
  });
  writeShard(shard, SHARD_OUT);
  console.log(`Shard: ${SHARD_OUT}`);

  mkdirSync(dirname(OPCIONES_OUT), { recursive: true });
  writeFileSync(OPCIONES_OUT, JSON.stringify({ opciones: agg.opciones }), 'utf8');
  console.log(`Opciones: ${OPCIONES_OUT} (${agg.opciones.length} opciones)`);

  return { shard, totalCanonico: agg.totalCanonico };
}

function geometryStep(): { names: string[] } {
  console.log('\n--- 2) Geometría (treinta_y_tres_series_map.json → TopoJSON) ---');
  const srcKb = (statSync(GEO_SRC).size / 1024).toFixed(0);
  const clean = cleanFeatureCollection(GEO_SRC, GEO_NAME_PROP);
  // Fuente 9.9 MB: p=0.05 → ~98 KB gz, dentro del budget de 500 KB gz.
  const { topo, features } = topojsonFromFC(clean, GEO_OBJ, { simplifyQuantile: 0.05 });
  const serialized = JSON.stringify(topo);
  const size = assertGeometryBudget(serialized, BUDGET_GZ);
  console.log(
    `GeoJSON fuente ${srcKb} KB → TopoJSON ${(size.rawBytes / 1024).toFixed(1)} KB raw / ` +
      `${(size.gzipBytes / 1024).toFixed(1)} KB gz (gate ≤500 KB gz: PASA ✅)`,
  );

  const obj = topo.objects[GEO_OBJ] as GeometryCollection;
  const fc = feature(topo, obj) as FeatureCollection;
  if (fc.features.length !== features) {
    throw new Error(`Round-trip falló: ${fc.features.length} ≠ ${features}`);
  }
  const names = fc.features.map((f) => String((f.properties as { name: string }).name));
  console.log(`Round-trip: ${fc.features.length}/${features} series ✅`);

  mkdirSync(dirname(GEO_OUT), { recursive: true });
  writeFileSync(GEO_OUT, serialized, 'utf8');
  console.log(`Artefacto: ${GEO_OUT}`);
  return { names };
}

function main(): void {
  console.log('=== ETL Treinta y Tres internas-2024 ===');
  const { shard, totalCanonico } = votesStep();
  const { names } = geometryStep();

  console.log('\n--- 3) Gate: reconciliación ---');
  const rec = reconcile(shard, totalCanonico, 0);
  console.log(
    `sum-in=${rec.sumIn.toLocaleString('es-UY')} sum-out=${rec.sumOut.toLocaleString('es-UY')} delta=${rec.delta} ✅`,
  );

  console.log('\n--- 4) Gate: cobertura series↔geometría ---');
  const cov = checkCoverage({ shard, geoBarrioNames: names, totalCanonico });
  console.log(
    `placement ${(cov.placement * 100).toFixed(1)}% (≥95% ✅) · ` +
      `serie-fill ${cov.barriosConVotos}/${cov.geoBarrios} = ${(cov.barrioFill * 100).toFixed(1)}% (≥75% ✅)`,
  );
  if (cov.geoSinVotos.length > 0) {
    console.log(`Series sin votos (${cov.geoSinVotos.length}): ${cov.geoSinVotos.join(', ')}`);
  }
  if (cov.shardSinMatch.length > 0) {
    console.log(
      `⚠️ geoIds del shard sin match en geometría (${cov.shardSinMatch.length}): ${cov.shardSinMatch.join(', ')}`,
    );
  }
  console.log('\n=== Todos los gates PASARON ✅ ===');
}

main();

const ttCfg = { deptCode: 'TT', deptName: 'treinta_y_tres', exteriorSerie: 'FZZ', simplifyQuantile: 0.05 };
runLocalidadStep(ttCfg);
runBarrioStep({ ...ttCfg, ciudad: 'treinta_y_tres', placementMin: 0.55 });
