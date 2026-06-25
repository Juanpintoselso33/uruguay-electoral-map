/**
 * Contrato de URL — fuente de verdad del estado del mapa (Story 1.7).
 *
 *   /{election}/{department}?zona=&opcion=&level=zona|serie|circuito&vs={election}
 *
 * Funciones PURAS (sin `window`/DOM) para que importen en SSR/build. El bridge al
 * `location`/`history` vive en `src/stores/map-state.ts`. Los nanostores ESPEJAN la
 * URL: no hay estado de sesión paralelo.
 */
import type { NivelGeografico } from './contracts';

export const NIVELES: readonly NivelGeografico[] = ['zona', 'serie', 'circuito', 'localidad'];
export const NIVEL_DEFAULT: NivelGeografico = 'zona';
export const BASE_NIVELES: readonly NivelGeografico[] = ['zona', 'barrio', 'localidad', 'serie'];

/** Vista del mapa derivada de la URL. `eleccion`/`departamento` son el contexto (path). */
export interface MapView {
  readonly eleccion: string;
  readonly departamento: string;
  readonly zona: string | null;
  readonly opcion: string | null;
  readonly level: NivelGeografico;
  /** Comparación contra otra elección (`?vs=`). */
  readonly vs: string | null;
  /** Forward-compat comparación dual (`?a=&b=`). */
  readonly a: string | null;
  readonly b: string | null;
  /** Contienda activa del selector de granularidad (`?cont=`, Epic 10): odn/odd/intendente/… */
  readonly contienda: string | null;
  /** Selección MÚLTIPLE de opciones (`?sel=` separado por coma, Epic 10): conjunto de opcionIds. */
  readonly seleccion: readonly string[];
  /** Modo de coloreo del mapa para la selección (`?modo=`, Epic 10): share/votos/heatmap (default ganador). */
  readonly modo: string | null;
  /** Nivel del ganador en el modo Ganador (`?gnivel=`): lema|precandidato|sublema|lista. Default lema. */
  readonly gnivel: string | null;
  /** Overlay de circuitos sobre el mapa base (`?circ=1`). */
  readonly circ: boolean;
}

function isNivel(v: string | null): v is NivelGeografico {
  return v !== null && (NIVELES as readonly string[]).includes(v);
}

/** Quita `/` de los bordes y separa segmentos no vacíos. */
function pathSegments(pathname: string): string[] {
  return pathname.split('/').filter((s) => s.length > 0).map(decodeURIComponent);
}

/**
 * Parsea pathname + search a una `MapView`. Tolera:
 * - elección en el path (`/{election}/{department}`) o en `?eleccion=` (override).
 * - params desconocidos: se ignoran.
 * - `level` inválido → default `zona`.
 */
export function parseUrl(pathname: string, search: string): MapView {
  const seg = pathSegments(pathname);
  const params = new URLSearchParams(search);

  const eleccionPath = seg[0] ?? '';
  const eleccion = params.get('eleccion') ?? eleccionPath;
  // Ruta nacional `/{eleccion}` (un solo segmento) → departamento '_nacional' (vista país, Epic 15).
  // Sin esto, la navegación orgánica (ClientRouter + transition:persist) re-parseaba departamento=''
  // y reloadData cargaba `/data/geo//…` → mapa roto.
  const departamento = seg[1] ?? (eleccionPath ? '_nacional' : '');

  const levelRaw = params.get('level');
  // Default de nivel: 'zona' por-depto; 'departamento' en la vista nacional (Epic 15.4).
  const level: NivelGeografico = isNivel(levelRaw)
    ? levelRaw
    : (departamento === '_nacional' ? 'departamento' : NIVEL_DEFAULT);

  const orNull = (v: string | null): string | null => (v && v.length > 0 ? v : null);

  const selRaw = params.get('sel');
  const seleccion = selRaw ? selRaw.split(',').map((s) => s.trim()).filter((s) => s.length > 0) : [];
  const circ = params.get('circ') === '1';

  return {
    eleccion,
    departamento,
    zona: orNull(params.get('zona')),
    opcion: orNull(params.get('opcion')),
    level,
    vs: orNull(params.get('vs')),
    a: orNull(params.get('a')),
    b: orNull(params.get('b')),
    contienda: orNull(params.get('cont')),
    seleccion,
    modo: orNull(params.get('modo')),
    gnivel: orNull(params.get('gnivel')),
    circ,
  };
}

/** Serializa una `MapView` a pathname + search. No emite params vacíos; `level=zona` se omite. */
export function toUrl(view: MapView): { pathname: string; search: string } {
  // Vista nacional: ruta de un solo segmento `/{eleccion}` (sin departamento); su nivel-default
  // es 'departamento' (no 'zona'), así el toggle a 'zona' SÍ se persiste en la URL.
  const esNacional = view.departamento === '_nacional';
  const pathname = esNacional
    ? `/${encodeURIComponent(view.eleccion)}`
    : `/${encodeURIComponent(view.eleccion)}/${encodeURIComponent(view.departamento)}`;
  const nivelDefault: NivelGeografico = esNacional ? 'departamento' : NIVEL_DEFAULT;
  const params = new URLSearchParams();
  if (view.zona) params.set('zona', view.zona);
  if (view.opcion) params.set('opcion', view.opcion);
  if (view.level !== nivelDefault) params.set('level', view.level);
  if (view.vs) params.set('vs', view.vs);
  if (view.a) params.set('a', view.a);
  if (view.b) params.set('b', view.b);
  if (view.contienda) params.set('cont', view.contienda);
  if (view.seleccion.length > 0) params.set('sel', view.seleccion.join(','));
  if (view.modo) params.set('modo', view.modo);
  if (view.gnivel && view.gnivel !== 'lema') params.set('gnivel', view.gnivel); // lema = default, se omite
  if (view.circ) params.set('circ', '1');
  const search = params.toString();
  return { pathname, search: search ? `?${search}` : '' };
}

/** Href completo (pathname + search) para `pushState`/links. */
export function toHref(view: MapView): string {
  const { pathname, search } = toUrl(view);
  return pathname + search;
}
