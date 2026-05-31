/**
 * Data Contract v3 — Manifest de artefactos.
 *
 * El ETL produce artefactos versionados con hash. El manifest es el índice
 * que el cliente lee para descubrir elecciones/departamentos disponibles y
 * las rutas a los shards de votos y geometría (por nivel). Ver architecture.md.
 */

import type { NivelGeografico } from './votes';

/** Referencia a un artefacto versionado e inmutable. */
export interface ArtefactoRef {
  /** Ruta relativa al artefacto (p. ej. "data/internas-2024/montevideo/votes.json"). */
  readonly path: string;
  /** Hash de contenido para versionado/cache-busting. */
  readonly hash: string;
  /** Tamaño en bytes (para presupuesto de carga). */
  readonly bytes: number;
}

/** Artefactos de una combinación elección × departamento. */
export interface ShardRefs {
  readonly eleccionId: string;
  readonly departamento: string;
  /** Shard de votos por nivel (zona eager; serie/circuito lazy). */
  readonly votos: Partial<Record<NivelGeografico, ArtefactoRef>>;
  /** Geometría por nivel (boundary del depto eager; serie/circuito lazy). */
  readonly geometria: Partial<Record<NivelGeografico, ArtefactoRef>>;
  /** OG-image pre-generada para esta ruta (Epic 3). */
  readonly ogImage?: ArtefactoRef;
}

export interface ManifestEleccion {
  readonly id: string;
  readonly tipo: import('./election').EleccionTipo;
  readonly anio: number;
  readonly nombre: string;
  /** Texto de la pregunta (solo para tipo plebiscito). */
  readonly pregunta?: string;
  /** Contiendas disponibles en esta elección (v3, Epic 10): odn/odd, intendente/junta/municipio, unica. */
  readonly contiendas?: readonly import('./election').Contienda[];
  /** Departamentos disponibles para esta elección. */
  readonly departamentos: readonly string[];
}

/** Índice raíz de todos los artefactos del sitio. */
export interface Manifest {
  /** Versión del esquema del contrato. */
  readonly contractVersion: 'v3';
  /** Hash global del set de artefactos (para invalidación). */
  readonly hash: string;
  /** Fecha de generación (ISO). */
  readonly generatedAt: string;
  readonly elecciones: readonly ManifestEleccion[];
  /** Refs a los shards por elección × departamento. */
  readonly shards: readonly ShardRefs[];
}
