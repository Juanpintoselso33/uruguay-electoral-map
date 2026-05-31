/**
 * Orquestador ETL — Departamentales y Municipales 2020, Montevideo (Story 7.7 / Epic 10).
 *
 * Las MISMAS 3 contiendas paralelas que 2025 (Story 10.9): Intendente (lema→candidato),
 * Junta (lema→sublema→hoja), Municipio (lema→alcalde→hoja). Diferencias del dato 2020:
 *   - Desglose en DOS archivos separados (departamental = ED, municipal = EM), Latin-1.
 *   - Integración (Latin-1) con otros nombres de columna (Numero_de_hoja, Titular_Suplente,
 *     Partido_Politico) y SIN columna Municipio → el municipio sale del DESCRIPCION_2 del desglose
 *     ("Municipio B" → "B").
 *   - Intendente: el candidato es la fila `Titular_Suplente == 'T'` (Ordinal es '0.0', inservible).
 *   - Hallazgo: la oposición corrió a Laura Raffo bajo el lema "Partido Independiente" (coalición).
 *
 * El `nombre`/etiqueta de lema se guarda COMPLETO (p. ej. "Partido Independiente") para que el
 * color resuelva PI morado (no el gris de "Independiente")); el `id` es el slug sin prefijo.
 * Reusa CRV→BARRIO de Montevideo. Gates: cobertura del join (tolerante a residual histórico) +
 * reconciliación NO tautológica contra re-suma cruda del desglose.
 *
 * Ejecutar: `npm run etl:departamentales-2020-mvd`.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type {
  AgregadoZona, CatalogoOpciones, ContiendaCatalogo, NodoOpcion, Opcion,
} from '../src/lib/contracts';
import { assertCatalogoConsistente, assertHojasEnCatalogo } from '../src/lib/contracts';
import { slugContrato, opcionIdHoja } from '../src/lib/contracts/granularidad';
import { parseCsv } from './extract/parse-csv';
import { buildShard, writeShard } from './load/emit-shard';
import { normName } from './lib/normalize';

const DIR = 'data/raw/electoral/departamentales-2020';
const DEP_CSV = `${DIR}/desglose-de-votos-elecci-n-departamental.csv`;
const MUN_CSV = `${DIR}/desglose-de-votos-elecci-n-municipal.csv`;
const INTG = `${DIR}/integraci-n-de-las-hojas-de-votaci-n.csv`;
const MAPPING_IN = 'data/mappings/montevideo-circuito-barrio.json';
const DEP = 'MO';
const ELECCION = 'departamentales-2020';
const DEPTO = 'montevideo';
const OUT = `public/data/${ELECCION}/${DEPTO}`;
const VL = 'vl';

/** Lema: display COMPLETO (para color) + id slug SIN prefijo "Partido " (estable). */
function lemaInfo(lemaRaw: string): { display: string; id: string } {
  const display = (lemaRaw ?? '').trim();
  return { display, id: slugContrato(display.replace(/^Partido\s+/i, '')) };
}

interface Acc {
  contienda: 'intendente' | 'junta' | 'municipio';
  niveles: ('lema' | 'sublema' | 'candidato' | 'alcalde' | 'hoja')[];
  lemas: Map<string, string>;
  middle: Map<string, NodoOpcion>;
  opciones: Map<string, Opcion>;
  votos: Map<string, Map<string, number>>;
}
function nuevoAcc(c: Acc['contienda'], niveles: Acc['niveles']): Acc {
  return { contienda: c, niveles, lemas: new Map(), middle: new Map(), opciones: new Map(), votos: new Map() };
}
function addVoto(acc: Acc, barrio: string, opcionId: string, votos: number): void {
  let z = acc.votos.get(barrio);
  if (!z) { z = new Map(); acc.votos.set(barrio, z); }
  z.set(opcionId, (z.get(opcionId) ?? 0) + votos);
}

function main(): void {
  console.log('=== ETL Departamentales 2020 — Montevideo (3 contiendas, Story 7.7) ===');
  const { crvToBarrio } = JSON.parse(readFileSync(MAPPING_IN, 'utf8')) as { crvToBarrio: Record<string, string> };
  const barrioDe = (crv: string): string | undefined => crvToBarrio[crv] ?? crvToBarrio[String(Number(crv))];

  // --- 1) Integración (MO): hoja → linaje (Titular_Suplente='T' define el candidato) ---
  const intg = parseCsv(INTG, 'latin1').filter((r) => r['Departamento'] === DEP);
  const candIntendente = new Map<string, string>();
  const sublemaJunta = new Map<string, string>();
  const alcaldeMuni = new Map<string, string>(); // hoja → alcalde (muni viene del desglose)
  for (const r of intg) {
    const num = r['Numero_de_hoja'];
    const cand = r['Candidatura'];
    if (cand === 'Intendente') {
      if (r['Titular_Suplente'] === 'T') candIntendente.set(num, r['Nombre']);
    } else if (cand === 'Junta Departamental') {
      if (!sublemaJunta.has(num)) sublemaJunta.set(num, r['Sublema']);
    } else if (cand === 'Municipio') {
      if (r['Titular_Suplente'] === 'T') alcaldeMuni.set(num, r['Nombre']);
    }
  }
  console.log(`  integración: intendente ${candIntendente.size} · junta ${sublemaJunta.size} · municipio ${alcaldeMuni.size}`);

  const intendente = nuevoAcc('intendente', ['lema', 'candidato']);
  const junta = nuevoAcc('junta', ['lema', 'sublema', 'hoja']);
  const municipio = nuevoAcc('municipio', ['lema', 'alcalde', 'hoja']);

  const ensureLema = (acc: Acc, id: string, display: string): void => { if (!acc.lemas.has(id)) acc.lemas.set(id, display); };
  const ensureMiddle = (acc: Acc, id: string, etiqueta: string, parentId: string, nivel: 'sublema' | 'alcalde'): void => {
    const prev = acc.middle.get(id);
    // Colisión REAL solo si difieren normalizados (acento/caso-insensible); variantes de tipeo
    // del MISMO sublema/alcalde (p. ej. "FRENTE DEMOCRATICO UNIDO" vs "Frente Democrático Unido")
    // comparten slug y son la misma entidad → se conserva la primera etiqueta.
    if (prev && normName(prev.etiqueta) !== normName(etiqueta)) {
      throw new Error(`colisión de slug en ${acc.contienda}: nodo ${id} = "${prev.etiqueta}" vs "${etiqueta}"`);
    }
    if (!prev) acc.middle.set(id, { id, nivel, etiqueta, parentId });
  };

  // --- 2a) Desglose DEPARTAMENTAL (ED) → intendente + junta ---
  for (const r of parseCsv(DEP_CSV, 'latin1')) {
    if (r['DEPARTAMENTO'] !== DEP) continue;
    const tipo = r['TIPO_REGISTRO'];
    if (tipo !== 'HOJA_ED' && tipo !== 'VOTO_LEMA_ED') continue;
    const barrioRaw = barrioDe(r['CRV']); if (!barrioRaw) continue;
    const barrio = normName(barrioRaw);
    const votos = Number(r['CANTIDAD_VOTOS']) || 0; if (votos === 0) continue;
    const { display: lemaDisp, id: lemaId } = lemaInfo(r['LEMA']);
    const hoja = tipo === 'HOJA_ED' ? r['DESCRIPCION_1'] : VL;

    // Intendente: candidato agrega hojas.
    ensureLema(intendente, lemaId, lemaDisp);
    const candNombre = hoja === VL ? 'Voto al lema' : (candIntendente.get(hoja) ?? '(sin candidato)');
    const candId = hoja === VL ? `intendente-${lemaId}-${VL}` : `intendente-${lemaId}-${slugContrato(candNombre)}`;
    const prevCand = intendente.opciones.get(candId) as { candidato?: string } | undefined;
    if (prevCand && prevCand.candidato && normName(prevCand.candidato) !== normName(candNombre)) throw new Error(`colisión intendente: ${candId} "${prevCand.candidato}" vs "${candNombre}"`);
    if (!prevCand) intendente.opciones.set(candId, { clase: 'candidato', id: candId, candidato: candNombre, partidoId: lemaId, contienda: 'intendente', lemaId } as Opcion);
    addVoto(intendente, barrio, candId, votos);

    // Junta: lema → sublema → hoja.
    ensureLema(junta, lemaId, lemaDisp);
    const hojaIdJ = opcionIdHoja('junta', lemaId, hoja);
    if (hoja === VL) {
      if (!junta.opciones.has(hojaIdJ)) junta.opciones.set(hojaIdJ, { clase: 'hoja', id: hojaIdJ, hoja: VL, partidoId: lemaId, contienda: 'junta', lemaId } as Opcion);
    } else {
      const sublema = sublemaJunta.get(hoja) ?? 'Sin sublema';
      const subId = `junta-${lemaId}-sl-${slugContrato(sublema)}`;
      ensureMiddle(junta, subId, sublema, lemaId, 'sublema');
      if (!junta.opciones.has(hojaIdJ)) junta.opciones.set(hojaIdJ, { clase: 'hoja', id: hojaIdJ, hoja, partidoId: lemaId, contienda: 'junta', lemaId, sublemaId: subId, grupoId: subId } as Opcion);
    }
    addVoto(junta, barrio, hojaIdJ, votos);
  }

  // --- 2b) Desglose MUNICIPAL (EM) → municipio (muni = DESCRIPCION_2 "Municipio X") ---
  for (const r of parseCsv(MUN_CSV, 'latin1')) {
    if (r['DEPARTAMENTO'] !== DEP) continue;
    const tipo = r['TIPO_REGISTRO'];
    if (tipo !== 'HOJA_EM' && tipo !== 'VOTO_LEMA_EM') continue;
    const barrioRaw = barrioDe(r['CRV']); if (!barrioRaw) continue;
    const barrio = normName(barrioRaw);
    const votos = Number(r['CANTIDAD_VOTOS']) || 0; if (votos === 0) continue;
    const { display: lemaDisp, id: lemaId } = lemaInfo(r['LEMA']);
    const hoja = tipo === 'HOJA_EM' ? r['DESCRIPCION_1'] : VL;
    ensureLema(municipio, lemaId, lemaDisp);
    const hojaIdM = opcionIdHoja('municipio', lemaId, hoja);
    if (hoja === VL) {
      if (!municipio.opciones.has(hojaIdM)) municipio.opciones.set(hojaIdM, { clase: 'hoja', id: hojaIdM, hoja: VL, partidoId: lemaId, contienda: 'municipio', lemaId } as Opcion);
    } else {
      const muni = (r['DESCRIPCION_2'] ?? '?').replace(/^Municipio\s+/i, '').trim();
      const alcalde = alcaldeMuni.get(hoja) ?? '(lista sin alcalde)';
      const alcId = `municipio-${lemaId}-al-${slugContrato(`${muni}-${alcalde}`)}`;
      ensureMiddle(municipio, alcId, `${alcalde} — Municipio ${muni}`, lemaId, 'alcalde');
      if (!municipio.opciones.has(hojaIdM)) municipio.opciones.set(hojaIdM, { clase: 'hoja', id: hojaIdM, hoja, partidoId: lemaId, contienda: 'municipio', lemaId, grupoId: alcId } as Opcion);
    }
    addVoto(municipio, barrio, hojaIdM, votos);
  }
  for (const acc of [intendente, junta, municipio]) {
    console.log(`  ${acc.contienda}: ${acc.lemas.size} lemas · ${acc.middle.size} nodos medios · ${acc.opciones.size} opciones`);
  }

  // --- 3) Catálogo + gate de consistencia ---
  const catalogo: CatalogoOpciones = {
    eleccionId: ELECCION, departamento: DEPTO,
    contiendas: [contiendaCatalogo(intendente), contiendaCatalogo(junta), contiendaCatalogo(municipio)],
  };
  assertCatalogoConsistente(catalogo);
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/catalogo.json`, JSON.stringify(catalogo), 'utf8');

  // --- 4) Shards por (contienda, lema) ---
  let nShards = 0;
  for (const acc of [intendente, junta, municipio]) {
    for (const lemaId of acc.lemas.keys()) {
      const zonas = shardZonas(acc, lemaId);
      if (zonas.length === 0) continue;
      const out = `${OUT}/hoja/${acc.contienda}/${lemaId}.json`;
      const shard = buildShard(zonas, { eleccionId: ELECCION, departamento: DEPTO, tipo: 'departamentales', nivel: 'zona', outPath: out });
      assertHojasEnCatalogo(shard, catalogo);
      writeShard(shard, out);
      nShards++;
    }
  }
  console.log(`  catálogo + ${nShards} shards escritos`);

  // --- 5) Base votes.json = intendente por LEMA + opciones.json ---
  const baseZonas: AgregadoZona[] = [];
  const lemaTotalInt = lemaTotales(intendente);
  for (const [barrio, lt] of lemaTotalInt) {
    const porOpcion = [...lt.entries()].filter(([, v]) => v > 0).map(([lemaId, votos]) => ({ opcionId: lemaId, votos }));
    if (porOpcion.length === 0) continue;
    const ganador = porOpcion.reduce((a, b) => (b.votos > a.votos ? b : a));
    baseZonas.push({ geoId: barrio, ganadorOpcionId: ganador.opcionId, validos: porOpcion.reduce((s, o) => s + o.votos, 0), porOpcion, noPartidarios: { enBlanco: 0, anulados: 0, observados: 0 } });
  }
  writeShard(buildShard(baseZonas, { eleccionId: ELECCION, departamento: DEPTO, tipo: 'departamentales', nivel: 'zona', outPath: `${OUT}/votes.json` }), `${OUT}/votes.json`);
  writeFileSync(`${OUT}/opciones.json`, JSON.stringify({ opciones: [...intendente.lemas.entries()].map(([id, nombre]) => ({ opcionId: id, nombre })) }), 'utf8');
  console.log(`  base votes.json (${baseZonas.length} barrios) + opciones.json`);

  // --- 6) Cobertura del join. Intendente: tolerante (residual histórico de hojas sin Titular);
  //         junta/municipio: estrictos (deberían cubrir 100%). ---
  coberturaGate('intendente', intendente, (o) => (o as { candidato?: string }).candidato === '(sin candidato)', () => false, 0.15);
  coberturaGate('junta', junta, () => false, (n) => n.etiqueta === 'Sin sublema', 0);
  coberturaGate('municipio', municipio, () => false, (n) => n.etiqueta.includes('(lista sin alcalde)'), 0.15);

  // --- 7) Reconciliación NO tautológica contra re-suma cruda del desglose ---
  const { edRaw, emRaw } = sumaCrudaDesglose(barrioDe);
  reconciliaContraRaw('intendente', intendente, edRaw);
  reconciliaContraRaw('junta', junta, edRaw);
  reconciliaContraRaw('municipio', municipio, emRaw);

  console.log('\n=== Departamentales 2020 MVD: gates PASARON ✅ ===');
}

/** Totales por (barrio, lema) de un Acc (desde sus opciones enrutadas). */
function lemaTotales(acc: Acc): Map<string, Map<string, number>> {
  const lemaDeOpcion = new Map<string, string>();
  for (const o of acc.opciones.values()) lemaDeOpcion.set(o.id, (o as { lemaId: string }).lemaId);
  const out = new Map<string, Map<string, number>>();
  for (const [barrio, m] of acc.votos) {
    const lt = new Map<string, number>();
    for (const [id, v] of m) { const l = lemaDeOpcion.get(id)!; lt.set(l, (lt.get(l) ?? 0) + v); }
    out.set(barrio, lt);
  }
  return out;
}

function coberturaGate(nombre: string, acc: Acc, opPh: (o: Opcion) => boolean, nodoPh: (n: NodoOpcion) => boolean, tol: number): void {
  // Mide la fracción de VOTOS en buckets placeholder (no de opciones) — la métrica significativa:
  // un residual histórico de pocas hojas sin Titular pesa poco; una integración rota pesa mucho.
  const phIds = new Set([...acc.opciones.values()].filter(opPh).map((o) => o.id));
  const phNodes = new Set([...acc.middle.values()].filter(nodoPh).map((n) => n.id));
  for (const o of acc.opciones.values()) if (phNodes.has((o as { grupoId?: string }).grupoId ?? '')) phIds.add(o.id);
  let total = 0; let ph = 0;
  for (const m of acc.votos.values()) for (const [id, v] of m) { total += v; if (phIds.has(id)) ph += v; }
  const frac = total ? ph / total : 0;
  if (frac > tol) throw new Error(`cobertura ${nombre}: ${(frac * 100).toFixed(2)}% de votos en placeholder (> tol ${(tol * 100)}%) — ¿integración rota?`);
  console.log(`  ${nombre}: ${(frac * 100).toFixed(2)}% de votos en placeholder (≤ tol ${(tol * 100)}%) ✅`);
}

function sumaCrudaDesglose(barrioDe: (crv: string) => string | undefined): { edRaw: Map<string, Map<string, number>>; emRaw: Map<string, Map<string, number>> } {
  const mk = (): Map<string, Map<string, number>> => new Map();
  const edRaw = mk(); const emRaw = mk();
  const add = (m: Map<string, Map<string, number>>, b: string, lemaId: string, v: number): void => {
    let x = m.get(b); if (!x) { x = new Map(); m.set(b, x); } x.set(lemaId, (x.get(lemaId) ?? 0) + v);
  };
  for (const r of parseCsv(DEP_CSV, 'latin1')) {
    if (r['DEPARTAMENTO'] !== DEP) continue;
    if (r['TIPO_REGISTRO'] !== 'HOJA_ED' && r['TIPO_REGISTRO'] !== 'VOTO_LEMA_ED') continue;
    const b = barrioDe(r['CRV']); if (!b) continue;
    const v = Number(r['CANTIDAD_VOTOS']) || 0; if (v === 0) continue;
    add(edRaw, normName(b), lemaInfo(r['LEMA']).id, v);
  }
  for (const r of parseCsv(MUN_CSV, 'latin1')) {
    if (r['DEPARTAMENTO'] !== DEP) continue;
    if (r['TIPO_REGISTRO'] !== 'HOJA_EM' && r['TIPO_REGISTRO'] !== 'VOTO_LEMA_EM') continue;
    const b = barrioDe(r['CRV']); if (!b) continue;
    const v = Number(r['CANTIDAD_VOTOS']) || 0; if (v === 0) continue;
    add(emRaw, normName(b), lemaInfo(r['LEMA']).id, v);
  }
  return { edRaw, emRaw };
}

function reconciliaContraRaw(nombre: string, acc: Acc, raw: Map<string, Map<string, number>>): void {
  const lemaDeOpcion = new Map<string, string>();
  for (const o of acc.opciones.values()) lemaDeOpcion.set(o.id, (o as { lemaId: string }).lemaId);
  let pares = 0; let rutado = 0;
  for (const [barrio, m] of acc.votos) {
    const porLema = new Map<string, number>();
    for (const [id, v] of m) { const l = lemaDeOpcion.get(id)!; porLema.set(l, (porLema.get(l) ?? 0) + v); rutado += v; }
    const rb = raw.get(barrio) ?? new Map<string, number>();
    for (const [lemaId, total] of porLema) {
      if ((rb.get(lemaId) ?? 0) !== total) throw new Error(`reconcilia ${nombre}: ${barrio}/${lemaId} ${total} ≠ crudo ${rb.get(lemaId) ?? 0}`);
      pares++;
    }
  }
  let crudo = 0; for (const m of raw.values()) for (const v of m.values()) crudo += v;
  if (rutado !== crudo) throw new Error(`reconcilia ${nombre}: enrutado ${rutado} ≠ crudo ${crudo}`);
  console.log(`  ${nombre}: ${pares} pares (barrio×lema) == crudo · total ${rutado.toLocaleString('es-UY')} ✅`);
}

function contiendaCatalogo(acc: Acc): ContiendaCatalogo {
  const lemaNodos: NodoOpcion[] = [...acc.lemas.entries()].map(([id, etiqueta]) => ({ id, nivel: 'lema', etiqueta, partidoId: id }));
  return { contienda: acc.contienda, niveles: acc.niveles, nodos: [...lemaNodos, ...acc.middle.values()], opciones: [...acc.opciones.values()] };
}

function shardZonas(acc: Acc, lemaId: string): AgregadoZona[] {
  const idsLema = new Set([...acc.opciones.values()].filter((o) => (o as { lemaId?: string }).lemaId === lemaId).map((o) => o.id));
  const zonas: AgregadoZona[] = [];
  for (const [barrio, m] of acc.votos) {
    const porOpcion = [...m.entries()].filter(([id, v]) => idsLema.has(id) && v > 0).map(([opcionId, votos]) => ({ opcionId, votos }));
    if (porOpcion.length === 0) continue;
    const ganador = porOpcion.reduce((a, b) => (b.votos > a.votos ? b : a));
    zonas.push({ geoId: barrio, ganadorOpcionId: ganador.opcionId, validos: porOpcion.reduce((s, o) => s + o.votos, 0), porOpcion, noPartidarios: { enBlanco: 0, anulados: 0, observados: 0 } });
  }
  return zonas;
}

main();
