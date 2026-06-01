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
import { $selection, $level, $comparison, $circuito, bindToLocation, commit, hydrateStores } from '../../stores/map-state';
import { parseUrl } from '../../lib/url-state';
import type { NivelGeografico } from '../../lib/contracts';
import deptsConfig from '../../config/departments.json';

const DEPT_LEVELS: Record<string, NivelGeografico[]> = Object.fromEntries(
  (deptsConfig as { id: string; levels: NivelGeografico[] }[]).map((d) => [d.id, d.levels])
);
import MapLegend from './MapLegend.vue';
import ZoneSheet from '../sheet/ZoneSheet.vue';

const props = defineProps<{
  eleccion: string;
  departamento: string;
  availableLevels?: NivelGeografico[];
}>();

interface OpcionesDoc {
  opciones: { opcionId: string; nombre: string }[];
}
interface SelInfo {
  geoId: string;
  /** Etiqueta de display: "Localidad · SERIE" en nivel serie, undefined en otros niveles. */
  label?: string;
  sigla: string;
  nombre: string;
  color: string;
  flagUrl?: string | null;
  votoGanador: number;
  validos: number;
  pct: number;
  enBlanco: number;
  anulados: number;
  observados: number;
  pctOpcionActiva: number | null;
  // Epic 10 (Story 10.5): desglose por hoja de la selección en esta zona.
  seleccionTotal?: number;
  seleccionPct?: number;
  desglose?: DesgloseGrupo[];
  esCiudadGrande?: boolean;
}
interface DesgloseGrupo {
  lemaNombre: string;
  sigla: string;
  color: string;
  flagUrl?: string | null;
  total: number;
  hojas: { id: string; label: string; votos: number }[];
  masN: number;
}
interface LegendEntry {
  sigla: string;
  nombre: string;
  color: string;
  votos: number;
  flagUrl?: string | null;
}

let COLOR_SIN_DATOS = '#e5e7eb';
const INTENSIDAD_LIGHT = '#f0f4f8';
let isDark = false;
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
// Ciudades grandes para nivel localidad (Story 8.4 — rótulo degradación).
let ciudadesGrandesSet = new Set<string>();
// Flag: indica si se hizo setData con FC de intensidad (para saber cuándo restaurar).
let intensidadActive = false;
// Comparación dual (Story 4.3): ganador por zona de la elección de comparación.
let vsWinnersMap = new Map<string, string>(); // normalizedGeoId → nombre del ganador en elección vs
let unsubComparison: (() => void) | null = null;
// True cuando el nivel activo usa geometría Point (circuito) en lugar de Polygon (Story 6.3).
let isPointNivel = false;
// Unsub del overlay de circuitos.
let unsubCircuito: (() => void) | null = null;
// True mientras el mapa está en movimiento (pan/zoom): evita redibujar dots de circuito en cada frame.
let isMapMoving = false;
// Mapa serie-code → nombre de localidad (solo nivel serie, interior).
let serieLocalidadMap: Map<string, string> = new Map();
// Mapa serie-code → nombre de barrio dentro de la capital (prioridad sobre localidad).
let serieBarrioMap: Map<string, string> = new Map();

const SERIE_BARRIO_FILES: Record<string, string> = {
  artigas:       'artigas-serie-barrio.json',
  cerro_largo:   'melo-serie-barrio.json',
  durazno:       'durazno-serie-barrio.json',
  paysandu:      'paysandu-serie-barrio.json',
  rivera:        'rivera-serie-barrio.json',
  salto:         'salto-serie-barrio.json',
  san_jose:      'san_jose_de_mayo-serie-barrio.json',
  treinta_y_tres:'treinta_y_tres-serie-barrio.json',
};

// ── Epic 10: coloreo por selección múltiple de HOJAS (Story 10.4) ──────────────
const SEL_BASE = '#1d4ed8'; // azul secuencial para la escala de selección
const seleccionActiva = ref<string[]>([]);
const coloreoMode = ref<'share' | 'votos' | 'heatmap'>('share');
// hojaId → {contienda, lemaId, hoja, lemaNombre} (del catalogo.json). Null = aún no cargado.
let catalogoOpcMeta: Map<string, { contienda: string; lemaId: string; hoja: string; lemaNombre: string }> | null = null;
// zonaNorm → hojaId → votos (acumulado de los shards de hoja cargados).
let hojaVotos = new Map<string, Map<string, number>>();
let lemasCargados = new Set<string>(); // `${contienda}/${lemaId}` ya fetcheados
// Story 7.8: a nivel localidad/barrio los shards de hoja están keyed por serie y no joinean por
// nombre de localidad/barrio. Cargamos UN consolidado `hoja-{nivel}.json` (re-agregado en ETL) que
// ya viene keyed por la zona geográfica. Guardamos la promise (no un bool) para que llamadas
// concurrentes esperen al MISMO fetch y vean `hojaVotos` ya poblado (cf. catalogoPromise).
let hojaGeoPromise: Promise<boolean> | null = null;
let seleccionFCActive = false; // true cuando setData usó un FC de selección
let catalogoPromise: Promise<void> | null = null; // dedup de la carga del catálogo (evita race)

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
  for (const f of fc.features) {
    if (f.geometry.type === 'Point') visit(f.geometry.coordinates as Position);
    else walk((f.geometry as Polygon | MultiPolygon).coordinates);
  }
  return [[minX, minY], [maxX, maxY]];
}

async function loadData(eleccion: string, departamento: string, nivel: string): Promise<{ fc: FeatureCollection; bounds: LngLatBoundsLike }> {
  isPointNivel = nivel === 'circuito';
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const votesFile = nivel === 'circuito' ? 'votes-circuito.json'
                  : nivel === 'localidad' ? 'votes-localidad.json'
                  : nivel === 'barrio'    ? 'votes-barrio.json'
                  : 'votes.json';
  const [topoRes, votesRes, opcRes, metaRes, serieMapRes, serieBarrioRes] = await Promise.all([
    fetch(`${base}/data/geo/${departamento}/${nivel}.topo.json`),
    fetch(`${base}/data/${eleccion}/${departamento}/${votesFile}`),
    fetch(`${base}/data/${eleccion}/${departamento}/opciones.json`),
    nivel === 'localidad'
      ? fetch(`${base}/data/${eleccion}/${departamento}/localidad-meta.json`).catch(() => null)
      : Promise.resolve(null),
    nivel === 'serie'
      ? fetch(`${base}/data/mappings/${departamento}/serie-localidad.json`).catch(() => null)
      : Promise.resolve(null),
    nivel === 'serie' && SERIE_BARRIO_FILES[departamento]
      ? fetch(`${base}/data/mappings/${departamento}/${SERIE_BARRIO_FILES[departamento]}`).catch(() => null)
      : Promise.resolve(null),
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
      p.flagUrl = meta.flagUrl;
      p.flagPattern = meta.flagUrl ? `flag-${meta.sigla.toLowerCase()}` : null;
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
      return { sigla: meta.sigla, nombre, color: meta.color, votos: barrios, flagUrl: meta.flagUrl };
    })
    .sort((a, b) => b.votos - a.votos);
  origLegend = legend.value;

  ciudadesGrandesSet = new Set<string>();
  if (metaRes?.ok) {
    try {
      const metaDoc = (await metaRes.json()) as { ciudadesGrandes: string[] };
      ciudadesGrandesSet = new Set(metaDoc.ciudadesGrandes.map(norm));
    } catch { /* malformed — empty set */ }
  }

  serieLocalidadMap = new Map();
  if (serieMapRes?.ok) {
    try {
      const serieDoc = (await serieMapRes.json()) as { serie: string; localidad: string }[];
      for (const { serie, localidad } of serieDoc) {
        serieLocalidadMap.set(serie.toLowerCase(), localidad);
      }
    } catch { /* ignore */ }
  }

  serieBarrioMap = new Map();
  if (serieBarrioRes?.ok) {
    try {
      const barrioDoc = (await serieBarrioRes.json()) as { serie: string; barrio: string }[];
      for (const { serie, barrio } of barrioDoc) {
        serieBarrioMap.set(serie.toLowerCase(), barrio);
      }
    } catch { /* ignore */ }
  }

  return { fc: geo, bounds: boundsOf(geo) };
}

/** Limpia los markers HTML sobre el mapa. */
function rebuildMarkers(_fc?: FeatureCollection, _filterOpcionId?: string | null): void {
  markers.forEach((mk) => mk.remove());
  markers.length = 0;
}

// Canvas overlay: una bandera centrada y escalada por polígono, recortada al contorno de la zona.
const flagImgs: Record<string, HTMLImageElement> = {};
let flagCanvas: HTMLCanvasElement | null = null;
let flagCtx: CanvasRenderingContext2D | null = null;
let flagsVisible = true;
// FeatureCollection de circuitos con datos de partido, para dibujar en el canvas overlay.
let circuitoFCForCanvas: FeatureCollection | null = null;

/** Carga los SVGs de banderas como HTMLImageElement para el canvas overlay. */
async function loadFlagImages(): Promise<void> {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const ENTRIES: [string, string][] = [
    ['flag-fa', `${base}/flags/fa.svg`],
    ['flag-pn', `${base}/flags/pn.svg`],
    ['flag-pc', `${base}/flags/pc.svg`],
    ['flag-ca', `${base}/flags/ca.svg`],
    ['flag-pi', `${base}/flags/pi.svg`],
    ['flag-cr', `${base}/flags/cr.svg`],
  ];
  await Promise.all(ENTRIES.map(([id, src]) =>
    new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => { flagImgs[id] = img; resolve(); };
      img.onerror = () => resolve();
      img.src = src;
    })
  ));
}

/** Crea el canvas HTML superpuesto sobre el canvas de MapLibre. */
function setupFlagCanvas(m: MlMap): void {
  const mc = m.getCanvas();
  const parent = mc.parentElement;
  if (!parent) return;
  flagCanvas = document.createElement('canvas');
  flagCanvas.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;';
  parent.appendChild(flagCanvas);
  flagCtx = flagCanvas.getContext('2d');
  syncFlagCanvasSize(m);
}

function syncFlagCanvasSize(m: MlMap): void {
  if (!flagCanvas) return;
  const mc = m.getCanvas();
  flagCanvas.width = mc.width;
  flagCanvas.height = mc.height;
  flagCanvas.style.width = mc.style.width || `${mc.clientWidth}px`;
  flagCanvas.style.height = mc.style.height || `${mc.clientHeight}px`;
}

/** Dibuja banderas de partido en zonas y dots de circuito sobre el canvas overlay. */
function drawFlagOverlay(m: MlMap): void {
  if (!flagCtx || !flagCanvas) return;
  syncFlagCanvasSize(m);
  flagCtx.clearRect(0, 0, flagCanvas.width, flagCanvas.height);

  const dpr = window.devicePixelRatio || 1;

  // Banderas de partido recortadas a cada polígono de zona (solo niveles poligonales).
  // Dos pasadas: primero todos los flags, luego todos los bordes encima.
  if (flagsVisible && !isPointNivel) {
    type Ring = [number, number][];
    const features = m.queryRenderedFeatures(undefined, { layers: ['zonas-fill'] });
    const seen = new Set<string | number>();
    const visibleFeats: (typeof features)[0][] = [];

    for (const feat of features) {
      const fid = feat.id ?? (feat.properties as Record<string, unknown>).name;
      if (seen.has(fid as string | number)) continue;
      seen.add(fid as string | number);
      visibleFeats.push(feat);
    }

    // Pasada 1: flags recortados a cada polígono
    for (const feat of visibleFeats) {
      const props = feat.properties as Record<string, unknown>;
      if (!props.flagPattern || !props.hasData) continue;
      const img = flagImgs[props.flagPattern as string];
      if (!img) continue;
      const geom = feat.geometry as { type: string; coordinates: unknown };
      const rings: Ring[] = geom.type === 'Polygon'
        ? (geom.coordinates as Ring[])
        : (geom.coordinates as Ring[][]).flat(1);
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      flagCtx.beginPath();
      for (const ring of rings) {
        let first = true;
        for (const coord of ring) {
          const pt = m.project(coord as [number, number]);
          const px = pt.x * dpr; const py = pt.y * dpr;
          if (first) { flagCtx.moveTo(px, py); first = false; }
          else flagCtx.lineTo(px, py);
          if (px < minX) minX = px; if (py < minY) minY = py;
          if (px > maxX) maxX = px; if (py > maxY) maxY = py;
        }
        flagCtx.closePath();
      }
      flagCtx.save();
      flagCtx.clip('evenodd');
      const bw = maxX - minX, bh = maxY - minY;
      const flagAspect = img.naturalWidth / img.naturalHeight;
      let dw = bw, dh = bw / flagAspect;
      if (dh < bh) { dh = bh; dw = bh * flagAspect; }
      flagCtx.globalAlpha = 1.0;
      flagCtx.drawImage(img, minX + (bw - dw) / 2, minY + (bh - dh) / 2, dw, dh);
      flagCtx.restore();
    }

    // Pasada 2: bordes encima de todos los flags + highlight de zona seleccionada
    const selectedGeoId = selected.value?.geoId ?? null;
    flagCtx.lineJoin = 'round';
    for (const feat of visibleFeats) {
      const props = feat.properties as Record<string, unknown>;
      const fid = String(feat.id ?? props.name ?? '');
      const geom = feat.geometry as { type: string; coordinates: unknown };
      if (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon') continue;
      const rings: Ring[] = geom.type === 'Polygon'
        ? (geom.coordinates as Ring[])
        : (geom.coordinates as Ring[][]).flat(1);
      flagCtx.beginPath();
      for (const ring of rings) {
        let first = true;
        for (const coord of ring) {
          const pt = m.project(coord as [number, number]);
          const px = pt.x * dpr; const py = pt.y * dpr;
          if (first) { flagCtx.moveTo(px, py); first = false; }
          else flagCtx.lineTo(px, py);
        }
        flagCtx.closePath();
      }
      const isSelected = selectedGeoId !== null && fid === selectedGeoId;
      if (isSelected) {
        flagCtx.strokeStyle = '#f59e0b';
        flagCtx.lineWidth = 5 * dpr;
        flagCtx.stroke();
        flagCtx.strokeStyle = '#fef9c3';
        flagCtx.lineWidth = 2 * dpr;
        flagCtx.stroke();
      } else {
        flagCtx.strokeStyle = isDark ? 'rgba(255,255,255,0.65)' : 'rgba(15,15,30,0.65)';
        flagCtx.lineWidth = 1 * dpr;
        flagCtx.stroke();
      }
    }
  }

  // Overlay de circuitos: skip durante movimiento activo para evitar lag a 60fps.
  if (circuitoFCForCanvas && !isMapMoving) {
    type Ring = [number, number][];
    for (const f of circuitoFCForCanvas.features) {
      const fprops = f.properties as Record<string, unknown>;
      if (!fprops.hasData) continue;
      const geom = f.geometry as { type: string; coordinates: unknown };

      // Calcular el centroide según tipo de geometría (Point, Polygon, MultiPolygon).
      let sx = 0, sy = 0, cnt = 0;
      if (geom.type === 'Point') {
        const [lng, lat] = geom.coordinates as [number, number];
        const pt = m.project([lng, lat]);
        sx = pt.x; sy = pt.y; cnt = 1;
      } else if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
        const rings: Ring[] = geom.type === 'Polygon'
          ? (geom.coordinates as Ring[])
          : (geom.coordinates as Ring[][]).flat(1);
        for (const ring of rings) {
          if (!Array.isArray(ring)) continue;
          for (const coord of ring) {
            const pt = m.project(coord as [number, number]);
            sx += pt.x; sy += pt.y; cnt++;
          }
        }
      }
      if (cnt === 0) continue;

      const cpx = (sx / cnt) * dpr;
      const cpy = (sy / cnt) * dpr;
      const r = 5 * dpr;
      const dotImg = fprops.flagPattern ? flagImgs[fprops.flagPattern as string] : null;
      flagCtx.save();
      flagCtx.beginPath();
      flagCtx.arc(cpx, cpy, r, 0, Math.PI * 2);
      flagCtx.closePath();
      if (dotImg) {
        flagCtx.clip();
        const aspect = dotImg.naturalWidth / dotImg.naturalHeight;
        const iw = aspect >= 1 ? r * 2 * aspect : r * 2;
        const ih = aspect >= 1 ? r * 2 : (r * 2) / aspect;
        flagCtx.drawImage(dotImg, cpx - iw / 2, cpy - ih / 2, iw, ih);
      } else {
        flagCtx.fillStyle = String(fprops.color ?? '#999');
        flagCtx.fill();
      }
      flagCtx.restore();
      flagCtx.beginPath();
      flagCtx.arc(cpx, cpy, r, 0, Math.PI * 2);
      flagCtx.strokeStyle = 'rgba(255,255,255,0.8)';
      flagCtx.lineWidth = 1 * dpr;
      flagCtx.stroke();
    }
  }
}

/** Muestra u oculta el overlay de banderas. */
function setPatternVisible(visible: boolean): void {
  flagsVisible = visible;
  const m = map.value;
  if (!m) return;
  if (m.getLayer('zonas-fill')) {
    m.setPaintProperty('zonas-fill', 'fill-opacity',
      visible
        ? ['case', ['!=', ['get', 'flagPattern'], null], 0, 0.85]
        : 0.85
    );
  }
  // Cuando el canvas dibuja los bordes, ocultar el layer MapLibre para evitar duplicados.
  if (m.getLayer('zonas-line')) {
    m.setLayoutProperty('zonas-line', 'visibility', visible ? 'none' : 'visible');
  }
  drawFlagOverlay(m);
}

/** Interpolación lineal entre dos colores #rrggbb (Story 2.3). */
function interpolateHex(c1: string, c2: string, t: number): string {
  const p = (s: string) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
  const [r1, g1, b1] = p(c1);
  const [r2, g2, b2] = p(c2);
  const h = (n: number) => Math.round(n).toString(16).padStart(2, '0');
  return `#${h(r1 + (r2 - r1) * t)}${h(g1 + (g2 - g1) * t)}${h(b1 + (b2 - b1) * t)}`;
}

// Rampa de calor multi-stop: amarillo pálido → naranja → rojo oscuro (YlOrRd, ColorBrewer)
const HEAT_STOPS = ['#FFFFB2', '#FEB24C', '#F03B20', '#BD0026'] as const;
function heatColor(t: number): string {
  const n = HEAT_STOPS.length - 1;
  const i = Math.min(n - 1, Math.floor(t * n));
  const local = t * n - i;
  return interpolateHex(HEAT_STOPS[i], HEAT_STOPS[i + 1], local);
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

// ── Epic 10 (Story 10.4): coloreo por selección múltiple de hojas ──────────────

/** Carga el catálogo jerárquico una vez (dedupeada): hojaId → {contienda, lemaId, hoja, lemaNombre}. */
function ensureCatalogo(eleccion: string, departamento: string): Promise<void> {
  if (catalogoOpcMeta) return Promise.resolve();
  if (catalogoPromise) return catalogoPromise;
  catalogoPromise = (async () => {
    const built = new Map<string, { contienda: string; lemaId: string; hoja: string; lemaNombre: string }>();
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, '');
      const res = await fetch(`${base}/data/${eleccion}/${departamento}/catalogo.json`);
      if (res.ok) {
        const doc = (await res.json()) as {
          contiendas: {
            contienda: string;
            nodos: { id: string; nivel: string; etiqueta: string }[];
            opciones: { id: string; hoja?: string; lemaId?: string }[];
          }[];
        };
        for (const c of doc.contiendas) {
          const lemaNombre = new Map(c.nodos.filter((n) => n.nivel === 'lema').map((n) => [n.id, n.etiqueta]));
          for (const o of c.opciones) {
            const lemaId = o.lemaId ?? '';
            built.set(o.id, { contienda: c.contienda, lemaId, hoja: o.hoja ?? '', lemaNombre: lemaNombre.get(lemaId) ?? lemaId });
          }
        }
      }
    } catch {
      /* sin catálogo → la selección no colorea (se queda en ganador) */
    }
    catalogoOpcMeta = built; // asignar SOLO tras poblar (evita que un caller concurrente vea un Map vacío)
  })();
  return catalogoPromise;
}

/**
 * Carga el consolidado `hoja-{nivel}.json` (localidad/barrio) UNA vez por nivel y puebla `hojaVotos`
 * keyed por nombre de zona geográfica — el mismo índice de join que las series. Devuelve true si el
 * nivel usa este modo consolidado (localidad/barrio), independientemente de si el fetch encontró
 * datos (los tipos planos no tienen archivo → hojaVotos queda vacío → fallback por lema). */
async function ensureHojaGeoConsolidado(eleccion: string, departamento: string): Promise<boolean> {
  const nivel = activeNivel;
  if (nivel !== 'localidad' && nivel !== 'barrio') return false;
  if (hojaGeoPromise) return hojaGeoPromise; // un caller concurrente espera el MISMO fetch poblado
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  hojaGeoPromise = (async () => {
    try {
      const res = await fetch(`${base}/data/${eleccion}/${departamento}/hoja-${nivel}.json`);
      if (!res.ok) return true; // sin consolidado (tipo plano) → hojaVotos vacío, fallback por lema
      const shard = (await res.json()) as VotosShard;
      for (const z of shard.zonas) {
        const key = norm(z.geoId);
        let mm = hojaVotos.get(key);
        if (!mm) { mm = new Map(); hojaVotos.set(key, mm); }
        for (const { opcionId, votos } of z.porOpcion) mm.set(opcionId, votos);
      }
    } catch { /* red caída → hojaVotos vacío, el coloreo degrada por lema */ }
    return true;
  })();
  return hojaGeoPromise;
}

/** Lazy-load de los shards de hoja por (contienda, lema) que toca la selección. */
async function ensureHojaShards(eleccion: string, departamento: string, sel: string[]): Promise<void> {
  await ensureCatalogo(eleccion, departamento);
  // Localidad/barrio: un solo consolidado re-agregado (los shards por serie no joinean aquí).
  if (await ensureHojaGeoConsolidado(eleccion, departamento)) return;
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const need = new Set<string>();
  for (const id of sel) {
    const meta = catalogoOpcMeta?.get(id);
    // Tipos planos (balotaje/plebiscito): la opción no tiene lema → vive en el votes.json
    // base (zonasVotos), no en un shard de hoja. Saltear para no pedir `hoja/unica/.json` (404).
    if (meta && meta.lemaId) {
      const k = `${meta.contienda}/${meta.lemaId}`;
      if (!lemasCargados.has(k)) need.add(k);
    }
  }
  for (const k of need) {
    try {
      const res = await fetch(`${base}/data/${eleccion}/${departamento}/hoja/${k}.json`);
      lemasCargados.add(k);
      if (!res.ok) continue;
      const shard = (await res.json()) as VotosShard;
      for (const z of shard.zonas) {
        const key = norm(z.geoId);
        let mm = hojaVotos.get(key);
        if (!mm) { mm = new Map(); hojaVotos.set(key, mm); }
        for (const { opcionId, votos } of z.porOpcion) mm.set(opcionId, votos);
      }
    } catch {
      lemasCargados.add(k);
    }
  }
}

/**
 * Suma de votos de las opciones seleccionadas en una zona. Lee del shard de hoja
 * (`hojaVotos`) y, si la opción no está ahí (tipos planos sin shard), del votes.json
 * base (`zonasVotos`). El mismo `opcionId` es la clave de join en ambos.
 */
function selSumZona(key: string, sel: string[]): number {
  const mm = hojaVotos.get(key);
  const base = zonasVotos.get(key);
  let s = 0;
  for (const id of sel) s += mm?.get(id) ?? base?.get(id) ?? 0;
  return s;
}

/** Desglose por hoja de la selección en una zona, agrupado por lema (Story 10.5). */
function buildDesglose(key: string, sel: string[]): { grupos: DesgloseGrupo[]; total: number } {
  const TOP = 10;
  // Agrupar por (contienda, lema): aunque hoy la selección es de una sola contienda
  // (el acordeón la limpia al cambiar), esto evita conflar odn+odd del mismo lema (AC6).
  const byLema = new Map<string, { nombre: string; hojas: { id: string; label: string; votos: number }[]; total: number }>();
  let total = 0;
  for (const id of sel) {
    const meta = catalogoOpcMeta?.get(id);
    const votos = hojaVotos.get(key)?.get(id) ?? zonasVotos.get(key)?.get(id) ?? 0;
    total += votos; // el total cuenta SIEMPRE
    if (!meta || !meta.lemaId) {
      // Tipos planos (balotaje/plebiscito/referéndum) o selección por opción simple (Epic 12):
      // la opción es su propio grupo, sin sub-hojas. Nombre desde opciones.json (opcNombreMap).
      const nombre = opcNombreMap.get(id) ?? id;
      const gk = `flat/${id}`;
      let e = byLema.get(gk);
      if (!e) { e = { nombre, hojas: [], total: 0 }; byLema.set(gk, e); }
      e.total += votos;
      continue;
    }
    const gk = `${meta.contienda}/${meta.lemaId}`;
    let e = byLema.get(gk);
    if (!e) { e = { nombre: meta.lemaNombre, hojas: [], total: 0 }; byLema.set(gk, e); }
    e.hojas.push({ id, label: meta.hoja === 'vl' ? 'Voto al lema' : `Lista ${meta.hoja}`, votos });
    e.total += votos;
  }
  const grupos: DesgloseGrupo[] = [...byLema.values()]
    .filter((g) => g.total > 0)
    .sort((a, b) => b.total - a.total)
    .map((g) => {
      const hojasOrd = g.hojas.filter((h) => h.votos > 0).sort((a, b) => b.votos - a.votos);
      const meta = resolveParty(g.nombre);
      return {
        lemaNombre: g.nombre, sigla: meta.sigla, color: meta.color, flagUrl: meta.flagUrl,
        total: g.total, hojas: hojasOrd.slice(0, TOP), masN: Math.max(0, hojasOrd.length - TOP),
      };
    });
  return { grupos, total };
}

/** Construye un FC coloreado por la selección según el modo (share/votos/heatmap). */
function buildSeleccionFC(fc: FeatureCollection, sel: string[], modo: 'share' | 'votos' | 'heatmap'): FeatureCollection {
  const perFeat = fc.features.map((f) => {
    const key = norm(String((f.properties as { name: string }).name));
    const sum = selSumZona(key, sel);
    const validos = zonasValidos.get(key) ?? 0;
    return { f, sum, validos };
  });
  const sums = perFeat.map((x) => x.sum);
  const maxSum = Math.max(1, ...sums);
  const nonZero = sums.filter((v) => v > 0).sort((a, b) => a - b); // para escala por cuantiles (votos)
  return {
    ...fc,
    features: perFeat.map(({ f, sum, validos }) => {
      let t = 0;
      if (sum > 0) {
        if (modo === 'share') t = validos > 0 ? Math.min(1, sum / validos) : 0;
        else if (modo === 'heatmap') t = sum / maxSum;
        else {
          // votos: rango por cuantil sobre el subconjunto seleccionado (legacy: escala recalculada).
          const r = nonZero.findIndex((v) => v >= sum);
          t = nonZero.length ? (r + 1) / nonZero.length : 0;
        }
      }
      // AC5: 0 votos de la selección pero CON urna → nivel más bajo de la escala (≠ gris-sin-dato).
      const color = sum > 0
        ? modo === 'heatmap'
          ? heatColor(Math.max(0.05, t))
          : interpolateHex(INTENSIDAD_LIGHT, SEL_BASE, Math.max(0.1, t))
        : validos > 0
          ? modo === 'heatmap' ? HEAT_STOPS[0] : interpolateHex(INTENSIDAD_LIGHT, SEL_BASE, 0.12)
          : COLOR_SIN_DATOS;
      return { ...f, properties: { ...f.properties, color, selVal: sum, selPct: validos > 0 ? sum / validos : 0 } };
    }),
  } as FeatureCollection;
}

/** Markers de valor (votos o %) por zona en modo selección — cumple "nunca solo por color". */
function rebuildSelMarkers(fc: FeatureCollection, modo: 'share' | 'votos' | 'heatmap'): void {
  if (!mlLib || !map.value || isPointNivel) return;
  markers.forEach((mk) => mk.remove());
  markers.length = 0;
  for (const f of fc.features) {
    const p = f.properties as { selVal?: number; selPct?: number };
    if (!p.selVal || p.selVal <= 0) continue;
    const [lng, lat] = centroid(f.geometry as Polygon | MultiPolygon);
    const el = document.createElement('span');
    el.className = 'zona-sigla';
    el.setAttribute('aria-hidden', 'true');
    el.textContent = modo === 'share' ? `${Math.round((p.selPct ?? 0) * 100)}%` : String(p.selVal);
    markers.push(new mlLib!.Marker({ element: el }).setLngLat([lng, lat]).addTo(map.value!));
  }
}

function buildSeleccionLegend(modo: 'share' | 'votos' | 'heatmap', n: number): LegendEntry[] {
  const titulo =
    modo === 'share' ? `% sobre válidos · ${n} lista${n === 1 ? '' : 's'}`
    : modo === 'heatmap' ? `Votos (densidad) · ${n} lista${n === 1 ? '' : 's'}`
    : `Votos (escala por selección) · ${n} lista${n === 1 ? '' : 's'}`;
  if (modo === 'heatmap') return [
    { sigla: '', nombre: `${titulo} — alto`, color: heatColor(1), votos: 0 },
    { sigla: '', nombre: 'medio', color: heatColor(0.5), votos: 0 },
    { sigla: '', nombre: 'bajo', color: heatColor(0.1), votos: 0 },
  ];
  return [
    { sigla: '', nombre: `${titulo} — alto`, color: interpolateHex(INTENSIDAD_LIGHT, SEL_BASE, 1), votos: 0 },
    { sigla: '', nombre: 'medio', color: interpolateHex(INTENSIDAD_LIGHT, SEL_BASE, 0.5), votos: 0 },
    { sigla: '', nombre: 'bajo', color: interpolateHex(INTENSIDAD_LIGHT, SEL_BASE, 0.15), votos: 0 },
  ];
}

/** Restaura el modo ganador desde un FC de selección (síncrono). */
function restoreGanadorDesdeSeleccion(): void {
  const m = map.value;
  const fc = fcRef.value;
  if (!m || !fc || !m.getSource('zonas')) return;
  if (seleccionFCActive) {
    (m.getSource('zonas') as GeoJSONSource).setData(fc);
    seleccionFCActive = false;
  }
  m.setPaintProperty('zonas-fill', 'fill-color', ['get', 'color']);
  rebuildMarkers(fc);
  setPatternVisible(true);
  legend.value = origLegend;
}

let seleccionGen = 0; // token de generación para cancelar applySeleccion obsoletos

/** Entrada principal: colorea el mapa por la selección activa (asume no vacía). */
async function applySeleccion(): Promise<void> {
  const m = map.value;
  const fc = fcRef.value;
  if (!m || !fc || !m.getSource('zonas')) return;
  const sel = seleccionActiva.value;
  if (sel.length === 0) { restoreGanadorDesdeSeleccion(); return; }
  const myGen = ++seleccionGen;
  await ensureHojaShards(activeEleccion, activeDepartamento, sel);
  if (myGen !== seleccionGen) return; // una llamada más nueva la dejó obsoleta
  const modo = coloreoMode.value;
  const selFC = buildSeleccionFC(fc, sel, modo);
  (m.getSource('zonas') as GeoJSONSource).setData(selFC);
  m.setPaintProperty('zonas-fill', 'fill-color', ['get', 'color']);
  setPatternVisible(false);
  seleccionFCActive = true;
  // setData resetea los feature-state: re-aplicar el resaltado de la zona seleccionada.
  const zonaSel = $selection.get().zona;
  if (zonaSel) {
    m.setFeatureState({ source: 'zonas', id: zonaSel }, { sel: true });
    selectByName(zonaSel, fc); // refresca la ficha con el desglose ya que los shards están cargados
  }
  rebuildSelMarkers(selFC, modo);
  legend.value = buildSeleccionLegend(modo, sel.length);
}

/** Cambia el modo de coloreo (escribe la URL; el subscribe re-aplica). */
function setColoreo(modo: 'share' | 'votos' | 'heatmap'): void {
  coloreoMode.value = modo;
  commit({ modo });
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
  setPatternVisible(false);
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
  setPatternVisible(false);
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
    // No restaurar si el modo dual opcion está activo (Story 4.4).
    const cmp = $comparison.get();
    if (cmp.a && cmp.b) return;
    if (intensidadActive) {
      (m.getSource('zonas') as GeoJSONSource).setData(fc);
      intensidadActive = false;
    }
    m.setPaintProperty('zonas-fill', 'fill-color', ['get', 'color']);
    rebuildMarkers(fc);
    setPatternVisible(true);
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
 *
 * Story 6.5 (FR18): si existe tabla de equivalencias, usa sigla canónica para comparar
 * (resuelve "Partido Colorado" ↔ "Colorado" = mismo partido, sigla PC).
 */
async function applyComparisonOverlay(vs: string, baseEleccion: string, departamento: string, nivel: string): Promise<void> {
  const m = map.value;
  const fc = fcRef.value;
  if (!m || !fc || status.value !== 'listo') return;
  try {
    const base = import.meta.env.BASE_URL.replace(/\/$/, '');

    // Intentar cargar tabla de equivalencias (Story 6.5 — FR18/FR32).
    // Si no existe, la comparación cae a nombre literal (comportamiento Story 4.3).
    interface EquivDoc {
      mappings: { aId: string; bId: string; sigla: string; nombreA: string; nombreB: string }[];
      soloA: string[];
      soloB: string[];
    }
    let equivDoc: EquivDoc | null = null;
    try {
      const equivRes = await fetch(`${base}/data/hoja-equivalencias/${departamento}/${baseEleccion}-${vs}.json`);
      if (equivRes.ok) equivDoc = (await equivRes.json()) as EquivDoc;
    } catch { /* tabla no disponible — modo degradado */ }

    // Mapa sigla → bId (opcionId en la elección de comparación) para normalizar.
    // Ambas direcciones: aId→sigla y bId→sigla.
    const siglaFromAId = new Map<string, string>(); // opcionId_base → sigla canónica
    const siglaFromBId = new Map<string, string>(); // opcionId_vs → sigla canónica
    if (equivDoc) {
      for (const m of equivDoc.mappings) {
        siglaFromAId.set(m.aId, m.sigla);
        siglaFromBId.set(m.bId, m.sigla);
      }
    }

    const vsVotesFile = nivel === 'circuito' ? 'votes-circuito.json'
                      : nivel === 'localidad' ? 'votes-localidad.json'
                      : nivel === 'barrio'    ? 'votes-barrio.json'
                      : 'votes.json';
    const [votesRes, opcRes] = await Promise.all([
      fetch(`${base}/data/${vs}/${departamento}/${vsVotesFile}`),
      fetch(`${base}/data/${vs}/${departamento}/opciones.json`),
    ]);
    if (!votesRes.ok || !opcRes.ok) return;
    const votes = (await votesRes.json()) as VotosShard;
    const opcDoc = (await opcRes.json()) as OpcionesDoc;
    const vsNombrePorOpcion = new Map(opcDoc.opciones.map((o) => [o.opcionId, o.nombre]));

    // vsWinnersMap: geoId normalizado → nombre del ganador en la elección vs
    vsWinnersMap = new Map();
    // vsSiglaMap: geoId normalizado → sigla canónica del ganador en la elección vs
    const vsSiglaMap = new Map<string, string>();
    for (const z of votes.zonas) {
      if (z.porOpcion.length > 0) {
        const vsNombre = vsNombrePorOpcion.get(z.ganadorOpcionId) ?? z.ganadorOpcionId;
        vsWinnersMap.set(norm(z.geoId), vsNombre);
        // Sigla: desde la tabla de equiv si existe, sino desde resolveParty
        const sigla = siglaFromBId.get(z.ganadorOpcionId) ?? resolveParty(vsNombre).sigla;
        vsSiglaMap.set(norm(z.geoId), sigla);
      }
    }

    // Activar feature-state vsChanged para zonas con ganador distinto.
    // Con tabla: compara por sigla canónica. Sin tabla: compara por resolveParty sigla (fallback seguro).
    for (const f of fc.features) {
      const name = String((f.properties as { name: string }).name);
      const baseNombre = String((f.properties as { nombre?: string }).nombre ?? '');
      const baseOpcionId = String((f.properties as { ganadorOpcionId?: string }).ganadorOpcionId ?? '');
      const vsGeoNorm = norm(name);
      if (!vsWinnersMap.has(vsGeoNorm) || !baseNombre) {
        m.setFeatureState({ source: 'zonas', id: name }, { vsChanged: false });
        continue;
      }
      // Sigla del ganador en la elección base
      const baseSigla = siglaFromAId.get(baseOpcionId) ?? resolveParty(baseNombre).sigla;
      // Sigla del ganador en la elección vs
      const vsSigla = vsSiglaMap.get(vsGeoNorm) ?? '';
      const changed = baseSigla !== '' && vsSigla !== '' && baseSigla !== vsSigla;
      m.setFeatureState({ source: 'zonas', id: name }, { vsChanged: changed });
    }

    // Leyenda: marcar partidos sin presencia en la elección de comparación.
    // Con tabla: usar sigla canónica para detectar continuidad.
    // Sin tabla: comparar por resolveParty sigla.
    const vsSiglas = new Set([...vsSiglaMap.values()]);
    const year = baseEleccion.match(/\d{4}/)?.[0] ?? baseEleccion;
    legend.value = origLegend.map((entry) => {
      const entrySigla = resolveParty(entry.nombre).sigla;
      return vsSiglas.has(entrySigla) ? entry : { ...entry, nombre: `${entry.nombre} (solo ${year})` };
    });
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
 * Vista de contraste entre dos opciones de la misma elección (Story 4.4).
 * Colorea cada zona según cuál de las dos opciones obtuvo más votos allí.
 * Usa zonasVotos (ya cargado) — sin fetch adicional.
 */
function applyDualOpcionView(aId: string, bId: string): void {
  const m = map.value;
  const fc = fcRef.value;
  if (!m || !fc || !m.getSource('zonas')) return;
  const aNombre = opcNombreMap.get(aId) ?? aId;
  const bNombre = opcNombreMap.get(bId) ?? bId;
  const aMeta = resolveParty(aNombre);
  const bMeta = resolveParty(bNombre);
  for (const f of fc.features) {
    const name = String((f.properties as { name: string }).name);
    const key = norm(name);
    const aVotos = zonasVotos.get(key)?.get(aId) ?? 0;
    const bVotos = zonasVotos.get(key)?.get(bId) ?? 0;
    const dualA = aVotos > 0 && aVotos >= bVotos;
    const dualB = bVotos > 0 && bVotos > aVotos;
    m.setFeatureState({ source: 'zonas', id: name }, { dualA, dualB });
  }
  m.setPaintProperty('zonas-fill', 'fill-color', [
    'case',
    ['boolean', ['feature-state', 'dualA'], false], aMeta.color,
    ['boolean', ['feature-state', 'dualB'], false], bMeta.color,
    COLOR_SIN_DATOS,
  ]);
  if (intensidadActive) {
    (m.getSource('zonas') as GeoJSONSource).setData(fc);
    intensidadActive = false;
  }
  markers.forEach((mk) => mk.remove());
  markers.length = 0;
  setPatternVisible(false);
  legend.value = [
    { sigla: aMeta.sigla, nombre: aNombre, color: aMeta.color, votos: 0 },
    { sigla: bMeta.sigla, nombre: bNombre, color: bMeta.color, votos: 0 },
  ];
  vistaMode.value = 'ganador';
}

/** Limpia la vista dual opcion: restaura fill-color y leyenda (Story 4.4). */
function clearDualOpcionView(): void {
  const m = map.value;
  const fc = fcRef.value;
  if (!m || !fc || !m.getSource('zonas')) return;
  for (const f of fc.features) {
    const name = String((f.properties as { name: string }).name);
    m.setFeatureState({ source: 'zonas', id: name }, { dualA: false, dualB: false });
  }
  m.setPaintProperty('zonas-fill', 'fill-color', ['get', 'color']);
  rebuildMarkers(fc);
  setPatternVisible(true);
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
  // Epic 10: resetear caches de hojas (el catálogo/shards son por elección×depto).
  catalogoOpcMeta = null;
  catalogoPromise = null;
  hojaVotos = new Map();
  lemasCargados = new Set();
  hojaGeoPromise = null; // Story 7.8: re-cargar el consolidado hoja-{nivel} al cambiar nivel/depto
  seleccionFCActive = false;
  try {
    const { fc, bounds } = await loadData(eleccion, departamento, nivel);
    // Esperar a que la fuente esté lista (puede que el mapa aún esté cargando).
    if (m.getSource('zonas')) {
      (m.getSource('zonas') as GeoJSONSource).setData(fc);
    }
    // Alternar visibilidad entre capas fill/line (poligonos) y circle (puntos) según nivel.
    if (m.getLayer('zonas-fill')) {
      m.setLayoutProperty('zonas-fill', 'visibility', isPointNivel ? 'none' : 'visible');
      m.setLayoutProperty('zonas-line', 'visibility', isPointNivel ? 'none' : 'visible');
      drawFlagOverlay(m);
    }
    if (m.getLayer('zonas-circle')) {
      m.setLayoutProperty('zonas-circle', 'visibility', isPointNivel ? 'visible' : 'none');
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
    // Epic 10: reaplicar coloreo por selección de hojas si sigue activo (Story 10.4).
    seleccionActiva.value = [...sel.seleccion];
    if (sel.seleccion.length > 0) await applySeleccion();
    status.value = 'listo';
    // Reaplicar modo comparación si sigue activo (Stories 4.3/4.4).
    const cmp = $comparison.get();
    if (cmp.a && cmp.b) {
      applyDualOpcionView(cmp.a, cmp.b);
    } else if (cmp.vs && cmp.vs !== eleccion) {
      void applyComparisonOverlay(cmp.vs, eleccion, departamento, nivel);
    }
    // Recargar overlay de circuitos si sigue activo.
    if ($circuito.get()) void loadCircuitoOverlay(eleccion, departamento);
  } catch (err) {
    status.value = 'error';
    errorMsg.value = err instanceof Error ? err.message : String(err);
  }
}

/**
 * Carga circuitos como overlay de puntos sobre el mapa base (no reemplaza el nivel activo).
 * Agrega source 'circuitos' + layer 'circuitos-circle' si no existen, y los hace visibles.
 */
async function loadCircuitoOverlay(eleccion: string, departamento: string): Promise<void> {
  const m = map.value;
  if (!m) return;
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  try {
    const [topoRes, votesRes] = await Promise.all([
      fetch(`${base}/data/geo/${departamento}/circuito.topo.json`),
      fetch(`${base}/data/${eleccion}/${departamento}/votes-circuito.json`),
    ]);
    if (!topoRes.ok || !votesRes.ok) return;
    const topo = (await topoRes.json()) as Topology;
    const votes = (await votesRes.json()) as VotosShard;
    const objName = Object.keys(topo.objects)[0];
    const geo = topoFeature(topo, topo.objects[objName] as GeometryCollection) as FeatureCollection;

    const zonaPorGeo = new Map(votes.zonas.map((z) => [norm(z.geoId), z]));
    for (const f of geo.features) {
      const name = String((f.properties as { name: string }).name);
      const zona = zonaPorGeo.get(norm(name));
      const p = f.properties as Record<string, unknown>;
      if (zona && zona.porOpcion.length > 0) {
        const nombre = opcNombreMap.get(zona.ganadorOpcionId) ?? zona.ganadorOpcionId;
        const meta = resolveParty(nombre);
        p.color = meta.color;
        p.flagPattern = meta.flagUrl ? `flag-${meta.sigla.toLowerCase()}` : null;
        p.nombre = nombre;
        p.hasData = true;
      } else {
        p.color = COLOR_SIN_DATOS;
        p.flagPattern = null;
        p.hasData = false;
      }
    }
    // Guardar para que drawFlagOverlay dibuje los dots en el canvas overlay.
    circuitoFCForCanvas = geo;

    if (m.getSource('circuitos')) {
      (m.getSource('circuitos') as GeoJSONSource).setData(geo);
    } else {
      m.addSource('circuitos', { type: 'geojson', data: geo, promoteId: 'name' });
      // El layer es invisible (transparente) — solo existe para hit-testing de clicks.
      // La visualización la maneja el flag canvas overlay (drawFlagOverlay).
      m.addLayer({
        id: 'circuitos-circle',
        type: 'circle',
        source: 'circuitos',
        layout: { visibility: 'visible' },
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': 8,
          'circle-opacity': 0,
          'circle-stroke-color': 'transparent',
          'circle-stroke-width': 0,
        },
      });
      m.on('click', 'circuitos-circle', (e) => {
        const f = e.features?.[0];
        if (!f) return;
        commit({ zona: String((f.properties as { name: string }).name) });
      });
      m.on('mouseenter', 'circuitos-circle', () => { m.getCanvas().style.cursor = 'pointer'; });
      m.on('mouseleave', 'circuitos-circle', () => { m.getCanvas().style.cursor = ''; });
    }
    m.setLayoutProperty('circuitos-circle', 'visibility', 'visible');
  } catch {
    // Sin datos de circuito — silencioso
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
    // Epic 12: desglose de la selección en esta zona para TODOS los caminos.
    // Prioridad: acordeón HOJA (seleccion[]) > comparación dual A/B > opción simple.
    const cmp = $comparison.get();
    const selFicha = seleccionActiva.value.length > 0
      ? seleccionActiva.value
      : cmp.a && cmp.b ? [cmp.a, cmp.b]
      : opcionId ? [opcionId]
      : [];
    const desgRaw = selFicha.length > 0 ? buildDesglose(key, selFicha) : null;
    const desg = desgRaw && desgRaw.grupos.length > 0 ? desgRaw : null;
    // pctOpcionActiva queda solo como fallback cuando el desglose no aplica (evita redundancia).
    const pctOpcionActiva = !desg && opcionId && validos > 0
      ? ((zonasVotos.get(key)?.get(opcionId) ?? 0) / validos) * 100
      : null;
    const rawGeoId = String(p.name);
    const zonaNombre = serieBarrioMap.get(rawGeoId.toLowerCase()) ?? serieLocalidadMap.get(rawGeoId.toLowerCase());
    selected.value = {
      geoId: rawGeoId,
      label: zonaNombre ? `${zonaNombre} · ${rawGeoId.toUpperCase()}` : undefined,
      sigla: String(p.sigla),
      nombre: String(p.nombre),
      color: String(p.color),
      flagUrl: (p.flagUrl as string | null) ?? null,
      votoGanador,
      validos,
      pct: validos > 0 ? (votoGanador / validos) * 100 : 0,
      enBlanco: noP.enBlanco,
      anulados: noP.anulados,
      observados: noP.observados,
      pctOpcionActiva,
      seleccionTotal: desg?.total,
      seleccionPct: desg && validos > 0 ? (desg.total / validos) * 100 : undefined,
      desglose: desg?.grupos,
      esCiudadGrande: ciudadesGrandesSet.size > 0 && ciudadesGrandesSet.has(norm(String(p.name))) && !(props.availableLevels ?? []).includes('barrio'),
    };
  } else if (p) {
    const rawGeoId2 = String(p.name);
    const zonaNombre2 = serieBarrioMap.get(rawGeoId2.toLowerCase()) ?? serieLocalidadMap.get(rawGeoId2.toLowerCase());
    selected.value = {
      geoId: rawGeoId2,
      label: zonaNombre2 ? `${zonaNombre2} · ${rawGeoId2.toUpperCase()}` : undefined,
      sigla: '', nombre: 'Sin datos', color: '#e5e7eb',
      votoGanador: 0, validos: 0, pct: 0, enBlanco: 0, anulados: 0, observados: 0,
      pctOpcionActiva: null,
      esCiudadGrande: ciudadesGrandesSet.size > 0 && ciudadesGrandesSet.has(norm(String(p.name))) && !(props.availableLevels ?? []).includes('barrio'),
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
const unsubSelection = $selection.subscribe((s) => {
  opcionActiva.value = s.opcion;
  seleccionActiva.value = [...s.seleccion];
  if (s.modo === 'share' || s.modo === 'votos' || s.modo === 'heatmap') coloreoMode.value = s.modo;
  applySelection(s.zona);
  if (s.seleccion.length > 0) {
    void applySeleccion(); // Epic 10: coloreo por selección múltiple de hojas
  } else {
    if (seleccionFCActive) restoreGanadorDesdeSeleccion(); // restaurar desde el FC de selección
    applyOpcionFilter(s.opcion);
  }
});

/** Resuelve el nivel base efectivo: excluye 'circuito' (ahora es overlay, no nivel base). */
function resolveNivel(urlLevel: NivelGeografico, dept?: string): NivelGeografico {
  const avail = (dept ? DEPT_LEVELS[dept] : null) ?? props.availableLevels ?? (['zona'] as NivelGeografico[]);
  const base = avail.filter(l => l !== 'circuito');
  const valid = base.length > 0 ? base : avail;
  return valid.includes(urlLevel) ? urlLevel : (valid[0] ?? urlLevel);
}

let afterSwapHandler: (() => void) | null = null;

onMounted(async () => {
  bindToLocation();

  // Suscribir $level para reaccionar a cambios de nivel (clic en LevelSelector).
  // Solo recargar si el nivel es distinto al activo y está disponible para este depto.
  unsubLevel = $level.subscribe((newLevel) => {
    const resolved = resolveNivel(newLevel, activeDepartamento);
    if (resolved !== activeNivel && map.value) {
      activeNivel = resolved;
      void reloadData(activeEleccion, activeDepartamento, resolved);
    }
  });

  // Suscribir $comparison para entrar/salir de modos comparación (Stories 4.3/4.4).
  // hydrateStores (llamado en after-swap y bindToLocation) ya actualiza este store.
  unsubComparison = $comparison.subscribe((cmp) => {
    if (!map.value || status.value !== 'listo') return;
    if (cmp.a && cmp.b) {
      applyDualOpcionView(cmp.a, cmp.b);
    } else if (cmp.vs && cmp.vs !== activeEleccion) {
      void applyComparisonOverlay(cmp.vs, activeEleccion, activeDepartamento, activeNivel);
    } else {
      clearComparisonOverlay();
      clearDualOpcionView();
    }
  });

  // Suscribir $circuito: muestra/oculta el overlay de puntos sobre el mapa base.
  unsubCircuito = $circuito.subscribe((on) => {
    const m = map.value;
    if (!m || status.value !== 'listo') return;
    if (on) {
      void loadCircuitoOverlay(activeEleccion, activeDepartamento);
    } else {
      if (m.getLayer('circuitos-circle')) {
        m.setLayoutProperty('circuitos-circle', 'visibility', 'none');
      }
      circuitoFCForCanvas = null;
      drawFlagOverlay(m);
    }
  });

  try {
    mlLib = await import('maplibre-gl');
    // Resolver nivel desde URL ($level) respetando disponibilidad del depto.
    const urlLevel = $level.get();
    const geoNivel = resolveNivel(urlLevel);
    activeNivel = geoNivel;
    // Si el nivel efectivo difiere del de la URL, corregir la URL silenciosamente (AC4: Rivera).
    if (geoNivel !== urlLevel) commit({ level: geoNivel });
    isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (isDark) COLOR_SIN_DATOS = '#313C56';
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
      preserveDrawingBuffer: true, // permite canvas.toDataURL() para export PNG (Story 6.2)
    });
    map.value = m;

    m.on('load', () => { void (async () => {
      await loadFlagImages();
      setupFlagCanvas(m);
      m.addSource('zonas', { type: 'geojson', data: fc, promoteId: 'name' });
      m.addLayer({ id: 'zonas-fill', type: 'fill', source: 'zonas', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': ['case', ['!=', ['get', 'flagPattern'], null], 0, 0.85] } });
      m.addLayer({ id: 'zonas-line', type: 'line', source: 'zonas', paint: { 'line-color': isDark ? 'rgba(255,255,255,0.85)' : 'rgba(20,20,35,0.85)', 'line-width': 2.5 } });
      m.on('render', () => drawFlagOverlay(m));
      m.on('movestart', () => { isMapMoving = true; });
      m.on('moveend',   () => { isMapMoving = false; drawFlagOverlay(m); });
      m.on('zoomstart', () => { isMapMoving = true; });
      m.on('zoomend',   () => { isMapMoving = false; drawFlagOverlay(m); });
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
          'line-color': isDark ? '#E8ECF6' : '#111827',
          'line-width': ['case', ['boolean', ['feature-state', 'sel'], false], 2.5, 0],
        },
      });
      // Nivel circuito (Story 6.3): burbujas de punto, visibles solo cuando nivel='circuito'.
      m.addLayer({
        id: 'zonas-circle',
        type: 'circle',
        source: 'zonas',
        layout: { visibility: isPointNivel ? 'visible' : 'none' },
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': 5,
          'circle-opacity': 0.85,
          'circle-stroke-color': ['case', ['boolean', ['feature-state', 'sel'], false], (isDark ? '#E8ECF6' : '#111827'), '#ffffff'],
          'circle-stroke-width': ['case', ['boolean', ['feature-state', 'sel'], false], 2.5, 1],
        },
      });

      if (isPointNivel) {
        m.setLayoutProperty('zonas-fill', 'visibility', 'none');
        m.setLayoutProperty('zonas-line', 'visibility', 'none');
      }

      fcRef.value = fc;

      m.on('click', 'zonas-fill', (e) => {
        const f = e.features?.[0];
        if (!f) return;
        commit({ zona: String((f.properties as { name: string }).name) });
      });
      m.on('mouseenter', 'zonas-fill', () => { m.getCanvas().style.cursor = 'pointer'; });
      m.on('mouseleave', 'zonas-fill', () => { m.getCanvas().style.cursor = ''; });

      m.on('click', 'zonas-circle', (e) => {
        const f = e.features?.[0];
        if (!f) return;
        commit({ zona: String((f.properties as { name: string }).name) });
      });
      m.on('mouseenter', 'zonas-circle', () => { m.getCanvas().style.cursor = 'pointer'; });
      m.on('mouseleave', 'zonas-circle', () => { m.getCanvas().style.cursor = ''; });

      applySelection($selection.get().zona);
      applyOpcionFilter($selection.get().opcion);
      // Epic 10: si la URL ya traía ?sel=, colorear por la selección de hojas (Story 10.4).
      {
        const initSel = $selection.get();
        seleccionActiva.value = [...initSel.seleccion];
        if (initSel.modo === 'share' || initSel.modo === 'votos' || initSel.modo === 'heatmap') coloreoMode.value = initSel.modo;
        if (initSel.seleccion.length > 0) void applySeleccion();
      }
      status.value = 'listo';
      // Aplicar modo comparación si la URL ya traía ?vs= o ?a=&b= (Stories 4.3/4.4).
      const initCmp = $comparison.get();
      if (initCmp.a && initCmp.b) {
        applyDualOpcionView(initCmp.a, initCmp.b);
      } else if (initCmp.vs && initCmp.vs !== props.eleccion) {
        void applyComparisonOverlay(initCmp.vs, props.eleccion, props.departamento, activeNivel);
      }
      // Activar overlay de circuitos si la URL ya traía ?circ=1.
      if ($circuito.get()) void loadCircuitoOverlay(props.eleccion, props.departamento);
    })(); });
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
      const newNivel = resolveNivel(view.level, view.departamento);
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
  map.value = null;
  circuitoFCForCanvas = null;
  if (afterSwapHandler) document.removeEventListener('astro:after-swap', afterSwapHandler);
  unsubLevel?.();
  unsubComparison?.();
  unsubCircuito?.();
  unsubSelection();
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

    <!-- Conmutador de modo para selección múltiple de hojas (Epic 10, Story 10.4) -->
    <div v-if="seleccionActiva.length > 0" class="vista-toggle" role="group" aria-label="Modo de coloreo del mapa">
      <button
        v-for="mo in (['share', 'votos', 'heatmap'] as const)"
        :key="mo"
        class="vista-toggle__btn"
        :class="{ 'vista-toggle__btn--activo': coloreoMode === mo }"
        :aria-pressed="coloreoMode === mo"
        type="button"
        @click="setColoreo(mo)"
      >{{ mo === 'share' ? 'Share %' : mo === 'votos' ? 'Votos' : 'Heatmap' }}</button>
    </div>

    <MapLegend :entradas="legend" :sin-datos="sinDatos" />
  </section>
</template>

<style>
@import 'maplibre-gl/dist/maplibre-gl.css';

.zona-sigla {
  font: 700 0.6875rem/1 system-ui, sans-serif;
  color: var(--color-ink);
  text-shadow:
    0 0 2px var(--color-card),
    0 0 2px var(--color-card),
    0 0 2px var(--color-card);
  pointer-events: none;
  user-select: none;
}
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
  background: var(--color-map-bg);
}
.map-status {
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  color: var(--color-ink-muted);
}
.map-status--error {
  color: #b91c1c;
}
.vista-toggle {
  display: flex;
  gap: 0;
  padding: 0.5rem 0.75rem;
  border-top: 1px solid var(--color-border);
}
.vista-toggle__btn {
  flex: 1;
  padding: 0.375rem 0.5rem;
  font-size: 0.8125rem;
  background: var(--color-surface-1);
  border: 1px solid var(--color-border-strong);
  cursor: pointer;
  color: var(--color-ink-soft);
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

</style>
