/**
 * Gate de cobertura zonas↔geometría (Story 1.6).
 *
 * Dos métricas, con umbrales fijados ANTES de ver los números (no se bajan para
 * forzar verde):
 *  - placement ponderado por votos: votos colocados en un barrio que EXISTE en la
 *    geometría / total canónico → honestidad del mapa (¿se está pintando dónde se votó?).
 *  - barrio-fill: barrios de la geometría que reciben votos / total de barrios →
 *    zonas no vacías (¿hay barrios reales que quedan sin datos?).
 *
 * Cualquiera bajo su umbral ⇒ throw (exit≠0) con reporte de faltantes.
 */
import { normName } from '../lib/normalize';
import type { VotosShard } from '../../src/lib/contracts';

/** Umbrales (constantes nombradas, no mágicos en línea). */
export const PLACEMENT_MIN = 0.95; // votos colocados en geometría / total
export const BARRIO_FILL_MIN = 0.75; // barrios con votos / barrios de la geometría

export interface CoverageResult {
  placement: number;
  barrioFill: number;
  totalCanonico: number;
  votosColocados: number;
  geoBarrios: number;
  barriosConVotos: number;
  /** Barrios de la geometría sin votos (aparecerían vacíos). */
  geoSinVotos: string[];
  /** geoIds del shard que no matchean ningún barrio de la geometría. */
  shardSinMatch: string[];
}

export interface CoverageInput {
  shard: VotosShard;
  /** Nombres de barrio de la geometría (properties.name del TopoJSON, canonicalizado). */
  geoBarrioNames: string[];
  totalCanonico: number;
}

export function checkCoverage(input: CoverageInput): CoverageResult {
  const { shard, geoBarrioNames, totalCanonico } = input;
  const geoSet = new Set(geoBarrioNames.map(normName));

  let votosColocados = 0;
  const shardSinMatch: string[] = [];
  const barriosConVotosNorm = new Set<string>();
  for (const z of shard.zonas) {
    const k = normName(z.geoId);
    const totalZona =
      z.validos + z.noPartidarios.enBlanco + z.noPartidarios.anulados + z.noPartidarios.observados;
    if (geoSet.has(k)) {
      votosColocados += totalZona;
      barriosConVotosNorm.add(k);
    } else {
      shardSinMatch.push(z.geoId);
    }
  }

  const geoSinVotos = geoBarrioNames.filter((n) => !barriosConVotosNorm.has(normName(n)));
  const placement = totalCanonico > 0 ? votosColocados / totalCanonico : 0;
  const barrioFill = geoSet.size > 0 ? barriosConVotosNorm.size / geoSet.size : 0;

  const result: CoverageResult = {
    placement,
    barrioFill,
    totalCanonico,
    votosColocados,
    geoBarrios: geoSet.size,
    barriosConVotos: barriosConVotosNorm.size,
    geoSinVotos,
    shardSinMatch,
  };

  const fallos: string[] = [];
  if (placement < PLACEMENT_MIN) {
    fallos.push(
      `placement ${(placement * 100).toFixed(1)}% < ${(PLACEMENT_MIN * 100).toFixed(0)}% ` +
        `(${shardSinMatch.length} geoIds del shard sin match: ${shardSinMatch.slice(0, 10).join(', ')})`,
    );
  }
  if (barrioFill < BARRIO_FILL_MIN) {
    fallos.push(
      `barrio-fill ${(barrioFill * 100).toFixed(1)}% < ${(BARRIO_FILL_MIN * 100).toFixed(0)}% ` +
        `(${geoSinVotos.length} barrios sin votos: ${geoSinVotos.slice(0, 15).join(', ')})`,
    );
  }
  if (fallos.length > 0) {
    throw new Error(`[coverage] COBERTURA FALLA:\n  - ${fallos.join('\n  - ')}`);
  }

  return result;
}
