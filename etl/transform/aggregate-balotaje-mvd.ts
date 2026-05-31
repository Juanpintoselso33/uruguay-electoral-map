/**
 * Agrega votos del balotaje 2024 para Montevideo por CRV → BARRIO.
 *
 * Reutiliza el mapping circuito→barrio generado por etl:montevideo (Story 1.6).
 * Los candidatos están en columnas fijas (no en columna PARTIDO), sin TIPO_REGISTRO.
 * CRVs sin barrio en el mapping van al bucket unmapped (no se descartan).
 */
import type { AgregadoZona, VotoOpcion } from '../../src/lib/contracts';
import { OPCIONES_BALOTAJE } from './aggregate-balotaje-by-serie';

export interface BalotajeMvdResult {
  zonas: AgregadoZona[];
  /** Suma de TotalVotosEmitidos de todas las filas procesadas. Para reconciliación. */
  totalCanonico: number;
  /** Votos de CRVs sin barrio en el mapping. */
  unmappedVotos: number;
  /** CRVs distintos sin barrio (diagnóstico). */
  crvsSinBarrio: string[];
  opciones: readonly { readonly opcionId: string; readonly nombre: string }[];
}

interface BarrioAcc {
  display: string;
  orsi: number;
  coa: number;
  enBlanco: number;
  anulados: number;
  observados: number;
}

/**
 * @param rows         Filas del CSV ya filtradas a Departamento=MO y sin serie BZZ.
 * @param crvToBarrio  Mapping CRV(string) → nombre de barrio (de montevideo-circuito-barrio.json).
 */
export function aggregateBalotajeMvd(
  rows: Record<string, string>[],
  crvToBarrio: Record<string, string>,
): BalotajeMvdResult {
  const porBarrio = new Map<string, BarrioAcc>();
  const crvsSinBarrio = new Set<string>();
  let totalCanonico = 0;
  let unmappedVotos = 0;

  for (const r of rows) {
    const rowTotal = Number(r['TotalVotosEmitidos']) || 0;
    totalCanonico += rowTotal;

    const crv = (r['CRV'] ?? '').trim();
    if (!crv) {
      crvsSinBarrio.add('(vacío)');
      unmappedVotos += rowTotal;
      continue;
    }
    const numKey = Number.isFinite(Number(crv)) ? String(Number(crv)) : undefined;
    const barrio = crvToBarrio[crv] ?? (numKey !== undefined ? crvToBarrio[numKey] : undefined);
    if (!barrio) {
      crvsSinBarrio.add(crv);
      unmappedVotos += rowTotal;
      continue;
    }

    const orsi = Number(r['TotalOrsiCosse']) || 0;
    const coa = Number(r['TotalDelgadoRipoll']) || 0;
    const enBlanco = Number(r['TotalEnBlanco']) || 0;
    const anulados = Number(r['TotalAnulados']) || 0;
    const observados = Number(r['TotalVotosObservados']) || 0;

    let acc = porBarrio.get(barrio);
    if (!acc) {
      acc = { display: barrio, orsi: 0, coa: 0, enBlanco: 0, anulados: 0, observados: 0 };
      porBarrio.set(barrio, acc);
    }
    acc.orsi += orsi;
    acc.coa += coa;
    acc.enBlanco += enBlanco;
    acc.anulados += anulados;
    acc.observados += observados;
  }

  const zonas: AgregadoZona[] = [];
  for (const [, acc] of porBarrio) {
    const validos = acc.orsi + acc.coa;
    const porOpcion: VotoOpcion[] = [
      { opcionId: 'frente-amplio', votos: acc.orsi },
      { opcionId: 'coalicion-republicana', votos: acc.coa },
    ];
    zonas.push({
      geoId: acc.display,
      ganadorOpcionId: acc.orsi >= acc.coa ? 'frente-amplio' : 'coalicion-republicana',
      validos,
      porOpcion,
      noPartidarios: { enBlanco: acc.enBlanco, anulados: acc.anulados, observados: acc.observados },
    });
  }

  return {
    zonas,
    totalCanonico,
    unmappedVotos,
    crvsSinBarrio: [...crvsSinBarrio],
    opciones: OPCIONES_BALOTAJE,
  };
}
