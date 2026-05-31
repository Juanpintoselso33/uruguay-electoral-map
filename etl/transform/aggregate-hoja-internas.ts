/**
 * Agrega votos de INTERNAS a nivel HOJA (v3, Epic 10) para una contienda (ODN u ODD).
 *
 * Mismo origen y mismo join CIRCUITO→BARRIO que el agregado por lema (Story 1.6):
 * `public/montevideo_{odn,odd}.csv` filtrado a ESCRUTINIO=Departamental. La diferencia
 * es la clave de agregación: (PARTIDO, PRECANDIDATO, HOJA, barrio) en vez de (PARTIDO, barrio).
 * Eso garantiza que Σ hojas de un lema en un barrio == el agregado por lema de ese barrio.
 *
 * Produce: el catálogo jerárquico de la contienda (nodos lema/precandidato + opciones hoja)
 * y un shard de votos por lema (lazy-load por lema). El roll-up hoja→precandidato→lema es exacto.
 */
import type {
  AgregadoZona,
  VotoOpcion,
  Contienda,
  NodoOpcion,
  OpcionHoja,
  ContiendaCatalogo,
} from '../../src/lib/contracts';
import { opcionIdHoja } from '../../src/lib/contracts';
import { normName, slug } from '../lib/normalize';

/** Marcadores no partidarios en la columna PARTIDO (no son hojas). */
const NO_PARTIDARIOS = new Set(['EN BLANCO', 'BLANCO', 'ANULADO', 'ANULADOS', 'OBSERVADO', 'OBSERVADOS']);

export interface AggregateHojaOptions {
  readonly contienda: Contienda;
  /** Si la escalera tiene nivel precandidato (ODN sí, ODD no). */
  readonly conPrecandidato: boolean;
  readonly escrutinioCanonico: string;
  readonly crvToBarrio: Record<string, string>;
}

export interface ShardLema {
  readonly lemaId: string;
  readonly zonas: AgregadoZona[];
}

export interface AggregateHojaResult {
  readonly contiendaCatalogo: ContiendaCatalogo;
  /** Un shard por lema (porOpcion = hojas de ese lema por barrio). */
  readonly shardsPorLema: ShardLema[];
  /** Σ de votos partidarios (a hoja). Para reconciliación/diagnóstico. */
  readonly totalCanonico: number;
  /** Votos cuyo circuito no tiene barrio en la mapping (bucket explícito). */
  readonly unmappedVotos: number;
  /** Reconciliación: barrio(normName) → lemaId → Σ votos del lema. */
  readonly lemaPorBarrio: Map<string, Map<string, number>>;
}

/** Resuelve el barrio de un circuito (tolera ceros a la izquierda / numérico). Igual que aggregate-by-circuito. */
function resolveBarrio(map: Record<string, string>, circuito: string): string | undefined {
  if (map[circuito]) return map[circuito];
  const n = Number(circuito);
  if (Number.isFinite(n) && map[String(n)]) return map[String(n)];
  return undefined;
}

/** "MARTÍNEZ MARUCA, Walter Gonzalo" → "Walter Gonzalo Martínez Maruca" (Title Case, acentos preservados). */
function nombrePrecandidato(raw: string): string {
  const t = raw.trim();
  const i = t.indexOf(',');
  const reordenado = i >= 0 ? `${t.slice(i + 1).trim()} ${t.slice(0, i).trim()}` : t;
  // Title Case Unicode-safe: `\b` es ASCII y rompe acentos (And\bÉS). Capitalizamos
  // la primera letra de cada palabra separando por espacios.
  return reordenado
    .toLocaleLowerCase('es-UY')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toLocaleUpperCase('es-UY') + w.slice(1))
    .join(' ');
}

export function aggregateHojaInternas(
  rows: Record<string, string>[],
  opts: AggregateHojaOptions,
): AggregateHojaResult {
  // barrio(norm) -> { display, lemas: Map<lemaId, Map<hoja, votos>> }
  const porBarrio = new Map<string, { display: string; lemas: Map<string, Map<string, number>> }>();
  const lemaNombre = new Map<string, string>(); // lemaId -> nombre PARTIDO
  const precandPorHoja = new Map<string, string>(); // `${lemaId}|${hoja}` -> precandNodeId
  const precandNombre = new Map<string, string>(); // precandNodeId -> display
  const lemaPorBarrio = new Map<string, Map<string, number>>();
  let totalCanonico = 0;
  let unmappedVotos = 0;

  for (const r of rows) {
    if (r['ESCRUTINIO'] !== opts.escrutinioCanonico) continue;
    const votos = Number(r['CNT_VOTOS']) || 0;
    if (votos < 0) continue;
    const partido = (r['PARTIDO'] ?? '').trim();
    if (!partido || NO_PARTIDARIOS.has(normName(partido))) continue; // no partidario → no es hoja
    const hoja = (r['HOJA'] ?? '').trim();
    if (!hoja) continue;

    const circuito = (r['CIRCUITO'] ?? '').trim();
    const barrio = resolveBarrio(opts.crvToBarrio, circuito);
    if (!barrio) {
      unmappedVotos += votos;
      continue;
    }
    totalCanonico += votos;

    const lemaId = slug(partido);
    lemaNombre.set(lemaId, partido);

    const bKey = normName(barrio);
    let entry = porBarrio.get(bKey);
    if (!entry) {
      entry = { display: barrio, lemas: new Map() };
      porBarrio.set(bKey, entry);
    }
    let hojas = entry.lemas.get(lemaId);
    if (!hojas) {
      hojas = new Map();
      entry.lemas.set(lemaId, hojas);
    }
    hojas.set(hoja, (hojas.get(hoja) ?? 0) + votos);

    // reconciliación por (barrio, lema)
    let lpb = lemaPorBarrio.get(bKey);
    if (!lpb) {
      lpb = new Map();
      lemaPorBarrio.set(bKey, lpb);
    }
    lpb.set(lemaId, (lpb.get(lemaId) ?? 0) + votos);

    if (opts.conPrecandidato) {
      const precRaw = (r['PRECANDIDATO'] ?? '').trim();
      if (precRaw && precRaw.toUpperCase() !== 'NO APLICA') {
        const precNodeId = `${lemaId}-${slug(precRaw)}`;
        precandPorHoja.set(`${lemaId}|${hoja}`, precNodeId);
        if (!precandNombre.has(precNodeId)) precandNombre.set(precNodeId, nombrePrecandidato(precRaw));
      }
    }
  }

  // --- Catálogo de la contienda: nodos (lema + precandidato) + opciones (hojas) ---
  const nodos: NodoOpcion[] = [];
  for (const [lemaId, nombre] of lemaNombre) {
    nodos.push({ id: lemaId, nivel: 'lema', etiqueta: nombre, partidoId: lemaId });
  }
  // precandidato nodes: parentId = su lemaId (lo recuperamos de la clave `${lemaId}|hoja`)
  const precParent = new Map<string, string>(); // precNodeId -> lemaId
  for (const [key, precNodeId] of precandPorHoja) {
    const lemaId = key.slice(0, key.indexOf('|'));
    precParent.set(precNodeId, lemaId);
  }
  for (const [precNodeId, lemaId] of precParent) {
    nodos.push({
      id: precNodeId,
      nivel: 'precandidato',
      etiqueta: precandNombre.get(precNodeId) ?? precNodeId,
      parentId: lemaId,
      partidoId: lemaId,
    });
  }

  // Opciones hoja: una por (lemaId, hoja) vista. Id compuesto derivable.
  const opcionesMap = new Map<string, OpcionHoja>();
  for (const entry of porBarrio.values()) {
    for (const [lemaId, hojas] of entry.lemas) {
      for (const hoja of hojas.keys()) {
        const id = opcionIdHoja(opts.contienda, lemaId, hoja);
        if (opcionesMap.has(id)) continue;
        const precandidatoId = opts.conPrecandidato ? precandPorHoja.get(`${lemaId}|${hoja}`) : undefined;
        opcionesMap.set(id, {
          clase: 'hoja',
          id,
          hoja,
          partidoId: lemaId,
          contienda: opts.contienda,
          lemaId,
          ...(precandidatoId ? { precandidatoId } : {}),
        });
      }
    }
  }

  const niveles = opts.conPrecandidato
    ? (['lema', 'precandidato', 'hoja'] as const)
    : (['lema', 'hoja'] as const);

  const contiendaCatalogo: ContiendaCatalogo = {
    contienda: opts.contienda,
    niveles,
    nodos,
    opciones: [...opcionesMap.values()],
  };

  // --- Shards por lema: para cada lema, zonas con sus hojas por barrio ---
  // lemaId -> barrio(display) -> Map<hoja, votos>
  const porLema = new Map<string, Map<string, Map<string, number>>>();
  for (const entry of porBarrio.values()) {
    for (const [lemaId, hojas] of entry.lemas) {
      let byBarrio = porLema.get(lemaId);
      if (!byBarrio) {
        byBarrio = new Map();
        porLema.set(lemaId, byBarrio);
      }
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
        opcionId: opcionIdHoja(opts.contienda, lemaId, hoja),
        votos: v,
      }));
      zonas.push({
        geoId: display,
        ganadorOpcionId: ranking.length ? opcionIdHoja(opts.contienda, lemaId, ranking[0][0]) : '',
        validos,
        porOpcion,
        noPartidarios: { enBlanco: 0, anulados: 0, observados: 0 },
      });
    }
    shardsPorLema.push({ lemaId, zonas });
  }

  return { contiendaCatalogo, shardsPorLema, totalCanonico, unmappedVotos, lemaPorBarrio };
}
