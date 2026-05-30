/**
 * Data Contract v1 — Elecciones y opciones electorales (polimórfico).
 *
 * Diseñado para soportar los 4 tipos de elección uruguayos SIN rediseño:
 * el discriminador es `Eleccion.tipo` y `Opcion` es una unión discriminada.
 * Ver architecture.md §Data Architecture y project-context.md.
 */

/** Tipo de elección. Discrimina la forma de `Opcion`. */
export type EleccionTipo = 'internas' | 'nacionales' | 'balotaje' | 'departamentales';

/** Identidad canónica de una agrupación política (estable entre elecciones). */
export interface Partido {
  /** Slug estable del lema/partido, p. ej. "frente-amplio". */
  readonly id: string;
  /** Nombre humano, p. ej. "Frente Amplio". */
  readonly nombre: string;
  /** Sigla, p. ej. "FA". Usada como etiqueta de texto en el mapa (a11y). */
  readonly sigla: string;
}

/**
 * Opción electoral polimórfica — lo que se vota. La forma varía por tipo:
 * - `hoja`: lista numerada (internas, nacionales legislativas). Tiene HOJA y partido.
 * - `candidato`: candidato/lema (balotaje, presidencial). NO tiene HOJA.
 * Discriminada por `clase`.
 */
export type Opcion = OpcionHoja | OpcionCandidato;

export interface OpcionHoja {
  readonly clase: 'hoja';
  /** Identidad de servicio (única dentro de la elección). */
  readonly id: string;
  /** Número de HOJA tal como aparece en la fuente. NO es estable entre elecciones. */
  readonly hoja: string;
  /** Partido/lema al que pertenece (estable entre elecciones). */
  readonly partidoId: string;
  /** Precandidato (solo ODN/internas). Ausente en ODD. */
  readonly precandidato?: string;
  /**
   * Entidad canónica para comparación cross-año (juicio editorial, NO dato).
   * Vacío/identidad en Fase 1. Ver architecture.md (equivalencia cross-año).
   */
  readonly entidadCanonica?: EntidadCanonica;
}

export interface OpcionCandidato {
  readonly clase: 'candidato';
  readonly id: string;
  /** Nombre del candidato/lema. NO hay HOJA (balotaje/presidencial). */
  readonly candidato: string;
  readonly partidoId: string;
  readonly entidadCanonica?: EntidadCanonica;
}

/**
 * Gancho de equivalencia cross-año, versionado y con procedencia.
 * Un único mecanismo cubre HOJA y drift de partido/lema. Vacío/identidad en Fase 1.
 */
export interface EntidadCanonica {
  /** Id canónico que agrupa opciones equivalentes entre elecciones. */
  readonly canonicalId: string;
  /** Nivel al que aplica la equivalencia. */
  readonly nivel: 'partido' | 'lema' | 'hoja';
  /** Procedencia del juicio (quién/cómo se decidió la equivalencia). */
  readonly procedencia: string;
  /** Versión del mapeo de equivalencias. */
  readonly version: string;
}

/** Una elección concreta de un departamento. */
export interface Eleccion {
  readonly id: string;
  readonly tipo: EleccionTipo;
  readonly anio: number;
  /** Nombre humano, p. ej. "Internas 2024". */
  readonly nombre: string;
}
