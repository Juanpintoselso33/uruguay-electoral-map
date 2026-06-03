import { describe, it, expect } from 'vitest';
import { parseUrl, toUrl, toHref, type MapView } from './url-state';

const base: MapView = {
  eleccion: 'internas-2024', departamento: 'montevideo',
  zona: null, opcion: null, level: 'zona',
  vs: null, a: null, b: null,
  contienda: null, seleccion: [], modo: null, circ: false,
};

describe('parseUrl', () => {
  it('deriva contexto del path', () => {
    const v = parseUrl('/internas-2024/montevideo', '');
    expect(v.eleccion).toBe('internas-2024');
    expect(v.departamento).toBe('montevideo');
    expect(v.level).toBe('zona'); // default por-depto
  });

  it('ruta de un solo segmento → departamento _nacional y nivel departamento', () => {
    const v = parseUrl('/balotaje-2024', '');
    expect(v.departamento).toBe('_nacional');
    expect(v.level).toBe('departamento');
  });

  it('nivel inválido cae a default zona', () => {
    expect(parseUrl('/internas-2024/montevideo', '?level=banana').level).toBe('zona');
  });

  it('ignora params desconocidos y separa sel por coma', () => {
    const v = parseUrl('/internas-2024/montevideo', '?foo=bar&sel=a,b,,c&cont=odn&circ=1');
    expect(v.seleccion).toEqual(['a', 'b', 'c']); // descarta vacíos
    expect(v.contienda).toBe('odn');
    expect(v.circ).toBe(true);
  });

  it('vacíos → null', () => {
    const v = parseUrl('/internas-2024/montevideo', '?zona=&opcion=');
    expect(v.zona).toBeNull();
    expect(v.opcion).toBeNull();
  });
});

describe('toUrl', () => {
  it('omite level=zona (default) y params vacíos', () => {
    expect(toUrl(base).search).toBe('');
  });

  it('vista nacional usa ruta de un solo segmento', () => {
    const { pathname } = toUrl({ ...base, departamento: '_nacional', level: 'departamento' });
    expect(pathname).toBe('/internas-2024');
  });

  it('serializa sel/cont/circ', () => {
    const { search } = toUrl({ ...base, seleccion: ['x', 'y'], contienda: 'odd', circ: true });
    expect(search).toContain('sel=x%2Cy');
    expect(search).toContain('cont=odd');
    expect(search).toContain('circ=1');
  });
});

describe('round-trip parseUrl(toHref(v)) === v', () => {
  it('preserva una vista por-departamento con selección', () => {
    const v: MapView = { ...base, zona: 'Centro', level: 'circuito', contienda: 'odn', seleccion: ['p', 'q'], modo: 'heatmap', circ: true };
    const href = toHref(v);
    const [pathname, search] = href.split('?');
    const back = parseUrl(pathname, search ? `?${search}` : '');
    expect(back).toEqual(v);
  });

  it('preserva la vista nacional', () => {
    const v: MapView = { ...base, departamento: '_nacional', level: 'departamento' };
    const [pathname, search] = toHref(v).split('?');
    expect(parseUrl(pathname, search ? `?${search}` : '')).toEqual(v);
  });
});
