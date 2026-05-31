/**
 * Orquestador ETL — INTERIOR internas-2024 a nivel HOJA (Story 10.6, Epic 10).
 *
 * Generaliza el slice de Montevideo (Story 10.2) a los 18 deptos del interior, que
 * agregan por SERIE. Para cada depto: catálogo jerárquico (ODN+ODD) + shards de hoja
 * por lema, con gates: catálogo consistente, hojas-en-catálogo, reconciliación ODN
 * EXACTA contra el votes.json por serie publicado, ODD contra aggregateBySerie, y roll-up.
 *
 * Ejecutar: `npm run etl:interior-hoja`.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import type { CatalogoOpciones, VotosShard } from '../src/lib/contracts';
import { assertCatalogoConsistente, assertHojasEnCatalogo } from '../src/lib/contracts';
import { parseCsv } from './extract/parse-csv';
import { aggregateHojaSerie, type AggregateHojaSerieResult } from './transform/aggregate-hoja-serie';
import { aggregateBySerie } from './transform/aggregate-by-serie';
import { buildShard, writeShard } from './load/emit-shard';

const DESGLOSE = 'data/raw/electoral/internas-2024/desglose-de-votos.csv';
const ELECCION = 'internas-2024';

interface DeptCfg { code: string; name: string; exterior: string }
const DEPTOS: DeptCfg[] = [
  { code: 'AR', name: 'artigas', exterior: 'IZZ' },
  { code: 'CA', name: 'canelones', exterior: 'CZZ' },
  { code: 'CL', name: 'cerro_largo', exterior: 'GZZ' },
  { code: 'CO', name: 'colonia', exterior: 'NZZ' },
  { code: 'DU', name: 'durazno', exterior: 'RZZ' },
  { code: 'FS', name: 'flores', exterior: 'PZZ' },
  { code: 'FD', name: 'florida', exterior: 'QZZ' },
  { code: 'LA', name: 'lavalleja', exterior: 'SZZ' },
  { code: 'MA', name: 'maldonado', exterior: 'DZZ' },
  { code: 'PA', name: 'paysandu', exterior: 'KZZ' },
  { code: 'RN', name: 'rio_negro', exterior: 'LZZ' },
  { code: 'RO', name: 'rocha', exterior: 'EZZ' },
  { code: 'RV', name: 'rivera', exterior: 'HZZ' },
  { code: 'SA', name: 'salto', exterior: 'JZZ' },
  { code: 'SJ', name: 'san_jose', exterior: 'OZZ' },
  { code: 'SO', name: 'soriano', exterior: 'MZZ' },
  { code: 'TA', name: 'tacuarembo', exterior: 'TZZ' },
  { code: 'TT', name: 'treinta_y_tres', exterior: 'FZZ' },
];

/** ref serie→lemaId→votos desde un shard por lema (votes.json publicado). */
function refDesdeShard(lema: VotosShard): Map<string, Map<string, number>> {
  const ref = new Map<string, Map<string, number>>();
  for (const z of lema.zonas) {
    const m = new Map<string, number>();
    for (const v of z.porOpcion) m.set(v.opcionId, v.votos);
    ref.set(z.geoId, m);
  }
  return ref;
}

/** ref independiente: aggregateBySerie sobre las filas (el código confiable del lema). */
function refDesdeAggBySerie(rows: Record<string, string>[]): Map<string, Map<string, number>> {
  const agg = aggregateBySerie(rows);
  const shard: VotosShard = {
    eleccionId: ELECCION, departamento: '', nivel: 'serie', escrutinio: 'definitivo', tipo: 'internas', zonas: agg.zonas,
  };
  return refDesdeShard(shard);
}

/** Reconcilia Σ hojas por (serie, lema) contra una referencia por lema (tolerancia 0). */
function reconcile(nombre: string, r: AggregateHojaSerieResult, ref: Map<string, Map<string, number>>): void {
  let refTotal = 0;
  for (const m of ref.values()) for (const v of m.values()) refTotal += v;
  let mineTotal = 0;
  let pares = 0;
  for (const [serie, lemas] of r.lemaPorSerie) {
    const refSerie = ref.get(serie);
    if (!refSerie) throw new Error(`reconcile ${nombre}: serie ${serie} ausente en la referencia`);
    for (const [lemaId, votos] of lemas) {
      mineTotal += votos;
      if (refSerie.get(lemaId) !== votos) {
        throw new Error(`reconcile ${nombre}: ${serie}/${lemaId} hoja ${votos} ≠ lema ${refSerie.get(lemaId)}`);
      }
      pares++;
    }
  }
  if (mineTotal !== refTotal) throw new Error(`reconcile ${nombre}: total hoja ${mineTotal} ≠ lema ${refTotal}`);
  console.log(`    ${nombre}: ${pares} pares (serie×lema) exactos · total ${mineTotal.toLocaleString('es-UY')} ✅`);
}

function runDepto(cfg: DeptCfg, allRows: Record<string, string>[]): boolean {
  const deptRows = allRows.filter((r) => r['DEPARTAMENTO'] === cfg.code);
  const noExterior = (r: Record<string, string>) => (r['SERIES'] ?? '').trim() !== cfg.exterior;
  const odnRows = deptRows.filter((r) => r['TIPO_REGISTRO'] === 'HOJA_ODN' && noExterior(r));
  const oddRows = deptRows.filter((r) => r['TIPO_REGISTRO'] === 'HOJA_ODD' && noExterior(r));

  const odn = aggregateHojaSerie(odnRows, { contienda: 'odn', conPrecandidato: true });
  const odd = aggregateHojaSerie(oddRows, { contienda: 'odd', conPrecandidato: false });

  const contiendas = [odn.contiendaCatalogo, odd.contiendaCatalogo].filter((c) => c.opciones.length > 0);
  const catalogo: CatalogoOpciones = { eleccionId: ELECCION, departamento: cfg.name, contiendas };
  assertCatalogoConsistente(catalogo);
  const CATALOGO_OUT = `public/data/${ELECCION}/${cfg.name}/catalogo.json`;
  mkdirSync(dirname(CATALOGO_OUT), { recursive: true });
  writeFileSync(CATALOGO_OUT, JSON.stringify(catalogo), 'utf8');

  let nShards = 0;
  for (const [contienda, r] of [['odn', odn], ['odd', odd]] as const) {
    for (const s of r.shardsPorLema) {
      const out = `public/data/${ELECCION}/${cfg.name}/hoja/${contienda}/${s.lemaId}.json`;
      const shard = buildShard(s.zonas, { eleccionId: ELECCION, departamento: cfg.name, tipo: 'internas', nivel: 'serie', outPath: out });
      assertHojasEnCatalogo(shard, catalogo);
      writeShard(shard, out);
      nShards++;
    }
  }

  // Reconciliación
  const VOTES_SERIE = `public/data/${ELECCION}/${cfg.name}/votes.json`;
  if (existsSync(VOTES_SERIE)) {
    reconcile('ODN', odn, refDesdeShard(JSON.parse(readFileSync(VOTES_SERIE, 'utf8')) as VotosShard));
  } else {
    console.log(`    ⚠️ ODN: no existe ${VOTES_SERIE} — se omite reconciliación externa`);
  }
  if (oddRows.length > 0) reconcile('ODD', odd, refDesdeAggBySerie(oddRows));

  console.log(`  ${cfg.name}: ODN ${odn.contiendaCatalogo.opciones.length}h/${odn.shardsPorLema.length}lemas · ODD ${odd.contiendaCatalogo.opciones.length}h · ${nShards} shards ✅`);
  return true;
}

function main(): void {
  console.log('=== ETL INTERIOR internas-2024 — nivel HOJA (Story 10.6) ===');
  const allRows = parseCsv(DESGLOSE);
  let ok = 0;
  for (const cfg of DEPTOS) {
    try {
      if (runDepto(cfg, allRows)) ok++;
    } catch (e) {
      console.error(`  ❌ ${cfg.name}: ${e instanceof Error ? e.message : String(e)}`);
      throw e;
    }
  }
  console.log(`\n=== ${ok}/${DEPTOS.length} deptos del interior: HOJA ✅ ===`);
}

main();
