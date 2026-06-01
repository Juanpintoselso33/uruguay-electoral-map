/**
 * Runner compartido — ingesta de una elección de DOS opciones (balotaje histórico o
 * Sí/No de plebiscito/referéndum) a los 18 departamentos del interior, a nivel SERIE.
 *
 * Reutiliza la geometría `serie.topo.json` ya generada por el ETL de internas de cada
 * depto (no regenera geometría). Por depto: filtra el CSV al depto, excluye series
 * exteriores (patrón xZZ), agrega con `aggregateBinariaBySerie`, escribe el shard +
 * opciones.json y corre los gates:
 *   - losslessness: Σ zona.validos == Σ válidos del CSV (tolerancia 0)
 *   - cobertura: placement serie↔geometría ≥95%
 *   - estructural: assertVotosShard (ganador=máx, no-negativos) vía buildShard
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { feature } from 'topojson-client';
import type { GeometryCollection } from 'topojson-specification';
import type { FeatureCollection } from 'geojson';
import type { EleccionTipo } from '../../src/lib/contracts';
import { parseCsv } from '../extract/parse-csv';
import { aggregateBinariaBySerie, type BinariaConfig, type OpcionDef } from '../transform/aggregate-binaria-by-serie';
import { buildShard, writeShard } from '../load/emit-shard';
import { checkCoverage } from '../gates/coverage';

const GEO_OBJ = 'zonas';

/** Los 18 departamentos del interior (mismo set que run-nacionales-2024-interior). */
export const DEPTS_INTERIOR: readonly { deptCode: string; deptName: string }[] = [
  { deptCode: 'CA', deptName: 'canelones' },
  { deptCode: 'MA', deptName: 'maldonado' },
  { deptCode: 'CO', deptName: 'colonia' },
  { deptCode: 'SA', deptName: 'salto' },
  { deptCode: 'PA', deptName: 'paysandu' },
  { deptCode: 'RV', deptName: 'rivera' },
  { deptCode: 'CL', deptName: 'cerro_largo' },
  { deptCode: 'TA', deptName: 'tacuarembo' },
  { deptCode: 'SJ', deptName: 'san_jose' },
  { deptCode: 'SO', deptName: 'soriano' },
  { deptCode: 'RO', deptName: 'rocha' },
  { deptCode: 'FD', deptName: 'florida' },
  { deptCode: 'AR', deptName: 'artigas' },
  { deptCode: 'DU', deptName: 'durazno' },
  { deptCode: 'TT', deptName: 'treinta_y_tres' },
  { deptCode: 'LA', deptName: 'lavalleja' },
  { deptCode: 'RN', deptName: 'rio_negro' },
  { deptCode: 'FS', deptName: 'flores' },
];

export interface ElecBinariaConfig {
  readonly eleccionId: string;
  readonly tipo: EleccionTipo;
  readonly csv: string;
  readonly opciones: readonly [OpcionDef, OpcionDef];
  /** Solo plebiscito/referéndum: texto de la pregunta para opciones.json. */
  readonly pregunta?: string;
  /** Extractor de votos por fila (ver aggregate-binaria-by-serie). */
  readonly extract: BinariaConfig['extract'];
  /** Umbral de placement del gate de cobertura (default 0.95). */
  readonly placementMin?: number;
}

/** Procesa una elección binaria para los 18 deptos del interior. Lanza si algún gate falla. */
export function runBinariaInterior(cfg: ElecBinariaConfig): void {
  console.log(`\n=== ETL Interior ${cfg.eleccionId} — 18 departamentos ===`);
  const allRows = parseCsv(cfg.csv);
  console.log(`CSV ${cfg.csv}: ${allRows.length} filas`);
  const placementMin = cfg.placementMin ?? 0.95;

  let ok = 0;
  const failed: string[] = [];
  for (const { deptCode, deptName } of DEPTS_INTERIOR) {
    try {
      const GEO_IN = `public/data/geo/${deptName}/serie.topo.json`;
      const SHARD_OUT = `public/data/${cfg.eleccionId}/${deptName}/votes.json`;
      const OPC_OUT = `public/data/${cfg.eleccionId}/${deptName}/opciones.json`;

      // Filtrar: depto + sin serie exterior (patrón xZZ).
      const rows = allRows.filter(
        (r) => r['Departamento'] === deptCode && !(r['Serie'] ?? '').toUpperCase().endsWith('ZZ'),
      );

      const agg = aggregateBinariaBySerie(rows, { opciones: cfg.opciones, extract: cfg.extract });

      const shard = buildShard(agg.zonas, {
        eleccionId: cfg.eleccionId,
        departamento: deptName,
        tipo: cfg.tipo,
        nivel: 'serie',
        outPath: SHARD_OUT,
      });
      mkdirSync(dirname(SHARD_OUT), { recursive: true });
      writeShard(shard, SHARD_OUT);

      mkdirSync(dirname(OPC_OUT), { recursive: true });
      const opcDoc = cfg.pregunta
        ? { pregunta: cfg.pregunta, opciones: cfg.opciones }
        : { opciones: cfg.opciones };
      writeFileSync(OPC_OUT, JSON.stringify(opcDoc), 'utf8');

      // Gate 1: losslessness — Σ válidos del shard == Σ válidos del CSV.
      const sumOut = agg.zonas.reduce((s, z) => s + z.validos, 0);
      if (sumOut !== agg.totalValidos) {
        throw new Error(`losslessness: Σshard ${sumOut} ≠ Σcsv ${agg.totalValidos} (delta ${sumOut - agg.totalValidos})`);
      }

      // Gate 2: cobertura serie↔geometría.
      const topo = JSON.parse(readFileSync(GEO_IN, 'utf8'));
      const obj = topo.objects[GEO_OBJ] as GeometryCollection;
      const fc = feature(topo, obj) as FeatureCollection;
      const geoNames = fc.features.map((f) => String((f.properties as { name: string }).name));
      const cov = checkCoverage({ shard, geoBarrioNames: geoNames, totalCanonico: agg.totalCanonico, placementMin });

      console.log(
        `  ✅ ${deptName}: ${agg.zonas.length} series · válidos ${agg.totalValidos.toLocaleString('es-UY')} · ` +
          `losslessness delta=0 · placement ${(cov.placement * 100).toFixed(1)}% · serie-fill ${(cov.barrioFill * 100).toFixed(1)}%`,
      );
      ok++;
    } catch (e) {
      console.error(`  ❌ ${deptName}:`, e instanceof Error ? e.message : e);
      failed.push(deptName);
    }
  }

  console.log(`=== ${cfg.eleccionId} interior: ${ok}/${DEPTS_INTERIOR.length} departamentos ===`);
  if (failed.length > 0) {
    throw new Error(`${cfg.eleccionId}: fallaron ${failed.join(', ')}`);
  }
}
