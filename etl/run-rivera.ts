/**
 * Orchestrator ETL — Rivera internas-2024.
 *
 * A diferencia de Montevideo (por barrio vía PIP circuito→dirección→coords),
 * Rivera mapea por SERIE ELECTORAL — la unidad geográfica nativa del interior.
 * Fuente canónica: desglose-de-votos.csv (etapa definitiva, sin columna ESCRUTINIO
 * porque este CSV ES el definitivo). Se excluye HZZ (exterior).
 *
 * Cadena: desglose filtrado (RV + HOJA_ODN - HZZ) → aggregateBySerie
 *   → VotosShard (nivel='serie') → gates reconciliación + cobertura.
 * Geometría: rivera_series_map.json (36 polígonos, prop `name` = código serie
 *   en minúsculas) → TopoJSON simplificado (quantile agresivo por fuente 12.7 MB).
 */
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
const GEO_SRC = 'data/processed/geographic/rivera_series_map.json';
const GEO_OUT = 'public/data/geo/rivera/serie.topo.json';
const GEO_OBJ = 'zonas';
const GEO_NAME_PROP = 'name'; // prop ya en minúsculas en la fuente procesada
const BUDGET_GZ = 500 * 1024;

const SHARD_OUT = 'public/data/internas-2024/rivera/votes.json';
const OPCIONES_OUT = 'public/data/internas-2024/rivera/opciones.json';

function votesStep(): { shard: ReturnType<typeof buildShard>; totalCanonico: number } {
  console.log('--- 1) Votos (desglose → agregado por SERIES) ---');
  const allRows = parseCsv(DESGLOSE);
  console.log(`CSV total: ${allRows.length} filas`);

  const rvOdn = allRows.filter(
    (r) => r['DEPARTAMENTO'] === 'RV' && r['TIPO_REGISTRO'] === 'HOJA_ODN',
  );
  console.log(`RV + HOJA_ODN: ${rvOdn.length} filas`);

  const exterior = rvOdn.filter((r) => (r['SERIES'] ?? '').trim() === 'HZZ');
  const mapRows = rvOdn.filter((r) => (r['SERIES'] ?? '').trim() !== 'HZZ');
  const votosExterior = exterior.reduce((s, r) => s + (Number(r['CANTIDAD_VOTOS']) || 0), 0);
  console.log(`Excluido exterior HZZ: ${exterior.length} filas / ${votosExterior} votos`);

  const agg = aggregateBySerie(mapRows);
  console.log(
    `Agregado: ${agg.zonas.length} series · total canónico ${agg.totalCanonico.toLocaleString('es-UY')} votos`,
  );

  const shard = buildShard(agg.zonas, {
    eleccionId: 'internas-2024',
    departamento: 'rivera',
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
  console.log('\n--- 2) Geometría (rivera_series_map.json → TopoJSON) ---');
  const srcKb = (statSync(GEO_SRC).size / 1024).toFixed(0);
  const clean = cleanFeatureCollection(GEO_SRC, GEO_NAME_PROP);
  // Fuente 12.7 MB: p=0.05 (mantiene el 5% de puntos más significativos).
  // Montevideo (2.1 MB) pasa con p=0.15; Rivera es 6x más grande.
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
  console.log('=== ETL Rivera internas-2024 ===');
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
