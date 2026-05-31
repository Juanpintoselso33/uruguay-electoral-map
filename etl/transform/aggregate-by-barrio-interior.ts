/**
 * Agrega votos por barrio — usando el mapping SERIE→barrio para ciudades grandes del interior.
 *
 * Solo las series en el mapping contribuyen; el resto va a unmappedVotos.
 * Compound SERIES (espacio-separadas) se distribuyen pro-rata igual que aggregateBySerie.
 */
import type { AgregadoZona, VotoOpcion } from '../../src/lib/contracts';
import { slug } from '../lib/normalize';
import type { SerieBarrioEntry } from '../lib/serie-barrio';

export interface OpcionCatalogo {
  readonly opcionId: string;
  readonly nombre: string;
}

export interface AggregateByBarrioResult {
  zonas: AgregadoZona[];
  totalCanonico: number;
  unmappedVotos: number;
  opciones: OpcionCatalogo[];
}

/**
 * Agrega filas (ya filtradas a HOJA_ODN + depto + sin exterior) por barrio.
 * El geoId emitido es `entry.barrio`, que debe coincidir con `properties.name`
 * del `barrio.topo.json` generado en el paso de geometría.
 */
export function aggregateByBarrioInterior(
  rows: Record<string, string>[],
  serieBarrioMap: SerieBarrioEntry[],
): AggregateByBarrioResult {
  const serieToBarrio = new Map<string, string>();
  for (const entry of serieBarrioMap) {
    serieToBarrio.set(entry.serie.toUpperCase(), entry.barrio);
  }

  const porBarrio = new Map<string, Map<string, number>>();
  const opcionesPorId = new Map<string, string>();
  let totalCanonico = 0;
  let unmappedVotos = 0;

  for (const r of rows) {
    const serieRaw = (r['SERIES'] ?? '').trim();
    const lema = (r['LEMA'] ?? '').trim();
    const votos = Number(r['CANTIDAD_VOTOS']);
    if (!serieRaw || !lema || !Number.isFinite(votos) || votos < 0) continue;
    totalCanonico += votos;
    if (votos === 0) continue;

    const seriesCodes = serieRaw.split(/\s+/).map((s) => s.toUpperCase());
    const n = seriesCodes.length;
    const base = Math.floor(votos / n);
    const rem = votos - base * n;

    opcionesPorId.set(slug(lema), lema);
    for (let i = 0; i < seriesCodes.length; i++) {
      const share = base + (i === 0 ? rem : 0);
      if (share === 0) continue;
      const barrio = serieToBarrio.get(seriesCodes[i]);
      if (!barrio) {
        unmappedVotos += share;
        continue;
      }
      let lemas = porBarrio.get(barrio);
      if (!lemas) {
        lemas = new Map();
        porBarrio.set(barrio, lemas);
      }
      lemas.set(lema, (lemas.get(lema) ?? 0) + share);
    }
  }

  const zonas: AgregadoZona[] = [];
  for (const [geoId, lemas] of porBarrio) {
    const ranking = [...lemas.entries()].sort((a, b) => b[1] - a[1]);
    const validos = ranking.reduce((s, [, v]) => s + v, 0);
    const porOpcion: VotoOpcion[] = ranking.map(([lema, v]) => ({ opcionId: slug(lema), votos: v }));
    zonas.push({
      geoId,
      ganadorOpcionId: ranking.length ? slug(ranking[0][0]) : '',
      validos,
      porOpcion,
      noPartidarios: { enBlanco: 0, anulados: 0, observados: 0 },
    });
  }

  return {
    zonas,
    totalCanonico,
    unmappedVotos,
    opciones: [...opcionesPorId.entries()].map(([opcionId, nombre]) => ({ opcionId, nombre })),
  };
}
