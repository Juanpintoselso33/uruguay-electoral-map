import { describe, it, expect } from 'vitest';
import { agregarPorDepto } from './[id]/resultados';

describe('agregarPorDepto', () => {
  it('suma votos de un opcionId por departamento, ordenado desc', () => {
    const porDepto = { mvd: [{ opcionId: 'orsi', votos: 100 }], canelones: [{ opcionId: 'orsi', votos: 250 }] };
    const r = agregarPorDepto(porDepto, 'orsi');
    expect(r).toEqual([{ departamento: 'canelones', votos: 250 }, { departamento: 'mvd', votos: 100 }]);
  });
});
