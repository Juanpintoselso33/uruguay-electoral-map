/**
 * Shared ETL function for interior departments (serie-based mapping).
 * All 18 non-Montevideo departments follow the same ETL pattern:
 *   desglose-de-votos.csv → filter(DEPARTAMENTO=code, HOJA_ODN, exclude exterior) → aggregateBySerie
 *   → VotosShard(nivel='serie') → gates reconciliation + coverage
 *   → {dept}_series_map.json → TopoJSON simplification → geometry gate
 */
import { mkdirSync, writeFileSync, statSync, existsSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { feature } from 'topojson-client';
import type { GeometryCollection } from 'topojson-specification';
import type { FeatureCollection } from 'geojson';
import { cleanFeatureCollection, topojsonFromFC } from './geometry/build-topojson';
import { assertGeometryBudget } from './gates/geometry-size';
import { parseCsv } from './extract/parse-csv';
import { aggregateBySerie } from './transform/aggregate-by-serie';
import { aggregateByLocalidad } from './transform/aggregate-by-localidad';
import { aggregateByBarrioInterior } from './transform/aggregate-by-barrio-interior';
import type { SerieLocalidadEntry } from './lib/serie-localidad';
import type { SerieBarrioEntry } from './lib/serie-barrio';
import { buildShard, writeShard } from './load/emit-shard';
import { reconcile } from './gates/reconcile';
import { checkCoverage } from './gates/coverage';

const DESGLOSE = 'data/raw/electoral/internas-2024/desglose-de-votos.csv';
const BUDGET_GZ = 500 * 1024;
const GEO_OBJ = 'zonas';

export interface InteriorDeptConfig {
  deptCode: string;
  deptName: string;
  exteriorSerie: string;
  simplifyQuantile?: number;
  eleccionId?: string;
  geoSrc?: string;
}

export function runInteriorDept(cfg: InteriorDeptConfig): void {
  const {
    deptCode,
    deptName,
    exteriorSerie,
    simplifyQuantile = 0.05,
    eleccionId = 'internas-2024',
    geoSrc = `data/processed/geographic/${deptName}_series_map.json`,
  } = cfg;

  const GEO_OUT = `public/data/geo/${deptName}/serie.topo.json`;
  const SHARD_OUT = `public/data/${eleccionId}/${deptName}/votes.json`;
  const OPCIONES_OUT = `public/data/${eleccionId}/${deptName}/opciones.json`;

  console.log(`=== ETL ${deptName} ${eleccionId} ===`);

  // 1) Votos
  console.log('--- 1) Votos ---');
  const allRows = parseCsv(DESGLOSE);
  const deptOdn = allRows.filter(
    (r) => r['DEPARTAMENTO'] === deptCode && r['TIPO_REGISTRO'] === 'HOJA_ODN',
  );
  const exterior = deptOdn.filter((r) => (r['SERIES'] ?? '').trim() === exteriorSerie);
  const mapRows = deptOdn.filter((r) => (r['SERIES'] ?? '').trim() !== exteriorSerie);
  const votosExterior = exterior.reduce((s, r) => s + (Number(r['CANTIDAD_VOTOS']) || 0), 0);
  console.log(
    `${deptCode}+HOJA_ODN: ${deptOdn.length} filas · exterior ${exteriorSerie}: ${exterior.length} filas / ${votosExterior} votos`,
  );

  const agg = aggregateBySerie(mapRows);
  console.log(
    `Agregado: ${agg.zonas.length} series · total canónico ${agg.totalCanonico.toLocaleString('es-UY')} votos`,
  );

  const shard = buildShard(agg.zonas, {
    eleccionId,
    departamento: deptName,
    tipo: 'internas',
    nivel: 'serie',
    outPath: SHARD_OUT,
  });
  writeShard(shard, SHARD_OUT);
  mkdirSync(dirname(OPCIONES_OUT), { recursive: true });
  writeFileSync(OPCIONES_OUT, JSON.stringify({ opciones: agg.opciones }), 'utf8');
  console.log(`Shard: ${SHARD_OUT} · Opciones: ${agg.opciones.length} opciones`);

  // 2) Geometría
  console.log('\n--- 2) Geometría ---');
  const srcKb = (statSync(geoSrc).size / 1024).toFixed(0);
  const clean = cleanFeatureCollection(geoSrc, 'name');
  const { topo, features } = topojsonFromFC(clean, GEO_OBJ, { simplifyQuantile });
  const serialized = JSON.stringify(topo);
  const size = assertGeometryBudget(serialized, BUDGET_GZ);
  console.log(
    `GeoJSON ${srcKb} KB → TopoJSON ${(size.rawBytes / 1024).toFixed(1)} KB raw / ` +
      `${(size.gzipBytes / 1024).toFixed(1)} KB gz ≤500 KB gz ✅`,
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

  // 3) Reconciliación
  console.log('\n--- 3) Gate reconciliación ---');
  const rec = reconcile(shard, agg.totalCanonico, 0);
  console.log(
    `sum-in=${rec.sumIn.toLocaleString('es-UY')} sum-out=${rec.sumOut.toLocaleString('es-UY')} delta=${rec.delta} ✅`,
  );

  // 4) Cobertura
  console.log('\n--- 4) Gate cobertura ---');
  const cov = checkCoverage({ shard, geoBarrioNames: names, totalCanonico: agg.totalCanonico });
  console.log(
    `placement ${(cov.placement * 100).toFixed(1)}% (≥95%) · ` +
      `serie-fill ${cov.barriosConVotos}/${cov.geoBarrios} = ${(cov.barrioFill * 100).toFixed(1)}% (≥75%) ✅`,
  );
  if (cov.geoSinVotos.length > 0) {
    console.log(`Series sin votos (${cov.geoSinVotos.length}): ${cov.geoSinVotos.join(', ')}`);
  }
  if (cov.shardSinMatch.length > 0) {
    console.log(`⚠️ geoIds sin match (${cov.shardSinMatch.length}): ${cov.shardSinMatch.join(', ')}`);
  }

  console.log(`\n=== ${deptName}: todos los gates PASARON ✅ ===`);
}

const LOCALIDAD_PLACEMENT_MIN = 0.85;

export function runLocalidadStep(cfg: InteriorDeptConfig): void {
  const { deptCode, deptName, exteriorSerie, eleccionId = 'internas-2024' } = cfg;

  const MAPPING_PATH = `public/data/mappings/${deptName}/serie-localidad.json`;
  const TOPO_PATH = `public/data/geo/${deptName}/localidad.topo.json`;
  const SHARD_OUT = `public/data/${eleccionId}/${deptName}/votes-localidad.json`;

  if (!existsSync(MAPPING_PATH)) {
    console.warn(`⚠️  [localidad] ${deptName}: sin mapping (${MAPPING_PATH}) — skip`);
    return;
  }
  if (!existsSync(TOPO_PATH)) {
    console.warn(`⚠️  [localidad] ${deptName}: sin localidad.topo.json (${TOPO_PATH}) — skip`);
    return;
  }

  console.log(`\n--- [localidad] ${deptName} ---`);

  const mapping = JSON.parse(readFileSync(MAPPING_PATH, 'utf8')) as SerieLocalidadEntry[];

  const allRows = parseCsv(DESGLOSE);
  const deptOdn = allRows.filter(
    (r) => r['DEPARTAMENTO'] === deptCode && r['TIPO_REGISTRO'] === 'HOJA_ODN',
  );
  const mapRows = deptOdn.filter((r) => (r['SERIES'] ?? '').trim() !== exteriorSerie);

  const agg = aggregateByLocalidad(mapRows, mapping);
  console.log(
    `Agregado: ${agg.zonas.length} localidades · total ${agg.totalCanonico.toLocaleString('es-UY')} · unmapped ${agg.unmappedVotos.toLocaleString('es-UY')} votos`,
  );

  const shard = buildShard(agg.zonas, {
    eleccionId,
    departamento: deptName,
    tipo: 'internas',
    nivel: 'localidad',
    outPath: SHARD_OUT,
  });
  writeShard(shard, SHARD_OUT);

  const ciudadesGrandes = [...new Set(
    mapping.filter((e) => e.tipo === 'ciudad-grande').map((e) => e.localidad),
  )];
  const META_OUT = `public/data/${eleccionId}/${deptName}/localidad-meta.json`;
  mkdirSync(dirname(META_OUT), { recursive: true });
  writeFileSync(META_OUT, JSON.stringify({ ciudadesGrandes }), 'utf8');
  console.log(`localidad-meta: ${ciudadesGrandes.length} ciudad(es) grande(s)`);

  const topoRaw = JSON.parse(readFileSync(TOPO_PATH, 'utf8'));
  const topoObj = topoRaw.objects[GEO_OBJ] as GeometryCollection;
  const topoFc = feature(topoRaw, topoObj) as FeatureCollection;
  let localidadFeatures = [...topoFc.features];

  // Augmentar localidad.topo.json con polígonos de ciudad-grande desde serie.topo.json.
  // Solo agrega ciudades que aún NO están en el topo (idempotente).
  if (ciudadesGrandes.length > 0) {
    const SERIE_TOPO_PATH = `public/data/geo/${deptName}/serie.topo.json`;
    if (existsSync(SERIE_TOPO_PATH)) {
      const normName = (s: string) => s.trim().toLowerCase();
      const existingNames = new Set(localidadFeatures.map((f) => normName(String((f.properties as { name: string }).name))));
      const ciudadesFaltantes = ciudadesGrandes.filter((c) => !existingNames.has(normName(c)));

      if (ciudadesFaltantes.length > 0) {
        const ciudadGrandeSeries = new Map<string, string>();
        for (const entry of mapping) {
          if (entry.tipo === 'ciudad-grande' && ciudadesFaltantes.some((c) => normName(c) === normName(entry.localidad))) {
            ciudadGrandeSeries.set(entry.serie.toUpperCase(), entry.localidad);
          }
        }
        const serieTopo = JSON.parse(readFileSync(SERIE_TOPO_PATH, 'utf8'));
        const serieObj = serieTopo.objects[GEO_OBJ] as GeometryCollection;
        const serieFC = feature(serieTopo, serieObj) as FeatureCollection;
        const cityFeatures = serieFC.features
          .filter((f) => ciudadGrandeSeries.has(String((f.properties as { name: string }).name).toUpperCase()))
          .map((f) => ({
            ...f,
            properties: { name: ciudadGrandeSeries.get(String((f.properties as { name: string }).name).toUpperCase())! },
          }));
        if (cityFeatures.length > 0) {
          localidadFeatures = [...localidadFeatures, ...cityFeatures];
          const augFC: FeatureCollection = { type: 'FeatureCollection', features: localidadFeatures };
          const { topo: augTopo } = topojsonFromFC(augFC, GEO_OBJ, { simplifyQuantile: 0.05 });
          writeFileSync(TOPO_PATH, JSON.stringify(augTopo), 'utf8');
          console.log(`localidad.topo.json: +${cityFeatures.length} series ciudad-grande → ${ciudadesFaltantes.join(', ')}`);
        }
      } else {
        console.log(`localidad.topo.json: ciudades grandes ya presentes (${ciudadesGrandes.join(', ')}) — sin cambios`);
      }
    }
  }

  const geoNames = localidadFeatures.map((f) => String((f.properties as { name: string }).name));

  console.log('\n--- [localidad] Gate reconciliación ---');
  const rec = reconcile(shard, agg.totalCanonico, agg.unmappedVotos);
  console.log(
    `sum-in=${rec.sumIn.toLocaleString('es-UY')} sum-out=${rec.sumOut.toLocaleString('es-UY')} delta=${rec.delta} ✅`,
  );

  console.log('\n--- [localidad] Gate cobertura (umbral 85%) ---');
  const cov = checkCoverage({
    shard,
    geoBarrioNames: geoNames,
    totalCanonico: agg.totalCanonico,
    placementMin: LOCALIDAD_PLACEMENT_MIN,
  });
  console.log(
    `placement ${(cov.placement * 100).toFixed(1)}% (≥85%) · ` +
      `localidad-fill ${cov.barriosConVotos}/${cov.geoBarrios} = ${(cov.barrioFill * 100).toFixed(1)}% (≥75%) ✅`,
  );
  if (cov.geoSinVotos.length > 0) {
    console.log(`Localidades sin votos (${cov.geoSinVotos.length}): ${cov.geoSinVotos.join(', ')}`);
  }
  if (cov.shardSinMatch.length > 0) {
    console.log(`⚠️ geoIds sin match (${cov.shardSinMatch.length}): ${cov.shardSinMatch.join(', ')}`);
  }

  console.log(`\n[localidad] ${deptName}: gates PASARON ✅ → ${SHARD_OUT}`);
}

const BARRIO_PLACEMENT_MIN = 0.75; // barrio sólo cubre zona urbana, no todo el depto

export interface BarrioStepConfig {
  deptCode: string;
  deptName: string;
  exteriorSerie: string;
  ciudad: string;
  eleccionId?: string;
  simplifyQuantile?: number;
  /** Override del umbral de placement (default: BARRIO_PLACEMENT_MIN=0.75). Usar cuando la capital representa <75% del depto. */
  placementMin?: number;
}

export function runBarrioStep(cfg: BarrioStepConfig): void {
  const {
    deptCode,
    deptName,
    exteriorSerie,
    ciudad,
    eleccionId = 'internas-2024',
    simplifyQuantile = 0.05,
  } = cfg;

  const MAPPING_PATH = `public/data/mappings/${deptName}/${ciudad}-serie-barrio.json`;
  const SERIE_TOPO_PATH = `public/data/geo/${deptName}/serie.topo.json`;
  const BARRIO_TOPO_OUT = `public/data/geo/${deptName}/barrio.topo.json`;
  const SHARD_OUT = `public/data/${eleccionId}/${deptName}/votes-barrio.json`;

  if (!existsSync(MAPPING_PATH)) {
    console.warn(`⚠️  [barrio] ${deptName}: sin mapping (${MAPPING_PATH}) — skip`);
    return;
  }
  if (!existsSync(SERIE_TOPO_PATH)) {
    console.warn(`⚠️  [barrio] ${deptName}: sin serie.topo.json (${SERIE_TOPO_PATH}) — skip`);
    return;
  }

  console.log(`\n--- [barrio] ${deptName}/${ciudad} ---`);

  const serieBarrioMap = JSON.parse(readFileSync(MAPPING_PATH, 'utf8')) as SerieBarrioEntry[];
  const serieToBarrio = new Map<string, string>();
  for (const entry of serieBarrioMap) {
    serieToBarrio.set(entry.serie.toUpperCase(), entry.barrio);
  }

  // 1) Geometría: extraer polígonos ciudad-grande del serie.topo.json y renombrar a barrio
  const topoRaw = JSON.parse(readFileSync(SERIE_TOPO_PATH, 'utf8'));
  const topoObj = topoRaw.objects[GEO_OBJ] as GeometryCollection;
  const serieFC = feature(topoRaw, topoObj) as FeatureCollection;

  const barrioFeatures = serieFC.features
    .map((f) => {
      const serieName = String((f.properties as { name: string }).name).toUpperCase();
      const barrio = serieToBarrio.get(serieName);
      if (!barrio) return null;
      return { ...f, properties: { name: barrio } };
    })
    .filter((f): f is NonNullable<typeof f> => f !== null);

  if (barrioFeatures.length === 0) {
    console.warn(`⚠️  [barrio] ${deptName}: 0 features después de filtrar — skip`);
    return;
  }

  const barrioFC: FeatureCollection = { type: 'FeatureCollection', features: barrioFeatures };
  const { topo: barrioTopo, features: nFeatures } = topojsonFromFC(barrioFC, GEO_OBJ, { simplifyQuantile });
  const serialized = JSON.stringify(barrioTopo);
  const size = assertGeometryBudget(serialized, BUDGET_GZ);
  console.log(
    `Geometría: ${nFeatures} features → barrio.topo.json ` +
      `${(size.rawBytes / 1024).toFixed(1)} KB / ${(size.gzipBytes / 1024).toFixed(1)} KB gz ≤500 KB gz ✅`,
  );
  mkdirSync(dirname(BARRIO_TOPO_OUT), { recursive: true });
  writeFileSync(BARRIO_TOPO_OUT, serialized, 'utf8');

  // 2) Votos
  const allRows = parseCsv(DESGLOSE);
  const deptOdn = allRows.filter(
    (r) => r['DEPARTAMENTO'] === deptCode && r['TIPO_REGISTRO'] === 'HOJA_ODN',
  );
  const mapRows = deptOdn.filter((r) => (r['SERIES'] ?? '').trim() !== exteriorSerie);

  const agg = aggregateByBarrioInterior(mapRows, serieBarrioMap);
  console.log(
    `Agregado: ${agg.zonas.length} barrios · total ${agg.totalCanonico.toLocaleString('es-UY')} · unmapped ${agg.unmappedVotos.toLocaleString('es-UY')} votos`,
  );

  const shard = buildShard(agg.zonas, {
    eleccionId,
    departamento: deptName,
    tipo: 'internas',
    nivel: 'barrio',
    outPath: SHARD_OUT,
  });
  writeShard(shard, SHARD_OUT);

  // 3) Gates
  const topoVerify = JSON.parse(readFileSync(BARRIO_TOPO_OUT, 'utf8'));
  const geoNames = (
    feature(topoVerify, topoVerify.objects[GEO_OBJ] as GeometryCollection) as FeatureCollection
  ).features.map((f) => String((f.properties as { name: string }).name));

  console.log('\n--- [barrio] Gate reconciliación ---');
  const rec = reconcile(shard, agg.totalCanonico, agg.unmappedVotos);
  console.log(
    `sum-in=${rec.sumIn.toLocaleString('es-UY')} sum-out=${rec.sumOut.toLocaleString('es-UY')} delta=${rec.delta} ✅`,
  );

  const placementMin = cfg.placementMin ?? BARRIO_PLACEMENT_MIN;
  console.log(`\n--- [barrio] Gate cobertura (umbral ${(placementMin * 100).toFixed(0)}%) ---`);
  const cov = checkCoverage({
    shard,
    geoBarrioNames: geoNames,
    totalCanonico: agg.totalCanonico,
    placementMin,
  });
  console.log(
    `placement ${(cov.placement * 100).toFixed(1)}% (≥${(placementMin * 100).toFixed(0)}%) · ` +
      `barrio-fill ${cov.barriosConVotos}/${cov.geoBarrios} = ${(cov.barrioFill * 100).toFixed(1)}% (≥75%) ✅`,
  );
  if (cov.geoSinVotos.length > 0) {
    console.log(`Barrios sin votos (${cov.geoSinVotos.length}): ${cov.geoSinVotos.join(', ')}`);
  }
  if (cov.shardSinMatch.length > 0) {
    console.log(`⚠️ geoIds sin match (${cov.shardSinMatch.length}): ${cov.shardSinMatch.join(', ')}`);
  }

  console.log(`\n[barrio] ${deptName}/${ciudad}: gates PASARON ✅ → ${SHARD_OUT}`);
}
