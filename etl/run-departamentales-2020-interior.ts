/**
 * ETL — interior departamentales-2020, 3 contiendas (Story 7.7).
 *
 * Mismo patrón que run-departamentales-2025-interior.ts. Diferencias vs. 2025:
 *  - Dos archivos CSV separados: ED (latin-1) + EM (latin-1)
 *  - Integración col Numero_de_hoja (no Numero), sin col Municipio
 *  - Candidatura title case: 'Intendente', 'Junta Departamental', 'Municipio'
 *  - Intendente titular: Ordinal='0.0' && Titular_Suplente='T'
 *  - Municipio alcalde: Ordinal='1.0' (cualquier T/S/No aplica)
 *  - Nombre municipio: DESCRIPCION_2 del desglose EM
 *
 * Ejecutar: `npm run etl:departamentales-2020-interior`
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import type {
  AgregadoZona, CatalogoOpciones, ContiendaCatalogo, NodoOpcion, Opcion,
} from '../src/lib/contracts';
import { assertCatalogoConsistente, assertHojasEnCatalogo } from '../src/lib/contracts';
import { slugContrato, opcionIdHoja } from '../src/lib/contracts/granularidad';
import { parseCsv } from './extract/parse-csv';
import { buildShard, writeShard } from './load/emit-shard';

const DESG_ED = 'data/raw/electoral/departamentales-2020/desglose-de-votos-elecci-n-departamental.csv';
const DESG_EM = 'data/raw/electoral/departamentales-2020/desglose-de-votos-elecci-n-municipal.csv';
const INTG = 'data/raw/electoral/departamentales-2020/integraci-n-de-las-hojas-de-votaci-n.csv';
const ELECCION = 'departamentales-2020';
const VL = 'vl';

interface DeptConfig {
  deptCode: string;
  deptName: string;
  exteriorSerie: string | null;
}

const DEPTS: DeptConfig[] = [
  { deptCode: 'CA', deptName: 'canelones',      exteriorSerie: null   },
  { deptCode: 'MA', deptName: 'maldonado',      exteriorSerie: 'DZZ'  },
  { deptCode: 'CO', deptName: 'colonia',        exteriorSerie: 'NZZ'  },
  { deptCode: 'SA', deptName: 'salto',          exteriorSerie: 'JZZ'  },
  { deptCode: 'PA', deptName: 'paysandu',       exteriorSerie: 'KZZ'  },
  { deptCode: 'RV', deptName: 'rivera',         exteriorSerie: 'HZZ'  },
  { deptCode: 'CL', deptName: 'cerro_largo',    exteriorSerie: 'GZZ'  },
  { deptCode: 'TA', deptName: 'tacuarembo',     exteriorSerie: 'TZZ'  },
  { deptCode: 'SJ', deptName: 'san_jose',       exteriorSerie: 'OZZ'  },
  { deptCode: 'SO', deptName: 'soriano',        exteriorSerie: 'MZZ'  },
  { deptCode: 'RO', deptName: 'rocha',          exteriorSerie: 'EZZ'  },
  { deptCode: 'FD', deptName: 'florida',        exteriorSerie: 'QZZ'  },
  { deptCode: 'AR', deptName: 'artigas',        exteriorSerie: 'IZZ'  },
  { deptCode: 'DU', deptName: 'durazno',        exteriorSerie: 'RZZ'  },
  { deptCode: 'TT', deptName: 'treinta_y_tres', exteriorSerie: 'FZZ'  },
  { deptCode: 'LA', deptName: 'lavalleja',      exteriorSerie: 'SZZ'  },
  { deptCode: 'RN', deptName: 'rio_negro',      exteriorSerie: 'LZZ'  },
  { deptCode: 'FS', deptName: 'flores',         exteriorSerie: 'PZZ'  },
];

function lemaInfo(lemaRaw: string): { display: string; id: string } {
  const display = lemaRaw.replace(/^PARTIDO\s+/i, '').trim();
  return { display, id: slugContrato(display) };
}

interface Acc {
  contienda: 'intendente' | 'junta' | 'municipio';
  niveles: ('lema' | 'sublema' | 'candidato' | 'alcalde' | 'hoja')[];
  lemas: Map<string, string>;
  middle: Map<string, NodoOpcion>;
  opciones: Map<string, Opcion>;
  votos: Map<string, Map<string, number>>;
  lemaTotal: Map<string, Map<string, number>>;
}
function nuevoAcc(c: Acc['contienda'], niveles: Acc['niveles']): Acc {
  return { contienda: c, niveles, lemas: new Map(), middle: new Map(), opciones: new Map(), votos: new Map(), lemaTotal: new Map() };
}

function addVoto(acc: Acc, serieId: string, opcionId: string, lemaId: string, votos: number): void {
  let z = acc.votos.get(serieId);
  if (!z) { z = new Map(); acc.votos.set(serieId, z); }
  z.set(opcionId, (z.get(opcionId) ?? 0) + votos);
  let lt = acc.lemaTotal.get(serieId);
  if (!lt) { lt = new Map(); acc.lemaTotal.set(serieId, lt); }
  lt.set(lemaId, (lt.get(lemaId) ?? 0) + votos);
}

function splitSeries(seriesRaw: string, votos: number, exteriorSerie: string | null): { serie: string; votos: number }[] {
  const parts = seriesRaw.toUpperCase().split(/\s+/).filter((s) => s);
  const valid = exteriorSerie
    ? parts.filter((s) => s !== exteriorSerie.toUpperCase())
    : parts;
  if (valid.length === 0) return [];
  if (valid.length === 1) return [{ serie: valid[0].toLowerCase(), votos }];
  const base = Math.floor(votos / valid.length);
  const rem = votos - base * valid.length;
  return valid.map((s, i) => ({ serie: s.toLowerCase(), votos: base + (i === 0 ? rem : 0) }));
}

const ensureLema = (acc: Acc, id: string, display: string): void => {
  if (!acc.lemas.has(id)) acc.lemas.set(id, display);
};

function ensureMiddle(acc: Acc, id: string, etiqueta: string, parentId: string, nivel: 'sublema' | 'alcalde'): void {
  // First-wins: el mismo slug puede aparecer con distintas mayúsculas en la fuente 2020.
  if (!acc.middle.has(id)) acc.middle.set(id, { id, nivel, etiqueta, parentId });
}

function contiendaCatalogo(acc: Acc): ContiendaCatalogo {
  const lemaNodos: NodoOpcion[] = [...acc.lemas.entries()].map(([id, etiqueta]) => ({
    id, nivel: 'lema', etiqueta, partidoId: id,
  }));
  return { contienda: acc.contienda, niveles: acc.niveles, nodos: [...lemaNodos, ...acc.middle.values()], opciones: [...acc.opciones.values()] };
}

function shardZonas(acc: Acc, lemaId: string): AgregadoZona[] {
  const idsLema = new Set([...acc.opciones.values()].filter((o) => (o as { lemaId?: string }).lemaId === lemaId).map((o) => o.id));
  const zonas: AgregadoZona[] = [];
  for (const [serieId, m] of acc.votos) {
    const porOpcion = [...m.entries()].filter(([id, v]) => idsLema.has(id) && v > 0).map(([opcionId, votos]) => ({ opcionId, votos }));
    if (porOpcion.length === 0) continue;
    const ganador = porOpcion.reduce((a, b) => (b.votos > a.votos ? b : a));
    zonas.push({ geoId: serieId, ganadorOpcionId: ganador.opcionId, validos: porOpcion.reduce((s, o) => s + o.votos, 0), porOpcion, noPartidarios: { enBlanco: 0, anulados: 0, observados: 0 } });
  }
  return zonas;
}

function coberturaGate(nombre: string, acc: Acc, opEsPlaceholder: (o: Opcion) => boolean, nodoEsPlaceholder: (n: NodoOpcion) => boolean = () => false): void {
  const ops = [...acc.opciones.values()].filter(opEsPlaceholder).length;
  const nodos = [...acc.middle.values()].filter(nodoEsPlaceholder).length;
  if (ops > 0 || nodos > 0) {
    // Datos 2020: integración histórica incompleta → advertencia, no error.
    console.warn(`  ⚠️ ${nombre}: ${ops} opciones + ${nodos} nodos sin join (datos 2020 incompletos)`);
  } else {
    console.log(`  ${nombre}: join completo (0 placeholders) ✅`);
  }
}

function reconciliaContraRaw(
  nombre: string,
  acc: Acc,
  raw: Map<string, Map<string, number>>,
): void {
  const lemaDeOpcion = new Map<string, string>();
  for (const o of acc.opciones.values()) lemaDeOpcion.set(o.id, (o as { lemaId: string }).lemaId);
  let pares = 0; let rutado = 0;
  for (const [serieId, m] of acc.votos) {
    const porLema = new Map<string, number>();
    for (const [id, v] of m) { const l = lemaDeOpcion.get(id)!; porLema.set(l, (porLema.get(l) ?? 0) + v); rutado += v; }
    const rb = raw.get(serieId) ?? new Map<string, number>();
    for (const [lemaId, total] of porLema) {
      if ((rb.get(lemaId) ?? 0) !== total) throw new Error(`reconcilia ${nombre}: ${serieId}/${lemaId} enrutado ${total} ≠ crudo ${rb.get(lemaId) ?? 0}`);
      pares++;
    }
  }
  let crudo = 0;
  for (const m of raw.values()) for (const v of m.values()) crudo += v;
  if (rutado !== crudo) throw new Error(`reconcilia ${nombre}: total enrutado ${rutado} ≠ crudo ${crudo}`);
  console.log(`  ${nombre}: ${pares} pares (serie×lema) == desglose crudo · total ${rutado.toLocaleString('es-UY')} ✅`);
}

function runDept(
  cfg: DeptConfig,
  allEd: Record<string, string>[],
  allEm: Record<string, string>[],
  allIntg: Record<string, string>[],
): void {
  const { deptCode, deptName, exteriorSerie } = cfg;
  const OUT = `public/data/${ELECCION}/${deptName}`;
  console.log(`\n=== ETL ${deptName} ${ELECCION} ===`);

  // 1) Integración para este dept
  const intg = allIntg.filter((r) => r.Departamento === deptCode);
  const candIntendente = new Map<string, string>();
  const sublemaJunta = new Map<string, string>();
  const alcaldeMuni = new Map<string, string>();
  for (const r of intg) {
    const num = r.Numero_de_hoja;
    if (r.Candidatura === 'Intendente') {
      if (r.Ordinal === '0.0' && r.Titular_Suplente === 'T' && !candIntendente.has(num)) {
        candIntendente.set(num, r.Nombre);
      }
    } else if (r.Candidatura === 'Junta Departamental') {
      if (!sublemaJunta.has(num)) sublemaJunta.set(num, r.Sublema);
    } else if (r.Candidatura === 'Municipio') {
      if (r.Ordinal === '1.0' && !alcaldeMuni.has(num)) {
        alcaldeMuni.set(num, r.Nombre);
      }
    }
  }
  console.log(`  intendente: ${candIntendente.size} hojas · junta: ${sublemaJunta.size} · municipio: ${alcaldeMuni.size}`);

  // 2) Acumuladores para las 3 contiendas
  const intendente = nuevoAcc('intendente', ['lema', 'candidato']);
  const junta = nuevoAcc('junta', ['lema', 'sublema', 'hoja']);
  const municipio = nuevoAcc('municipio', ['lema', 'alcalde', 'hoja']);
  const edRaw = new Map<string, Map<string, number>>();
  const emRaw = new Map<string, Map<string, number>>();

  const addRaw = (m: Map<string, Map<string, number>>, serie: string, lemaId: string, v: number): void => {
    let x = m.get(serie); if (!x) { x = new Map(); m.set(serie, x); } x.set(lemaId, (x.get(lemaId) ?? 0) + v);
  };

  // 3) Procesar desglose ED
  for (const r of allEd) {
    if (r.DEPARTAMENTO !== deptCode) continue;
    const tipo = r.TIPO_REGISTRO;
    const seriesRaw = (r.SERIES ?? '').trim();
    const votos = Number(r.CANTIDAD_VOTOS) || 0;
    if (!seriesRaw || votos === 0) continue;
    const splits = splitSeries(seriesRaw, votos, exteriorSerie);
    if (splits.length === 0) continue;
    const { display: lemaDisp, id: lemaId } = lemaInfo(r.LEMA);

    for (const { serie, votos: v } of splits) {
      if (tipo === 'HOJA_ED' || tipo === 'VOTO_LEMA_ED') {
        const hoja = tipo === 'HOJA_ED' ? r.DESCRIPCION_1 : VL;
        addRaw(edRaw, serie, lemaId, v);

        // Intendente
        ensureLema(intendente, lemaId, lemaDisp);
        const candNombre = hoja === VL ? 'Voto al lema' : (candIntendente.get(hoja) ?? '(sin candidato)');
        const candId = hoja === VL ? `intendente-${lemaId}-${VL}` : `intendente-${lemaId}-${slugContrato(candNombre)}`;
        const prevCand = intendente.opciones.get(candId) as { candidato?: string } | undefined;
        if (prevCand && prevCand.candidato !== candNombre) throw new Error(`colisión slug intendente: ${candId}`);
        if (!prevCand) intendente.opciones.set(candId, { clase: 'candidato', id: candId, candidato: candNombre, partidoId: lemaId, contienda: 'intendente', lemaId } as Opcion);
        addVoto(intendente, serie, candId, lemaId, v);

        // Junta
        ensureLema(junta, lemaId, lemaDisp);
        const sublema = hoja === VL ? 'Voto al lema' : (sublemaJunta.get(hoja) ?? 'Sin sublema');
        const hojaIdJunta = opcionIdHoja('junta', lemaId, hoja);
        if (hoja === VL) {
          if (!junta.opciones.has(hojaIdJunta)) junta.opciones.set(hojaIdJunta, { clase: 'hoja', id: hojaIdJunta, hoja: VL, partidoId: lemaId, contienda: 'junta', lemaId } as Opcion);
        } else {
          const subId = `junta-${lemaId}-sl-${slugContrato(sublema)}`;
          ensureMiddle(junta, subId, sublema, lemaId, 'sublema');
          if (!junta.opciones.has(hojaIdJunta)) junta.opciones.set(hojaIdJunta, { clase: 'hoja', id: hojaIdJunta, hoja, partidoId: lemaId, contienda: 'junta', lemaId, sublemaId: subId, grupoId: subId } as Opcion);
        }
        addVoto(junta, serie, hojaIdJunta, lemaId, v);
      }
    }
  }

  // 4) Procesar desglose EM
  for (const r of allEm) {
    if (r.DEPARTAMENTO !== deptCode) continue;
    const tipo = r.TIPO_REGISTRO;
    const seriesRaw = (r.SERIES ?? '').trim();
    const votos = Number(r.CANTIDAD_VOTOS) || 0;
    if (!seriesRaw || votos === 0) continue;
    const splits = splitSeries(seriesRaw, votos, exteriorSerie);
    if (splits.length === 0) continue;
    const { display: lemaDisp, id: lemaId } = lemaInfo(r.LEMA);

    for (const { serie, votos: v } of splits) {
      if (tipo === 'HOJA_EM' || tipo === 'VOTO_LEMA_EM') {
        const hoja = tipo === 'HOJA_EM' ? r.DESCRIPCION_1 : VL;
        // Nombre municipio viene en DESCRIPCION_2 del desglose (no en integración)
        const muniNombre = (r.DESCRIPCION_2 ?? '').trim() || '?';
        addRaw(emRaw, serie, lemaId, v);
        ensureLema(municipio, lemaId, lemaDisp);
        const hojaIdMuni = opcionIdHoja('municipio', lemaId, hoja);
        if (hoja === VL) {
          if (!municipio.opciones.has(hojaIdMuni)) municipio.opciones.set(hojaIdMuni, { clase: 'hoja', id: hojaIdMuni, hoja: VL, partidoId: lemaId, contienda: 'municipio', lemaId } as Opcion);
        } else {
          const alcalde = alcaldeMuni.get(hoja) ?? '(lista sin alcalde)';
          const alcId = `municipio-${lemaId}-al-${slugContrato(`${muniNombre}-${alcalde}`)}`;
          ensureMiddle(municipio, alcId, `${alcalde} — Municipio ${muniNombre}`, lemaId, 'alcalde');
          if (!municipio.opciones.has(hojaIdMuni)) municipio.opciones.set(hojaIdMuni, { clase: 'hoja', id: hojaIdMuni, hoja, partidoId: lemaId, contienda: 'municipio', lemaId, grupoId: alcId } as Opcion);
        }
        addVoto(municipio, serie, hojaIdMuni, lemaId, v);
      }
    }
  }

  for (const acc of [intendente, junta, municipio]) {
    console.log(`  ${acc.contienda}: ${acc.lemas.size} lemas · ${acc.middle.size} nodos medios · ${acc.opciones.size} opciones`);
  }

  // 5) Catálogo
  const catalogo: CatalogoOpciones = {
    eleccionId: ELECCION, departamento: deptName,
    contiendas: [contiendaCatalogo(intendente), contiendaCatalogo(junta), contiendaCatalogo(municipio)],
  };
  assertCatalogoConsistente(catalogo);
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/catalogo.json`, JSON.stringify(catalogo), 'utf8');
  console.log(`  catálogo: ${OUT}/catalogo.json ✅`);

  // 6) Shards por (contienda, lema)
  let nShards = 0;
  for (const acc of [intendente, junta, municipio]) {
    for (const lemaId of acc.lemas.keys()) {
      const zonas = shardZonas(acc, lemaId);
      if (zonas.length === 0) continue;
      const out = `${OUT}/hoja/${acc.contienda}/${lemaId}.json`;
      const shard = buildShard(zonas, { eleccionId: ELECCION, departamento: deptName, tipo: 'departamentales', nivel: 'serie', outPath: out });
      assertHojasEnCatalogo(shard, catalogo);
      writeShard(shard, out);
      nShards++;
    }
  }
  console.log(`  ${nShards} shards en ${OUT}/hoja/{intendente,junta,municipio}/{lema}.json`);

  // 7) Base votes.json (intendente por lema) + opciones.json
  const baseZonas: AgregadoZona[] = [];
  for (const [serieId, lt] of intendente.lemaTotal) {
    const porOpcion = [...lt.entries()].filter(([, v]) => v > 0).map(([lemaId, votos]) => ({ opcionId: lemaId, votos }));
    if (porOpcion.length === 0) continue;
    const ganador = porOpcion.reduce((a, b) => (b.votos > a.votos ? b : a));
    baseZonas.push({ geoId: serieId, ganadorOpcionId: ganador.opcionId, validos: porOpcion.reduce((s, o) => s + o.votos, 0), porOpcion, noPartidarios: { enBlanco: 0, anulados: 0, observados: 0 } });
  }
  const baseShard = buildShard(baseZonas, { eleccionId: ELECCION, departamento: deptName, tipo: 'departamentales', nivel: 'serie', outPath: `${OUT}/votes.json` });
  writeShard(baseShard, `${OUT}/votes.json`);
  const opcionesBase = [...intendente.lemas.entries()].map(([id, nombre]) => ({ opcionId: id, nombre }));
  writeFileSync(`${OUT}/opciones.json`, JSON.stringify({ opciones: opcionesBase }), 'utf8');
  console.log(`  votes.json (${baseZonas.length} series) + opciones.json (${opcionesBase.length} lemas)`);

  // 8) Gates
  coberturaGate('intendente', intendente, (o) => (o as { candidato?: string }).candidato === '(sin candidato)');
  coberturaGate('junta', junta, () => false, (n) => n.etiqueta === 'Sin sublema');
  coberturaGate('municipio', municipio, () => false, (n) => n.etiqueta.includes('(lista sin alcalde)'));
  reconciliaContraRaw('intendente+junta', intendente, edRaw);
  reconciliaContraRaw('municipio', municipio, emRaw);

  console.log(`=== ${deptName} ${ELECCION}: gates PASARON ✅ ===`);
}

function main(): void {
  console.log('=== ETL Departamentales 2020 — interior (18 depts, Story 7.7) ===');
  console.log(`Leyendo ${DESG_ED}...`);
  const allEd = parseCsv(DESG_ED, 'latin1');
  console.log(`ED: ${allEd.length} filas`);
  console.log(`Leyendo ${DESG_EM}...`);
  const allEm = parseCsv(DESG_EM, 'latin1');
  console.log(`EM: ${allEm.length} filas`);
  console.log(`Leyendo ${INTG}...`);
  const allIntg = parseCsv(INTG, 'latin1');
  console.log(`Integración: ${allIntg.length} filas`);

  let ok = 0;
  const failed: string[] = [];
  for (const cfg of DEPTS) {
    try {
      runDept(cfg, allEd, allEm, allIntg);
      ok++;
    } catch (e) {
      console.error(`ERROR en ${cfg.deptName}:`, e);
      failed.push(cfg.deptName);
    }
  }

  console.log(`\n=== Departamentales 2020 interior: ${ok}/${DEPTS.length} depts ===`);
  if (failed.length > 0) {
    console.error(`FALLARON: ${failed.join(', ')}`);
    process.exit(1);
  }
}

main();
