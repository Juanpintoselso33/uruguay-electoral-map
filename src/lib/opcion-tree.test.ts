import { describe, it, expect } from 'vitest';
import { buildOpcionTree, type OpcionMetaTree, type PartyLook } from './opcion-tree';

const META: Record<string, OpcionMetaTree> = {
  // PN, ODN: precandidato A (sublema s1: hojas 404, 71) + precandidato B (sublema s2: hoja 22)
  'pn-404': { contienda: 'odn', lemaId: 'pn', lemaNombre: 'Partido Nacional', precandidatoId: 'pn-a', sublemaId: 'pn-a-s1', hoja: '404' },
  'pn-71': { contienda: 'odn', lemaId: 'pn', lemaNombre: 'Partido Nacional', precandidatoId: 'pn-a', sublemaId: 'pn-a-s1', hoja: '71' },
  'pn-22': { contienda: 'odn', lemaId: 'pn', lemaNombre: 'Partido Nacional', precandidatoId: 'pn-b', sublemaId: 'pn-b-s2', hoja: '22' },
  // FA, ODN: precandidato sin sublema → hoja cuelga directo del precandidato
  'fa-99': { contienda: 'odn', lemaId: 'fa', lemaNombre: 'Frente Amplio', precandidatoId: 'fa-a', hoja: '99' },
};
const LABEL: Record<string, string> = {
  'pn-a': 'Precand. A', 'pn-b': 'Precand. B', 'fa-a': 'Precand. FA',
  'pn-a-s1': 'Sublema Uno', 'pn-b-s2': 'Sublema Dos',
};
const party = (n: string): PartyLook => ({ sigla: n === 'Partido Nacional' ? 'PN' : 'FA', color: '#000' });
const base = {
  metaOf: (id: string) => META[id],
  nodeLabel: (id: string) => LABEL[id],
  partyOf: party,
};

describe('buildOpcionTree — ODN (4 niveles)', () => {
  const niveles = ['lema', 'precandidato', 'sublema', 'lista'] as const;
  const votos = [
    { opcionId: 'pn-404', votos: 212 },
    { opcionId: 'pn-71', votos: 152 },
    { opcionId: 'pn-22', votos: 100 },
    { opcionId: 'fa-99', votos: 433 },
  ];

  it('arma lema → precandidato → sublema → lista y suma hacia arriba', () => {
    const { nodes, total } = buildOpcionTree({ niveles: [...niveles], votos, ...base });
    expect(total).toBe(897);
    // Ordenado por votos desc: FA (433) antes que PN (464)? PN=464 > FA=433 → PN primero.
    expect(nodes.map((n) => n.label)).toEqual(['Partido Nacional', 'Frente Amplio']);
    const pn = nodes[0];
    expect(pn.votos).toBe(464);
    expect(pn.sigla).toBe('PN');
    // PN → precandidato A (364) y B (100)
    expect(pn.hijos.map((h) => [h.label, h.votos])).toEqual([['Precand. A', 364], ['Precand. B', 100]]);
    // Precand A → sublema Uno → listas 404 (212) y 71 (152)
    const subUno = pn.hijos[0].hijos[0];
    expect(subUno.label).toBe('Sublema Uno');
    expect(subUno.votos).toBe(364);
    expect(subUno.hijos.map((h) => [h.label, h.votos])).toEqual([['Lista 404', 212], ['Lista 71', 152]]);
  });

  it('una hoja sin sublema cuelga directo del precandidato (no inventa nodo)', () => {
    const { nodes } = buildOpcionTree({ niveles: [...niveles], votos, ...base });
    const fa = nodes.find((n) => n.label === 'Frente Amplio')!;
    const precFa = fa.hijos[0];
    expect(precFa.label).toBe('Precand. FA');
    // su hijo directo es la LISTA (no un sublema)
    expect(precFa.hijos.map((h) => [h.nivel, h.label])).toEqual([['lista', 'Lista 99']]);
  });

  it('descarta hojas con 0 votos', () => {
    const { nodes, total } = buildOpcionTree({
      niveles: [...niveles],
      votos: [{ opcionId: 'pn-404', votos: 0 }, { opcionId: 'fa-99', votos: 5 }],
      ...base,
    });
    expect(total).toBe(5);
    expect(nodes.map((n) => n.label)).toEqual(['Frente Amplio']);
  });
});

describe('buildOpcionTree — ODD (3 niveles, sin precandidato)', () => {
  const META_ODD: Record<string, OpcionMetaTree> = {
    'pn-1': { contienda: 'odd', lemaId: 'pn', lemaNombre: 'Partido Nacional', sublemaId: 'pn-sa', hoja: '1' },
    'pn-2': { contienda: 'odd', lemaId: 'pn', lemaNombre: 'Partido Nacional', sublemaId: 'pn-sb', hoja: '2' },
  };
  it('agrupa lema → sublema → lista', () => {
    const { nodes } = buildOpcionTree({
      niveles: ['lema', 'sublema', 'lista'],
      votos: [{ opcionId: 'pn-1', votos: 10 }, { opcionId: 'pn-2', votos: 30 }],
      metaOf: (id) => META_ODD[id],
      nodeLabel: (id) => ({ 'pn-sa': 'SA', 'pn-sb': 'SB' })[id],
      partyOf: party,
    });
    expect(nodes[0].hijos.map((h) => [h.label, h.nivel, h.votos])).toEqual([
      ['SB', 'sublema', 30], ['SA', 'sublema', 10],
    ]);
  });
});

describe('buildOpcionTree — plano (1 nivel: balotaje/plebiscito)', () => {
  it('cada opción es un nodo de primer nivel, sin hojas', () => {
    const { nodes, total } = buildOpcionTree({
      niveles: ['lema'],
      votos: [{ opcionId: 'si', votos: 60 }, { opcionId: 'no', votos: 40 }],
      metaOf: () => undefined,
      nodeLabel: () => undefined,
      partyOf: () => ({ sigla: '', color: '#888' }),
      flatNombre: (id) => ({ si: 'Sí', no: 'No' })[id],
    });
    expect(total).toBe(100);
    expect(nodes.map((n) => [n.label, n.votos, n.hijos.length])).toEqual([['Sí', 60, 0], ['No', 40, 0]]);
  });
});
