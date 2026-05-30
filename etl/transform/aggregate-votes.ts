/**
 * Normaliza y agrega votos del CSV a `AgregadoZona[]` (nivel partido/lema).
 * Voto canónico: etapa definitiva (en este dataset, 'Departamental'). Nunca suma etapas.
 */
import type { AgregadoZona, VotoOpcion } from '../../src/lib/contracts';
import { normName, slug } from '../lib/normalize';

/** Marcadores de categorías no partidarias en la columna PARTIDO (si aparecen). */
const NO_PARTIDARIOS = new Map<string, keyof CatAcc>([
  ['EN BLANCO', 'enBlanco'],
  ['BLANCO', 'enBlanco'],
  ['ANULADO', 'anulados'],
  ['ANULADOS', 'anulados'],
  ['OBSERVADO', 'observados'],
  ['OBSERVADOS', 'observados'],
]);

interface CatAcc { enBlanco: number; anulados: number; observados: number }

export interface AggregateOptions {
  /** Valor de ESCRUTINIO considerado canónico (definitivo). */
  escrutinioCanonico: string;
}

export interface AggregateResult {
  zonas: AgregadoZona[];
  /** Diagnóstico para el reporte. */
  totalValidos: number;
  ganadorGlobal: { partido: string; votos: number };
  partidosVistos: string[];
}

/**
 * Agrega filas (keyed por header del CSV) a AgregadoZona[] por ZONA × PARTIDO.
 * @param rows filas crudas del CSV
 */
export function aggregateVotes(rows: Record<string, string>[], opts: AggregateOptions): AggregateResult {
  // zona normalizada -> { partido -> votos } y categorías
  const porZona = new Map<string, { display: string; partidos: Map<string, number>; cat: CatAcc }>();
  const globalPartidos = new Map<string, number>();
  const partidosVistos = new Set<string>();

  for (const r of rows) {
    if (r['ESCRUTINIO'] !== opts.escrutinioCanonico) continue;
    const zonaRaw = r['ZONA'];
    if (!zonaRaw) continue;
    const zonaKey = normName(zonaRaw);
    const votos = Number(r['CNT_VOTOS']) || 0;
    if (votos < 0) continue;
    const partido = (r['PARTIDO'] ?? '').trim();

    let entry = porZona.get(zonaKey);
    if (!entry) {
      entry = { display: zonaRaw.trim(), partidos: new Map(), cat: { enBlanco: 0, anulados: 0, observados: 0 } };
      porZona.set(zonaKey, entry);
    }

    const catKey = NO_PARTIDARIOS.get(normName(partido));
    if (catKey) {
      entry.cat[catKey] += votos;
    } else {
      entry.partidos.set(partido, (entry.partidos.get(partido) ?? 0) + votos);
      globalPartidos.set(partido, (globalPartidos.get(partido) ?? 0) + votos);
      partidosVistos.add(partido);
    }
  }

  const zonas: AgregadoZona[] = [];
  let totalValidos = 0;
  for (const [, entry] of porZona) {
    const ranking = [...entry.partidos.entries()].sort((a, b) => b[1] - a[1]);
    if (ranking.length === 0) continue;
    const validos = ranking.reduce((s, [, v]) => s + v, 0);
    totalValidos += validos;
    const porOpcion: VotoOpcion[] = ranking.map(([partido, v]) => ({ opcionId: slug(partido), votos: v }));
    zonas.push({
      geoId: entry.display,
      ganadorOpcionId: slug(ranking[0][0]),
      validos,
      porOpcion,
      noPartidarios: entry.cat,
    });
  }

  const globalRanking = [...globalPartidos.entries()].sort((a, b) => b[1] - a[1]);
  const ganadorGlobal = globalRanking.length
    ? { partido: globalRanking[0][0], votos: globalRanking[0][1] }
    : { partido: '(sin datos)', votos: 0 };

  return { zonas, totalValidos, ganadorGlobal, partidosVistos: [...partidosVistos] };
}
