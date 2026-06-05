/**
 * Constructor PURO del árbol de desglose de una contienda (lema → precandidato/sublema → lista),
 * derivado de los `niveles[]` que declara el catálogo. El comportamiento por tipo de elección
 * EMERGE del dato: internas ODN = 4 niveles, ODD/nacionales = 3, balotaje/plebiscito = 1 (plano).
 *
 * Lo consume la ficha de zona/local (ZoneSheet) para mostrar SIEMPRE el desglose completo,
 * agrupado, sin truncar. Es la misma jerarquía que arma OpcionAccordion, aislada y testeable.
 */
import type { Nivel } from './appearance';

/** Metadata de una opción terminal (hoja/candidato) tomada del catálogo. */
export interface OpcionMetaTree {
  contienda: string;
  lemaId: string;
  lemaNombre: string;
  precandidatoId?: string;
  sublemaId?: string;
  /** Número de hoja; 'vl' = voto al lema; '' si no aplica (planos/candidatos). */
  hoja: string;
  /** Etiqueta terminal alternativa (nombre de candidato de intendente, etc.). */
  label?: string;
}

export interface PartyLook {
  sigla: string;
  color: string;
  flagUrl?: string | null;
}

export interface TreeNode {
  /** 'lema' para la raíz de partido; el nivel del catálogo para los intermedios y la hoja. */
  nivel: Nivel | 'lema';
  /** Id único del nodo (namespaced para los intermedios; opcionId en las hojas terminales). */
  id: string;
  label: string;
  votos: number;
  hijos: TreeNode[];
  /** Visual del partido — se setea en la raíz de lema (y en los planos); los hijos lo heredan en UI. */
  sigla?: string;
  color?: string;
  flagUrl?: string | null;
}

export interface BuildOpcionTreeArgs {
  /** Escalera de la contienda, p.ej. ['lema','precandidato','sublema','lista']. */
  niveles: Nivel[];
  /** TODAS las opciones de la zona con sus votos (no solo la selección). */
  votos: { opcionId: string; votos: number }[];
  metaOf: (id: string) => OpcionMetaTree | undefined;
  /** Id de nodo agrupador (sublema/precandidato) → etiqueta legible. */
  nodeLabel: (id: string) => string | undefined;
  /** resolveParty: nombre de lema → sigla/color/bandera. */
  partyOf: (lemaNombre: string) => PartyLook;
  /** Nombre legible de una opción plana (balotaje/plebiscito) sin lema. */
  flatNombre?: (id: string) => string | undefined;
}

function terminalLabel(meta: OpcionMetaTree): string {
  if (meta.hoja === 'vl') return 'Voto al lema';
  if (meta.hoja) return `Lista ${meta.hoja}`;
  return meta.label ?? meta.lemaNombre;
}

/** Id del nodo agrupador de una opción para un nivel intermedio dado. */
function nodeIdForNivel(meta: OpcionMetaTree, nivel: Nivel): string | undefined {
  if (nivel === 'precandidato') return meta.precandidatoId;
  if (nivel === 'sublema') return meta.sublemaId;
  return undefined;
}

/**
 * Construye el árbol de desglose. Cada nodo lleva la suma de los votos de sus hojas (recursivo).
 * Las hojas con 0 votos se descartan; los grupos vacíos no aparecen. Ordena por votos desc en
 * cada nivel. NUNCA trunca: todas las opciones con voto > 0 son alcanzables.
 */
export function buildOpcionTree(args: BuildOpcionTreeArgs): { nodes: TreeNode[]; total: number } {
  const { niveles, votos, metaOf, nodeLabel, partyOf, flatNombre } = args;
  // Niveles intermedios = entre 'lema' (raíz) y el terminal (último). Para planos (niveles<=1) no hay.
  const intermedios = niveles.length > 1 ? (niveles.slice(1, -1) as Nivel[]) : [];

  const roots = new Map<string, TreeNode>();
  let total = 0;

  const ensureChild = (parent: TreeNode, id: string, nivel: Nivel | 'lema', label: string): TreeNode => {
    let child = parent.hijos.find((h) => h.id === id);
    if (!child) {
      child = { nivel, id, label, votos: 0, hijos: [] };
      parent.hijos.push(child);
    }
    return child;
  };

  for (const { opcionId, votos: v } of votos) {
    if (v <= 0) continue;
    const meta = metaOf(opcionId);

    // Plano (balotaje/plebiscito/referéndum) o opción sin lema: nodo de primer nivel, sin hojas.
    if (!meta || !meta.lemaId) {
      const nombre = flatNombre?.(opcionId) ?? meta?.lemaNombre ?? opcionId;
      const look = partyOf(nombre);
      let root = roots.get(`flat/${opcionId}`);
      if (!root) {
        root = { nivel: 'lema', id: `flat/${opcionId}`, label: nombre, votos: 0, hijos: [], ...look };
        roots.set(`flat/${opcionId}`, root);
      }
      root.votos += v;
      total += v;
      continue;
    }

    // Raíz de lema.
    const lemaKey = `${meta.contienda}/${meta.lemaId}`;
    let root = roots.get(lemaKey);
    if (!root) {
      const look = partyOf(meta.lemaNombre);
      root = { nivel: 'lema', id: lemaKey, label: meta.lemaNombre, votos: 0, hijos: [], ...look };
      roots.set(lemaKey, root);
    }
    root.votos += v;
    total += v;

    // Descender por los niveles intermedios disponibles en la opción.
    let cursor = root;
    for (const niv of intermedios) {
      const nid = nodeIdForNivel(meta, niv);
      if (!nid) break; // sin ese agrupador → la hoja cuelga directo del nivel actual
      const child = ensureChild(cursor, `${lemaKey}/${niv}/${nid}`, niv, nodeLabel(nid) ?? nid);
      child.votos += v;
      cursor = child;
    }

    // Hoja terminal.
    const leafNivel = (niveles[niveles.length - 1] ?? 'lista') as Nivel;
    const leaf = ensureChild(cursor, opcionId, leafNivel, terminalLabel(meta));
    leaf.votos += v;
  }

  const sortRec = (nodes: TreeNode[]): TreeNode[] => {
    nodes.sort((a, b) => b.votos - a.votos || a.label.localeCompare(b.label, 'es'));
    for (const n of nodes) if (n.hijos.length) sortRec(n.hijos);
    return nodes;
  };

  return { nodes: sortRec([...roots.values()]), total };
}
