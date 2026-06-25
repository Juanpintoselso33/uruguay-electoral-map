import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import OpcionAccordion from './OpcionAccordion.vue';
import { $selection, $context } from '../../stores/map-state';

/**
 * Harness de componentes Vue (Epic 18, Story 18.3).
 * Patrón para montar un componente que (a) hace `fetch` de shards y (b) usa stores nanostores:
 *  - `vi.stubGlobal('fetch', …)` ruteando por URL → devuelve fixtures.
 *  - resetear el store (`$selection.set(...)`) en beforeEach; el componente lo lee/escribe vía commit.
 *  - `await flushPromises()` tras montar (onMounted async) y tras cada click que dispara fetch lazy.
 */

// Catálogo fixture: ODN de 4 niveles (lema → precandidato → sublema → hoja), 1 rama, 2 listas.
const CATALOGO = {
  eleccionId: 'internas-2024',
  departamento: 'montevideo',
  contiendas: [
    {
      contienda: 'odn',
      niveles: ['lema', 'precandidato', 'sublema', 'hoja'],
      nodos: [
        { id: 'pn', nivel: 'lema', etiqueta: 'Partido Nacional', partidoId: 'pn' },
        { id: 'pn-x', nivel: 'precandidato', etiqueta: 'Precandidato X', parentId: 'pn', partidoId: 'pn' },
        { id: 'pn-x-sl-a', nivel: 'sublema', etiqueta: 'SUBLEMA A', parentId: 'pn-x' },
      ],
      opciones: [
        { clase: 'hoja', id: 'odn-pn-1', hoja: '1', lemaId: 'pn', contienda: 'odn', precandidatoId: 'pn-x', sublemaId: 'pn-x-sl-a', grupoId: 'pn-x-sl-a' },
        { clase: 'hoja', id: 'odn-pn-2', hoja: '2', lemaId: 'pn', contienda: 'odn', precandidatoId: 'pn-x', sublemaId: 'pn-x-sl-a', grupoId: 'pn-x-sl-a' },
      ],
    },
  ],
};

beforeEach(() => {
  // El path de la URL (que commit()→pushState arma) sale de $context, no de los props → setearlo
  // o pushState recibe "//" y jsdom lanza SecurityError. Parte del patrón de montaje.
  $context.set({ eleccion: 'internas-2024', departamento: 'montevideo' });
  $selection.set({ zona: null, opcion: null, contienda: null, seleccion: [], modo: null, gnivel: null });
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/catalogo.json')) return new Response(JSON.stringify(CATALOGO), { status: 200 });
    // votes.json y los shards de hoja lazy: zonas vacías (no afectan la estructura del árbol).
    return new Response(JSON.stringify({ zonas: [] }), { status: 200 });
  }));
});
afterEach(() => vi.unstubAllGlobals());

const expandPorLabel = async (wrapper: ReturnType<typeof mount>, prefijo: string): Promise<void> => {
  const btn = wrapper.findAll('button').find((b) => b.attributes('aria-label')?.startsWith(prefijo));
  expect(btn, `botón "${prefijo}" no encontrado`).toBeTruthy();
  await btn!.trigger('click');
  await flushPromises();
};

describe('OpcionAccordion — árbol recursivo por parentId', () => {
  it('renderiza el lema y expande lema → precandidato → sublema → lista', async () => {
    const wrapper = mount(OpcionAccordion, { props: { eleccion: 'internas-2024', departamento: 'montevideo' } });
    await flushPromises();

    // Nivel lema visible.
    expect(wrapper.text()).toContain('Partido Nacional');

    // Expandir cada nivel y verificar que aparece el siguiente.
    await expandPorLabel(wrapper, 'Ver listas de Partido Nacional');
    expect(wrapper.text()).toContain('Precandidato X');

    await expandPorLabel(wrapper, 'Ver listas de Precandidato X');
    expect(wrapper.text()).toContain('SUBLEMA A');

    await expandPorLabel(wrapper, 'Ver listas de SUBLEMA A');
    expect(wrapper.text()).toContain('Lista 1');
    expect(wrapper.text()).toContain('Lista 2');
  });

  it('tri-estado: "seleccionar todas" del lema marca TODAS sus listas (recursivo)', async () => {
    const wrapper = mount(OpcionAccordion, { props: { eleccion: 'internas-2024', departamento: 'montevideo' } });
    await flushPromises();

    const cb = wrapper.findAll('button').find((b) => b.attributes('aria-label') === 'Seleccionar todas las listas de Partido Nacional');
    expect(cb).toBeTruthy();
    await cb!.trigger('click');
    await flushPromises();

    expect([...$selection.get().seleccion].sort()).toEqual(['odn-pn-1', 'odn-pn-2']);
  });
});

/**
 * Caso PLANO de la vista nacional: sin catalogo.json, el componente degrada a una lista de
 * PARTIDOS (catalogoPlanoFallback desde opciones.json). Regla "lista ≠ partido" (feedback de
 * usuario): la UI NO debe llamar "listas" a los partidos, y debe avisar dónde está el desglose
 * por lista (en cada departamento).
 */
describe('OpcionAccordion — caso plano nacional rotula PARTIDOS, no listas', () => {
  beforeEach(() => {
    $context.set({ eleccion: 'nacionales-2024', departamento: '_nacional' });
    $selection.set({ zona: null, opcion: null, contienda: null, seleccion: [], modo: null, gnivel: null });
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/_manifest.json')) {
        return new Response(JSON.stringify({ 'nacionales-2024': { _nacional: ['zona-annexed'] } }), { status: 200 });
      }
      if (url.includes('/catalogo.json')) return new Response('not found', { status: 404 }); // → fallback plano
      if (url.includes('/opciones.json')) {
        return new Response(JSON.stringify({ opciones: [
          { opcionId: 'fa', nombre: 'Frente Amplio' },
          { opcionId: 'pn', nombre: 'Partido Nacional' },
        ] }), { status: 200 });
      }
      return new Response(JSON.stringify({ zonas: [] }), { status: 200 });
    }));
  });

  it('el header dice "Filtrar por partido" (no "lista")', async () => {
    const wrapper = mount(OpcionAccordion, { props: { eleccion: 'nacionales-2024', departamento: '_nacional' } });
    await flushPromises();
    await flushPromises(); // catalogo 404 → opciones.json (segunda cadena de await)

    const lbl = wrapper.find('.acc__toggle-lbl').text();
    expect(lbl).toBe('Filtrar por partido');
    expect(lbl).not.toContain('lista');
  });

  it('el chip de selección dice "N partido(s) seleccionado(s)", no "listas"', async () => {
    const wrapper = mount(OpcionAccordion, { props: { eleccion: 'nacionales-2024', departamento: '_nacional' } });
    await flushPromises();
    await flushPromises();

    // Seleccionar el primer partido (checkbox del caso plano).
    const cb = wrapper.findAll('button').find((b) => b.attributes('aria-label')?.startsWith('Seleccionar '));
    expect(cb, 'checkbox de partido no encontrado').toBeTruthy();
    await cb!.trigger('click');
    await flushPromises();

    const chip = wrapper.find('.acc__chip--sel').text();
    expect(chip).toBe('1 partido seleccionado');
    expect(chip).not.toContain('lista');
  });

  it('NO muestra disclaimer/CTA (se quitó — en departamentales nacional las listas no agregan)', async () => {
    const wrapper = mount(OpcionAccordion, { props: { eleccion: 'nacionales-2024', departamento: '_nacional' } });
    await flushPromises();
    await flushPromises();

    expect(wrapper.find('.acc__cta').exists()).toBe(false);
  });
});

/**
 * Feature de hoja nacional (build-nacional-hoja.py): cuando _nacional SÍ tiene catalogo.json,
 * el acordeón nacional arma el ÁRBOL real (lema→sublema→hoja), NO el fallback plano. El CTA de
 * "está dentro de cada departamento" desaparece (ya se puede filtrar por lista a nivel país).
 */
describe('OpcionAccordion — vista nacional CON catálogo de hoja (feature nacional)', () => {
  const CATALOGO_NAC = {
    eleccionId: 'nacionales-2024',
    departamento: '_nacional',
    contiendas: [{
      contienda: 'unica',
      niveles: ['lema', 'sublema', 'hoja'],
      nodos: [
        { id: 'frente-amplio', nivel: 'lema', etiqueta: 'Frente Amplio', partidoId: 'frente-amplio' },
        { id: 'fa-sl-uph', nivel: 'sublema', etiqueta: 'UNIDAD PARA LA ESPERANZA', parentId: 'frente-amplio' },
      ],
      opciones: [
        { clase: 'hoja', id: 'unica-frente-amplio-609', hoja: '609', lemaId: 'frente-amplio', contienda: 'unica', sublemaId: 'fa-sl-uph', grupoId: 'fa-sl-uph' },
      ],
    }],
  };
  beforeEach(() => {
    $context.set({ eleccion: 'nacionales-2024', departamento: '_nacional' });
    $selection.set({ zona: null, opcion: null, contienda: null, seleccion: [], modo: null, gnivel: null });
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/_manifest.json')) return new Response(JSON.stringify({ 'nacionales-2024': { _nacional: ['catalogo', 'hoja-base'] } }), { status: 200 });
      if (url.includes('/catalogo.json')) return new Response(JSON.stringify(CATALOGO_NAC), { status: 200 });
      return new Response(JSON.stringify({ zonas: [] }), { status: 200 });
    }));
  });

  it('arma el árbol (lema visible, expandible a lista) y NO muestra el CTA de depto', async () => {
    const wrapper = mount(OpcionAccordion, { props: { eleccion: 'nacionales-2024', departamento: '_nacional' } });
    await flushPromises();

    expect(wrapper.text()).toContain('Frente Amplio'); // nivel lema del árbol
    expect(wrapper.find('.acc__cta').exists()).toBe(false); // ya hay filtro por lista nacional
    // El header vuelve al rótulo de árbol (hay listas Y partidos).
    expect(wrapper.find('.acc__toggle-lbl').text()).toBe('Filtrar por lista / partido');

    await expandPorLabel(wrapper, 'Ver listas de Frente Amplio');
    expect(wrapper.text()).toContain('UNIDAD PARA LA ESPERANZA');
  });
});
