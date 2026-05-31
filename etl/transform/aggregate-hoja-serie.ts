/**
 * Agrega votos de INTERNAS a nivel HOJA para el INTERIOR (geoId = SERIE) — Story 10.6.
 *
 * Mismo origen y misma lógica de series combinadas (pro-rata) que `aggregateBySerie`
 * (Story 1.x): `desglose-de-votos.csv` filtrado por depto + TIPO_REGISTRO. La diferencia
 * con el agregado por lema es la clave: (LEMA, DESCRIPCIÓN_1=precandidato, DESCRIPCIÓN_2=hoja)
 * en vez de solo LEMA. Replicar el pro-rata EXACTO garantiza reconciliación con el serie.
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
import { slug } from '../lib/normalize';

const COL_PREC = 'DESCRIPCIÓN_1';
const COL_HOJA = 'DESCRIPCIÓN_2';

export interface AggregateHojaSerieOptions {
  readonly contienda: Contienda;
  readonly conPrecandidato: boolean; // ODN sí, ODD no
}

export interface ShardLema {
  readonly lemaId: string;
  readonly zonas: AgregadoZona[];
}

export interface AggregateHojaSerieResult {
  readonly contiendaCatalogo: ContiendaCatalogo;
  readonly shardsPorLema: ShardLema[];
  readonly totalCanonico: number;
  /** Reconciliación: serie → lemaId → Σ votos. */
  readonly lemaPorSerie: Map<string, Map<string, number>>;
}

/** Title-Case Unicode-safe (la 1ª letra de cada palabra). */
function titleCase(s: string): string {
  return s
    .trim()
    .toLocaleLowerCase('es-UY')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toLocaleUpperCase('es-UY') + w.slice(1))
    .join(' ');
}

/** "APELLIDO, Nombre" → "Nombre Apellido" Title-Case. */
function nombrePrecandidato(raw: string): string {
  const t = raw.trim();
  const i = t.indexOf(',');
  return titleCase(i >= 0 ? `${t.slice(i + 1).trim()} ${t.slice(0, i).trim()}` : t);
}

export function aggregateHojaSerie(
  rows: Record<string, string>[],
  opts: AggregateHojaSerieOptions,
): AggregateHojaSerieResult {
  // serie → lemaId → hoja → votos
  const porSerie = new Map<string, Map<string, Map<string, number>>>();
  const lemaNombre = new Map<string, string>();
  const precandPorHoja = new Map<string, string>(); // `${lemaId}|${hoja}` → precNodeId
  const precandNombre = new Map<string, string>();
  const lemaPorSerie = new Map<string, Map<string, number>>();
  let totalCanonico = 0;

  for (const r of rows) {
    const serieRaw = (r['SERIES'] ?? '').trim();
    const lema = (r['LEMA'] ?? '').trim();
    const hoja = (r[COL_HOJA] ?? '').trim();
    const votos = Number(r['CANTIDAD_VOTOS']);
    if (!serieRaw || !lema || !hoja || !Number.isFinite(votos) || votos < 0) continue;
    totalCanonico += votos;
    if (votos === 0) continue;

    const seriesCodes = serieRaw.split(/\s+/).map((s) => s.toLowerCase());
    const n = seriesCodes.length;
    const base = Math.floor(votos / n);
    const rem = votos - base * n;

    const lemaId = slug(lema);
    if (!lemaNombre.has(lemaId)) lemaNombre.set(lemaId, titleCase(lema));

    if (opts.conPrecandidato) {
      const precRaw = (r[COL_PREC] ?? '').trim();
      if (precRaw && precRaw.toUpperCase() !== 'NO APLICA') {
        const precNodeId = `${lemaId}-${slug(precRaw)}`;
        precandPorHoja.set(`${lemaId}|${hoja}`, precNodeId);
        if (!precandNombre.has(precNodeId)) precandNombre.set(precNodeId, nombrePrecandidato(precRaw));
      }
    }

    for (let i = 0; i < seriesCodes.length; i++) {
      const geoId = seriesCodes[i];
      const share = base + (i === 0 ? rem : 0);
      if (share === 0) continue;
      let byLema = porSerie.get(geoId);
      if (!byLema) { byLema = new Map(); porSerie.set(geoId, byLema); }
      let byHoja = byLema.get(lemaId);
      if (!byHoja) { byHoja = new Map(); byLema.set(lemaId, byHoja); }
      byHoja.set(hoja, (byHoja.get(hoja) ?? 0) + share);
      let lpb = lemaPorSerie.get(geoId);
      if (!lpb) { lpb = new Map(); lemaPorSerie.set(geoId, lpb); }
      lpb.set(lemaId, (lpb.get(lemaId) ?? 0) + share);
    }
  }

  // --- Catálogo: nodos (lema + precandidato) + opciones (hojas) ---
  const nodos: NodoOpcion[] = [];
  for (const [lemaId, nombre] of lemaNombre) {
    nodos.push({ id: lemaId, nivel: 'lema', etiqueta: nombre, partidoId: lemaId });
  }
  const precParent = new Map<string, string>();
  for (const [key, precNodeId] of precandPorHoja) precParent.set(precNodeId, key.slice(0, key.indexOf('|')));
  for (const [precNodeId, lemaId] of precParent) {
    nodos.push({
      id: precNodeId, nivel: 'precandidato', etiqueta: precandNombre.get(precNodeId) ?? precNodeId,
      parentId: lemaId, partidoId: lemaId,
    });
  }

  const opcionesMap = new Map<string, OpcionHoja>();
  for (const byLema of porSerie.values()) {
    for (const [lemaId, hojas] of byLema) {
      for (const hoja of hojas.keys()) {
        const id = opcionIdHoja(opts.contienda, lemaId, hoja);
        if (opcionesMap.has(id)) continue;
        const precandidatoId = opts.conPrecandidato ? precandPorHoja.get(`${lemaId}|${hoja}`) : undefined;
        opcionesMap.set(id, {
          clase: 'hoja', id, hoja, partidoId: lemaId, contienda: opts.contienda, lemaId,
          ...(precandidatoId ? { precandidatoId } : {}),
        });
      }
    }
  }

  const niveles = opts.conPrecandidato
    ? (['lema', 'precandidato', 'hoja'] as const)
    : (['lema', 'hoja'] as const);
  const contiendaCatalogo: ContiendaCatalogo = {
    contienda: opts.contienda, niveles, nodos, opciones: [...opcionesMap.values()],
  };

  // --- Shards por lema (geoId = serie) ---
  const porLema = new Map<string, Map<string, Map<string, number>>>(); // lemaId → serie → hoja → votos
  for (const [geoId, byLema] of porSerie) {
    for (const [lemaId, hojas] of byLema) {
      let bySerie = porLema.get(lemaId);
      if (!bySerie) { bySerie = new Map(); porLema.set(lemaId, bySerie); }
      bySerie.set(geoId, hojas);
    }
  }
  const shardsPorLema: ShardLema[] = [];
  for (const [lemaId, bySerie] of porLema) {
    const zonas: AgregadoZona[] = [];
    for (const [geoId, hojas] of bySerie) {
      const ranking = [...hojas.entries()].sort((a, b) => b[1] - a[1]);
      const validos = ranking.reduce((s, [, v]) => s + v, 0);
      const porOpcion: VotoOpcion[] = ranking.map(([hoja, v]) => ({
        opcionId: opcionIdHoja(opts.contienda, lemaId, hoja), votos: v,
      }));
      zonas.push({
        geoId,
        ganadorOpcionId: ranking.length ? opcionIdHoja(opts.contienda, lemaId, ranking[0][0]) : '',
        validos, porOpcion, noPartidarios: { enBlanco: 0, anulados: 0, observados: 0 },
      });
    }
    shardsPorLema.push({ lemaId, zonas });
  }

  return { contiendaCatalogo, shardsPorLema, totalCanonico, lemaPorSerie };
}
