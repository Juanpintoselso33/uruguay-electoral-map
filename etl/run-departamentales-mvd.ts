/**
 * Orquestador ETL — Departamentales y Municipales 2025, Montevideo (Story 10.9, Epic 10).
 *
 * Tres contiendas PARALELAS en el mismo sobre, cada una con su escalera:
 *   - Intendente (HOJA_ED): lema → candidato         (el candidato agrega sus hojas)
 *   - Junta Departamental (HOJA_ED): lema → sublema → hoja
 *   - Municipio (HOJA_EM): lema → alcalde → hoja      (8 municipios A–G/CH; el alcalde rotula su municipio)
 *
 * El mismo voto HOJA_ED cuenta para Intendente Y Junta (un sobre elige ambos); Municipio usa
 * HOJA_EM (sobre municipal). El linaje (candidato de intendente, sublema de junta, alcalde de
 * municipio) sale de cruzar el desglose con la INTEGRACIÓN por número de hoja.
 *
 * Fuente integración: el XLSX (hoja 'Datos') convertido a `integracion-de-hojas-full.csv` — el
 * CSV publicado está truncado a Artigas (ver memoria integracion-csv-truncado-usar-xlsx).
 * Reusa el mapping CRV→BARRIO de Montevideo (no regenera geometría). Self-consistencia: cada
 * contienda reconcilia Σ opciones(barrio,lema) == total del lema; base intendente == ese total.
 *
 * Ejecutar: `npm run etl:departamentales-mvd`.
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

const DESG = 'data/raw/electoral/departamentales-2025/desglose-de-votos.csv';
const INTG = 'data/raw/electoral/departamentales-2025/integracion-de-hojas-full.csv';
const MAPPING_IN = 'data/mappings/montevideo-circuito-barrio.json';
const DEP = 'MO';
const ELECCION = 'departamentales-2025';
const DEPTO = 'montevideo';
const OUT = `public/data/${ELECCION}/${DEPTO}`;
const VL = 'vl'; // pseudo-hoja: voto al lema (sin elegir lista)

/** Lema legible (sin prefijo "PARTIDO ") + id slug estable. */
function lemaInfo(lemaRaw: string): { display: string; id: string } {
  const display = lemaRaw.replace(/^PARTIDO\s+/i, '').trim();
  return { display, id: slugContrato(display) };
}

/** Acumulador de una contienda: árbol (nodos) + opciones (hojas/candidatos) + votos por barrio. */
interface Acc {
  contienda: 'intendente' | 'junta' | 'municipio';
  niveles: ('lema' | 'sublema' | 'candidato' | 'alcalde' | 'hoja')[];
  lemas: Map<string, string>;                    // lemaId → display
  middle: Map<string, NodoOpcion>;               // middleNodeId → nodo (sublema/alcalde)
  opciones: Map<string, Opcion>;                 // opcionId → opción terminal
  votos: Map<string, Map<string, number>>;       // barrioNorm → opcionId → votos
  lemaTotal: Map<string, Map<string, number>>;   // barrioNorm → lemaId → total (gate)
}
function nuevoAcc(c: Acc['contienda'], niveles: Acc['niveles']): Acc {
  return { contienda: c, niveles, lemas: new Map(), middle: new Map(), opciones: new Map(), votos: new Map(), lemaTotal: new Map() };
}

function addVoto(acc: Acc, barrio: string, opcionId: string, lemaId: string, votos: number): void {
  let z = acc.votos.get(barrio);
  if (!z) { z = new Map(); acc.votos.set(barrio, z); }
  z.set(opcionId, (z.get(opcionId) ?? 0) + votos);
  let lt = acc.lemaTotal.get(barrio);
  if (!lt) { lt = new Map(); acc.lemaTotal.set(barrio, lt); }
  lt.set(lemaId, (lt.get(lemaId) ?? 0) + votos);
}

function main(): void {
  console.log('=== ETL Departamentales 2025 — Montevideo (3 contiendas, Epic 10 Story 10.9) ===');
  const { crvToBarrio } = JSON.parse(readFileSync(MAPPING_IN, 'utf8')) as { crvToBarrio: Record<string, string> };
  const barrioDe = (crv: string): string | undefined => crvToBarrio[crv] ?? crvToBarrio[String(Number(crv))];

  // --- 1) Integración (MO): hoja → linaje ---
  console.log('\n--- 1) Integración: hoja → candidato/sublema/alcalde ---');
  const intg = parseCsv(INTG).filter((r) => r.Departamento === DEP);
  const candIntendente = new Map<string, string>();          // hoja → nombre del candidato a intendente (Ord1 T)
  const sublemaJunta = new Map<string, string>();            // hoja → sublema de junta
  const alcaldeMuni = new Map<string, { municipio: string; alcalde: string }>(); // hojaSuf → {muni, alcalde}
  for (const r of intg) {
    const num = r.Numero;
    if (r.Candidatura === 'INTENDENTE') {
      if (r.Ordinal === '1' && r.TitularSuplente === 'T') candIntendente.set(num, r.Nombre);
    } else if (r.Candidatura === 'JUNTA DEPARTAMENTAL') {
      if (!sublemaJunta.has(num)) sublemaJunta.set(num, r.Sublema);
    } else if (r.Candidatura === 'MUNICIPIO') {
      if (r.Ordinal === '1' && r.TitularSuplente === 'T') alcaldeMuni.set(num, { municipio: r.Municipio, alcalde: r.Nombre });
    }
  }
  console.log(`  intendente: ${candIntendente.size} hojas · junta: ${sublemaJunta.size} · municipio: ${alcaldeMuni.size}`);

  // --- 2) Desglose (MO): acumular por contienda ---
  console.log('\n--- 2) Desglose → 3 contiendas ---');
  const intendente = nuevoAcc('intendente', ['lema', 'candidato']);
  const junta = nuevoAcc('junta', ['lema', 'sublema', 'hoja']);
  const municipio = nuevoAcc('municipio', ['lema', 'alcalde', 'hoja']);
  let unmapped = 0;

  const ensureLema = (acc: Acc, id: string, display: string): void => { if (!acc.lemas.has(id)) acc.lemas.set(id, display); };
  const ensureMiddle = (acc: Acc, id: string, etiqueta: string, parentId: string, nivel: 'sublema' | 'alcalde'): void => {
    const prev = acc.middle.get(id);
    // Guarda anti-colisión de slug: dos nodos distintos no deben compartir id (silenciaría datos).
    if (prev && prev.etiqueta !== etiqueta) {
      throw new Error(`colisión de slug en ${acc.contienda}: nodo ${id} = "${prev.etiqueta}" vs "${etiqueta}"`);
    }
    if (!prev) acc.middle.set(id, { id, nivel, etiqueta, parentId });
  };

  for (const r of parseCsv(DESG)) {
    if (r.DEPARTAMENTO !== DEP) continue;
    const tipo = r.TIPO_REGISTRO;
    const barrioRaw = barrioDe(r.CRV);
    if (!barrioRaw) { unmapped += Number(r.CANTIDAD_VOTOS) || 0; continue; }
    const barrio = normName(barrioRaw);
    const votos = Number(r.CANTIDAD_VOTOS) || 0;
    if (votos === 0) continue;
    const { display: lemaDisp, id: lemaId } = lemaInfo(r.LEMA);

    if (tipo === 'HOJA_ED' || tipo === 'VOTO_LEMA_ED') {
      const hoja = tipo === 'HOJA_ED' ? r.DESCRIPCION_1 : VL;
      // Intendente: el candidato agrega las hojas; vl = "Voto al lema".
      ensureLema(intendente, lemaId, lemaDisp);
      const candNombre = hoja === VL ? 'Voto al lema' : (candIntendente.get(hoja) ?? '(sin candidato)');
      const candId = hoja === VL ? `intendente-${lemaId}-${VL}` : `intendente-${lemaId}-${slugContrato(candNombre)}`;
      const prevCand = intendente.opciones.get(candId) as { candidato?: string } | undefined;
      if (prevCand && prevCand.candidato !== candNombre) {
        throw new Error(`colisión de slug intendente: ${candId} = "${prevCand.candidato}" vs "${candNombre}"`);
      }
      if (!prevCand) {
        intendente.opciones.set(candId, { clase: 'candidato', id: candId, candidato: candNombre, partidoId: lemaId, contienda: 'intendente', lemaId } as Opcion);
      }
      addVoto(intendente, barrio, candId, lemaId, votos);

      // Junta: lema → sublema → hoja (mismos votos del sobre ED).
      ensureLema(junta, lemaId, lemaDisp);
      const sublema = hoja === VL ? 'Voto al lema' : (sublemaJunta.get(hoja) ?? 'Sin sublema');
      const hojaId = opcionIdHoja('junta', lemaId, hoja);
      if (hoja === VL) {
        if (!junta.opciones.has(hojaId)) junta.opciones.set(hojaId, { clase: 'hoja', id: hojaId, hoja: VL, partidoId: lemaId, contienda: 'junta', lemaId } as Opcion);
      } else {
        const subId = `junta-${lemaId}-sl-${slugContrato(sublema)}`;
        ensureMiddle(junta, subId, sublema, lemaId, 'sublema');
        if (!junta.opciones.has(hojaId)) junta.opciones.set(hojaId, { clase: 'hoja', id: hojaId, hoja, partidoId: lemaId, contienda: 'junta', lemaId, sublemaId: subId, grupoId: subId } as Opcion);
      }
      addVoto(junta, barrio, hojaId, lemaId, votos);
    } else if (tipo === 'HOJA_EM' || tipo === 'VOTO_LEMA_EM') {
      // Municipio: HOJA_EM trae "53-B" (hoja-municipio) en DESCRIPCION_1 y la letra en DESCRIPCION_2.
      const hoja = tipo === 'HOJA_EM' ? r.DESCRIPCION_1 : VL;
      ensureLema(municipio, lemaId, lemaDisp);
      const hojaId = opcionIdHoja('municipio', lemaId, hoja);
      if (hoja === VL) {
        if (!municipio.opciones.has(hojaId)) municipio.opciones.set(hojaId, { clase: 'hoja', id: hojaId, hoja: VL, partidoId: lemaId, contienda: 'municipio', lemaId } as Opcion);
      } else {
        const info = alcaldeMuni.get(hoja);
        const muni = info?.municipio ?? r.DESCRIPCION_2 ?? '?';
        const alcalde = info?.alcalde ?? '(lista sin alcalde)';
        const alcId = `municipio-${lemaId}-al-${slugContrato(`${muni}-${alcalde}`)}`;
        ensureMiddle(municipio, alcId, `${alcalde} — Municipio ${muni}`, lemaId, 'alcalde');
        if (!municipio.opciones.has(hojaId)) municipio.opciones.set(hojaId, { clase: 'hoja', id: hojaId, hoja, partidoId: lemaId, contienda: 'municipio', lemaId, grupoId: alcId } as Opcion);
      }
      addVoto(municipio, barrio, hojaId, lemaId, votos);
    }
  }
  for (const acc of [intendente, junta, municipio]) {
    console.log(`  ${acc.contienda}: ${acc.lemas.size} lemas · ${acc.middle.size} nodos medios · ${acc.opciones.size} opciones`);
  }
  if (unmapped > 0) console.log(`  (votos en CRV sin barrio: ${unmapped})`);

  // --- 3) Catálogo (3 contiendas) + gate de consistencia ---
  console.log('\n--- 3) Catálogo jerárquico + gate ---');
  const catalogo: CatalogoOpciones = {
    eleccionId: ELECCION, departamento: DEPTO,
    contiendas: [contiendaCatalogo(intendente), contiendaCatalogo(junta), contiendaCatalogo(municipio)],
  };
  assertCatalogoConsistente(catalogo);
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/catalogo.json`, JSON.stringify(catalogo), 'utf8');
  console.log(`  catálogo escrito (consistente): ${OUT}/catalogo.json`);

  // --- 4) Shards por (contienda, lema) + gate hojas-en-catálogo ---
  console.log('\n--- 4) Shards por lema ---');
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
  console.log(`  ${nShards} shards en ${OUT}/hoja/{intendente,junta,municipio}/{lema}.json`);

  // --- 5) Base votes.json = intendente por LEMA (mapa por defecto) + opciones.json ---
  console.log('\n--- 5) Base (intendente por lema) ---');
  const baseZonas: AgregadoZona[] = [];
  for (const [barrio, lt] of intendente.lemaTotal) {
    const porOpcion = [...lt.entries()].filter(([, v]) => v > 0).map(([lemaId, votos]) => ({ opcionId: lemaId, votos }));
    if (porOpcion.length === 0) continue;
    const ganador = porOpcion.reduce((a, b) => (b.votos > a.votos ? b : a));
    baseZonas.push({ geoId: barrio, ganadorOpcionId: ganador.opcionId, validos: porOpcion.reduce((s, o) => s + o.votos, 0), porOpcion, noPartidarios: { enBlanco: 0, anulados: 0, observados: 0 } });
  }
  const baseShard = buildShard(baseZonas, { eleccionId: ELECCION, departamento: DEPTO, tipo: 'departamentales', nivel: 'zona', outPath: `${OUT}/votes.json` });
  writeShard(baseShard, `${OUT}/votes.json`);
  const opcionesBase = [...intendente.lemas.entries()].map(([id, nombre]) => ({ opcionId: id, nombre }));
  writeFileSync(`${OUT}/opciones.json`, JSON.stringify({ opciones: opcionesBase }), 'utf8');
  console.log(`  votes.json (${baseZonas.length} barrios) + opciones.json (${opcionesBase.length} lemas)`);

  // --- 6) Cobertura del join: ninguna opción cayó en bucket placeholder (detecta integración
  // truncada/ausente: votos sumarían igual pero bajo etiquetas degradadas, y los gates de suma
  // pasarían igual — por eso este chequeo es independiente de la reconciliación). ---
  console.log('\n--- 6) Cobertura del join (sin placeholders) ---');
  coberturaGate('intendente', intendente, (o) => (o as { candidato?: string }).candidato === '(sin candidato)');
  coberturaGate('junta', junta, () => false, (n) => n.etiqueta === 'Sin sublema');
  coberturaGate('municipio', municipio, () => false, (n) => n.etiqueta.includes('(lista sin alcalde)'));

  // --- 7) Reconciliación NO tautológica: re-suma cruda del desglose (otra pasada, sin pasar por
  // opciones/integración) y compara contra Σ de los votos enrutados por opción. Detecta mis-routing
  // (un voto que cayó en el lema equivocado) — lo que el self-check barrio×lema no podía. ---
  console.log('\n--- 7) Reconciliación contra re-suma cruda del desglose ---');
  const { edRaw, emRaw } = sumaCrudaDesglose(barrioDe);
  reconciliaContraRaw('intendente', intendente, edRaw);
  reconciliaContraRaw('junta', junta, edRaw);
  reconciliaContraRaw('municipio', municipio, emRaw);

  console.log('\n=== Todos los gates PASARON ✅ ===');
}

/** Gate de cobertura: lanza si alguna opción/nodo cayó en un bucket placeholder (join degradado). */
function coberturaGate(
  nombre: string,
  acc: Acc,
  opEsPlaceholder: (o: Opcion) => boolean,
  nodoEsPlaceholder: (n: NodoOpcion) => boolean = () => false,
): void {
  const ops = [...acc.opciones.values()].filter(opEsPlaceholder).length;
  const nodos = [...acc.middle.values()].filter(nodoEsPlaceholder).length;
  if (ops > 0 || nodos > 0) {
    throw new Error(`cobertura ${nombre}: ${ops} opciones + ${nodos} nodos en placeholder (¿integración truncada/ausente?)`);
  }
  console.log(`  ${nombre}: join completo (0 placeholders) ✅`);
}

/** Re-suma cruda del desglose por (barrio,lema), sin pasar por opciones/integración. */
function sumaCrudaDesglose(barrioDe: (crv: string) => string | undefined): {
  edRaw: Map<string, Map<string, number>>; emRaw: Map<string, Map<string, number>>;
} {
  const edRaw = new Map<string, Map<string, number>>();
  const emRaw = new Map<string, Map<string, number>>();
  const add = (m: Map<string, Map<string, number>>, b: string, lemaId: string, v: number): void => {
    let x = m.get(b); if (!x) { x = new Map(); m.set(b, x); } x.set(lemaId, (x.get(lemaId) ?? 0) + v);
  };
  for (const r of parseCsv(DESG)) {
    if (r.DEPARTAMENTO !== DEP) continue;
    const b = barrioDe(r.CRV); if (!b) continue;
    const v = Number(r.CANTIDAD_VOTOS) || 0; if (v === 0) continue;
    const barrio = normName(b);
    const { id: lemaId } = lemaInfo(r.LEMA);
    if (r.TIPO_REGISTRO === 'HOJA_ED' || r.TIPO_REGISTRO === 'VOTO_LEMA_ED') add(edRaw, barrio, lemaId, v);
    else if (r.TIPO_REGISTRO === 'HOJA_EM' || r.TIPO_REGISTRO === 'VOTO_LEMA_EM') add(emRaw, barrio, lemaId, v);
  }
  return { edRaw, emRaw };
}

/** Σ de los votos enrutados por opción, agrupados por (barrio,lema), == re-suma cruda independiente. */
function reconciliaContraRaw(nombre: string, acc: Acc, raw: Map<string, Map<string, number>>): void {
  const lemaDeOpcion = new Map<string, string>();
  for (const o of acc.opciones.values()) lemaDeOpcion.set(o.id, (o as { lemaId: string }).lemaId);
  let pares = 0;
  let rutado = 0;
  for (const [barrio, m] of acc.votos) {
    const porLema = new Map<string, number>();
    for (const [id, v] of m) { const l = lemaDeOpcion.get(id)!; porLema.set(l, (porLema.get(l) ?? 0) + v); rutado += v; }
    const rb = raw.get(barrio) ?? new Map<string, number>();
    for (const [lemaId, total] of porLema) {
      if ((rb.get(lemaId) ?? 0) !== total) {
        throw new Error(`reconcilia ${nombre}: ${barrio}/${lemaId} enrutado ${total} ≠ crudo ${rb.get(lemaId) ?? 0}`);
      }
      pares++;
    }
  }
  let crudo = 0;
  for (const m of raw.values()) for (const v of m.values()) crudo += v;
  if (rutado !== crudo) throw new Error(`reconcilia ${nombre}: total enrutado ${rutado} ≠ crudo ${crudo}`);
  console.log(`  ${nombre}: ${pares} pares (barrio×lema) == desglose crudo · total ${rutado.toLocaleString('es-UY')} ✅`);
}

/** Construye el ContiendaCatalogo desde un Acc. */
function contiendaCatalogo(acc: Acc): ContiendaCatalogo {
  const lemaNodos: NodoOpcion[] = [...acc.lemas.entries()].map(([id, etiqueta]) => ({ id, nivel: 'lema', etiqueta, partidoId: id }));
  const nodos = [...lemaNodos, ...acc.middle.values()];
  return { contienda: acc.contienda, niveles: acc.niveles, nodos, opciones: [...acc.opciones.values()] };
}

/** Zonas de un shard por (contienda, lema): barrios con votos de ese lema. */
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
