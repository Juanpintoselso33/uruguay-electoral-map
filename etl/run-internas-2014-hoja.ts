/**
 * ETL — internas-2014, nivel HOJA, 19 deptos (MVD + 18 interior). Clon de run-internas-2019-hoja.ts.
 *
 *   - HOJA_ODN (Convención Nacional): D1=PRECANDIDATO, D2=nº de hoja → lema→precandidato→hoja.
 *   - HOJA_ODD (Convención Departamental): D1="No aplica", D2=nº de hoja → lema→hoja.
 *
 * Diferencias vs 2019: desglose UTF-8 (no latin-1). TODOS los deptos (incl. Montevideo) usan SERIE
 * como unidad geográfica: MVD ahora se muestra POR SERIE (no depto-total; sin plan-circuital no hay
 * barrio, pero la serie ES la unidad — ver run-internas-2014-mvd.ts). Series combinadas "SFA SFB"
 * → pro-rata. Reconcilia ODN Σ hojas == votes.json lema por depto.
 *
 * Ejecutar: `npm run etl:internas-2014-hoja`.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { AgregadoZona, CatalogoOpciones, ContiendaCatalogo, NodoOpcion, OpcionHoja, VotoOpcion, VotosShard } from '../src/lib/contracts';
import { assertCatalogoConsistente, assertHojasEnCatalogo } from '../src/lib/contracts';
import { slugContrato, opcionIdHoja } from '../src/lib/contracts/granularidad';
import { parseCsv } from './extract/parse-csv';
import { buildShard, writeShard } from './load/emit-shard';

const CSV = 'data/raw/electoral/internas-2014/desglose-de-votos.csv';
const ELECCION = 'internas-2014';
const VL = 'vl';
// Montevideo se emite por BARRIO (CRV→barrio del mapeo por ciclo), igual que su votes.json.
// El resto de los deptos (incl. Canelones/Maldonado) sigue por SERIE.
const MVD_MAPPING = 'data/mappings/montevideo-circuito-barrio.internas-2014.json';

interface Cfg { deptCode: string; deptName: string; exteriorSerie?: string; geoMode?: 'serie' | 'barrio' }

interface Acc {
  lemas: Map<string, string>;
  precands: Map<string, { display: string; lemaId: string }>;
  porGeo: Map<string, Map<string, Map<string, Map<string, number>>>>;
}
function nuevoAcc(): Acc { return { lemas: new Map(), precands: new Map(), porGeo: new Map() }; }

function add(acc: Acc, geo: string, lemaId: string, lemaDisp: string, precandId: string, precandDisp: string, hoja: string, votos: number): void {
  if (!acc.lemas.has(lemaId)) acc.lemas.set(lemaId, lemaDisp);
  if (precandId && !acc.precands.has(precandId)) acc.precands.set(precandId, { display: precandDisp, lemaId });
  let g = acc.porGeo.get(geo); if (!g) { g = new Map(); acc.porGeo.set(geo, g); }
  let l = g.get(lemaId); if (!l) { l = new Map(); g.set(lemaId, l); }
  let p = l.get(precandId); if (!p) { p = new Map(); l.set(precandId, p); }
  p.set(hoja, (p.get(hoja) ?? 0) + votos);
}

function emitir(acc: Acc, contienda: 'odn' | 'odd', conPrecand: boolean): {
  cc: ContiendaCatalogo; shards: { lemaId: string; zonas: AgregadoZona[] }[]; lemaPorGeo: Map<string, Map<string, number>>;
} {
  const lemaNodos: NodoOpcion[] = [...acc.lemas.entries()].map(([id, etiqueta]) => ({ id, nivel: 'lema', etiqueta, partidoId: id }));
  const precandNodos: NodoOpcion[] = conPrecand
    ? [...acc.precands.entries()].map(([id, p]) => ({ id, nivel: 'precandidato', etiqueta: p.display, parentId: p.lemaId }))
    : [];
  const opcionesMap = new Map<string, OpcionHoja>();
  const lemaPorGeo = new Map<string, Map<string, number>>();
  const porLema = new Map<string, { geo: string; hojas: Map<string, number> }[]>();

  for (const [geo, lemas] of acc.porGeo) {
    const lt = new Map<string, number>();
    for (const [lemaId, precands] of lemas) {
      const hojasLema = new Map<string, number>();
      let total = 0;
      for (const [precandId, hojas] of precands) {
        for (const [hojaRaw, v] of hojas) {
          total += v;
          const hoja = hojaRaw && hojaRaw.toLowerCase() !== 'no aplica' ? hojaRaw : VL;
          const id = opcionIdHoja(contienda, lemaId, hoja);
          const prev = opcionesMap.get(id) as { precandidatoId?: string } | undefined;
          if (!prev) {
            const op: OpcionHoja = { clase: 'hoja', id, hoja, partidoId: lemaId, contienda, lemaId };
            if (conPrecand && precandId) {
              (op as { precandidatoId?: string }).precandidatoId = precandId;
            }
            opcionesMap.set(id, op);
          } else if (conPrecand && precandId && prev.precandidatoId !== precandId) {
            throw new Error(`hoja ${id} reclamada por precandidatos distintos: ${prev.precandidatoId} vs ${precandId}`);
          }
          hojasLema.set(id, (hojasLema.get(id) ?? 0) + v);
        }
      }
      lt.set(lemaId, total);
      let arr = porLema.get(lemaId); if (!arr) { arr = []; porLema.set(lemaId, arr); }
      arr.push({ geo, hojas: hojasLema });
    }
    lemaPorGeo.set(geo, lt);
  }

  const shards: { lemaId: string; zonas: AgregadoZona[] }[] = [];
  for (const [lemaId, geos] of porLema) {
    const zonas: AgregadoZona[] = [];
    for (const { geo, hojas } of geos) {
      const ranking = [...hojas.entries()].sort((a, b) => b[1] - a[1]);
      const validos = ranking.reduce((s, [, v]) => s + v, 0);
      if (validos === 0) continue;
      const porOpcion: VotoOpcion[] = ranking.map(([opcionId, votos]) => ({ opcionId, votos }));
      zonas.push({ geoId: geo, ganadorOpcionId: porOpcion[0].opcionId, validos, porOpcion, noPartidarios: { enBlanco: 0, anulados: 0, observados: 0 } });
    }
    shards.push({ lemaId, zonas });
  }

  // degradado: internas-2014 NO tiene el nivel SUBLEMA (no hay archivo Integración-hojas en CKAN
  // para 2014 — el dataset de internas-2014 no se publicó como datos abiertos). La escalera completa
  // de internas es lema>precandidato>sublema>hoja (ODN) / lema>sublema>hoja (ODD); acá se omite el
  // sublema → niveles = subsecuencia válida con terminal 'hoja' preservado (gate-escaleras lo acepta).
  const cc: ContiendaCatalogo = conPrecand
    ? { contienda, niveles: ['lema', 'precandidato', 'hoja'], nodos: [...lemaNodos, ...precandNodos], opciones: [...opcionesMap.values()], degradado: true }
    : { contienda, niveles: ['lema', 'hoja'], nodos: lemaNodos, opciones: [...opcionesMap.values()], degradado: true };
  return { cc, shards, lemaPorGeo };
}

function runDept(cfg: Cfg, allRows: Record<string, string>[], d1Key: string, d2Key: string,
                 crvToBarrio?: Record<string, string>): void {
  const { deptCode, deptName, exteriorSerie } = cfg;
  const barrioMode = cfg.geoMode === 'barrio';
  const nivel = barrioMode ? 'zona' : 'serie';
  const odn = nuevoAcc(); const odd = nuevoAcc();
  // BARRIO (MVD): geoId = barrio display name (join CRV→barrio, mismo mapeo que votes.json).
  // SERIE (interior): serie(s) minúscula; combinadas "SFA SFB" → pro-rata (floor, resto a la 1ra).
  const geoVotos = (r: Record<string, string>, votos: number): [string, number][] => {
    if (barrioMode) {
      const crv = (r['CRV'] ?? '').trim();
      const barrio = crvToBarrio![crv] ?? crvToBarrio![String(Number(crv))];
      return barrio ? [[barrio, votos]] : []; // sin barrio → no se emite (el bucket unmapped del votes.json)
    }
    const sRaw = (r['SERIES'] ?? '').trim();
    if (!sRaw || sRaw.toUpperCase() === (exteriorSerie ?? '').toUpperCase()) return [];
    const series = sRaw.toLowerCase().split(/\s+/).filter(Boolean); const n = series.length; if (n === 0) return [];
    // IMPORTANTE: el resto va ENTERO a la 1ra serie (idéntico a transform/aggregate-by-serie.ts,
    // que construye votes.json contra el que reconciliamos). No repartir el resto de a 1.
    const base = Math.floor(votos / n); const rem = votos - base * n;
    return series.map((s, i) => [s, base + (i === 0 ? rem : 0)] as [string, number]);
  };
  for (const r of allRows) {
    if (r['DEPARTAMENTO'] !== deptCode) continue;
    const tipo = r['TIPO_REGISTRO'];
    if (tipo !== 'HOJA_ODN' && tipo !== 'HOJA_ODD') continue;
    const votos = Number(r['CANTIDAD_VOTOS']) || 0; if (votos <= 0) continue;
    const lemaRaw = (r['LEMA'] ?? '').trim(); if (!lemaRaw) continue;
    const lemaId = slugContrato(lemaRaw.replace(/^Partido\s+/i, ''));
    const hoja = (r[d2Key] ?? '').trim();
    const odnContienda = tipo === 'HOJA_ODN';
    const precandDisp = odnContienda ? (r[d1Key] ?? '').trim() : '';
    const precandId = odnContienda && precandDisp && precandDisp.toLowerCase() !== 'no aplica' ? `odn-${lemaId}-pc-${slugContrato(precandDisp)}` : '';
    const acc = odnContienda ? odn : odd;
    for (const [geo, v] of geoVotos(r, votos)) if (v > 0) add(acc, geo, lemaId, lemaRaw, precandId, precandDisp, hoja, v);
  }

  const eOdn = emitir(odn, 'odn', true);
  const eOdd = emitir(odd, 'odd', false);
  const catalogo: CatalogoOpciones = { eleccionId: ELECCION, departamento: deptName, contiendas: [eOdn.cc, eOdd.cc] };
  assertCatalogoConsistente(catalogo);
  const CAT_OUT = `public/data/${ELECCION}/${deptName}/catalogo.json`;
  mkdirSync(dirname(CAT_OUT), { recursive: true });
  writeFileSync(CAT_OUT, JSON.stringify(catalogo), 'utf8');

  let nShards = 0;
  for (const [contienda, e] of [['odn', eOdn], ['odd', eOdd]] as const) {
    for (const s of e.shards) {
      if (s.zonas.length === 0) continue;
      const out = `public/data/${ELECCION}/${deptName}/hoja/${contienda}/${s.lemaId}.json`;
      const shard = buildShard(s.zonas, { eleccionId: ELECCION, departamento: deptName, tipo: 'internas', nivel, outPath: out });
      assertHojasEnCatalogo(shard, catalogo);
      writeShard(shard, out);
      nShards++;
    }
  }

  // Reconciliación ODN contra votes.json lema (normaliza prefijo "partido-" inconsistente entre bases).
  const nl = (s: string): string => s.replace(/^partido-/, '');
  const lema = JSON.parse(readFileSync(`public/data/${ELECCION}/${deptName}/votes.json`, 'utf8')) as VotosShard;
  const ref = new Map<string, Map<string, number>>();
  for (const z of lema.zonas) { const m = new Map<string, number>(); for (const v of z.porOpcion) m.set(nl(v.opcionId), v.votos); ref.set(z.geoId, m); }
  let pares = 0;
  for (const [geo, lt] of eOdn.lemaPorGeo) {
    const rb = ref.get(geo); if (!rb) throw new Error(`reconcile ${deptName}: geo ${geo} ausente en votes.json`);
    for (const [lemaId, total] of lt) {
      if ((rb.get(nl(lemaId)) ?? 0) !== total) throw new Error(`reconcile ${deptName}: ${geo}/${lemaId} ODN ${total} ≠ lema ${rb.get(nl(lemaId)) ?? 0}`);
      pares++;
    }
  }
  const nPrec = eOdn.cc.nodos.filter((n) => n.nivel === 'precandidato').length;
  console.log(`  ${deptName}: ODN ${eOdn.cc.opciones.length}h/${nPrec}pc + ODD ${eOdd.cc.opciones.length}h · ${nShards} shards · ${pares} pares ✅`);
}

function main(): void {
  console.log('=== ETL internas-2014 HOJA — 19 deptos (MVD + interior; ODN lema→precand→hoja + ODD lema→hoja) ===');
  const allRows = parseCsv(CSV, 'utf8');
  const keys = Object.keys(allRows[0] ?? {});
  const d1Key = keys.find((k) => /DESCRIPCI.*N_1/i.test(k)) ?? 'DESCRIPCIÓN_1';
  const d2Key = keys.find((k) => /DESCRIPCI.*N_2/i.test(k)) ?? 'DESCRIPCIÓN_2';
  console.log(`columnas: precand="${d1Key}" hoja="${d2Key}"`);
  const crvToBarrio = (JSON.parse(readFileSync(MVD_MAPPING, 'utf8')) as { crvToBarrio: Record<string, string> }).crvToBarrio;
  const DEPTS: Cfg[] = [
    { deptCode: 'MO', deptName: 'montevideo', exteriorSerie: 'AZZ', geoMode: 'barrio' },
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
    try { runDept(cfg, allRows, d1Key, d2Key, cfg.geoMode === 'barrio' ? crvToBarrio : undefined); ok++; } catch (e) { console.error(`ERROR ${cfg.deptName}:`, (e as Error).message); failed.push(cfg.deptName); }
  }
  console.log(`\n=== internas-2014 HOJA: ${ok}/${DEPTS.length} ===`);
  if (failed.length > 0) { console.error(`FALLARON: ${failed.join(', ')}`); process.exit(1); }
}

main();
