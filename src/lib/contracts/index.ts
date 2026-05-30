/** Data Contract v1 — punto de entrada. Ver README.md. */
export type {
  EleccionTipo,
  Partido,
  Opcion,
  OpcionHoja,
  OpcionCandidato,
  EntidadCanonica,
  Eleccion,
} from './election';

export type {
  Escrutinio,
  NivelGeografico,
  CategoriasNoPartidarias,
  VotoOpcion,
  AgregadoZona,
  VotosShard,
} from './votes';

export type {
  ArtefactoRef,
  ShardRefs,
  ManifestEleccion,
  Manifest,
} from './manifest';

export {
  isOpcionHoja,
  isOpcionCandidato,
  isEscrutinioDefinitivo,
  assertVotosShard,
} from './guards';
