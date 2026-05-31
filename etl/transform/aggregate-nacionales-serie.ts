/**
 * Agrega votos de nacionales (desglose-de-votos.csv) por SERIES — departamentos del interior.
 *
 * El CSV de nacionales usa columnas en mixed-case (TipoRegistro, Departamento, CRV,
 * Series, Lema, Descripcion1, CantidadVotos), diferente a internas-2024 (UPPERCASE).
 *
 * Se suman ambos tipos de registro sin doble conteo:
 *  HOJA_EN   — voto a una lista específica, atribuido al Lema.
 *  VOTO_LEMA — voto directo al lema (sin lista); mutuamente exclusivos con HOJA_EN.
 *
 * Normalización de lema: se elimina el prefijo "Partido " para que los opcionIds
 * coincidan con los generados por aggregateNacionalesMvd (nacionales-2019/2024 Montevideo).
 *
 * El geoId emitido es el código de serie en minúsculas. Para CRVs que abarcan múltiples
 * series (e.g., "IAA IAB"), se hace pro-rata entero igual que aggregateBySerie (internas).
 */
import type { AgregadoZona, VotoOpcion } from '../../src/lib/contracts';
import { slug } from '../lib/normalize';

export interface AggregateNacionalesSerieResult {
  zonas: AgregadoZona[];
  totalCanonico: number;
  unmappedVotos: number;
  opciones: { opcionId: string; nombre: string }[];
}

/**
 * Agrega filas por SERIES → LEMA (nivel lema, opcionId = slug del lema sin prefijo).
 *
 * @param rows Filas del CSV nacionales ya filtradas: solo HOJA_EN|VOTO_LEMA del departamento,
 *             sin series exteriores (patrón XZZ).
 */
export function aggregateNacionalesSerie(
  rows: Record<string, string>[],
): AggregateNacionalesSerieResult {
  const porSerie = new Map<string, Map<string, number>>();
  const opcionesPorId = new Map<string, string>();
  let totalCanonico = 0;

  for (const r of rows) {
    const serieRaw = (r['Series'] ?? '').trim();
    const lemaRaw = (r['Lema'] ?? '').trim();
    const lemaDisplay = lemaRaw.replace(/^Partido\s+/i, '');
    const votos = Number(r['CantidadVotos']);
    if (!serieRaw || !lemaDisplay || !Number.isFinite(votos) || votos < 0) continue;
    totalCanonico += votos;
    if (votos === 0) continue;

    const opcionId = slug(lemaDisplay);
    opcionesPorId.set(opcionId, lemaDisplay);

    // Una CRV puede abarcar múltiples series (e.g., "IAA IAB"). Distribuir pro-rata entero.
    const seriesCodes = serieRaw.split(/\s+/).map((s) => s.toLowerCase());
    const n = seriesCodes.length;
    const base = Math.floor(votos / n);
    const rem = votos - base * n;

    for (let i = 0; i < seriesCodes.length; i++) {
      const geoId = seriesCodes[i];
      const share = base + (i === 0 ? rem : 0);
      if (share === 0) continue;
      let lemas = porSerie.get(geoId);
      if (!lemas) {
        lemas = new Map();
        porSerie.set(geoId, lemas);
      }
      lemas.set(opcionId, (lemas.get(opcionId) ?? 0) + share);
    }
  }

  const zonas: AgregadoZona[] = [];
  for (const [geoId, lemas] of porSerie) {
    const ranking = [...lemas.entries()].sort((a, b) => b[1] - a[1]);
    const validos = ranking.reduce((s, [, v]) => s + v, 0);
    const porOpcion: VotoOpcion[] = ranking.map(([opcionId, v]) => ({ opcionId, votos: v }));
    zonas.push({
      geoId,
      ganadorOpcionId: ranking.length ? ranking[0][0] : '',
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
