<script setup lang="ts">
/**
 * Isla mapa choropleth (Story 1.8, extendido Story 2.1).
 *
 * `client:load`. Pinta las unidades geográficas (barrios o series) por partido
 * ganador. Sigla como texto (markers HTML en centroides). Leyenda = partidos ganadores.
 *
 * Story 2.1: con ClientRouter + transition:persist el island sobrevive la navegación
 * entre departamentos. En `astro:after-swap` recarga datos sin re-inicializar MapLibre
 * (NFR1 anti-jank). La URL es la fuente de verdad; nanostores espejan.
 */
import { onMounted, onUnmounted, ref, shallowRef } from 'vue';
import type { Map as MlMap, Marker as MlMarker, LngLatBoundsLike, GeoJSONSource } from 'maplibre-gl';
import type { Feature, FeatureCollection, Polygon, MultiPolygon, Position } from 'geojson';
import type { Topology, GeometryCollection } from 'topojson-specification';
import { feature as topoFeature } from 'topojson-client';
import { resolveParty } from '../../lib/party-meta';
import type { VotosShard } from '../../lib/contracts';
import { $selection, $level, $comparison, bindToLocation, commit, hydrateStores } from '../../stores/map-state';
import { parseUrl } from '../../lib/url-state';
import type { NivelGeografico } from '../../lib/contracts';
import MapLegend from './MapLegend.vue';
import ZoneSheet from '../sheet/ZoneSheet.vue';

const props = defineProps<{ eleccion: string; departamento: string }>();

// Niveles geo disponibles por depto. Actualizar al agregar deptos o nuevos niveles de datos.
const DEPT_AVAIL: Record<string, NivelGeografico[]> = {
  montevideo: ['zona'],
  rivera:     ['serie'],
};

interface OpcionesDoc {
  opciones: { opcionId: string; nombre: string }[];
}
interface SelInfo {
  geoId: string;
  sigla: string;
  nombre: string;
  color: string;
  votoGanador: number;
  validos: number;
  pct: number;
  enBlanco: number;
  anulados: number;
  observados: number;
  pctOpcionActiva: number | null;
}
interface LegendEntry {
  sigla: string;
  nombre: string;
  color: string;
  votos: number;
}

const COLOR_SIN_DATOS = '#e5e7eb';
const INTENSIDAD_LIGHT = '#f0f4f8';
const mapEl = ref<HTMLDivElement | null>(null);
const status = ref<'cargando' | 'listo' | 'error'>('cargando');
const errorMsg = ref('');
const legend = ref<LegendEntry[]>([]);
const sinDatos = ref(0);
const selected = ref<SelInfo | null>(null);
const map = shallowRef<MlMap | null>(null);
const fcRef = shallowRef<FeatureCollection | null>(null);
const markers: MlMarker[] = [];
// Toggle de vista (Story 2.3): 'ganador' (default) o 'intensidad'.
const vistaMode = ref<'ganador' | 'intensidad'>('ganador');
// Ref reactivo de la opción activa para el toggle UI.
const opcionActiva = ref<string | null>(null);

// MapLibre module guardado para crear Markers en reloadData sin re-importar.
let mlLib: typeof import('maplibre-gl') | null = null;
// Contexto en curso (para detectar cambio en astro:after-swap).
let activeEleccion = props.eleccion;
let activeDepartamento = props.departamento;
// Nivel activo en curso (sincronizado con URL/$level tras resolución de DEPT_AVAIL).
let activeNivel: NivelGeografico = 'zona';
// Unsub de $level para limpiar en onUnmounted.
let unsubLevel: (() => void) | null = null;
// Catálogo opcionId→nombre y snapshot de leyenda en modo ganador (Story 2.2).
let opcNombreMap = new Map<string, string>();
let origLegend: LegendEntry[] = [];
// Votos por zona por opción (Story 2.3 — intensidad).
let zonasVotos = new Map<string, Map<string, number>>();
let zonasValidos = new Map<string, number>();
// Categorías no partidarias por zona (Story 2.4 — ficha).
let zonasNoPartidarios = new Map<string, { enBlanco: number; anulados: number; observados: number }>();
// Flag: indica si se hizo setData con FC de intensidad (para saber cuándo restaurar).
let intensidadActive = false;
// Comparación dual (Story 4.3): ganador por zona de la elección de comparación.
let vsWinnersMap = new Map<string, string>(); // normalizedGeoId → nombre del ganador en elección vs
let unsubComparison: (() => void) | null = null;

function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
}

function centroid(geom: Polygon | MultiPolygon): [number, number] {
  const rings: Position[][] = geom.type === 'Polygon' ? [geom.coordinates[0]] : geom.coordinates.map((p) => p[0]);
  let best: Position[] = rings[0] ?? [];
  let bestLen = -1;
  for (const r of rings) {
    if (r.length > bestLen) { bestLen = r.length; best = r; }
  }
  let x = 0;
  let y = 0;
  for (const [lng, lat] of best) { x += lng; y += lat; }
  const n = best.length || 1;
  return [x / n, y / n];
}

function boundsOf(fc: FeatureCollection): LngLatBoundsLike {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const visit = (pos: Position): void => {
    if (pos[0] < minX) minX = pos[0];
    if (pos[0] > maxX) maxX = pos[0];
    if (pos[1] < minY) minY = pos[1];
    if (pos[1] > maxY) maxY = pos[1];
  };
  const walk = (coords: unknown): void => {
    if (Array.isArray(coords) && typeof coords[0] === 'number') visit(coords as Position);
    else if (Array.isArray(coords)) coords.forEach(walk);
  };
  for (const f of fc.features) walk((f.geometry as Polygon | MultiPolygon).coordinates);
  return [[minX, minY], [maxX, maxY]];
}

async function loadData(eleccion: string, departamento: string, nivel: string): Promise<{ fc: FeatureCollection; bounds: LngLatBoundsLike }> {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const [topoRes, votesRes, opcRes] = await Promise.all([
    fetch(`${base}/data/geo/${departamento}/${nivel}.topo.json`),
    fetch(`${base}/data/${eleccion}/${departamento}/votes.json`),
    fetch(`${base}/data/${eleccion}/${departamento}/opciones.json`),
  ]);
  if (!topoRes.ok || !votesRes.ok || !opcRes.ok) throw new Error('No se pudieron cargar los datos del mapa');
  const topo = (await topoRes.json()) as Topology;
  const votes = (await votesRes.json()) as VotosShard;
  const opcDoc = (await opcRes.json()) as OpcionesDoc;

  const objName = Object.keys(topo.objects)[0];
  const geo = topoFeature(topo, topo.objects[objName] as GeometryCollection) as FeatureCollection;

  const nombrePorOpcion = new Map(opcDoc.opciones.map((o) => [o.opcionId, o.nombre]));
  opcNombreMap = nombrePorOpcion;

  // Poblar índices para modo intensidad (Story 2.3) y ficha (Story 2.4).
  zonasVotos = new Map();
  zonasValidos = new Map();
  zonasNoPartidarios = new Map();
  for (const z of votes.zonas) {
    const key = norm(z.geoId);
    const m = new Map<string, number>();
    for (const { opcionId, votos } of z.porOpcion) m.set(opcionId, votos);
    zonasVotos.set(key, m);
    zonasValidos.set(key, z.validos);
    zonasNoPartidarios.set(key, {
      enBlanco: z.noPartidarios.enBlanco,
      anulados: z.noPartidarios.anulados,
      observados: z.noPartidarios.observados,
    });
  }

  const zonaPorGeo = new Map(votes.zonas.map((z) => [norm(z.geoId), z]));
  const barriosGanados = new Map<string, number>();

  let sin = 0;
  for (const f of geo.features) {
    const name = String((f.properties as { name: string }).name);
    const zona = zonaPorGeo.get(norm(name));
    const p = f.properties as Record<string, unknown>;
    p.name = name;
    if (zona && zona.porOpcion.length > 0) {
      const nombre = nombrePorOpcion.get(zona.ganadorOpcionId) ?? zona.ganadorOpcionId;
      const meta = resolveParty(nombre);
      p.color = meta.color;
      p.sigla = meta.sigla;
      p.nombre = nombre;
      p.validos = zona.validos;
      p.hasData = true;
      p.ganadorOpcionId = zona.ganadorOpcionId;
      barriosGanados.set(zona.ganadorOpcionId, (barriosGanados.get(zona.ganadorOpcionId) ?? 0) + 1);
    } else {
      p.color = COLOR_SIN_DATOS;
      p.sigla = '';
      p.hasData = false;
      sin++;
    }
  }
  sinDatos.value = sin;

  legend.value = [...barriosGanados.entries()]
    .map(([opcionId, barrios]) => {
      const nombre = nombrePorOpcion.get(opcionId) ?? opcionId;
      const meta = resolveParty(nombre);
      return { sigla: meta.sigla, nombre, color: meta.color, votos: barrios };
    })
    .sort((a, b) => b.votos - a.votos);
  origLegend = legend.value;

  return { fc: geo, bounds: boundsOf(geo) };
}

/** Reconstruye los markers de sigla. Limpia los anteriores antes.
 *  Si `filterOpcionId` está definido, sólo pinta markers en zonas donde esa opción ganó. */
function rebuildMarkers(fc: FeatureCollection, filterOpcionId?: string | null): void {
  if (!mlLib || !map.value) return;
  markers.forEach((mk) => mk.remove());
  markers.length = 0;
  for (const f of fc.features) {
    const p = f.properties as Record<string, unknown>;
    if (!p.hasData) continue;
    if (filterOpcionId && p.ganadorOpcionId !== filterOpcionId) continue;
    const [lng, lat] = centroid(f.geometry as Polygon | MultiPolygon);
    const el = document.createElement('span');
    el.className = 'zona-sigla';
    el.textContent = String(p.sigla);
    el.setAttribute('aria-hidden', 'true');
    markers.push(new mlLib!.Marker({ element: el }).setLngLat([lng, lat]).addTo(map.value!));
  }
}

/** Interpolación lineal entre dos colores #rrggbb (Story 2.3). */
function interpolateHex(c1: string, c2: string, t: number): string {
  const p = (s: string) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
  const [r1, g1, b1] = p(c1);
  const [r2, g2, b2] = p(c2);
  const h = (n: number) => Math.round(n).toString(16).padStart(2, '0');
  return `#${h(r1 + (r2 - r1) * t)}${h(g1 + (g2 - g1) * t)}${h(b1 + (b2 - b1) * t)}`;
}

/** Construye un FC con colores de gradiente según % de voto para la opcion dada (Story 2.3). */
function buildIntensidadFC(fc: FeatureCollection, opcionId: string, partyColor: string): FeatureCollection {
  let maxPct = 0;
  for (const f of fc.features) {
    const key = norm(String((f.properties as { name: string }).name));
    const votos = zonasVotos.get(key)?.get(opcionId) ?? 0;
    const validos = zonasValidos.get(key) ?? 0;
    if (validos > 0 && votos / validos > maxPct) maxPct = votos / validos;
  }
  return {
    ...fc,
    features: fc.features.map((f) => {
      const key = norm(String((f.properties as { name: string }).name));
      const votos = zonasVotos.get(key)?.get(opcionId) ?? 0;
      const validos = zonasValidos.get(key) ?? 0;
      const t = validos > 0 && maxPct > 0 ? (votos / validos) / maxPct : 0;
      return { ...f, properties: { ...f.properties, color: t > 0.01 ? interpolateHex(INTENSIDAD_LIGHT, partyColor, t) : COLOR_SIN_DATOS } };
    }),
  } as FeatureCollection;
}

/** Construye la leyenda para modo intensidad (3 swatches: alto/medio/bajo) (Story 2.3). */
function buildIntensidadLegend(nombre: string, meta: { sigla: string; color: string }): LegendEntry[] {
  return [
    { sigla: meta.sigla, nombre: `${nombre} — intensidad alta`, color: meta.color, votos: 0 },
    { sigla: '', nombre: 'Intensidad media', color: interpolateHex(INTENSIDAD_LIGHT, meta.color, 0.4), votos: 0 },
    { sigla: '', nombre: 'Intensidad baja', color: interpolateHex(INTENSIDAD_LIGHT, meta.color, 0.15), votos: 0 },
  ];
}

/** Aplica modo ganador (Story 2.2): zonas donde gana opcion en color, resto gris. */
function applyGanadorMode(opcionId: string, m: MlMap, fc: FeatureCollection): void {
  if (intensidadActive) {
    (m.getSource('zonas') as GeoJSONSource).setData(fc);
    m.setPaintProperty('zonas-fill', 'fill-color', ['get', 'color']);
    intensidadActive = false;
  }
  m.setPaintProperty('zonas-fill', 'fill-color', [
    'case',
    ['==', ['get', 'ganadorOpcionId'], opcionId],
    ['get', 'color'],
    COLOR_SIN_DATOS,
  ]);
  rebuildMarkers(fc, opcionId);
  const nombre = opcNombreMap.get(opcionId) ?? opcionId;
  const meta = resolveParty(nombre);
  const count = fc.features.filter(
    (f) => (f.properties as { ganadorOpcionId?: string }).ganadorOpcionId === opcionId,
  ).length;
  legend.value = [{ sigla: meta.sigla, nombre, color: meta.color, votos: count }];
}

/** Aplica modo intensidad (Story 2.3): gradiente de % de voto para opcion dada. */
function applyIntensidadMode(opcionId: string, m: MlMap, fc: FeatureCollection): void {
  const nombre = opcNombreMap.get(opcionId) ?? opcionId;
  const meta = resolveParty(nombre);
  const gradientFC = buildIntensidadFC(fc, opcionId, meta.color);
  (m.getSource('zonas') as GeoJSONSource).setData(gradientFC);
  m.setPaintProperty('zonas-fill', 'fill-color', ['get', 'color']);
  intensidadActive = true;
  // Sin markers en modo intensidad (todos los colores son del mismo partido).
  markers.forEach((mk) => mk.remove());
  markers.length = 0;
  legend.value = buildIntensidadLegend(nombre, meta);
}

/** Aplica o limpia el filtro de opción, respetando el vistaMode actual (Stories 2.2 / 2.3). */
function applyOpcionFilter(opcionId: string | null): void {
  const m = map.value;
  const fc = fcRef.value;
  if (!m || !fc || !m.getSource('zonas')) return;
  if (!opcionId) {
    if (intensidadActive) {
      (m.getSource('zonas') as GeoJSONSource).setData(fc);
      intensidadActive = false;
    }
    m.setPaintProperty('zonas-fill', 'fill-color', ['get', 'color']);
    rebuildMarkers(fc);
    legend.value = origLegend;
    vistaMode.value = 'ganador';
    return;
  }
  if (vistaMode.value === 'intensidad') {
    applyIntensidadMode(opcionId, m, fc);
  } else {
    applyGanadorMode(opcionId, m, fc);
  }
}

/** Cambia el modo de vista y re-aplica con la opción activa (Story 2.3). */
function setVista(mode: 'ganador' | 'intensidad'): void {
  vistaMode.value = mode;
  applyOpcionFilter($selection.get().opcion);
}

/**
 * Carga datos de la elección de comparación y aplica el overlay de cambio (Story 4.3).
 * Zonas donde el ganador difiere de la elección base reciben feature-state vsChanged=true,
 * activando el borde naranja en la capa zonas-vs-changed.
 */
async function applyComparisonOverlay(vs: string, baseEleccion: string, departamento: string, nivel: string): Promise<void> {
  const m = map.value;
  const fc = fcRef.value;
  if (!m || !fc || status.value !== 'listo') return;
  try {
    const base = import.meta.env.BASE_URL.replace(/\/$/, '');
    const [votesRes, opcRes] = await Promise.all([
      fetch(`${base}/data/${vs}/${departamento}/votes.json`),
      fetch(`${base}/data/${vs}/${departamento}/opciones.json`),
    ]);
    if (!votesRes.ok || !opcRes.ok) return;
    const votes = (await votesRes.json()) as VotosShard;
    const opcDoc = (await opcRes.json()) as OpcionesDoc;
    const vsNombrePorOpcion = new Map(opcDoc.opciones.map((o) => [o.opcionId, o.nombre]));
    vsWinnersMap = new Map();
    for (const z of votes.zonas) {
      if (z.porOpcion.length > 0) {
        vsWinnersMap.set(norm(z.geoId), vsNombrePorOpcion.get(z.ganadorOpcionId) ?? z.ganadorOpcionId);
      }
    }
    // Activar feature-state vsChanged para zonas con ganador distinto.
    for (const f of fc.features) {
      const name = String((f.properties as { name: string }).name);
      const baseNombre = String((f.properties as { nombre?: string }).nombre ?? '');
      const vsNombre = vsWinnersMap.get(norm(name)) ?? null;
      const changed = vsNombre !== null && baseNombre !== '' && baseNombre !== vsNombre;
      m.setFeatureState({ source: 'zonas', id: name }, { vsChanged: changed });
    }
    // Marcar continuidad en leyenda: partidos sin presencia en la elección de comparación.
    const vsNombres = new Set([...vsWinnersMap.values()]);
    const year = baseEleccion.match(/\d{4}/)?.[0] ?? baseEleccion;
    legend.value = origLegend.map((entry) =>
      vsNombres.has(entry.nombre) ? entry : { ...entry, nombre: `${entry.nombre} (solo ${year})` },
    );
  } catch {
    // Degradación silenciosa: si no hay datos de comparación, el mapa sigue normal.
  }
}

/** Limpia el overlay de comparación: restaura feature-states y leyenda original (Story 4.3). */
function clearComparisonOverlay(): void {
  const m = map.value;
  const fc = fcRef.value;
  if (!m || !fc) return;
  for (const f of fc.features) {
    const name = String((f.properties as { name: string }).name);
    m.setFeatureState({ source: 'zonas', id: name }, { vsChanged: false });
  }
  vsWinnersMap = new Map();
  legend.value = origLegend;
}

/**
 * Recarga datos en el mapa ya inicializado (sin re-init de MapLibre — NFR1).
 * Llamado desde el handler astro:after-swap cuando cambia el departamento/elección.
 */
async function reloadData(eleccion: string, departamento: string, nivel: string): Promise<void> {
  const m = map.value;
  if (!m) return;
  status.value = 'cargando';
  // Resetear modo intensidad al cambiar de departamento (AC Story 2.3).
  intensidadActive = false;
  vistaMode.value = 'ganador';
  try {
    const { fc, bounds } = await loadData(eleccion, departamento, nivel);
    // Esperar a que la fuente esté lista (puede que el mapa aún esté cargando).
    if (m.getSource('zonas')) {
      (m.getSource('zonas') as GeoJSONSource).setData(fc);
    }
    m.fitBounds(bounds, { padding: 24 });
    rebuildMarkers(fc);
    fcRef.value = fc;
    origLegend = legend.value;

    // Limpiar zona si no existe en el nuevo departamento (AC Story 2.1).
    const sel = $selection.get();
    const selZona = sel.zona;
    const zonaExiste = selZona && fc.features.some(
      (f) => norm(String((f.properties as { name: string }).name)) === norm(selZona),
    );
    if (selZona && !zonaExiste) {
      commit({ zona: null });
    } else {
      applySelection(selZona);
    }
    // Reaplicar filtro de opción si había uno activo al cambiar de departamento (Story 2.2).
    applyOpcionFilter(sel.opcion);
    status.value = 'listo';
    // Reaplicar overlay de comparación si sigue activo (Story 4.3).
    const vs = $comparison.get().vs;
    if (vs && vs !== eleccion) {
      void applyComparisonOverlay(vs, eleccion, departamento, nivel);
    }
  } catch (err) {
    status.value = 'error';
    errorMsg.value = err instanceof Error ? err.message : String(err);
  }
}

function selectByName(name: string, fc: FeatureCollection): void {
  const f = fc.features.find((ft) => norm(String((ft.properties as { name: string }).name)) === norm(name));
  const p = f?.properties as Record<string, unknown> | undefined;
  if (p && p.hasData) {
    const key = norm(name);
    const ganadorId = String(p.ganadorOpcionId);
    const votoGanador = zonasVotos.get(key)?.get(ganadorId) ?? 0;
    const validos = Number(p.validos);
    const noP = zonasNoPartidarios.get(key) ?? { enBlanco: 0, anulados: 0, observados: 0 };
    const opcionId = $selection.get().opcion;
    const pctOpcionActiva = opcionId && validos > 0
      ? ((zonasVotos.get(key)?.get(opcionId) ?? 0) / validos) * 100
      : null;
    selected.value = {
      geoId: String(p.name),
      sigla: String(p.sigla),
      nombre: String(p.nombre),
      color: String(p.color),
      votoGanador,
      validos,
      pct: validos > 0 ? (votoGanador / validos) * 100 : 0,
      enBlanco: noP.enBlanco,
      anulados: noP.anulados,
      observados: noP.observados,
      pctOpcionActiva,
    };
  } else if (p) {
    selected.value = {
      geoId: String(p.name), sigla: '', nombre: 'Sin datos', color: '#e5e7eb',
      votoGanador: 0, validos: 0, pct: 0, enBlanco: 0, anulados: 0, observados: 0,
      pctOpcionActiva: null,
    };
  }
}

let prevSelId: string | null = null;
function applySelection(zona: string | null): void {
  const m = map.value;
  if (!m || !m.getSource('zonas')) return;
  if (prevSelId !== null) m.setFeatureState({ source: 'zonas', id: prevSelId }, { sel: false });
  if (zona) {
    m.setFeatureState({ source: 'zonas', id: zona }, { sel: true });
    if (fcRef.value) selectByName(zona, fcRef.value);
  } else {
    selected.value = null;
  }
  prevSelId = zona;
}
$selection.subscribe((s) => {
  opcionActiva.value = s.opcion;
  applySelection(s.zona);
  applyOpcionFilter(s.opcion);
});

/** Resuelve el nivel efectivo: si el pedido por URL no está disponible para el depto, usa el primero disponible. */
function resolveNivel(departamento: string, urlLevel: NivelGeografico): NivelGeografico {
  const avail = DEPT_AVAIL[departamento] ?? (['zona'] as NivelGeografico[]);
  return avail.includes(urlLevel) ? urlLevel : avail[0];
}

let afterSwapHandler: (() => void) | null = null;

onMounted(async () => {
  bindToLocation();

  // Suscribir $level para reaccionar a cambios de nivel (clic en LevelSelector).
  // Solo recargar si el nivel es distinto al activo y está disponible para este depto.
  unsubLevel = $level.subscribe((newLevel) => {
    const resolved = resolveNivel(activeDepartamento, newLevel);
    if (resolved !== activeNivel && map.value) {
      activeNivel = resolved;
      void reloadData(activeEleccion, activeDepartamento, resolved);
    }
  });

  // Suscribir $comparison para entrar/salir del modo comparación (Story 4.3).
  // hydrateStores (llamado en after-swap y bindToLocation) ya actualiza este store.
  unsubComparison = $comparison.subscribe((cmp) => {
    if (!map.value || status.value !== 'listo') return;
    if (cmp.vs && cmp.vs !== activeEleccion) {
      void applyComparisonOverlay(cmp.vs, activeEleccion, activeDepartamento, activeNivel);
    } else {
      clearComparisonOverlay();
    }
  });

  try {
    mlLib = await import('maplibre-gl');
    // Resolver nivel desde URL ($level) respetando disponibilidad del depto.
    const urlLevel = $level.get();
    const geoNivel = resolveNivel(props.departamento, urlLevel);
    activeNivel = geoNivel;
    // Si el nivel efectivo difiere del de la URL, corregir la URL silenciosamente (AC4: Rivera).
    if (geoNivel !== urlLevel) commit({ level: geoNivel });
    const { fc, bounds } = await loadData(props.eleccion, props.departamento, geoNivel);
    if (!mapEl.value) return;

    const m: MlMap = new mlLib.Map({
      container: mapEl.value,
      style: { version: 8, sources: {}, layers: [] },
      bounds,
      fitBoundsOptions: { padding: 24 },
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
    });
    map.value = m;

    m.on('load', () => {
      m.addSource('zonas', { type: 'geojson', data: fc, promoteId: 'name' });
      m.addLayer({ id: 'zonas-fill', type: 'fill', source: 'zonas', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.85 } });
      m.addLayer({ id: 'zonas-line', type: 'line', source: 'zonas', paint: { 'line-color': '#ffffff', 'line-width': 0.6 } });
      // Overlay de comparación (Story 4.3): borde naranja en zonas que cambiaron ganador.
      m.addLayer({
        id: 'zonas-vs-changed',
        type: 'line',
        source: 'zonas',
        paint: {
          'line-color': '#f97316',
          'line-width': ['case', ['boolean', ['feature-state', 'vsChanged'], false], 3, 0],
        },
      });
      m.addLayer({
        id: 'zonas-sel',
        type: 'line',
        source: 'zonas',
        paint: {
          'line-color': '#111827',
          'line-width': ['case', ['boolean', ['feature-state', 'sel'], false], 2.5, 0],
        },
      });

      rebuildMarkers(fc);
      fcRef.value = fc;

      m.on('click', 'zonas-fill', (e) => {
        const f = e.features?.[0];
        if (!f) return;
        commit({ zona: String((f.properties as { name: string }).name) });
      });
      m.on('mouseenter', 'zonas-fill', () => { m.getCanvas().style.cursor = 'pointer'; });
      m.on('mouseleave', 'zonas-fill', () => { m.getCanvas().style.cursor = ''; });

      applySelection($selection.get().zona);
      applyOpcionFilter($selection.get().opcion);
      status.value = 'listo';
      // Aplicar overlay de comparación si la URL ya traía ?vs= (Story 4.3).
      const initVs = $comparison.get().vs;
      if (initVs && initVs !== props.eleccion) {
        void applyComparisonOverlay(initVs, props.eleccion, props.departamento, activeNivel);
      }
    });
  } catch (err) {
    status.value = 'error';
    errorMsg.value = err instanceof Error ? err.message : String(err);
  }

  // Escuchar astro:after-swap (ClientRouter) para recargar datos sin re-init del mapa.
  const handler = () => {
    const view = parseUrl(window.location.pathname, window.location.search);
    hydrateStores(view);
    if (view.eleccion !== activeEleccion || view.departamento !== activeDepartamento) {
      activeEleccion = view.eleccion;
      activeDepartamento = view.departamento;
      const newNivel = resolveNivel(view.departamento, view.level);
      activeNivel = newNivel;
      if (newNivel !== view.level) commit({ level: newNivel });
      void reloadData(view.eleccion, view.departamento, newNivel);
    }
  };
  afterSwapHandler = handler;
  // astro:after-swap se despacha en document (no en window) — Astro View Transitions.
  document.addEventListener('astro:after-swap', handler);
});

onUnmounted(() => {
  markers.forEach((mk) => mk.remove());
  map.value?.remove();
  if (afterSwapHandler) document.removeEventListener('astro:after-swap', afterSwapHandler);
  unsubLevel?.();
  unsubComparison?.();
});
</script>

<template>
  <section class="map-wrap" aria-label="Mapa electoral por zona">
    <div ref="mapEl" class="map" role="img" :aria-label="`Mapa de ${departamento}, ${eleccion}, coloreado por partido ganador`"></div>

    <p v-if="status === 'cargando'" class="map-status">Cargando mapa…</p>
    <p v-else-if="status === 'error'" class="map-status map-status--error">Error: {{ errorMsg }}</p>

    <ZoneSheet
      :sel="selected"
      :opcion-sigla="opcionActiva ? (opcNombreMap.get(opcionActiva) ? resolveParty(opcNombreMap.get(opcionActiva)!).sigla : opcionActiva) : null"
      @close="commit({ zona: null })"
    />

    <!-- Toggle Ganador / Intensidad — sólo visible cuando hay opción activa (Story 2.3) -->
    <div v-if="opcionActiva" class="vista-toggle" role="group" aria-label="Tipo de vista del mapa">
      <button
        class="vista-toggle__btn"
        :class="{ 'vista-toggle__btn--activo': vistaMode === 'ganador' }"
        :aria-pressed="vistaMode === 'ganador'"
        type="button"
        @click="setVista('ganador')"
      >Ganador</button>
      <button
        class="vista-toggle__btn"
        :class="{ 'vista-toggle__btn--activo': vistaMode === 'intensidad' }"
        :aria-pressed="vistaMode === 'intensidad'"
        type="button"
        @click="setVista('intensidad')"
      >Intensidad</button>
    </div>

    <MapLegend :entradas="legend" :sin-datos="sinDatos" />
  </section>
</template>

<style>
@import 'maplibre-gl/dist/maplibre-gl.css';
</style>

<style scoped>
.map-wrap {
  display: flex;
  flex-direction: column;
}
.map {
  width: 100%;
  height: 60vh;
  min-height: 320px;
  background: #f8fafc;
}
.map-status {
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  color: #6b7280;
}
.map-status--error {
  color: #b91c1c;
}
.vista-toggle {
  display: flex;
  gap: 0;
  padding: 0.5rem 0.75rem;
  border-top: 1px solid #e5e7eb;
}
.vista-toggle__btn {
  flex: 1;
  padding: 0.375rem 0.5rem;
  font-size: 0.8125rem;
  background: #f9fafb;
  border: 1px solid #d1d5db;
  cursor: pointer;
  color: #374151;
  min-height: 44px;
}
.vista-toggle__btn:first-child {
  border-radius: 0.25rem 0 0 0.25rem;
}
.vista-toggle__btn:last-child {
  border-radius: 0 0.25rem 0.25rem 0;
  border-left: none;
}
.vista-toggle__btn--activo {
  background: #1d4ed8;
  color: #fff;
  font-weight: 700;
  border-color: #1d4ed8;
}
:global(.zona-sigla) {
  font:
    700 0.6875rem/1 system-ui,
    sans-serif;
  color: #111827;
  text-shadow:
    0 0 2px #fff,
    0 0 2px #fff,
    0 0 2px #fff;
  pointer-events: none;
  user-select: none;
}
</style>
