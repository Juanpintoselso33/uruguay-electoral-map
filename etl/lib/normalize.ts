/** Utilidades de normalización compartidas del ETL. */

/** Normaliza un nombre (barrio/zona) para join/agrupación: MAYÚSCULAS, sin acentos, espacios colapsados. */
export function normName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita diacríticos
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Slug estable a partir de un nombre (para opcionId/partidoId). */
export function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
