/**
 * Agrega votos por localidad — usando el mapping SERIE→localidad de Story 8.1.
 *
 * Las series (1:1 y ciudad-grande) se suman a la localidad correspondiente.
 * Series sin match en el mapping van al bucket `unmappedVotos`.
 * Compound SERIES (e.g. "MAA MAB") se distribuyen pro-rata igual que aggregateBySerie.
 */
import type { AgregadoZona, VotoOpcion } from '../../src/lib/contracts';
import { slug } from '../lib/normalize';
import type { SerieLocalidadEntry } from '../lib/serie-localidad';

export interface OpcionCatalogo {
  readonly opcionId: string;
  readonly nombre: string;
}

export interface AggregateByLocalidadResult {
  zonas: AgregadoZona[];
  totalCanonico: number;
  unmappedVotos: number;
  opciones: OpcionCatalogo[];
}

/**
 * Agrega filas (ya filtradas a HOJA_ODN + depto + sin exterior) por localidad.
 * El geoId emitido es `entry.localidad` (display name del mapping), que coincide
 * con `properties.name` del `localidad.topo.json` generado en Story 8.2.
 */
export function aggregateByLocalidad(
  rows: Record<string, string>[],
  serieLocalidadMap: SerieLocalidadEntry[],
): AggregateByLocalidadResult {
  const serieToLocalidad = new Map<string, string>();
  for (const entry of serieLocalidadMap) {
    serieToLocalidad.set(entry.serie.toUpperCase(), entry.localidad);
  }

  const porLocalidad = new Map<string, Map<string, number>>();
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
      const localidad = serieToLocalidad.get(seriesCodes[i]);
      if (!localidad) {
        unmappedVotos += share;
        continue;
      }
      let lemas = porLocalidad.get(localidad);
      if (!lemas) {
        lemas = new Map();
        porLocalidad.set(localidad, lemas);
      }
      lemas.set(lema, (lemas.get(lema) ?? 0) + share);
    }
  }

  const zonas: AgregadoZona[] = [];
  for (const [geoId, lemas] of porLocalidad) {
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
