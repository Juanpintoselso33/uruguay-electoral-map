/**
 * Gate de tamaño de geometría (Story 1.5). Falla el build si un artefacto
 * eager supera el budget (NFR1). Mide crudo y gzip (lo que viaja por el CDN).
 */
import { gzipSync } from 'node:zlib';

export interface SizeGateResult {
  rawBytes: number;
  gzipBytes: number;
  passes: boolean;
}

/** Lanza si el artefacto (serializado) supera el budget gzip. */
export function assertGeometryBudget(serialized: string, budgetGzipBytes: number): SizeGateResult {
  const raw = Buffer.byteLength(serialized, 'utf8');
  const gz = gzipSync(Buffer.from(serialized, 'utf8'), { level: 9 }).length;
  const passes = gz <= budgetGzipBytes;
  if (!passes) {
    throw new Error(
      `[geometry-size] artefacto ${(gz / 1024).toFixed(1)} KB gz supera el budget ${(budgetGzipBytes / 1024).toFixed(0)} KB gz`,
    );
  }
  return { rawBytes: raw, gzipBytes: gz, passes };
}
