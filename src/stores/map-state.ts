/**
 * Stores nanostores que ESPEJAN la URL (Story 1.7). Cross-isla = solo estos stores.
 * La URL es la fuente de verdad: `commit()` escribe la URL y re-sincroniza los stores;
 * `popstate` (atrás/adelante, deep-link) re-sincroniza. Pinia global / vue-router prohibidos.
 *
 * SSR-safe: el bridge a `location`/`history` está guardado por `typeof window`.
 */
import { atom } from 'nanostores';
import type { NivelGeografico } from '../lib/contracts';
import { parseUrl, toHref, type MapView } from '../lib/url-state';

export interface Contexto {
  readonly eleccion: string;
  readonly departamento: string;
}
export interface Seleccion {
  readonly zona: string | null;
  readonly opcion: string | null;
}
export interface Comparacion {
  readonly vs: string | null;
  readonly a: string | null;
  readonly b: string | null;
}

export const $context = atom<Contexto>({ eleccion: '', departamento: '' });
export const $selection = atom<Seleccion>({ zona: null, opcion: null });
export const $level = atom<NivelGeografico>('zona');
export const $comparison = atom<Comparacion>({ vs: null, a: null, b: null });

/** Vuelca una `MapView` (parseada de la URL) a los stores. Puro respecto al DOM. */
export function hydrateStores(view: MapView): void {
  $context.set({ eleccion: view.eleccion, departamento: view.departamento });
  $selection.set({ zona: view.zona, opcion: view.opcion });
  $level.set(view.level);
  $comparison.set({ vs: view.vs, a: view.a, b: view.b });
}

/** Reconstruye la `MapView` actual a partir de los stores. */
export function currentView(): MapView {
  const ctx = $context.get();
  const sel = $selection.get();
  const cmp = $comparison.get();
  return {
    eleccion: ctx.eleccion,
    departamento: ctx.departamento,
    zona: sel.zona,
    opcion: sel.opcion,
    level: $level.get(),
    vs: cmp.vs,
    a: cmp.a,
    b: cmp.b,
  };
}

const hasWindow = (): boolean => typeof window !== 'undefined';

/** Inicializa los stores desde `location` y escucha `popstate`. No-op en SSR. */
export function bindToLocation(): void {
  if (!hasWindow()) return;
  const sync = (): void => hydrateStores(parseUrl(window.location.pathname, window.location.search));
  sync();
  window.addEventListener('popstate', sync);
}

/**
 * Aplica un cambio parcial: actualiza los stores afectados, serializa a URL y hace
 * `pushState` (la URL queda como fuente de verdad). No-op de history en SSR.
 */
export function commit(patch: Partial<MapView>): void {
  const next: MapView = { ...currentView(), ...patch };
  hydrateStores(next);
  if (hasWindow()) {
    window.history.pushState(null, '', toHref(next));
  }
}
