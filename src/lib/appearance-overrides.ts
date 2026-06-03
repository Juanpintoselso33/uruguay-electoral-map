/**
 * Overrides de apariencia por opción (sublema/lista) — el seam para SVGs/logos custom.
 * Keyed por `${eleccion}:${nivel}:${key}` (preferente) o por `key` suelto (reusar entre años).
 * VACÍO por ahora. Ejemplo futuro:
 *   'internas-2024:sublema:frente-amplio-ana-olivera-sl-mpp': { svgUrl: '/icons/mpp.svg' },
 *   'frente-amplio-...-sl-mpp': { color: '#7c3aed', svgUrl: '/icons/mpp.svg' },
 */
export interface AparienciaOverride {
  readonly color?: string;
  readonly svgUrl?: string;
}
export const APARIENCIA_OVERRIDES: Record<string, AparienciaOverride> = {};
