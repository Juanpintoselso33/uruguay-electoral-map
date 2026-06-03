/**
 * Apariencia y ganador por nivel (lema → precandidato → sublema → lista).
 * Funciones PURAS (sin DOM/red) → testables (appearance.test.ts) y reusables en SSR.
 * El color base de lema y la bandera vienen de party-meta; este módulo deriva la cascada y
 * resuelve overrides (SVG custom) sin acoplarse al render.
 */
import { resolveParty } from './party-meta';
import { APARIENCIA_OVERRIDES } from './appearance-overrides';

/** Niveles a los que se puede calcular el ganador. 'lista'/'candidato' = terminal. */
export type Nivel = 'lema' | 'precandidato' | 'sublema' | 'lista' | 'candidato';

/** Etiqueta legible del selector de nivel. */
export const NIVEL_LABEL: Record<Nivel, string> = {
  lema: 'Lema',
  precandidato: 'Precandidato',
  sublema: 'Sublema',
  lista: 'Lista',
  candidato: 'Candidato',
};

/** Metadata por opción que el cómputo necesita (subconjunto de catalogoOpcMeta). */
export interface OpcMeta {
  readonly lemaId: string;
  readonly lemaNombre?: string;
  readonly precandidatoId?: string;
  readonly sublemaId?: string;
  readonly hoja?: string;
  readonly etiqueta?: string;
}

type MetaOf = (opcionId: string) => OpcMeta | undefined;

/** Clave de agrupación del ganador a un nivel, con fallback al padre disponible. */
export function grupoKeyDeOpcion(opcionId: string, nivel: Nivel, metaOf: MetaOf): string {
  const m = metaOf(opcionId);
  if (!m) return opcionId;
  switch (nivel) {
    case 'lema': return m.lemaId || opcionId;
    case 'precandidato': return m.precandidatoId || m.lemaId || opcionId;
    case 'sublema': return m.sublemaId || m.precandidatoId || m.lemaId || opcionId;
    case 'lista':
    case 'candidato': return opcionId;
  }
}

/** Ganador a un nivel dado un mapa opcionId→votos. Devuelve la clave ganadora, sus votos,
 *  y el total por clave (para roll-up/leyenda). */
export function winnerAtLevel(
  votos: Map<string, number>,
  metaOf: MetaOf,
  nivel: Nivel,
): { key: string | null; votos: number; totals: Record<string, number> } {
  const totals: Record<string, number> = {};
  for (const [oid, v] of votos) {
    if (v <= 0) continue;
    const k = grupoKeyDeOpcion(oid, nivel, metaOf);
    totals[k] = (totals[k] ?? 0) + v;
  }
  let key: string | null = null;
  let best = 0;
  for (const k in totals) if (totals[k] > best) { best = totals[k]; key = k; }
  return { key, votos: best, totals };
}

// ── Cascada de color determinística (hex ↔ hsl) ────────────────────────────────
function hexToHsl(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let hue = 0; const l = (max + min) / 2; const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    if (max === r) hue = ((g - b) / d) % 6;
    else if (max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
    hue *= 60; if (hue < 0) hue += 360;
  }
  return [hue, s, l];
}
function hslToHex(hue: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const mm = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (hue < 60) [r, g, b] = [c, x, 0];
  else if (hue < 120) [r, g, b] = [x, c, 0];
  else if (hue < 180) [r, g, b] = [0, c, x];
  else if (hue < 240) [r, g, b] = [0, x, c];
  else if (hue < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to = (v: number): string => Math.round((v + mm) * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0);
}
/** Tono determinístico derivado del color del lema: varía la luminosidad ±, estable por `key`. */
export function cascadeShade(baseHex: string, key: string): string {
  const [h, s, l] = hexToHsl(baseHex);
  const steps = [-0.18, -0.11, -0.05, 0.05, 0.11, 0.18];
  const dl = steps[hashStr(key) % steps.length];
  const nl = Math.min(0.82, Math.max(0.2, l + dl));
  return hslToHex(h, Math.max(0.25, s), nl);
}

// ── Resolver de apariencia (el seam para SVGs custom) ──────────────────────────
export interface OpcAppearance {
  readonly color: string;
  readonly label: string;
  readonly sigla: string;           // del lema padre → agrupa leyenda
  readonly pattern: { kind: 'flag' | 'custom'; id: string; url: string } | null;
}

/** Resuelve color/label/ícono de la clave ganadora a un nivel. `nodeLabel` mapea nodeId→etiqueta
 *  (de catalogo.nodos) para sublema/precandidato; `terminalLabel` arma "Lista N" para listas. */
export function resolveOpcionAppearance(
  key: string,
  nivel: Nivel,
  eleccion: string,
  ctx: { lemaNombre: string; nodeLabel?: string; terminalLabel?: string },
): OpcAppearance {
  const party = resolveParty(ctx.lemaNombre, eleccion);
  const override = APARIENCIA_OVERRIDES[`${eleccion}:${nivel}:${key}`] ?? APARIENCIA_OVERRIDES[key];
  if (nivel === 'lema') {
    return {
      color: override?.color ?? party.color,
      label: ctx.lemaNombre,
      sigla: party.sigla,
      pattern: override?.svgUrl
        ? { kind: 'custom', id: `svg-${key}`, url: override.svgUrl }
        : party.flagUrl ? { kind: 'flag', id: `flag-${party.sigla.toLowerCase()}`, url: party.flagUrl } : null,
    };
  }
  const label = ctx.nodeLabel ?? ctx.terminalLabel ?? key;
  return {
    color: override?.color ?? cascadeShade(party.color, key),
    label,
    sigla: party.sigla,
    pattern: override?.svgUrl ? { kind: 'custom', id: `svg-${key}`, url: override.svgUrl } : null,
  };
}
