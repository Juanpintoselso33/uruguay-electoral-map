import { describe, it, expect } from 'vitest';
import { filtrarPorOpcion } from './results';

describe('filtrarPorOpcion', () => {
  it('filtra porOpcion por un opcionId dado', () => {
    const zonas = [{ geoId: 'a', validos: 10, porOpcion: [{ opcionId: 'x', votos: 6 }, { opcionId: 'y', votos: 4 }] }];
    const r = filtrarPorOpcion(zonas, 'x');
    expect(r[0].porOpcion).toEqual([{ opcionId: 'x', votos: 6 }]);
  });
  it('sin filtro devuelve todo', () => {
    const zonas = [{ geoId: 'a', validos: 10, porOpcion: [{ opcionId: 'x', votos: 6 }] }];
    expect(filtrarPorOpcion(zonas, null)[0].porOpcion).toHaveLength(1);
  });
});
