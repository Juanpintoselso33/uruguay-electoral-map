/**
 * Agrega votos por SERIES (unidad geográfica del interior) — Rivera y similares.
 *
 * Para departamentos del interior la unidad de mapeo es la SERIE ELECTORAL
 * (no el barrio). La fuente canónica es `desglose-de-votos.csv` filtrado a
 * TIPO_REGISTRO=HOJA_ODN + DEPARTAMENTO=XX + sin SERIES=HZZ (exterior).
 * No hay join circuito→barrio; la clave geográfica sale directo de SERIES.
 */
import type { AgregadoZona, VotoOpcion } from '../../src/lib/contracts';
import { slug } from '../lib/normalize';

export interface OpcionCatalogo {
  readonly opcionId: string;
  readonly nombre: string;
}

export interface AggregateBySerieResult {
  zonas: AgregadoZona[];
  totalCanonico: number;
  unmappedVotos: number;
  opciones: OpcionCatalogo[];
}

/**
 * Agrega filas (ya filtradas a HOJA_ODN + depto + sin exterior) por SERIES → LEMA.
 * El geoId emitido es la serie en minúsculas (coincide con `properties.name` del TopoJSON).
 */
export function aggregateBySerie(rows: Record<string, string>[]): AggregateBySerieResult {
  const porSerie = new Map<string, Map<string, number>>();
  const opcionesPorId = new Map<string, string>();
  let totalCanonico = 0;

  for (const r of rows) {
    const serieRaw = (r['SERIES'] ?? '').trim();
    const lema = (r['LEMA'] ?? '').trim();
    const votos = Number(r['CANTIDAD_VOTOS']);
    if (!serieRaw || !lema || !Number.isFinite(votos) || votos < 0) continue;
    totalCanonico += votos;
    if (votos === 0) continue;

    // Algunos circuitos consolidan múltiples series en un solo registro (e.g. "PBB PBC").
    // Expandir: distribuir los votos entre cada código de serie de forma pro-rata.
    const seriesCodes = serieRaw.split(/\s+/).map((s) => s.toLowerCase());
    const n = seriesCodes.length;
    const base = Math.floor(votos / n);
    const rem = votos - base * n;

    opcionesPorId.set(slug(lema), lema);
    for (let i = 0; i < seriesCodes.length; i++) {
      const geoId = seriesCodes[i];
      const share = base + (i === 0 ? rem : 0);
      if (share === 0) continue;
      let lemas = porSerie.get(geoId);
      if (!lemas) {
        lemas = new Map();
        porSerie.set(geoId, lemas);
      }
      lemas.set(lema, (lemas.get(lema) ?? 0) + share);
    }
  }

  const zonas: AgregadoZona[] = [];
  for (const [geoId, lemas] of porSerie) {
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
    unmappedVotos: 0,
    opciones: [...opcionesPorId.entries()].map(([opcionId, nombre]) => ({ opcionId, nombre })),
  };
}
