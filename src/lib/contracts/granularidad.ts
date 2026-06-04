/**
 * Data Contract v3 — Escalera de granularidad y catálogo jerárquico de opciones (Epic 10).
 *
 * Cada `(tipo, contienda)` declara su ESCALERA: el orden de niveles del árbol del
 * selector (contienda → lema → … → hoja). El ETL y la UI construyen el árbol desde
 * estos datos; nunca hardcodean una jerarquía por tipo. Sin dependencias externas.
 */
import type { EleccionTipo, Contienda, GranularidadNivel, NodoOpcion, Opcion } from './election';

/** Descriptor de la escalera de granularidad de una `(tipo, contienda)`. */
export interface EscaleraGranularidad {
  readonly tipo: EleccionTipo;
  readonly contienda: Contienda;
  /** Niveles en orden de profundidad (raíz → hoja). El último es la unidad de voto. */
  readonly niveles: readonly GranularidadNivel[];
}

/**
 * Catálogo de escaleras conocidas. Internas confirmado con dato real; el resto
 * declara su forma esperada y el ETL degrada/rotula donde el dato falte (Story 10.7/10.8).
 */
export const ESCALERAS: readonly EscaleraGranularidad[] = [
  { tipo: 'internas', contienda: 'odn', niveles: ['lema', 'precandidato', 'sublema', 'hoja'] },
  { tipo: 'internas', contienda: 'odd', niveles: ['lema', 'sublema', 'hoja'] },
  { tipo: 'nacionales', contienda: 'unica', niveles: ['lema', 'sublema', 'hoja'] },
  { tipo: 'balotaje', contienda: 'unica', niveles: ['candidato'] },
  { tipo: 'plebiscito', contienda: 'unica', niveles: ['binaria'] },
  { tipo: 'departamentales', contienda: 'intendente', niveles: ['lema', 'candidato'] },
  { tipo: 'departamentales', contienda: 'junta', niveles: ['lema', 'sublema', 'hoja'] },
  { tipo: 'departamentales', contienda: 'municipio', niveles: ['lema', 'alcalde', 'hoja'] },
  // Elección municipal standalone (Epic 22): mismo árbol que la contienda municipio departamental.
  // 2025 emite los 3 niveles; 2020 degrada a [lema, hoja] (sin agrupador de alcalde).
  { tipo: 'municipales', contienda: 'municipio', niveles: ['lema', 'alcalde', 'hoja'] },
] as const;

/** Devuelve la escalera de una `(tipo, contienda)`, o `undefined` si no está declarada. */
export function escaleraDe(
  tipo: EleccionTipo,
  contienda: Contienda,
): readonly GranularidadNivel[] | undefined {
  return ESCALERAS.find((e) => e.tipo === tipo && e.contienda === contienda)?.niveles;
}

/** Slug mínimo, sin dependencias (NFD + minúsculas + no-alfanumérico→guion). */
export function slugContrato(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * `opcion_id` COMPUESTO de una hoja. Estable dentro de una elección×departamento
 * (que es el scope de un shard). Compuesto porque los números de hoja se reúsan
 * entre departamentos y entre contiendas (verificado en el dato).
 */
export function opcionIdHoja(contienda: Contienda, lemaId: string, hoja: string): string {
  return `${contienda}-${slugContrato(lemaId)}-${hoja}`;
}

/** Catálogo de una contienda: sus nodos agrupadores + sus opciones (hojas/candidatos/binarias). */
export interface ContiendaCatalogo {
  readonly contienda: Contienda;
  readonly niveles: readonly GranularidadNivel[];
  /** Nodos agrupadores (lema, sublema, precandidato…) que arman el árbol. */
  readonly nodos: readonly NodoOpcion[];
  /** Unidades de voto (hojas/candidatos/binarias) que cuelgan de los nodos hoja. */
  readonly opciones: readonly Opcion[];
  /** Marca de degradación: la escalera real emitida es más corta que la declarada (falta dato). */
  readonly degradado?: boolean;
}

/** Catálogo jerárquico de opciones de una elección×departamento (lo emite el ETL). */
export interface CatalogoOpciones {
  readonly eleccionId: string;
  readonly departamento: string;
  readonly contiendas: readonly ContiendaCatalogo[];
}
