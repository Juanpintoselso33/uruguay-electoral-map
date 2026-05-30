/**
 * Gate de reconciliación / losslessness (Story 1.6).
 *
 * No existe un "total oficial" externo en la fuente (el CSV solo tiene
 * ESCRUTINIO='Departamental'), así que esto es una prueba de LOSSLESSNESS del
 * pipeline: la suma de todos los votos canónicos del CSV (sum-in) debe igualar
 * la suma de lo que el ETL contabilizó (sum-out = Σ porOpcion + Σ noPartidarios
 * por barrio + bucket unmapped). Delta ≠ 0 ⇒ el ETL perdió o duplicó votos ⇒ build falla.
 */
import type { VotosShard } from '../../src/lib/contracts';

export interface ReconcileResult {
  sumIn: number;
  sumOut: number;
  delta: number;
}

export function reconcile(shard: VotosShard, totalCanonico: number, unmappedVotos: number): ReconcileResult {
  let sumOut = unmappedVotos;
  for (const z of shard.zonas) {
    for (const o of z.porOpcion) sumOut += o.votos;
    sumOut += z.noPartidarios.enBlanco + z.noPartidarios.anulados + z.noPartidarios.observados;
  }
  const delta = sumOut - totalCanonico;
  if (delta !== 0) {
    throw new Error(
      `[reconcile] LOSSLESSNESS FALLA: sum-in=${totalCanonico} sum-out=${sumOut} delta=${delta} ` +
        `(el ETL perdió o duplicó votos)`,
    );
  }
  return { sumIn: totalCanonico, sumOut, delta };
}
