import { describe, it, expect } from 'vitest';
import { grupoKeyDeOpcion, winnerAtLevel, cascadeShade, resolveOpcionAppearance, type OpcMeta } from './appearance';

// Fixture: PN con 2 precandidatos (cada uno con sublemas) + FA sin sublema.
const META: Record<string, OpcMeta> = {
  h1: { lemaId: 'pn', lemaNombre: 'Partido Nacional', precandidatoId: 'pn-a', sublemaId: 'pn-a-s1' },
  h2: { lemaId: 'pn', lemaNombre: 'Partido Nacional', precandidatoId: 'pn-a', sublemaId: 'pn-a-s2' },
  h3: { lemaId: 'pn', lemaNombre: 'Partido Nacional', precandidatoId: 'pn-b', sublemaId: 'pn-b-s1' },
  h4: { lemaId: 'fa', lemaNombre: 'Frente Amplio', precandidatoId: 'fa-a', sublemaId: undefined },
};
const metaOf = (id: string): OpcMeta | undefined => META[id];

describe('grupoKeyDeOpcion', () => {
  it('devuelve la clave del nivel pedido', () => {
    expect(grupoKeyDeOpcion('h1', 'lema', metaOf)).toBe('pn');
    expect(grupoKeyDeOpcion('h1', 'precandidato', metaOf)).toBe('pn-a');
    expect(grupoKeyDeOpcion('h1', 'sublema', metaOf)).toBe('pn-a-s1');
    expect(grupoKeyDeOpcion('h1', 'lista', metaOf)).toBe('h1');
    expect(grupoKeyDeOpcion('h1', 'candidato', metaOf)).toBe('h1');
  });
  it('cae al padre disponible cuando falta el nivel', () => {
    expect(grupoKeyDeOpcion('h4', 'sublema', metaOf)).toBe('fa-a'); // sin sublema → precandidato
  });
  it('opción sin metadata → su propio id', () => {
    expect(grupoKeyDeOpcion('zzz', 'sublema', metaOf)).toBe('zzz');
  });
});

describe('winnerAtLevel', () => {
  const votos = new Map<string, number>([['h1', 10], ['h2', 30], ['h3', 5], ['h4', 100]]);

  it('elige el grupo ganador a cada nivel', () => {
    expect(winnerAtLevel(votos, metaOf, 'lema').key).toBe('fa');       // 100 > 45
    expect(winnerAtLevel(votos, metaOf, 'sublema').key).toBe('fa-a');  // FA sin sublema → fa-a
    expect(winnerAtLevel(votos, metaOf, 'lista').key).toBe('h4');
  });

  it('roll-up exacto: Σ sublemas de PN == total PN', () => {
    const { totals } = winnerAtLevel(votos, metaOf, 'sublema');
    const sumaPN = (totals['pn-a-s1'] ?? 0) + (totals['pn-a-s2'] ?? 0) + (totals['pn-b-s1'] ?? 0);
    expect(sumaPN).toBe(45);
    const totalLema = winnerAtLevel(votos, metaOf, 'lema').totals['pn'];
    expect(sumaPN).toBe(totalLema);
  });

  it('ignora votos <= 0; mapa vacío → key null', () => {
    expect(winnerAtLevel(new Map([['h1', 0]]), metaOf, 'lema').key).toBeNull();
    expect(winnerAtLevel(new Map(), metaOf, 'lema').key).toBeNull();
  });
});

describe('cascadeShade', () => {
  it('es determinístico (misma key → mismo hex)', () => {
    expect(cascadeShade('#1e40af', 'pn-a-s1')).toBe(cascadeShade('#1e40af', 'pn-a-s1'));
  });
  it('devuelve hex de 6 dígitos', () => {
    expect(cascadeShade('#1e40af', 'cualquier-key')).toMatch(/^#[0-9a-f]{6}$/);
  });
  it('distintas keys tienden a distintos tonos', () => {
    const a = cascadeShade('#1e40af', 'aaa');
    const b = cascadeShade('#1e40af', 'zzz-distinta');
    expect(a).not.toBe(b);
  });
});

describe('resolveOpcionAppearance', () => {
  it('nivel lema → color/sigla/bandera del partido', () => {
    const ap = resolveOpcionAppearance('frente-amplio', 'lema', 'internas-2024', { lemaNombre: 'Frente Amplio' });
    expect(ap.sigla).toBe('FA');
    expect(ap.label).toBe('Frente Amplio');
    expect(ap.pattern?.kind).toBe('flag');
  });
  it('nivel sublema → shade en cascada, sin patrón, label del nodo', () => {
    const ap = resolveOpcionAppearance('pn-a-s1', 'sublema', 'internas-2024', { lemaNombre: 'Partido Nacional', nodeLabel: 'POR LA PATRIA' });
    expect(ap.sigla).toBe('PN');          // sigla del lema padre → agrupa leyenda
    expect(ap.label).toBe('POR LA PATRIA');
    expect(ap.pattern).toBeNull();        // sin override → relleno sólido (no satura)
    expect(ap.color).toMatch(/^#[0-9a-f]{6}$/);
  });
});
