import { describe, it, expect } from 'vitest';
import { ESCALERAS, escaleraDe } from './granularidad';
import type { EleccionTipo } from './election';

describe('ESCALERAS (catálogo de escaleras)', () => {
  it('cada tipo usado declara al menos una escalera', () => {
    const tipos = new Set<EleccionTipo>(ESCALERAS.map((e) => e.tipo));
    for (const t of ['internas', 'nacionales', 'balotaje', 'plebiscito', 'departamentales'] as EleccionTipo[]) {
      expect(tipos.has(t)).toBe(true);
    }
  });

  it('ningún (tipo, contienda) está declarado dos veces', () => {
    const keys = ESCALERAS.map((e) => `${e.tipo}:${e.contienda}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('toda escalera termina en una unidad de voto (hoja/candidato/binaria)', () => {
    for (const e of ESCALERAS) {
      const terminal = e.niveles[e.niveles.length - 1];
      expect(['hoja', 'candidato', 'binaria']).toContain(terminal);
    }
  });
});

describe('escaleraDe', () => {
  it('internas ODN = lema → precandidato → sublema → hoja (4 niveles)', () => {
    expect(escaleraDe('internas', 'odn')).toEqual(['lema', 'precandidato', 'sublema', 'hoja']);
  });

  it('internas ODD = lema → sublema → hoja', () => {
    expect(escaleraDe('internas', 'odd')).toEqual(['lema', 'sublema', 'hoja']);
  });

  it('planas: balotaje/plebiscito = 1 nivel', () => {
    expect(escaleraDe('balotaje', 'unica')).toEqual(['candidato']);
    expect(escaleraDe('plebiscito', 'unica')).toEqual(['binaria']);
  });

  it('(tipo, contienda) no declarado → undefined', () => {
    expect(escaleraDe('balotaje', 'odn')).toBeUndefined();
  });
});
