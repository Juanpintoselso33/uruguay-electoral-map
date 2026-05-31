/** Data Contract v3 — punto de entrada. Ver README.md. */
export type {
  EleccionTipo,
  Contienda,
  GranularidadNivel,
  Partido,
  Opcion,
  OpcionHoja,
  OpcionCandidato,
  OpcionBinaria,
  NodoOpcion,
  EntidadCanonica,
  Eleccion,
} from './election';

export type {
  EscaleraGranularidad,
  ContiendaCatalogo,
  CatalogoOpciones,
} from './granularidad';

export { ESCALERAS, escaleraDe, opcionIdHoja, slugContrato } from './granularidad';

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
  isOpcionBinaria,
  isEscrutinioDefinitivo,
  assertVotosShard,
  assertCatalogoConsistente,
  assertHojasEnCatalogo,
} from './guards';
