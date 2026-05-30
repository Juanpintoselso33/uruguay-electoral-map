/**
 * Arma un VotosShard a partir de los agregados, lo valida con el contrato y lo escribe.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { AgregadoZona, VotosShard, EleccionTipo, NivelGeografico } from '../../src/lib/contracts';
import { assertVotosShard } from '../../src/lib/contracts';

export interface EmitOptions {
  eleccionId: string;
  departamento: string;
  tipo: EleccionTipo;
  nivel: NivelGeografico;
  outPath: string;
}

export function buildShard(zonas: AgregadoZona[], opts: EmitOptions): VotosShard {
  const shard: VotosShard = {
    eleccionId: opts.eleccionId,
    departamento: opts.departamento,
    nivel: opts.nivel,
    escrutinio: 'definitivo', // etapa canónica del contrato (fuente: 'Departamental')
    tipo: opts.tipo,
    zonas,
  };
  assertVotosShard(shard); // lanza si la agregación viola el contrato
  return shard;
}

export function writeShard(shard: VotosShard, outPath: string): void {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(shard), 'utf8');
}
