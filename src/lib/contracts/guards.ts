/**
 * Data Contract v3 — type guards y validadores runtime (sin dependencias).
 * Usados por el ETL (gates) y por el cliente al cargar shards.
 */

import type { Opcion, OpcionHoja, OpcionCandidato, OpcionBinaria } from './election';
import type { VotosShard, AgregadoZona } from './votes';
import type { CatalogoOpciones } from './granularidad';
import { opcionIdHoja } from './granularidad';

export function isOpcionHoja(o: Opcion): o is OpcionHoja {
  return o.clase === 'hoja';
}

export function isOpcionCandidato(o: Opcion): o is OpcionCandidato {
  return o.clase === 'candidato';
}

export function isOpcionBinaria(o: Opcion): o is OpcionBinaria {
  return o.clase === 'binaria';
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

/**
 * Valida la consistencia interna de un catálogo jerárquico (v3, Epic 10):
 * - ids de opción únicos GLOBALMENTE (entre todas las contiendas);
 * - todo `parentId` de un nodo referencia un nodo existente de la misma contienda;
 * - la `clase` de cada opción coincide con el nivel terminal de la escalera de su contienda;
 * - cada HOJA: su `contienda` coincide con la del catálogo, su `lemaId` (y `precandidatoId`
 *   cuando la escalera lo exige) referencian nodos presentes, y su `id` deriva de
 *   `opcionIdHoja(contienda, lemaId, hoja)` — el id es la clave de join al shard.
 */
export function assertCatalogoConsistente(cat: CatalogoOpciones): void {
  const ctx = `${cat.eleccionId}/${cat.departamento}`;
  const opcionIdsGlobal = new Set<string>();
  for (const c of cat.contiendas) {
    // Nodos: unicidad + integridad referencial de parentId (scope por contienda).
    const nodoIds = new Set<string>();
    for (const n of c.nodos) {
      if (nodoIds.has(n.id)) throw new ContractError(`${ctx}/${c.contienda}: nodo duplicado ${n.id}`);
      nodoIds.add(n.id);
    }
    for (const n of c.nodos) {
      if (n.parentId !== undefined && !nodoIds.has(n.parentId)) {
        throw new ContractError(`${ctx}/${c.contienda}: parentId ${n.parentId} de ${n.id} no existe`);
      }
    }
    // Nivel terminal de la escalera de esta contienda = clase esperada de sus opciones.
    const terminal = c.niveles[c.niveles.length - 1];
    const tienePrecandidato = c.niveles.includes('precandidato');
    for (const o of c.opciones) {
      if (opcionIdsGlobal.has(o.id)) {
        throw new ContractError(`${ctx}: opcion_id duplicado ${o.id} (debe ser único en todo el catálogo)`);
      }
      opcionIdsGlobal.add(o.id);
      if (o.clase !== terminal) {
        throw new ContractError(
          `${ctx}/${c.contienda}: opcion ${o.id} es '${o.clase}' pero el nivel terminal es '${terminal}'`,
        );
      }
      if (o.clase === 'hoja') {
        if (o.contienda !== c.contienda) {
          throw new ContractError(`${ctx}/${c.contienda}: hoja ${o.id} declara contienda '${o.contienda}'`);
        }
        if (o.lemaId === undefined) {
          throw new ContractError(`${ctx}/${c.contienda}: hoja ${o.id} sin lemaId (linaje incompleto)`);
        }
        if (!nodoIds.has(o.lemaId)) {
          throw new ContractError(`${ctx}/${c.contienda}: hoja ${o.id} referencia lema inexistente ${o.lemaId}`);
        }
        const idEsperado = opcionIdHoja(c.contienda, o.lemaId, o.hoja);
        if (o.id !== idEsperado) {
          throw new ContractError(`${ctx}/${c.contienda}: id de hoja ${o.id} ≠ derivado ${idEsperado}`);
        }
        if (tienePrecandidato && o.precandidatoId === undefined) {
          throw new ContractError(`${ctx}/${c.contienda}: hoja ${o.id} sin precandidatoId (la escalera lo exige)`);
        }
        if (o.precandidatoId !== undefined && !nodoIds.has(o.precandidatoId)) {
          throw new ContractError(`${ctx}/${c.contienda}: hoja ${o.id} referencia precandidato inexistente ${o.precandidatoId}`);
        }
        if (o.sublemaId !== undefined && !nodoIds.has(o.sublemaId)) {
          throw new ContractError(`${ctx}/${c.contienda}: hoja ${o.id} referencia sublema inexistente ${o.sublemaId}`);
        }
        if (o.grupoId !== undefined && !nodoIds.has(o.grupoId)) {
          throw new ContractError(`${ctx}/${c.contienda}: hoja ${o.id} referencia grupoId inexistente ${o.grupoId}`);
        }
      }
    }
  }
}

/**
 * Verifica que todo `opcionId` de un shard a nivel HOJA exista en el catálogo
 * (en cualquiera de sus contiendas). Úsese solo con shards de hojas, no de lema.
 */
export function assertHojasEnCatalogo(shard: VotosShard, cat: CatalogoOpciones): void {
  const ctx = `${shard.eleccionId}/${shard.departamento}/${shard.nivel}`;
  const ids = new Set<string>();
  for (const c of cat.contiendas) for (const o of c.opciones) ids.add(o.id);
  for (const z of shard.zonas) {
    for (const v of z.porOpcion) {
      if (!ids.has(v.opcionId)) {
        throw new ContractError(`${ctx}/${z.geoId}: opcionId ${v.opcionId} no está en el catálogo`);
      }
    }
  }
}
