/**
 * Agrega votos de NACIONALES a nivel HOJA para departamentos del interior — geoId = SERIE.
 *
 * Análogo a aggregateHojaNacionales (Montevideo, geoId = BARRIO), pero usa el campo
 * `Series` del CSV directamente como identificador geográfico. No requiere mapping CRV→barrio.
 *
 * CRVs multi-serie ("IAA IAB"): distribución equal floor+remainder, igual que
 * aggregateNacionalesSerie, garantizando reconciliación exacta contra votes.json lema.
 *
 * Devuelve el mismo tipo `AggregateHojaNacionalesResult` para reutilizar la lógica de
 * emit-shard / catalogo en el script orquestador.
 */
import type {
  AgregadoZona,
  VotoOpcion,
  NodoOpcion,
  OpcionHoja,
  ContiendaCatalogo,
} from '../../src/lib/contracts';
import { opcionIdHoja } from '../../src/lib/contracts';
import { slug } from '../lib/normalize';
import type { AggregateHojaNacionalesResult, ShardLema } from './aggregate-hoja-nacionales';

const VOTO_LEMA_HOJA = 'vl';

export function aggregateHojaNacionalesInterior(
  rows: Record<string, string>[],
  departamentoCode: string,
  exteriorSerie: string,
  hojaSublema?: Map<string, string>,
): AggregateHojaNacionalesResult {
  // serie(lower) → { display, lemas: Map<lemaId, Map<hoja, votos>> }
  const porSerie = new Map<string, { display: string; lemas: Map<string, Map<string, number>> }>();
  const lemaNombre = new Map<string, string>();
  const lemaPorBarrio = new Map<string, Map<string, number>>(); // serie → lema → Σvotos
  let totalCanonico = 0;

  for (const r of rows) {
    const tipo = r['TipoRegistro'];
    if (
      (tipo !== 'HOJA_EN' && tipo !== 'VOTO_LEMA') ||
      r['Departamento'] !== departamentoCode
    ) continue;

    const votos = Number(r['CantidadVotos']) || 0;
    if (votos < 0) continue;

    const serieRaw = (r['Series'] ?? '').trim().toUpperCase();
    if (!serieRaw || serieRaw === exteriorSerie.toUpperCase()) continue;

    const lemaRaw = (r['Lema'] ?? '').trim();
    const lemaDisplay = lemaRaw.replace(/^Partido\s+/i, '');
    if (!lemaDisplay) continue;

    const hoja = tipo === 'HOJA_EN' ? (r['Descripcion1'] ?? '').trim() : VOTO_LEMA_HOJA;
    if (!hoja) continue;

    const lemaId = slug(lemaDisplay);
    if (!lemaNombre.has(lemaId)) lemaNombre.set(lemaId, lemaDisplay);

    // Multi-serie: equal floor+remainder (mismo que aggregateNacionalesSerie)
    const series = serieRaw.split(/\s+/).map((s) => s.toLowerCase());
    const n = series.length;
    const base = Math.floor(votos / n);
    const rem = votos - base * n;

    for (let i = 0; i < series.length; i++) {
      const geoId = series[i];
      const share = base + (i === 0 ? rem : 0);
      if (share === 0) continue;
      totalCanonico += share;

      let entry = porSerie.get(geoId);
      if (!entry) { entry = { display: geoId, lemas: new Map() }; porSerie.set(geoId, entry); }
      let hojas = entry.lemas.get(lemaId);
      if (!hojas) { hojas = new Map(); entry.lemas.set(lemaId, hojas); }
      hojas.set(hoja, (hojas.get(hoja) ?? 0) + share);

      let lps = lemaPorBarrio.get(geoId);
      if (!lps) { lps = new Map(); lemaPorBarrio.set(geoId, lps); }
      lps.set(lemaId, (lps.get(lemaId) ?? 0) + share);
    }
  }

  // Catálogo: nodos lema + sublema (si hay) + opciones hoja
  const conSublema = !!hojaSublema && hojaSublema.size > 0;
  const nodos: NodoOpcion[] = [];
  for (const [lemaId, nombre] of lemaNombre) {
    nodos.push({ id: lemaId, nivel: 'lema', etiqueta: nombre, partidoId: lemaId });
  }
  const sublemaNodeId = (lemaId: string, sublema: string): string => `${lemaId}-sl-${slug(sublema)}`;
  const sublemaVista = new Set<string>();
  const opcionesMap = new Map<string, OpcionHoja>();
  for (const entry of porSerie.values()) {
    for (const [lemaId, hojas] of entry.lemas) {
      for (const hoja of hojas.keys()) {
        const id = opcionIdHoja('unica', lemaId, hoja);
        if (opcionesMap.has(id)) continue;
        const sub = conSublema && hoja !== VOTO_LEMA_HOJA ? (hojaSublema!.get(hoja) ?? '') : '';
        const real = sub && sub.toLowerCase() !== 'no aplica' ? sub : '';
        const op: OpcionHoja = { clase: 'hoja', id, hoja, partidoId: lemaId, contienda: 'unica', lemaId };
        if (real) {
          const subId = sublemaNodeId(lemaId, real);
          if (!sublemaVista.has(subId)) {
            sublemaVista.add(subId);
            nodos.push({ id: subId, nivel: 'sublema', etiqueta: real, parentId: lemaId });
          }
          (op as { sublemaId?: string }).sublemaId = subId;
          (op as { grupoId?: string }).grupoId = subId;
        }
        opcionesMap.set(id, op);
      }
    }
  }
  const contiendaCatalogo: ContiendaCatalogo = conSublema
    ? { contienda: 'unica', niveles: ['lema', 'sublema', 'hoja'], nodos, opciones: [...opcionesMap.values()] }
    : { contienda: 'unica', niveles: ['lema', 'hoja'], nodos, opciones: [...opcionesMap.values()], degradado: true };

  // Shards por lema
  const porLema = new Map<string, Map<string, Map<string, number>>>();
  for (const entry of porSerie.values()) {
    for (const [lemaId, hojas] of entry.lemas) {
      let bySerie = porLema.get(lemaId);
      if (!bySerie) { bySerie = new Map(); porLema.set(lemaId, bySerie); }
      bySerie.set(entry.display, hojas);
    }
  }
  const shardsPorLema: ShardLema[] = [];
  for (const [lemaId, bySerie] of porLema) {
    const zonas: AgregadoZona[] = [];
    for (const [display, hojas] of bySerie) {
      const ranking = [...hojas.entries()].sort((a, b) => b[1] - a[1]);
      const validos = ranking.reduce((s, [, v]) => s + v, 0);
      const porOpcion: VotoOpcion[] = ranking.map(([hoja, v]) => ({
        opcionId: opcionIdHoja('unica', lemaId, hoja),
        votos: v,
      }));
      zonas.push({
        geoId: display,
        ganadorOpcionId: ranking.length ? opcionIdHoja('unica', lemaId, ranking[0][0]) : '',
        validos,
        porOpcion,
        noPartidarios: { enBlanco: 0, anulados: 0, observados: 0 },
      });
    }
    shardsPorLema.push({ lemaId, zonas });
  }

  return { contiendaCatalogo, shardsPorLema, totalCanonico, unmappedVotos: 0, lemaPorBarrio };
}
