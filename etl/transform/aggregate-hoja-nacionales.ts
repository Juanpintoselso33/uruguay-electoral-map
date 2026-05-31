/**
 * Agrega votos de NACIONALES a nivel HOJA (Story 10.7, Epic 10) — geoId = BARRIO (Montevideo).
 *
 * Mismo origen y join CRV→BARRIO que el agregado por lema de nacionales (Story 4.1,
 * `aggregateNacionalesMvd`). La diferencia: clave (lema, hoja) en vez de solo lema.
 *  - HOJA_EN  → voto a una hoja (Descripcion1 = nº de hoja).
 *  - VOTO_LEMA → voto al lema sin lista → pseudo-hoja "Voto al lema" (no se pierde).
 * Lema lleva prefijo "Partido " que se elimina antes del slug (igual que el agregado por lema).
 *
 * Escalera nacionales = ['lema','sublema','hoja']. Si se pasa `hojaSublema` (Story 10.8, desde la
 * integración de hojas), se puebla el nivel `sublema`; si no, se emite DEGRADADA a ['lema','hoja']
 * con `degradado: true` (fallback histórico de Story 10.7).
 */
import type {
  AgregadoZona,
  VotoOpcion,
  NodoOpcion,
  OpcionHoja,
  ContiendaCatalogo,
} from '../../src/lib/contracts';
import { opcionIdHoja } from '../../src/lib/contracts';
import { normName, slug } from '../lib/normalize';

const VOTO_LEMA_HOJA = 'vl'; // marcador de pseudo-hoja "Voto al lema"

export interface ShardLema {
  readonly lemaId: string;
  readonly zonas: AgregadoZona[];
}
export interface AggregateHojaNacionalesResult {
  readonly contiendaCatalogo: ContiendaCatalogo;
  readonly shardsPorLema: ShardLema[];
  readonly totalCanonico: number;
  readonly unmappedVotos: number;
  /** Reconciliación: barrio(normName) → lemaId → Σ votos. */
  readonly lemaPorBarrio: Map<string, Map<string, number>>;
}

function resolveBarrio(map: Record<string, string>, crv: string): string | undefined {
  if (map[crv]) return map[crv];
  const n = Number(crv);
  if (Number.isFinite(n) && map[String(n)]) return map[String(n)];
  return undefined;
}

export function aggregateHojaNacionales(
  rows: Record<string, string>[],
  crvToBarrio: Record<string, string>,
  departamentoCode = 'MO',
  /** hoja(nº) → sublema legible (de la integración de hojas, Story 10.8). Ausente = escalera degradada. */
  hojaSublema?: Map<string, string>,
): AggregateHojaNacionalesResult {
  // barrio(norm) → { display, lemas: Map<lemaId, Map<hoja, votos>> }
  const porBarrio = new Map<string, { display: string; lemas: Map<string, Map<string, number>> }>();
  const lemaNombre = new Map<string, string>();
  const lemaPorBarrio = new Map<string, Map<string, number>>();
  let totalCanonico = 0;
  let unmappedVotos = 0;

  for (const r of rows) {
    const tipo = r['TipoRegistro'];
    if ((tipo !== 'HOJA_EN' && tipo !== 'VOTO_LEMA') || r['Departamento'] !== departamentoCode) continue;
    const votos = Number(r['CantidadVotos']) || 0;
    if (votos < 0) continue;

    const lemaRaw = (r['Lema'] ?? '').trim();
    const lemaDisplay = lemaRaw.replace(/^Partido\s+/i, '');
    if (!lemaDisplay) continue;
    const hoja = tipo === 'HOJA_EN' ? (r['Descripcion1'] ?? '').trim() : VOTO_LEMA_HOJA;
    if (!hoja) continue;

    const crv = (r['CRV'] ?? '').trim();
    const barrio = resolveBarrio(crvToBarrio, crv);
    if (!barrio) { unmappedVotos += votos; continue; }
    totalCanonico += votos;

    const lemaId = slug(lemaDisplay);
    if (!lemaNombre.has(lemaId)) lemaNombre.set(lemaId, lemaDisplay);

    const bKey = normName(barrio);
    let entry = porBarrio.get(bKey);
    if (!entry) { entry = { display: barrio, lemas: new Map() }; porBarrio.set(bKey, entry); }
    let hojas = entry.lemas.get(lemaId);
    if (!hojas) { hojas = new Map(); entry.lemas.set(lemaId, hojas); }
    hojas.set(hoja, (hojas.get(hoja) ?? 0) + votos);

    let lpb = lemaPorBarrio.get(bKey);
    if (!lpb) { lpb = new Map(); lemaPorBarrio.set(bKey, lpb); }
    lpb.set(lemaId, (lpb.get(lemaId) ?? 0) + votos);
  }

  // --- Catálogo: nodos lema (+ sublema si hay dato) + opciones hoja ---
  const conSublema = !!hojaSublema && hojaSublema.size > 0;
  const nodos: NodoOpcion[] = [];
  for (const [lemaId, nombre] of lemaNombre) {
    nodos.push({ id: lemaId, nivel: 'lema', etiqueta: nombre, partidoId: lemaId });
  }
  // Nodo sublema por (lemaId, sublema) — id estable, scope contienda 'unica'.
  const sublemaNodeId = (lemaId: string, sublema: string): string => `${lemaId}-sl-${slug(sublema)}`;
  const sublemaVista = new Set<string>();
  const opcionesMap = new Map<string, OpcionHoja>();
  for (const entry of porBarrio.values()) {
    for (const [lemaId, hojas] of entry.lemas) {
      for (const hoja of hojas.keys()) {
        const id = opcionIdHoja('unica', lemaId, hoja);
        if (opcionesMap.has(id)) continue;
        // sublema de la hoja (vacío para 'vl' / "No aplica" → cuelga directo del lema).
        const sub = conSublema && hoja !== VOTO_LEMA_HOJA ? (hojaSublema!.get(hoja) ?? '') : '';
        const real = sub && sub.toLowerCase() !== 'no aplica' ? sub : '';
        const op: OpcionHoja = { clase: 'hoja', id, hoja, partidoId: lemaId, contienda: 'unica', lemaId };
        if (real) {
          const subId = sublemaNodeId(lemaId, real);
          if (!sublemaVista.has(subId)) {
            sublemaVista.add(subId);
            nodos.push({ id: subId, nivel: 'sublema', etiqueta: real, parentId: lemaId });
          }
          (op as { sublemaId?: string; grupoId?: string }).sublemaId = subId;
          (op as { grupoId?: string }).grupoId = subId;
        }
        opcionesMap.set(id, op);
      }
    }
  }
  const contiendaCatalogo: ContiendaCatalogo = conSublema
    ? { contienda: 'unica', niveles: ['lema', 'sublema', 'hoja'], nodos, opciones: [...opcionesMap.values()] }
    : { contienda: 'unica', niveles: ['lema', 'hoja'], nodos, opciones: [...opcionesMap.values()], degradado: true };

  // --- Shards por lema ---
  const porLema = new Map<string, Map<string, Map<string, number>>>();
  for (const entry of porBarrio.values()) {
    for (const [lemaId, hojas] of entry.lemas) {
      let byBarrio = porLema.get(lemaId);
      if (!byBarrio) { byBarrio = new Map(); porLema.set(lemaId, byBarrio); }
      byBarrio.set(entry.display, hojas);
    }
  }
  const shardsPorLema: ShardLema[] = [];
  for (const [lemaId, byBarrio] of porLema) {
    const zonas: AgregadoZona[] = [];
    for (const [display, hojas] of byBarrio) {
      const ranking = [...hojas.entries()].sort((a, b) => b[1] - a[1]);
      const validos = ranking.reduce((s, [, v]) => s + v, 0);
      const porOpcion: VotoOpcion[] = ranking.map(([hoja, v]) => ({
        opcionId: opcionIdHoja('unica', lemaId, hoja), votos: v,
      }));
      zonas.push({
        geoId: display,
        ganadorOpcionId: ranking.length ? opcionIdHoja('unica', lemaId, ranking[0][0]) : '',
        validos, porOpcion, noPartidarios: { enBlanco: 0, anulados: 0, observados: 0 },
      });
    }
    shardsPorLema.push({ lemaId, zonas });
  }

  return { contiendaCatalogo, shardsPorLema, totalCanonico, unmappedVotos, lemaPorBarrio };
}
