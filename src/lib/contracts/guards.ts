/**
 * Data Contract v1 — type guards y validadores runtime (sin dependencias).
 * Usados por el ETL (gates) y por el cliente al cargar shards.
 */

import type { Opcion, OpcionHoja, OpcionCandidato } from './election';
import type { VotosShard, AgregadoZona } from './votes';

export function isOpcionHoja(o: Opcion): o is OpcionHoja {
  return o.clase === 'hoja';
}

export function isOpcionCandidato(o: Opcion): o is OpcionCandidato {
  return o.clase === 'candidato';
}

export function isEscrutinioDefinitivo(shard: Pick<VotosShard, 'escrutinio'>): boolean {
  return shard.escrutinio === 'definitivo';
}

/** Error de validación del contrato (lo lanzan los gates del ETL). */
export class ContractError extends Error {
  constructor(message: string) {
    super(`[DataContract] ${message}`);
    this.name = 'ContractError';
  }
}

function assertZona(z: AgregadoZona, ctx: string): void {
  if (typeof z.geoId !== 'string' || z.geoId.length === 0) {
    throw new ContractError(`${ctx}: geoId vacío`);
  }
  if (z.validos < 0) throw new ContractError(`${ctx}/${z.geoId}: válidos negativos`);
  for (const v of z.porOpcion) {
    if (v.votos < 0) throw new ContractError(`${ctx}/${z.geoId}: votos negativos en ${v.opcionId}`);
  }
  const ganador = z.porOpcion.find((v) => v.opcionId === z.ganadorOpcionId);
  if (!ganador) {
    throw new ContractError(`${ctx}/${z.geoId}: ganador ${z.ganadorOpcionId} no está en porOpcion`);
  }
  // El ganador debe ser efectivamente el de más votos en la zona (M1, code review 1.2).
  const maxVotos = Math.max(...z.porOpcion.map((v) => v.votos));
  if (ganador.votos < maxVotos) {
    throw new ContractError(
      `${ctx}/${z.geoId}: ganador ${z.ganadorOpcionId} (${ganador.votos}) no es el de más votos (${maxVotos})`,
    );
  }
}

/**
 * Valida un VotosShard contra el contrato. Lanza ContractError si no cumple.
 * Reglas: escrutinio definitivo, sin votos negativos, ganador consistente,
 * sin geoId duplicado.
 */
export function assertVotosShard(shard: VotosShard): void {
  const ctx = `${shard.eleccionId}/${shard.departamento}/${shard.nivel}`;
  if (!isEscrutinioDefinitivo(shard)) {
    throw new ContractError(`${ctx}: escrutinio debe ser 'definitivo' (es '${shard.escrutinio}')`);
  }
  const vistos = new Set<string>();
  for (const z of shard.zonas) {
    if (vistos.has(z.geoId)) throw new ContractError(`${ctx}: geoId duplicado ${z.geoId}`);
    vistos.add(z.geoId);
    assertZona(z, ctx);
  }
}
