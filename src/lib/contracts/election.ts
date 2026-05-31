/**
 * Data Contract v3 — Elecciones y opciones electorales (polimórfico).
 *
 * v2 agregó `plebiscito` + `OpcionBinaria`. v3 (Epic 10) agrega la granularidad de
 * opción: `Contienda`, `GranularidadNivel`, `NodoOpcion` y el linaje de hoja
 * (contienda/lema/precandidato/sublema) para el drill-down hasta la HOJA individual.
 * Discriminador `Eleccion.tipo`; `Opcion` es unión discriminada.
 * Ver architecture.md §Data Architecture y project-context.md.
 */

/** Tipo de elección. Discrimina la forma de `Opcion`. */
export type EleccionTipo = 'internas' | 'nacionales' | 'balotaje' | 'departamentales' | 'plebiscito';

/**
 * Contienda — el "voto paralelo" dentro de una elección (v3, Epic 10).
 * Una misma jornada electoral puede tener varios votos en el sobre:
 * - internas: `odn` (Convención Nacional) · `odd` (Convención Departamental)
 * - departamentales: `intendente` · `junta` · `municipio`
 * - nacionales/balotaje/plebiscito: `unica`
 */
export type Contienda = 'odn' | 'odd' | 'intendente' | 'junta' | 'municipio' | 'unica';

/**
 * Nivel de la escalera de granularidad de opción (v3, Epic 10).
 * Ordena el árbol del selector: contienda → lema → (sublema|precandidato|...) → hoja.
 * Los niveles "hoja"/"candidato"/"binaria" son unidades de voto (una `Opcion`);
 * los demás son agrupadores (`NodoOpcion`) cuyo total es el roll-up de sus hojas.
 */
export type GranularidadNivel =
  | 'contienda'
  | 'lema'
  | 'sublema'
  | 'precandidato'
  | 'candidato'
  | 'alcalde'
  | 'hoja'
  | 'binaria';

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
 * - `binaria`: opción Sí/No de un plebiscito. Sin partido ni HOJA.
 * Discriminada por `clase`.
 */
export type Opcion = OpcionHoja | OpcionCandidato | OpcionBinaria;

export interface OpcionHoja {
  readonly clase: 'hoja';
  /** Identidad de servicio (única dentro de la elección×depto). En v3 es compuesta: ver `opcionIdHoja`. */
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
  // --- Linaje de granularidad (v3, Epic 10). Opcionales para no romper contratos v2. ---
  /** Contienda a la que pertenece la hoja (odn/odd/junta/...). */
  readonly contienda?: Contienda;
  /**
   * Id del nodo lema en el árbol de granularidad = **slug del lema** (no prefijado por
   * contienda; el árbol se scopea por contienda). En UY lema≡partido, así que coincide
   * con `partidoId`. Es el `lemaId` que consume `opcionIdHoja` para derivar el `id`.
   */
  readonly lemaId?: string;
  /** Id del nodo precandidato (= slug, solo donde la escalera lo tiene, p. ej. internas ODN). */
  readonly precandidatoId?: string;
  /** Id del nodo sublema (nacionales/departamentales donde el dato lo provee). */
  readonly sublemaId?: string;
  /**
   * Id del nodo MEDIO genérico al que cuelga la hoja en el árbol (sublema/alcalde/…),
   * cuando la escalera tiene un nivel intermedio que no es precandidato (Story 10.9).
   * La UI usa `grupoId ?? precandidatoId` como enlace al padre.
   */
  readonly grupoId?: string;
}

export interface OpcionCandidato {
  readonly clase: 'candidato';
  readonly id: string;
  /** Nombre del candidato/lema. NO hay HOJA (balotaje/presidencial). */
  readonly candidato: string;
  readonly partidoId: string;
  readonly entidadCanonica?: EntidadCanonica;
  // --- Linaje de granularidad (v3, Epic 10). Opcionales para no romper contratos v2. ---
  /** Contienda (p. ej. `intendente` en departamentales, `unica` en balotaje). */
  readonly contienda?: Contienda;
  /** Id del nodo lema en el árbol de granularidad. */
  readonly lemaId?: string;
}

/**
 * Nodo agrupador del árbol de granularidad (v3, Epic 10).
 * Representa un nivel SIN voto propio (lema, sublema, precandidato, candidato a
 * intendente, alcalde). Su total es el roll-up de las hojas que cuelgan de él.
 * Distinto de `Opcion` (hoja/candidato/binaria), que SÍ es unidad de voto.
 */
export interface NodoOpcion {
  readonly id: string;
  readonly nivel: GranularidadNivel;
  /** Nombre humano del nodo (lema, sublema, precandidato…). */
  readonly etiqueta: string;
  /** Id del nodo padre en el árbol (ausente en el nivel raíz de la contienda). */
  readonly parentId?: string;
  /** Color/identidad de partido cuando aplica (lema y descendientes). */
  readonly partidoId?: string;
}

/**
 * Opción binaria de un plebiscito (Sí / No).
 * No tiene partido ni HOJA — es una pregunta con dos respuestas posibles.
 */
export interface OpcionBinaria {
  readonly clase: 'binaria';
  readonly id: string;
  /** Etiqueta canónica de la opción. */
  readonly etiqueta: 'si' | 'no';
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
  /** Texto de la pregunta (solo para tipo plebiscito). */
  readonly pregunta?: string;
}
