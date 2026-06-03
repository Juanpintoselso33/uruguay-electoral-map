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
