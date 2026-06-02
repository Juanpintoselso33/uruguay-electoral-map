/**
 * Data Contract v3 — Votos y agregados por zona.
 *
 * Unidad canónica: (opción × geografía × etapa de escrutinio). La etapa
 * DEFINITIVA es la canónica; nunca se suman etapas. Blanco/anulado/observado
 * son categorías separadas (no opciones partidarias). Ver project-context.md.
 */

import type { EleccionTipo } from './election';

/** Etapa de escrutinio. La canónica del producto es 'definitivo'. */
export type Escrutinio = 'definitivo' | 'primario' | 'total';

/** Nivel geográfico (jerarquía DEPARTAMENTO ⊃ {CIRCUITO ⊃ SERIE ⊃ ZONA; LOCALIDAD agrega series por localidad del interior; BARRIO subdivide ciudades grandes; LOCAL = local de votación geolocalizado, agrega circuitos por venue físico — Epic 17}. DEPARTAMENTO = vista nacional, agrega los 19 deptos — Epic 15). */
export type NivelGeografico = 'departamento' | 'zona' | 'serie' | 'circuito' | 'local' | 'localidad' | 'barrio';

/** Categorías no partidarias presentes en los totales oficiales. */
export interface CategoriasNoPartidarias {
  readonly enBlanco: number;
  readonly anulados: number;
  readonly observados: number;
}

/** Votos de una opción en una unidad geográfica (de la etapa canónica). */
export interface VotoOpcion {
  readonly opcionId: string;
  readonly votos: number;
}

/** Agregados precomputados por unidad geográfica (los produce el ETL). */
export interface AgregadoZona {
  /** Clave de la unidad geográfica en este nivel. */
  readonly geoId: string;
  /** Opción ganadora (id). */
  readonly ganadorOpcionId: string;
  /** Total de votos válidos en la zona (denominador de %). */
  readonly validos: number;
  /** Votos por opción (de la etapa definitiva). */
  readonly porOpcion: readonly VotoOpcion[];
  /** Categorías no partidarias de la zona. */
  readonly noPartidarios: CategoriasNoPartidarias;
}

/**
 * Shard de votos servido por (elección × departamento × nivel).
 * Agregado en el ETL; el cliente NO recalcula sobre datos crudos.
 */
export interface VotosShard {
  readonly eleccionId: string;
  readonly departamento: string;
  readonly nivel: NivelGeografico;
  /** Etapa de escrutinio de la que provienen los agregados (debe ser 'definitivo'). */
  readonly escrutinio: Escrutinio;
  /** Tipo de elección (redundante con la elección, útil para validación local). */
  readonly tipo: EleccionTipo;
  readonly zonas: readonly AgregadoZona[];
}
