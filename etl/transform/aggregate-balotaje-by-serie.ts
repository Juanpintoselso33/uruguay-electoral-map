/**
 * Agrega votos del balotaje 2024 por SERIES — departamentos del interior.
 *
 * El CSV del balotaje (Corte Electoral 2024) tiene un schema diferente a los
 * formatos A/B/C de internas y nacionales: una fila por CRV con los votos ya
 * separados en columnas fijas TotalOrsiCosse / TotalDelgadoRipoll (sin columna
 * PARTIDO ni TIPO_REGISTRO). Las series exteriores siguen el patrón XZZ y se
 * excluyen antes de pasar las filas a esta función.
 *
 * Invariante de reconciliación: para cada fila no-exterior,
 *   TotalVotosEmitidos = TotalOrsiCosse + TotalDelgadoRipoll
 *                       + TotalEnBlanco + TotalAnulados + TotalVotosObservados
 *
 * El geoId emitido es la serie en minúsculas, igual que el patrón de internas-2024.
 */
import type { AgregadoZona, VotoOpcion } from '../../src/lib/contracts';

export interface BalotajeBySerieResult {
  zonas: AgregadoZona[];
  /** Suma de TotalVotosEmitidos de todas las filas (sin exterior). Para el gate de reconciliación. */
  totalCanonico: number;
  opciones: readonly { readonly opcionId: string; readonly nombre: string }[];
}

/** Catálogo fijo de opciones para balotaje 2024. */
export const OPCIONES_BALOTAJE = [
  { opcionId: 'frente-amplio', nombre: 'Frente Amplio' },
  { opcionId: 'coalicion-republicana', nombre: 'Coalición Republicana' },
] as const;

interface SerieAcc {
  orsi: number;
  coa: number;
  enBlanco: number;
  anulados: number;
  observados: number;
}

/**
 * Agrega filas del balotaje por SERIE → candidato fijo.
 *
 * @param rows  Filas del CSV ya filtradas al departamento y sin series exteriores (xZZ).
 *              Columnas esperadas: Serie, TotalOrsiCosse, TotalDelgadoRipoll,
 *              TotalEnBlanco, TotalAnulados, TotalVotosObservados, TotalVotosEmitidos.
 */
export function aggregateBalotajeBySerie(rows: Record<string, string>[]): BalotajeBySerieResult {
  const porSerie = new Map<string, SerieAcc>();
  let totalCanonico = 0;

  for (const r of rows) {
    const serieRaw = (r['Serie'] ?? '').trim();
    if (!serieRaw) continue;

    const orsi = Number(r['TotalOrsiCosse']) || 0;
    const coa = Number(r['TotalDelgadoRipoll']) || 0;
    const enBlanco = Number(r['TotalEnBlanco']) || 0;
    const anulados = Number(r['TotalAnulados']) || 0;
    const observados = Number(r['TotalVotosObservados']) || 0;
    const rowTotal = Number(r['TotalVotosEmitidos']) || 0;
    totalCanonico += rowTotal;

    // Una CRV puede abarcar múltiples series (e.g., "AAA AAB"). Distribuir pro-rata.
    const seriesCodes = serieRaw.split(/\s+/).filter(Boolean).map((s) => s.toLowerCase());
    const n = seriesCodes.length;

    for (let i = 0; i < seriesCodes.length; i++) {
      const geoId = seriesCodes[i];
      let acc = porSerie.get(geoId);
      if (!acc) {
        acc = { orsi: 0, coa: 0, enBlanco: 0, anulados: 0, observados: 0 };
        porSerie.set(geoId, acc);
      }
      if (n === 1) {
        acc.orsi += orsi;
        acc.coa += coa;
        acc.enBlanco += enBlanco;
        acc.anulados += anulados;
        acc.observados += observados;
      } else {
        // Pro-rata: distribución entera, el sobrante va a la primera serie.
        const distribute = (v: number): number => Math.floor(v / n) + (i === 0 ? v - Math.floor(v / n) * n : 0);
        acc.orsi += distribute(orsi);
        acc.coa += distribute(coa);
        acc.enBlanco += distribute(enBlanco);
        acc.anulados += distribute(anulados);
        acc.observados += distribute(observados);
      }
    }
  }

  const zonas: AgregadoZona[] = [];
  for (const [geoId, acc] of porSerie) {
    const validos = acc.orsi + acc.coa;
    const porOpcion: VotoOpcion[] = [
      { opcionId: 'frente-amplio', votos: acc.orsi },
      { opcionId: 'coalicion-republicana', votos: acc.coa },
    ];
    zonas.push({
      geoId,
      ganadorOpcionId: acc.orsi >= acc.coa ? 'frente-amplio' : 'coalicion-republicana',
      validos,
      porOpcion,
      noPartidarios: { enBlanco: acc.enBlanco, anulados: acc.anulados, observados: acc.observados },
    });
  }

  return { zonas, totalCanonico, opciones: OPCIONES_BALOTAJE };
}
