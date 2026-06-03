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
import { onMounted, onUnmounted, ref, shallowRef, computed } from 'vue';
import type { Map as MlMap, Marker as MlMarker, LngLatBoundsLike, GeoJSONSource } from 'maplibre-gl';
import type { Feature, FeatureCollection, Polygon, MultiPolygon, Position } from 'geojson';
import type { Topology, GeometryCollection } from 'topojson-specification';
import { feature as topoFeature } from 'topojson-client';
import { resolveParty } from '../../lib/party-meta';
import { winnerAtLevel, resolveOpcionAppearance, NIVEL_LABEL, type Nivel, type OpcMeta } from '../../lib/appearance';
import type { VotosShard, AgregadoZona } from '../../lib/contracts';
import { $selection, $level, $comparison, $circuito, bindToLocation, commit, hydrateStores } from '../../stores/map-state';
import { parseUrl } from '../../lib/url-state';
import type { NivelGeografico } from '../../lib/contracts';
import deptsConfig from '../../config/departments.json';

const DEPT_LEVELS: Record<string, NivelGeografico[]> = {
  ...Object.fromEntries(
    (deptsConfig as { id: string; levels: NivelGeografico[] }[]).map((d) => [d.id, d.levels])
  ),
  // Vista nacional (Epic 15): resolveNivel necesita los niveles aunque '_nacional' no esté en
  // departments.json. Sin esto, tras navegar (persist) caía a props.availableLevels stale.
  _nacional: ['departamento', 'zona'],
};
import MapLegend from './MapLegend.vue';
import ResultadoGlobal from './ResultadoGlobal.vue';
import ZoneSheet from '../sheet/ZoneSheet.vue';

const props = defineProps<{
  eleccion: string;
  departamento: string;
  availableLevels?: NivelGeografico[];
  /** Nivel inicial cuando la URL no trae ?level (Epic 15.4: vista nacional abre en 'departamento'). */
  defaultNivel?: NivelGeografico;
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
  /** Padrón y emitidos de la zona (Epic no-partidarios) — para participación/abstención. */
  habilitados?: number;
  emitidos?: number;
  pctOpcionActiva: number | null;
  // Epic 10 (Story 10.5): desglose por hoja de la selección en esta zona.
  seleccionTotal?: number;
  seleccionPct?: number;
  desglose?: DesgloseGrupo[];
  esCiudadGrande?: boolean;
  // Ficha por circuito/local: metadata del local + desglose de sus circuitos.
  local?: { nombre: string; direccion: string; habilitados: number };
  circuitos?: { circuito: string; sigla: string; nombre: string; color: string; flagUrl?: string | null; validos: number }[];
}
interface CircuitoBreak { circuito: string; ganadorOpcionId: string; validos: number }
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
  /** Coloreo-por-nivel: sub-ganadores (sublema/lista) bajo este lema, con cap "+masN". */
  subEntradas?: { nombre: string; color: string; votos: number }[];
  masN?: number;
}
/** Resultado agregado de la geografía mostrada (% de voto real, no polígonos ganados). */
interface ResultadoEntry {
  opcionId: string;
  sigla: string;
  nombre: string;
  color: string;
  flagUrl?: string | null;
  votos: number;
  pct: number;
}

let COLOR_SIN_DATOS = '#e5e7eb';
const INTENSIDAD_LIGHT = '#f0f4f8';
let isDark = false;
const mapEl = ref<HTMLDivElement | null>(null);
const status = ref<'cargando' | 'listo' | 'error'>('cargando');
const errorMsg = ref('');
const legend = ref<LegendEntry[]>([]);
const sinDatos = ref(0);
// Epic 16: votos cuyo geoId no tiene polígono (series especiales/observados de las departamentales,
// sin ubicación geográfica real) → se anotan como limitación, no se pierden silenciosamente.
const votosSinUbicacion = ref(0);
const zonasSinUbicacion = ref(0);
// Resultado agregado (% de voto) de la geografía mostrada — independiente de la selección.
const resultadoGlobal = ref<ResultadoEntry[]>([]);
const resultadoValidos = ref(0);
// Contexto del resultado (elección · departamento) para aclarar de qué es. Leído del masthead, que
// es la fuente que SÍ se actualiza al navegar (los props del island quedan congelados por persist).
const resultadoCtx = ref('');
function readResultadoCtx(): void {
  // El masthead nacional agrega "— mapa nacional" (redundante con "Resultado nacional") → se recorta.
  const ele = (document.querySelector('.masthead__eleccion')?.textContent ?? '').split('—')[0].trim();
  const dep = document.querySelector('.masthead__dept')?.textContent?.trim() ?? '';
  // En departamentales la base (votes.json) es SIEMPRE el resultado de Intendente (= Junta a nivel
  // lema; Municipio es otra papeleta). Se aclara para que el número no se confunda con la contienda
  // activa del selector (que solo cambia las listas, no la base). No aplica a otras elecciones.
  const contest = activeEleccion.includes('departamentales') ? 'Intendente' : '';
  const partes = activeDepartamento === '_nacional' ? [ele, contest] : [ele, dep, contest];
  resultadoCtx.value = partes.filter(Boolean).join(' · ');
}
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
let zonasNoPartidarios = new Map<string, { enBlanco: number; anulados: number; observados: number; habilitados: number; emitidos: number }>();
// Ciudades grandes para nivel localidad (Story 8.4 — rótulo degradación).
let ciudadesGrandesSet = new Set<string>();
// Flag: indica si se hizo setData con FC de intensidad (para saber cuándo restaurar).
let intensidadActive = false;
// Comparación dual (Story 4.3): ganador por zona de la elección de comparación.
let vsWinnersMap = new Map<string, string>(); // normalizedGeoId → nombre del ganador en elección vs
let vsZonaPct = new Map<string, Map<string, number>>(); // normGeoId → sigla → % (0..1) en la elección vs (delta Fase 2)
let unsubComparison: (() => void) | null = null;
/** Expresión base de opacidad del relleno (flags transparentan su zona). Reusada para restaurar tras el delta. */
const BASE_FILL_OPACITY = ['case', ['!=', ['get', 'flagPattern'], null], 0, 0.85];
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
const coloreoMode = ref<'ganador' | 'share' | 'heatmap'>('heatmap');
/** Nivel al que se calcula/colorea el ganador en modo Ganador (coloreo-por-nivel). */
const gnivel = ref<Nivel>('lema');
/** Niveles agrupables de la contienda activa (deriva el selector `gnivel`). */
const nivelesDisponibles = ref<Nivel[]>(['lema']);
/** Comparación entre elecciones activa (overlay ?vs= aplicado) → muestra leyenda + nota del borde naranja. */
const comparacionActiva = ref(false);
/** Sub-modo de comparación: 'ganador' (flip, borde naranja) | 'delta' (Δ% de un partido, escala divergente). */
const cmpModo = ref<'ganador' | 'delta'>('ganador');
/** Sigla del partido cuyo Δ% se colorea en modo delta. Default = ganador de la elección base. */
const cmpDeltaSigla = ref('');
/** Clamp del gradiente divergente del delta (±15 puntos porcentuales; deltas reales son chicos). */
const DELTA_CLAMP = 0.15;
/** Partidos seleccionables para el delta (siglas presentes en la base, dedup, con color). */
const siglasComparables = computed(() => {
  const seen = new Map<string, { sigla: string; nombre: string; color: string }>();
  for (const e of resultadoGlobal.value) if (!seen.has(e.sigla)) seen.set(e.sigla, { sigla: e.sigla, nombre: e.nombre, color: e.color });
  return [...seen.values()];
});
// hojaId → metadata del catálogo (del catalogo.json). Null = aún no cargado.
// Ampliado (coloreo-por-nivel): incluye precandidatoId/sublemaId para agrupar el ganador a cualquier nivel.
let catalogoOpcMeta: Map<string, {
  contienda: string; lemaId: string; hoja: string; lemaNombre: string;
  precandidatoId?: string; sublemaId?: string;
}> | null = null;
/** nodeId → etiqueta (de catalogo.nodos): labels de precandidato/sublema para la leyenda. */
let catalogoNodeLabel: Map<string, string> = new Map();
/** contienda → niveles agrupables (Nivel[]) para el selector `gnivel`. */
let catalogoNivelesPorCont: Map<string, Nivel[]> = new Map();
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
                  // Vista nacional (Epic 15.4): nivel 'departamento' usa votes.json (agregado);
                  // nivel 'zona' usa votes-zona.json (todas las zonas de los 19 deptos combinadas).
                  : (departamento === '_nacional' && nivel === 'zona') ? 'votes-zona.json'
                  : 'votes.json';
  const [topoRes, votesRes, opcRes, metaRes, serieMapRes, serieBarrioRes, annexRes] = await Promise.all([
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
    // Epic 16.4: override de anexión — series nuevas que no votaron esa elección, fusionadas con su
    // madre. Per-depto (nivel serie) usa serie-annexed.json; la vista zona nacional usa el
    // consolidado zona-annexed.json. Ausente = sin anexiones.
    nivel === 'serie' && departamento !== '_nacional'
      ? fetch(`${base}/data/${eleccion}/${departamento}/serie-annexed.json`).catch(() => null)
      : (nivel === 'zona' && departamento === '_nacional')
        ? fetch(`${base}/data/${eleccion}/_nacional/zona-annexed.json`).catch(() => null)
        : Promise.resolve(null),
  ]);
  if (!topoRes.ok || !votesRes.ok || !opcRes.ok) throw new Error('No se pudieron cargar los datos del mapa');
  const topo = (await topoRes.json()) as Topology;
  const votes = (await votesRes.json()) as VotosShard;
  const opcDoc = (await opcRes.json()) as OpcionesDoc;

  const objName = Object.keys(topo.objects)[0];
  const geo = topoFeature(topo, topo.objects[objName] as GeometryCollection) as FeatureCollection;

  // Epic 16.4: aplicar el override de anexión — quitar las series grises + sus madres originales y
  // agregar el polígono fusionado M′ (que joinea al voto de la madre por su geoId). Resultado: la
  // serie nueva deja de ser gris y se ve fusionada con su madre, solo para esta elección.
  if (annexRes && annexRes.ok) {
    try {
      const annexFC = (await annexRes.json()) as FeatureCollection;
      const reemplazados = new Set<string>();
      for (const f of annexFC.features) {
        for (const r of ((f.properties as { replaces?: string[] }).replaces ?? [])) reemplazados.add(norm(r));
      }
      geo.features = geo.features
        .filter((f) => !reemplazados.has(norm(String((f.properties as { name?: string }).name ?? ''))))
        .concat(annexFC.features);
    } catch { /* override malformado → ignorar, sigue el mapa base */ }
  }

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
      habilitados: z.habilitados ?? 0,
      emitidos: z.emitidos ?? 0,
    });
  }

  const zonaPorGeo = new Map(votes.zonas.map((z) => [norm(z.geoId), z]));
  const barriosGanados = new Map<string, number>();

  // Epic 16 — Polígonos MERGEADOS ("a-b-c"): la geometría dibuja varias series como una sola forma
  // (mismo lugar), pero el voto las trae separadas. Sintetizamos la zona del polígono sumando sus
  // series constituyentes → "vincula" esos votos al polígono (no quedan gris ni invisibles).
  const consumidasPorMerge = new Set<string>();
  for (const f of geo.features) {
    const name = String((f.properties as { name: string }).name);
    const key = norm(name);
    if (!name.includes('-') || zonaPorGeo.has(key)) continue;
    const partes = name.split('-').map((s) => norm(s));
    const zs = partes.map((p) => zonaPorGeo.get(p)).filter((z): z is NonNullable<typeof z> => !!z);
    if (zs.length === 0) continue;
    const porOp = new Map<string, number>();
    let vv = 0, eb = 0, an = 0, ob = 0, hb = 0, em = 0;
    for (const z of zs) {
      for (const o of z.porOpcion) porOp.set(o.opcionId, (porOp.get(o.opcionId) ?? 0) + o.votos);
      vv += z.validos; eb += z.noPartidarios.enBlanco; an += z.noPartidarios.anulados; ob += z.noPartidarios.observados;
      hb += z.habilitados ?? 0; em += z.emitidos ?? 0;
    }
    const porOpcion = [...porOp.entries()].map(([opcionId, votos]) => ({ opcionId, votos }));
    const ganadorOpcionId = porOpcion.reduce((a, b) => (b.votos > a.votos ? b : a)).opcionId;
    zonaPorGeo.set(key, { geoId: name, ganadorOpcionId, validos: vv, porOpcion,
      noPartidarios: { enBlanco: eb, anulados: an, observados: ob }, habilitados: hb, emitidos: em } as (typeof zs)[number]);
    zonasVotos.set(key, new Map(porOpcion.map((o) => [o.opcionId, o.votos])));
    zonasValidos.set(key, vv);
    zonasNoPartidarios.set(key, { enBlanco: eb, anulados: an, observados: ob, habilitados: hb, emitidos: em });
    partes.forEach((p) => consumidasPorMerge.add(p));
  }

  let sin = 0;
  for (const f of geo.features) {
    const name = String((f.properties as { name: string }).name);
    const zona = zonaPorGeo.get(norm(name));
    const p = f.properties as Record<string, unknown>;
    p.name = name;
    if (zona && zona.porOpcion.length > 0) {
      const nombre = nombrePorOpcion.get(zona.ganadorOpcionId) ?? zona.ganadorOpcionId;
      const meta = resolveParty(nombre, eleccion);
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

  // Epic 16 — Votos SIN UBICACIÓN: zonas con voto cuyo geoId no tiene polígono (ni directo ni vía
  // merge). En las departamentales son ~127 series especiales/observados (c1,d1,n1…) sin lugar real
  // → se reportan como limitación abajo, sin perderlos del conteo.
  const featKeys = new Set(geo.features.map((f) => norm(String((f.properties as { name: string }).name))));
  let zSU = 0, vSU = 0;
  for (const z of votes.zonas) {
    const k = norm(z.geoId);
    if (!featKeys.has(k) && !consumidasPorMerge.has(k)) { zSU++; vSU += z.validos; }
  }
  zonasSinUbicacion.value = zSU;
  votosSinUbicacion.value = vSU;

  legend.value = [...barriosGanados.entries()]
    .map(([opcionId, barrios]) => {
      const nombre = nombrePorOpcion.get(opcionId) ?? opcionId;
      const meta = resolveParty(nombre, eleccion);
      return { sigla: meta.sigla, nombre, color: meta.color, votos: barrios, flagUrl: meta.flagUrl };
    })
    .sort((a, b) => b.votos - a.votos);
  origLegend = legend.value;

  // Resultado agregado (% de voto real) — se suma desde votes.zonas (la fuente cruda del shard, sin
  // las entradas sintéticas del merge "a-b-c" que duplicarían las series constituyentes). Incluye las
  // series sin ubicación geográfica (igual que la nota de la leyenda: contabilizadas en los totales).
  {
    const votosPorOpcion = new Map<string, number>();
    let totalValidos = 0;
    for (const z of votes.zonas) {
      totalValidos += z.validos;
      for (const { opcionId, votos: v } of z.porOpcion) {
        votosPorOpcion.set(opcionId, (votosPorOpcion.get(opcionId) ?? 0) + v);
      }
    }
    resultadoValidos.value = totalValidos;
    resultadoGlobal.value = [...votosPorOpcion.entries()]
      .map(([opcionId, v]) => {
        const nombre = nombrePorOpcion.get(opcionId) ?? opcionId;
        const meta = resolveParty(nombre, eleccion);
        return {
          opcionId, sigla: meta.sigla, nombre, color: meta.color, flagUrl: meta.flagUrl,
          votos: v, pct: totalValidos > 0 ? (v / totalValidos) * 100 : 0,
        };
      })
      .sort((a, b) => b.votos - a.votos);
  }

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
  selMarkerState = null;
}

// Canvas overlay: una bandera centrada y escalada por polígono, recortada al contorno de la zona.
const flagImgs: Record<string, HTMLImageElement> = {};
let flagCanvas: HTMLCanvasElement | null = null;
let flagCtx: CanvasRenderingContext2D | null = null;
let flagsVisible = true;
// FeatureCollection de circuitos con datos de partido, para dibujar en el canvas overlay.
let circuitoFCForCanvas: FeatureCollection | null = null;
// FC de zonas ACTUALMENTE mostrado (el último setData('zonas')). drawFlagOverlay lo recorre para
// tener geometría COMPLETA (sin clipear por tile) + props del modo activo (color/flagPattern/hasData).
// Se actualiza en cada setData('zonas'); los builders preservan la geometría por referencia (...f).
let zonasDisplayFC: FeatureCollection | null = null;
// Ficha por circuito/local: dato completo de cada local/circuito del overlay (norm(geoId) → zona).
type ZonaLocal = AgregadoZona & { local?: { nombre: string; direccion: string; habilitados: number }; circuitos?: CircuitoBreak[] };
let circuitoZonaPorGeo = new Map<string, ZonaLocal>();
// Desglose por HOJA del nivel local (hoja-local.json), keyed por norm(localId) → opcionId → votos.
// Da el detalle por lista/sublema en la ficha del circuito y coloreo hoja-exacto (si existe el shard).
let circuitHojaVotos = new Map<string, Map<string, number>>();

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
    ['flag-is', `${base}/flags/is.svg`],
    ['flag-ap', `${base}/flags/ap.svg`],
    ['flag-peri', `${base}/flags/peri.svg`],
    ['flag-pca', `${base}/flags/pca.svg`],
    ['flag-ar', `${base}/flags/ar.svg`],
    ['flag-pcn', `${base}/flags/pcn.svg`],
    ['flag-pva', `${base}/flags/pva.svg`],
    ['flag-pg', `${base}/flags/pg.svg`],
    ['flag-pd', `${base}/flags/pd.svg`],
    ['flag-pt', `${base}/flags/pt.svg`],
    ['flag-lib', `${base}/flags/lib.svg`],
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
/** Sigla de partido de una opción (hoja o lema), para matchear contra el porOpcion de los circuitos
 *  (que es a nivel partido/lema, sin hoja). Ej: 'unica-frente-amplio-90' → 'FA'. */
function siglaDeOpcion(oid: string): string {
  return resolveParty(nombrePartidoDeOpcion(oid), activeEleccion).sigla;
}

/** Votos de la selección en un circuito/local: si existe hoja-local.json suma EXACTO las hojas
 *  seleccionadas; si no, agrega por partido (sigla) desde el porOpcion lema-level. Devuelve el total
 *  y el desglose por partido (para el modo "ganador entre seleccionados"). */
function circuitSelVotes(z: ZonaLocal, sel: string[], selSiglas: Set<string>): { sum: number; porPartido: Map<string, { votos: number; nombre: string }> } {
  const hojaMap = circuitHojaVotos.get(norm(z.geoId));
  const porPartido = new Map<string, { votos: number; nombre: string }>();
  let sum = 0;
  if (hojaMap) {
    for (const oid of sel) {
      const v = hojaMap.get(oid) ?? 0; if (v <= 0) continue;
      sum += v;
      const sigla = siglaDeOpcion(oid);
      const e = porPartido.get(sigla) ?? { votos: 0, nombre: nombrePartidoDeOpcion(oid) };
      e.votos += v; porPartido.set(sigla, e);
    }
  } else {
    for (const o of z.porOpcion) {
      const sigla = siglaDeOpcion(o.opcionId);
      if (!selSiglas.has(sigla)) continue;
      sum += o.votos;
      const e = porPartido.get(sigla) ?? { votos: 0, nombre: opcNombreMap.get(o.opcionId) ?? o.opcionId };
      e.votos += o.votos; porPartido.set(sigla, e);
    }
  }
  return { sum, porPartido };
}

/** Contexto de coloreo de los dots de circuito para el frame actual: modo activo + siglas de la
 *  selección + máximos de escala (heatmap/intensidad se normalizan al máximo sobre los circuitos). */
function circuitColorCtx(): {
  sel: string[]; opcion: string | null; modo: 'ganador' | 'share' | 'heatmap';
  intensidad: boolean; selSiglas: Set<string>; maxSelSum: number; maxPct: number; nivel: Nivel; cont: string | null;
} {
  const sel = seleccionActiva.value;
  const opcion = opcionActiva.value;
  const modo = coloreoMode.value;
  const intensidad = intensidadActive;
  // Los circuitos son a nivel partido: matcheamos la selección (que viene en ids de hoja) por sigla.
  const selSiglas = new Set(sel.map(siglaDeOpcion));
  let maxSelSum = 1, maxPct = 0;
  if (circuitoFCForCanvas && (sel.length > 0 || (opcion && intensidad))) {
    for (const f of circuitoFCForCanvas.features) {
      const z = circuitoZonaPorGeo.get(norm(String((f.properties as { name?: string }).name ?? '')));
      if (!z) continue;
      if (sel.length > 0 && modo === 'heatmap') {
        const s = circuitSelVotes(z, sel, selSiglas).sum;
        if (s > maxSelSum) maxSelSum = s;
      }
      if (opcion && intensidad && z.validos > 0) {
        const p = (z.porOpcion.find((o) => o.opcionId === opcion)?.votos ?? 0) / z.validos;
        if (p > maxPct) maxPct = p;
      }
    }
  }
  return { sel, opcion, modo, intensidad, selSiglas, maxSelSum, maxPct, nivel: gnivel.value, cont: $selection.get().contienda };
}

/** Coloreo-por-nivel en un circuito/local (Epic 19.2): ganador al nivel `gnivel` sobre el desglose
 *  por HOJA del local (`circuitHojaVotos`), reutilizando el mismo núcleo que las zonas
 *  (`winnerAtLevel` + `appearanceDeKey`). Devuelve null si el circuito no tiene hoja-local
 *  (→ el caller cae al coloreo por sigla/lema). El universo restringe a las hojas relevantes
 *  (la selección, o todas las del local en el caso absoluto). */
function circuitWinnerAtLevel(z: ZonaLocal, universo: string[], nivel: Nivel): { color: string; flagPattern: string | null } | null {
  const hojaMap = circuitHojaVotos.get(norm(z.geoId));
  if (!hojaMap) return null;
  const votos = new Map<string, number>();
  for (const oid of universo) { const v = hojaMap.get(oid) ?? 0; if (v > 0) votos.set(oid, v); }
  const { key, votos: w } = winnerAtLevel(votos, metaOf, nivel);
  if (!key || w <= 0) return null;
  const ap = appearanceDeKey(key, nivel);
  return { color: ap.color, flagPattern: ap.pattern ? ap.pattern.id : null };
}

/** Color/bandera de un dot de circuito según el modo de coloreo activo — paridad con las zonas.
 *  Los circuitos son a nivel partido/lema: la selección se agrega por partido (sigla), no por hoja. */
function circuitStyle(z: ZonaLocal, ctx: ReturnType<typeof circuitColorCtx>): { color: string; flagPattern: string | null } {
  const validos = z.validos;
  const MUTED = validos > 0 ? interpolateHex(INTENSIDAD_LIGHT, SEL_BASE, 0.12) : COLOR_SIN_DATOS;
  const partyStyle = (nombre: string): { color: string; flagPattern: string | null } => {
    const meta = resolveParty(nombre, activeEleccion);
    return { color: meta.color, flagPattern: meta.flagUrl ? `flag-${meta.sigla.toLowerCase()}` : null };
  };
  // Selección activa (acordeón): ganador-entre-seleccionado | share | heatmap.
  // Hoja-exacto si hay hoja-local.json; si no, agrega por partido (sigla).
  if (ctx.sel.length > 0) {
    const { sum, porPartido } = circuitSelVotes(z, ctx.sel, ctx.selSiglas);
    if (ctx.modo === 'ganador') {
      // Sub-nivel (sublema/precandidato/lista): hereda el coloreo del mapa donde hay hoja-local.
      if (ctx.nivel !== 'lema') {
        const sub = circuitWinnerAtLevel(z, ctx.sel, ctx.nivel);
        if (sub) return sub;
      }
      let best: { votos: number; nombre: string } | null = null;
      for (const v of porPartido.values()) if (!best || v.votos > best.votos) best = v;
      return best && best.votos > 0 ? partyStyle(best.nombre) : { color: MUTED, flagPattern: null };
    }
    if (sum <= 0) return { color: validos > 0 ? (ctx.modo === 'heatmap' ? HEAT_STOPS[0] : MUTED) : COLOR_SIN_DATOS, flagPattern: null };
    const t = ctx.modo === 'share' ? (validos > 0 ? Math.min(1, sum / validos) : 0) : Math.min(1, sum / ctx.maxSelSum);
    const color = ctx.modo === 'heatmap' ? heatColor(Math.max(0.05, t)) : interpolateHex(INTENSIDAD_LIGHT, SEL_BASE, Math.max(0.1, t));
    return { color, flagPattern: null };
  }
  // Filtro de opción simple (sin acordeón): intensidad por % | ganador filtrado.
  if (ctx.opcion) {
    const votesOpcion = z.porOpcion.find((o) => o.opcionId === ctx.opcion)?.votos ?? 0;
    if (ctx.intensidad) {
      const t = validos > 0 && ctx.maxPct > 0 ? (votesOpcion / validos) / ctx.maxPct : 0;
      const meta = resolveParty(opcNombreMap.get(ctx.opcion) ?? ctx.opcion, activeEleccion);
      return { color: t > 0.01 ? interpolateHex(INTENSIDAD_LIGHT, meta.color, t) : COLOR_SIN_DATOS, flagPattern: null };
    }
    return z.ganadorOpcionId === ctx.opcion ? partyStyle(opcNombreMap.get(ctx.opcion) ?? ctx.opcion) : { color: COLOR_SIN_DATOS, flagPattern: null };
  }
  // Default: ganador absoluto. Sub-nivel hereda gnivel sobre las hojas del local (hoja-local),
  // SCOPEADAS a la contienda activa: un local mezcla odn+odd, así que filtramos por contienda
  // (idéntico al universo que arma aplicarGanadorAbsolutoPorNivel para las zonas).
  if (ctx.nivel !== 'lema') {
    const hojaMap = circuitHojaVotos.get(norm(z.geoId));
    if (hojaMap) {
      const universo = [...hojaMap.keys()].filter((oid) => !ctx.cont || catalogoOpcMeta?.get(oid)?.contienda === ctx.cont);
      const sub = circuitWinnerAtLevel(z, universo, ctx.nivel);
      if (sub) return sub;
    }
  }
  return partyStyle(opcNombreMap.get(z.ganadorOpcionId) ?? z.ganadorOpcionId);
}

/** Desglose de la selección en un circuito/local, agrupado por PARTIDO (sigla; los circuitos no
 *  tienen granularidad de hoja → sin sub-listas). Espeja buildDesglose para la ficha del circuito. */
function buildDesgloseCircuito(z: ZonaLocal, sel: string[]): { grupos: DesgloseGrupo[]; total: number } {
  const selSiglas = new Set(sel.map(siglaDeOpcion));
  const byParty = new Map<string, { nombre: string; total: number }>();
  let total = 0;
  for (const o of z.porOpcion) {
    const sigla = siglaDeOpcion(o.opcionId);
    if (!selSiglas.has(sigla)) continue;
    total += o.votos;
    const nombre = opcNombreMap.get(o.opcionId) ?? o.opcionId;
    const e = byParty.get(sigla) ?? { nombre, total: 0 };
    e.total += o.votos; byParty.set(sigla, e);
  }
  const grupos: DesgloseGrupo[] = [...byParty.values()]
    .filter((g) => g.total > 0)
    .sort((a, b) => b.total - a.total)
    .map((g) => {
      const meta = resolveParty(g.nombre, activeEleccion);
      return { lemaNombre: g.nombre, sigla: meta.sigla, color: meta.color, flagUrl: meta.flagUrl, total: g.total, hojas: [], masN: 0 };
    });
  return { grupos, total };
}

function drawFlagOverlay(m: MlMap): void {
  if (!flagCtx || !flagCanvas) return;
  syncFlagCanvasSize(m);
  flagCtx.clearRect(0, 0, flagCanvas.width, flagCanvas.height);
  flagCtx.globalAlpha = 1.0; // baseline; la atenuación de flip se aplica por-bandera en Pasada 1

  const dpr = window.devicePixelRatio || 1;

  // Banderas de partido recortadas a cada polígono de zona (solo niveles poligonales).
  // Dos pasadas: primero todos los flags, luego todos los bordes encima.
  if (flagsVisible && !isPointNivel) {
    type Ring = [number, number][];
    // Recorremos el FC ACTUALMENTE mostrado (no queryRenderedFeatures). queryRenderedFeatures devuelve
    // la geometría PARTIDA por tile (con buffer): combinar las piezas en un clip('evenodd') hacía que
    // los solapes de buffer se cancelaran (conteo par) → franjas/polígonos transparentes a alto zoom, y
    // bordear cada pieza dibujaba las líneas de la grilla de tiles. Además, a alto zoom QRF puede dejar
    // de devolver barrios enteros (cobertura por tile) → quedaban blancos. El FC de origen tiene la
    // geometría COMPLETA y todos los barrios; sus props ya reflejan el modo activo (los builders hacen
    // ...f preservando geometría y seteando color/flagPattern del modo).
    const dispFC = zonasDisplayFC ?? fcRef.value;
    const feats = dispFC?.features ?? [];
    const ringsOf = (f: Feature): Ring[] => {
      const geom = f.geometry as { type: string; coordinates: unknown };
      if (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon') return [];
      return geom.type === 'Polygon' ? (geom.coordinates as Ring[]) : (geom.coordinates as Ring[][]).flat(1);
    };
    const tracePath = (f: Feature, bbox?: { minX: number; minY: number; maxX: number; maxY: number }): void => {
      flagCtx!.beginPath();
      for (const ring of ringsOf(f)) {
        let first = true;
        for (const coord of ring) {
          const pt = m.project(coord as [number, number]);
          const px = pt.x * dpr; const py = pt.y * dpr;
          if (first) { flagCtx!.moveTo(px, py); first = false; }
          else flagCtx!.lineTo(px, py);
          if (bbox) {
            if (px < bbox.minX) bbox.minX = px; if (py < bbox.minY) bbox.minY = py;
            if (px > bbox.maxX) bbox.maxX = px; if (py > bbox.maxY) bbox.maxY = py;
          }
        }
        flagCtx!.closePath();
      }
    };

    // Comparación modo "cambió ganador": atenuar las banderas de las zonas que NO cambiaron
    // → las que flipearon quedan a full y saltan. Mantiene TODAS las banderas visibles.
    const flipDim = comparacionActiva.value && cmpModo.value === 'ganador';
    // Pasada 1: flags recortados a cada polígono completo (un solo drawImage por barrio)
    for (const f of feats) {
      const props = f.properties as Record<string, unknown>;
      if (!props.flagPattern || !props.hasData) continue;
      const img = flagImgs[props.flagPattern as string];
      if (!img) continue;
      const fname = String(props.name ?? '');
      const dimmed = flipDim && !m.getFeatureState({ source: 'zonas', id: fname })?.vsChanged;
      const bbox = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
      tracePath(f, bbox);
      if (!Number.isFinite(bbox.minX)) continue;
      // A alto zoom un polígono puede salirse de pantalla → su bbox en px llega a decenas de miles.
      // drawImage con dimensiones enormes (>~32k px, límite del canvas) FALLA silenciosamente y el
      // polígono queda SIN bandera (blanco/transparente). Clampeamos el bbox al área visible del
      // canvas (con margen): el flag se escala a lo visible y el clip lo recorta al polígono igual.
      const W = flagCanvas.width, H = flagCanvas.height;
      const minX = Math.max(bbox.minX, -W), minY = Math.max(bbox.minY, -H);
      const maxX = Math.min(bbox.maxX, 2 * W), maxY = Math.min(bbox.maxY, 2 * H);
      if (maxX <= minX || maxY <= minY) continue;  // polígono fuera de pantalla
      flagCtx.save();
      flagCtx.clip('evenodd');
      const bw = maxX - minX, bh = maxY - minY;
      const flagAspect = img.naturalWidth / img.naturalHeight;
      let dw = bw, dh = bw / flagAspect;
      if (dh < bh) { dh = bh; dw = bh * flagAspect; }
      flagCtx.globalAlpha = dimmed ? 0.3 : 1.0;
      flagCtx.drawImage(img, minX + (bw - dw) / 2, minY + (bh - dh) / 2, dw, dh);
      flagCtx.restore();
    }

    // Pasada 2: bordes encima de todos los flags + highlight de zona seleccionada
    const selectedGeoId = selected.value?.geoId ?? null;
    flagCtx.lineJoin = 'round';
    flagCtx.globalAlpha = 1.0; // los bordes nunca se atenúan (Pasada 1 pudo dejar alpha < 1)
    for (const f of feats) {
      const fid = String((f.properties as { name?: string }).name ?? '');
      tracePath(f);
      const isSelected = selectedGeoId !== null && fid === selectedGeoId;
      if (isSelected) {
        flagCtx.strokeStyle = '#f59e0b';
        flagCtx.lineWidth = 5 * dpr;
        flagCtx.stroke();
        flagCtx.strokeStyle = '#fef9c3';
        flagCtx.lineWidth = 2 * dpr;
        flagCtx.stroke();
      } else {
        // Borde entre polígonos: oscuro y marcado pero fino (antes 1px/0.65 se veía lavado en
        // barrios chicos con relleno claro; 1.5 quedaba algo grueso → 1.15).
        // Oscuro en AMBOS temas (pedido del usuario): no invertir a blanco en modo oscuro.
        flagCtx.strokeStyle = 'rgba(10,12,24,0.92)';
        flagCtx.lineWidth = 1.15 * dpr;
        flagCtx.stroke();
      }
    }
  }

  // Overlay de circuitos: skip durante movimiento activo para evitar lag a 60fps.
  if (circuitoFCForCanvas && !isMapMoving) {
    type Ring = [number, number][];
    // Highlight del circuito/local seleccionado (mismo ámbar que el polígono seleccionado).
    const selCircId = selected.value?.geoId ? norm(selected.value.geoId) : null;
    // Coloreo de los dots según el modo activo (ganador/filtro/share/heatmap) — paridad con zonas.
    const cctx = circuitColorCtx();
    for (const f of circuitoFCForCanvas.features) {
      const fprops = f.properties as Record<string, unknown>;
      if (!fprops.hasData) continue;
      // El color/bandera del dot sale del modo activo, no del ganador estático del FC.
      const czl = circuitoZonaPorGeo.get(norm(String(fprops.name ?? '')));
      const cstyle = czl ? circuitStyle(czl, cctx)
        : { color: String(fprops.color ?? '#999'), flagPattern: (fprops.flagPattern as string | null) ?? null };
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
      const dotImg = cstyle.flagPattern ? flagImgs[cstyle.flagPattern] : null;
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
        flagCtx.fillStyle = cstyle.color;
        flagCtx.fill();
      }
      flagCtx.restore();
      const isSelCirc = selCircId !== null && norm(String(fprops.name ?? '')) === selCircId;
      if (isSelCirc) {
        // Anillo ámbar como el polígono seleccionado (dot agrandado + doble trazo).
        flagCtx.beginPath();
        flagCtx.arc(cpx, cpy, r + 4 * dpr, 0, Math.PI * 2);
        flagCtx.strokeStyle = '#f59e0b';
        flagCtx.lineWidth = 3.5 * dpr;
        flagCtx.stroke();
        flagCtx.beginPath();
        flagCtx.arc(cpx, cpy, r + 4 * dpr, 0, Math.PI * 2);
        flagCtx.strokeStyle = '#fef9c3';
        flagCtx.lineWidth = 1.25 * dpr;
        flagCtx.stroke();
      } else {
        flagCtx.beginPath();
        flagCtx.arc(cpx, cpy, r, 0, Math.PI * 2);
        flagCtx.strokeStyle = 'rgba(255,255,255,0.8)';
        flagCtx.lineWidth = 1 * dpr;
        flagCtx.stroke();
      }
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
    const built = new Map<string, { contienda: string; lemaId: string; hoja: string; lemaNombre: string; precandidatoId?: string; sublemaId?: string }>();
    const nodeLabel = new Map<string, string>();
    const nivPorCont = new Map<string, Nivel[]>();
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, '');
      const res = await fetch(`${base}/data/${eleccion}/${departamento}/catalogo.json`);
      if (res.ok) {
        const doc = (await res.json()) as {
          contiendas: {
            contienda: string;
            niveles: string[];
            nodos: { id: string; nivel: string; etiqueta: string }[];
            opciones: { id: string; hoja?: string; lemaId?: string; precandidatoId?: string; sublemaId?: string }[];
          }[];
        };
        const NIVEL_MAP: Record<string, Nivel> = { lema: 'lema', precandidato: 'precandidato', sublema: 'sublema', hoja: 'lista', candidato: 'candidato' };
        for (const c of doc.contiendas) {
          const lemaNombre = new Map(c.nodos.filter((n) => n.nivel === 'lema').map((n) => [n.id, n.etiqueta]));
          for (const n of c.nodos) nodeLabel.set(n.id, n.etiqueta); // lema/precandidato/sublema
          const nivs = (c.niveles ?? []).map((n) => NIVEL_MAP[n]).filter(Boolean) as Nivel[];
          nivPorCont.set(c.contienda, nivs.length > 1 ? nivs : ['lema']);
          for (const o of c.opciones) {
            const lemaId = o.lemaId ?? '';
            built.set(o.id, {
              contienda: c.contienda, lemaId, hoja: o.hoja ?? '',
              lemaNombre: lemaNombre.get(lemaId) ?? lemaId,
              precandidatoId: o.precandidatoId, sublemaId: o.sublemaId,
            });
          }
        }
      }
    } catch {
      /* sin catálogo → la selección no colorea (se queda en ganador) */
    }
    catalogoNodeLabel = nodeLabel;
    catalogoNivelesPorCont = nivPorCont;
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
function buildDesglose(key: string, sel: string[], votesFor?: (id: string) => number): { grupos: DesgloseGrupo[]; total: number } {
  const TOP = 10;
  // votesFor permite reusar el desglose para circuitos (que leen su propio mapa hoja-local).
  const lookup = votesFor ?? ((id: string) => hojaVotos.get(key)?.get(id) ?? zonasVotos.get(key)?.get(id) ?? 0);
  // Agrupar por (contienda, lema): aunque hoy la selección es de una sola contienda
  // (el acordeón la limpia al cambiar), esto evita conflar odn+odd del mismo lema (AC6).
  const byLema = new Map<string, { nombre: string; hojas: { id: string; label: string; votos: number }[]; total: number }>();
  let total = 0;
  for (const id of sel) {
    const meta = catalogoOpcMeta?.get(id);
    const votos = lookup(id);
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
      const meta = resolveParty(g.nombre, activeEleccion);
      return {
        lemaNombre: g.nombre, sigla: meta.sigla, color: meta.color, flagUrl: meta.flagUrl,
        total: g.total, hojas: hojasOrd.slice(0, TOP), masN: Math.max(0, hojasOrd.length - TOP),
      };
    });
  return { grupos, total };
}

/** Construye un FC coloreado por la selección según el modo (share/votos/heatmap). */
function buildSeleccionFC(fc: FeatureCollection, sel: string[], modo: 'share' | 'heatmap'): FeatureCollection {
  const perFeat = fc.features.map((f) => {
    const key = norm(String((f.properties as { name: string }).name));
    const sum = selSumZona(key, sel);
    const validos = zonasValidos.get(key) ?? 0;
    return { f, sum, validos };
  });
  const sums = perFeat.map((x) => x.sum);
  const maxSum = Math.max(1, ...sums);
  return {
    ...fc,
    features: perFeat.map(({ f, sum, validos }) => {
      let t = 0;
      if (sum > 0) {
        t = modo === 'share'
          ? (validos > 0 ? Math.min(1, sum / validos) : 0)
          : sum / maxSum; // heatmap (magnitud absoluta, escala lineal sobre el máximo)
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

// Estado del modo selección para re-declusterizar los labels en cada zoomend (al acercar reaparecen).
let selMarkerState: { fc: FeatureCollection; modo: 'share' | 'heatmap' } | null = null;

/** Markers de valor (votos o %) por zona en modo selección — cumple "nunca solo por color".
 *  De-clustering: en pantallas densas (bajo zoom) los labels se pisaban; se colocan por PRIORIDAD
 *  (mayor valor primero) descartando los que caen a < MIN_PX de uno ya puesto o fuera de pantalla.
 *  Se re-ejecuta en zoomend → al acercar, los labels antes ocultos aparecen. */
function rebuildSelMarkers(fc: FeatureCollection, modo: 'share' | 'heatmap'): void {
  if (!mlLib || !map.value || isPointNivel) return;
  const m = map.value;
  markers.forEach((mk) => mk.remove());
  markers.length = 0;
  selMarkerState = { fc, modo };
  // Con el overlay de circuitos prendido, los dots ya muestran el detalle por circuito/local:
  // los labels de total por barrio se superponen y saturan → no se dibujan (reaparecen al apagarlo).
  if ($circuito.get()) return;
  const W = m.getCanvas().clientWidth, H = m.getCanvas().clientHeight;
  const MIN_PX = 36;        // separación mínima entre labels
  const MARGIN = 24;        // descartar labels fuera del viewport (con margen)
  // Candidatos con valor > 0, proyectados, ordenados por importancia (los grandes nunca se ocultan).
  const cands = fc.features
    .map((f) => {
      const p = f.properties as { selVal?: number; selPct?: number };
      if (!p.selVal || p.selVal <= 0) return null;
      const [lng, lat] = centroid(f.geometry as Polygon | MultiPolygon);
      const pt = m.project([lng, lat]);
      return { lng, lat, x: pt.x, y: pt.y, selVal: p.selVal, selPct: p.selPct ?? 0 };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .sort((a, b) => b.selVal - a.selVal);
  const placed: { x: number; y: number }[] = [];
  for (const c of cands) {
    if (c.x < -MARGIN || c.x > W + MARGIN || c.y < -MARGIN || c.y > H + MARGIN) continue;
    let clear = true;
    for (const q of placed) {
      if (Math.abs(c.x - q.x) < MIN_PX && Math.abs(c.y - q.y) < MIN_PX) { clear = false; break; }
    }
    if (!clear) continue;
    placed.push({ x: c.x, y: c.y });
    const el = document.createElement('span');
    el.className = 'zona-sigla';
    el.setAttribute('aria-hidden', 'true');
    el.textContent = modo === 'share' ? `${Math.round(c.selPct * 100)}%` : String(c.selVal);
    markers.push(new mlLib!.Marker({ element: el }).setLngLat([c.lng, c.lat]).addTo(m));
  }
}

function buildSeleccionLegend(modo: 'share' | 'heatmap', n: number): LegendEntry[] {
  const titulo =
    modo === 'share' ? `% sobre válidos · ${n} lista${n === 1 ? '' : 's'}`
    : `Votos (densidad) · ${n} lista${n === 1 ? '' : 's'}`;
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

/** Nombre de partido/lema de una opción para color/sigla: HOJA → lema del catálogo;
 *  plano → nombre de opciones.json. (resolveParty necesita el nombre, no el opcionId.) */
function nombrePartidoDeOpcion(id: string): string {
  const meta = catalogoOpcMeta?.get(id);
  if (meta && meta.lemaNombre) return meta.lemaNombre;
  return opcNombreMap.get(id) ?? id;
}

// ── Ganador por NIVEL (coloreo-por-nivel): generaliza el "ganador entre lo seleccionado" ──
/** Lookup OpcMeta para el núcleo puro (desde catalogoOpcMeta; plano → solo lemaId=oid). */
function metaOf(oid: string): OpcMeta | undefined {
  const m = catalogoOpcMeta?.get(oid);
  if (m) return { lemaId: m.lemaId, lemaNombre: m.lemaNombre, precandidatoId: m.precandidatoId, sublemaId: m.sublemaId, hoja: m.hoja };
  return { lemaId: oid, lemaNombre: opcNombreMap.get(oid) ?? oid };
}
/** Votos de las opciones del universo en una zona (hojaVotos si hay shard de hoja; si no, zonasVotos). */
function votosDeZonaUniverso(key: string, universo: string[]): Map<string, number> {
  const mm = hojaVotos.get(key);
  const base = zonasVotos.get(key);
  const out = new Map<string, number>();
  for (const oid of universo) {
    const v = mm?.get(oid) ?? base?.get(oid) ?? 0;
    if (v > 0) out.set(oid, v);
  }
  return out;
}
/** Nombre del lema padre de un nodeId de sublema/precandidato (busca una opción que cuelgue de él). */
function lemaNombrePorNodo(nodeId: string): string {
  if (catalogoOpcMeta) {
    for (const m of catalogoOpcMeta.values()) {
      if (m.sublemaId === nodeId || m.precandidatoId === nodeId) return m.lemaNombre;
    }
  }
  return catalogoNodeLabel.get(nodeId) ?? nodeId;
}
/** "Lista N" / "Voto al lema" para un opcionId terminal. */
function etiquetaTerminal(oid: string): string {
  const hoja = catalogoOpcMeta?.get(oid)?.hoja;
  if (hoja === 'vl') return 'Voto al lema';
  return hoja ? `Lista ${hoja}` : (opcNombreMap.get(oid) ?? oid);
}
/** Apariencia (color/sigla/label/pattern) de una clave ganadora al nivel actual. */
function appearanceDeKey(key: string, nivel: Nivel): ReturnType<typeof resolveOpcionAppearance> {
  const lemaNombre = nivel === 'lema'
    ? (catalogoNodeLabel.get(key) ?? opcNombreMap.get(key) ?? key)
    : (catalogoOpcMeta?.get(key)?.lemaNombre ?? lemaNombrePorNodo(key));
  const esTerminal = nivel === 'lista' || nivel === 'candidato';
  const terminalLabel = esTerminal ? etiquetaTerminal(key) : undefined;
  const nodeLabel = !esTerminal && nivel !== 'lema' ? catalogoNodeLabel.get(key) : undefined;
  return resolveOpcionAppearance(key, nivel, activeEleccion, { lemaNombre, nodeLabel, terminalLabel });
}

/** FC del modo "ganador" al nivel actual: cada zona toma el grupo ganador del universo (sel || todas). */
function buildSeleccionGanadorFC(fc: FeatureCollection, universo: string[]): FeatureCollection {
  const nivel = gnivel.value;
  return {
    ...fc,
    features: fc.features.map((f) => {
      const key = norm(String((f.properties as { name: string }).name));
      const validos = zonasValidos.get(key) ?? 0;
      const { key: ganKey, votos } = winnerAtLevel(votosDeZonaUniverso(key, universo), metaOf, nivel);
      if (!ganKey || votos <= 0) {
        const color = validos > 0 ? interpolateHex(INTENSIDAD_LIGHT, SEL_BASE, 0.12) : COLOR_SIN_DATOS;
        return { ...f, properties: { ...f.properties, color, sigla: '', flagPattern: null, selVal: 0, selPct: 0 } };
      }
      const ap = appearanceDeKey(ganKey, nivel);
      return {
        ...f,
        properties: {
          ...f.properties,
          color: ap.color, sigla: ap.sigla, flagPattern: ap.pattern ? ap.pattern.id : null,
          selVal: votos, selPct: validos > 0 ? votos / validos : 0,
        },
      };
    }),
  } as FeatureCollection;
}

/** Leyenda del modo ganador-por-nivel. nivel 'lema' → un renglón por lema (como antes).
 *  Sub-nivel → agrupado por lema con sub-entradas (cap top-6 + "+N más") para no saturar. */
function buildSeleccionGanadorLegend(fc: FeatureCollection, universo: string[]): LegendEntry[] {
  const nivel = gnivel.value;
  const winsPorClave = new Map<string, number>(); // claveGanadora → nº zonas
  for (const f of fc.features) {
    const key = norm(String((f.properties as { name: string }).name));
    const { key: ganKey, votos } = winnerAtLevel(votosDeZonaUniverso(key, universo), metaOf, nivel);
    if (ganKey && votos > 0) winsPorClave.set(ganKey, (winsPorClave.get(ganKey) ?? 0) + 1);
  }
  if (nivel === 'lema') {
    return [...winsPorClave.entries()]
      .map(([k, n]) => { const ap = appearanceDeKey(k, nivel); return { sigla: ap.sigla, nombre: ap.label, color: ap.color, votos: n, flagUrl: ap.pattern?.url ?? null }; })
      .sort((a, b) => b.votos - a.votos);
  }
  // Sub-nivel: agrupar por sigla de lema → sub-entradas.
  const porLema = new Map<string, { sigla: string; color: string; flagUrl: string | null; total: number; subs: { nombre: string; color: string; votos: number }[] }>();
  for (const [k, n] of winsPorClave) {
    const ap = appearanceDeKey(k, nivel);
    let e = porLema.get(ap.sigla);
    if (!e) {
      const lemaId = catalogoOpcMeta?.get(k)?.lemaId ?? k;
      const lap = appearanceDeKey(lemaId, 'lema');
      e = { sigla: ap.sigla, color: lap.color, flagUrl: lap.pattern?.url ?? null, total: 0, subs: [] };
      porLema.set(ap.sigla, e);
    }
    e.total += n; e.subs.push({ nombre: ap.label, color: ap.color, votos: n });
  }
  return [...porLema.values()].sort((a, b) => b.total - a.total).map((e) => {
    const subs = e.subs.sort((a, b) => b.votos - a.votos);
    const top = subs.slice(0, 6);
    return { sigla: e.sigla, nombre: '', color: e.color, votos: e.total, flagUrl: e.flagUrl, subEntradas: top, masN: subs.length - top.length };
  });
}

/** Restaura el modo ganador desde un FC de selección (síncrono). */
function restoreGanadorDesdeSeleccion(): void {
  const m = map.value;
  const fc = fcRef.value;
  if (!m || !fc || !m.getSource('zonas')) return;
  if (seleccionFCActive) {
    (m.getSource('zonas') as GeoJSONSource).setData(fc); zonasDisplayFC = fc;
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
  syncNivelesDisponibles(); // el catálogo ya cargó → fija niveles del selector y clampa gnivel
  const modo = coloreoMode.value;
  const zonaSel = $selection.get().zona;
  // setData resetea los feature-state: re-aplicar el resaltado de la zona seleccionada + ficha.
  const reaplicarZona = (): void => {
    if (!zonaSel) return;
    // Circuito/local seleccionado: re-armar su ficha ahora que el catálogo ya cargó (desglose por hoja).
    if (circuitoZonaPorGeo.has(norm(zonaSel))) { selectCircuitoLocal(zonaSel); return; }
    m.setFeatureState({ source: 'zonas', id: zonaSel }, { sel: true });
    selectByName(zonaSel, fc);
  };

  if (modo === 'ganador') {
    // Modo "ganador entre lo seleccionado": color/bandera de la opción seleccionada líder por zona.
    const selFC = buildSeleccionGanadorFC(fc, sel);
    (m.getSource('zonas') as GeoJSONSource).setData(selFC); zonasDisplayFC = selFC;
    m.setPaintProperty('zonas-fill', 'fill-color', ['get', 'color']);
    seleccionFCActive = true;
    setPatternVisible(true); // banderas (mismo render que el modo ganador por defecto)
    reaplicarZona();
    rebuildMarkers(selFC);
    legend.value = buildSeleccionGanadorLegend(fc, sel);
    return;
  }

  const selFC = buildSeleccionFC(fc, sel, modo);
  (m.getSource('zonas') as GeoJSONSource).setData(selFC);
  m.setPaintProperty('zonas-fill', 'fill-color', ['get', 'color']);
  setPatternVisible(false);
  seleccionFCActive = true;
  reaplicarZona();
  rebuildSelMarkers(selFC, modo);
  legend.value = buildSeleccionLegend(modo, sel.length);
}

/** Cambia el modo de coloreo (escribe la URL; el subscribe re-aplica). */
function setColoreo(modo: 'ganador' | 'share' | 'heatmap'): void {
  coloreoMode.value = modo;
  commit({ modo });
}

const NIVELES_GANADOR: readonly Nivel[] = ['lema', 'precandidato', 'sublema', 'lista', 'candidato'];
const esNivel = (v: string | null): v is Nivel => v !== null && (NIVELES_GANADOR as readonly string[]).includes(v);

/** Recalcula los niveles del selector según la contienda activa y clampa `gnivel` si no aplica.
 *  No toca nada hasta que el catálogo cargó (catalogoNivelesPorCont vacío = aún no sabemos). */
function syncNivelesDisponibles(): void {
  if (catalogoNivelesPorCont.size === 0) return;
  const cont = $selection.get().contienda ?? [...catalogoNivelesPorCont.keys()][0];
  nivelesDisponibles.value = (cont && catalogoNivelesPorCont.get(cont)) || ['lema'];
  if (!nivelesDisponibles.value.includes(gnivel.value)) gnivel.value = 'lema';
}

/** Cambia el nivel del ganador (escribe la URL; el subscribe re-aplica el coloreo). */
function setGnivel(nivel: Nivel): void {
  gnivel.value = nivel;
  commit({ gnivel: nivel });
}

/** Sin selección: colorea por el ganador ABSOLUTO al nivel actual. 'lema' → FC base (restore);
 *  sub-nivel → carga todos los shards de hoja de la contienda y computa winnerAtLevel sobre TODAS. */
async function aplicarGanadorAbsolutoPorNivel(): Promise<void> {
  const m = map.value; const fc = fcRef.value;
  if (!m || !fc || !m.getSource('zonas')) return;
  if (gnivel.value === 'lema') { restoreGanadorDesdeSeleccion(); return; }
  const myGen = ++seleccionGen;
  await ensureCatalogo(activeEleccion, activeDepartamento);
  syncNivelesDisponibles();
  if (gnivel.value === 'lema') { restoreGanadorDesdeSeleccion(); return; } // quedó clampeado
  const cont = $selection.get().contienda;
  const universo = [...(catalogoOpcMeta?.entries() ?? [])]
    .filter(([, meta]) => !cont || meta.contienda === cont)
    .map(([id]) => id);
  await ensureHojaShards(activeEleccion, activeDepartamento, universo); // todos los lemas de la contienda
  if (myGen !== seleccionGen) return;
  const selFC = buildSeleccionGanadorFC(fc, universo);
  (m.getSource('zonas') as GeoJSONSource).setData(selFC); zonasDisplayFC = selFC;
  m.setPaintProperty('zonas-fill', 'fill-color', ['get', 'color']);
  seleccionFCActive = true;
  setPatternVisible(true);
  rebuildMarkers(selFC);
  legend.value = buildSeleccionGanadorLegend(fc, universo);
}

/** Aplica modo ganador (Story 2.2): zonas donde gana opcion en color, resto gris. */
function applyGanadorMode(opcionId: string, m: MlMap, fc: FeatureCollection): void {
  if (intensidadActive) {
    (m.getSource('zonas') as GeoJSONSource).setData(fc); zonasDisplayFC = fc;
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
  const meta = resolveParty(nombre, activeEleccion);
  const count = fc.features.filter(
    (f) => (f.properties as { ganadorOpcionId?: string }).ganadorOpcionId === opcionId,
  ).length;
  legend.value = [{ sigla: meta.sigla, nombre, color: meta.color, votos: count }];
}

/** Aplica modo intensidad (Story 2.3): gradiente de % de voto para opcion dada. */
function applyIntensidadMode(opcionId: string, m: MlMap, fc: FeatureCollection): void {
  const nombre = opcNombreMap.get(opcionId) ?? opcionId;
  const meta = resolveParty(nombre, activeEleccion);
  const gradientFC = buildIntensidadFC(fc, opcionId, meta.color);
  (m.getSource('zonas') as GeoJSONSource).setData(gradientFC); zonasDisplayFC = gradientFC;
  m.setPaintProperty('zonas-fill', 'fill-color', ['get', 'color']);
  intensidadActive = true;
  setPatternVisible(false);
  markers.forEach((mk) => mk.remove());
  markers.length = 0;
  selMarkerState = null;
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
      (m.getSource('zonas') as GeoJSONSource).setData(fc); zonasDisplayFC = fc;
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
  comparacionActiva.value = false; // se confirma al final si el overlay aplica
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
    // vsZonaPct: geoId normalizado → sigla → % (0..1) en la elección vs (para el delta Fase 2).
    vsZonaPct = new Map();
    for (const z of votes.zonas) {
      if (z.porOpcion.length > 0) {
        const vsNombre = vsNombrePorOpcion.get(z.ganadorOpcionId) ?? z.ganadorOpcionId;
        vsWinnersMap.set(norm(z.geoId), vsNombre);
        // Sigla: desde la tabla de equiv si existe, sino desde resolveParty
        const sigla = siglaFromBId.get(z.ganadorOpcionId) ?? resolveParty(vsNombre).sigla;
        vsSiglaMap.set(norm(z.geoId), sigla);
        // % por sigla en esta zona (delta). Agrega por sigla canónica; share sobre válidos.
        if (z.validos > 0) {
          const porSigla = new Map<string, number>();
          for (const o of z.porOpcion) {
            const nombre = vsNombrePorOpcion.get(o.opcionId) ?? o.opcionId;
            const s = siglaFromBId.get(o.opcionId) ?? resolveParty(nombre).sigla;
            porSigla.set(s, (porSigla.get(s) ?? 0) + o.votos);
          }
          const pctMap = new Map<string, number>();
          for (const [s, v] of porSigla) pctMap.set(s, v / z.validos);
          vsZonaPct.set(norm(z.geoId), pctMap);
        }
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
    comparacionActiva.value = true; // overlay aplicado → leyenda + nota del borde naranja
    if (!cmpDeltaSigla.value || !siglasComparables.value.some((s) => s.sigla === cmpDeltaSigla.value)) {
      cmpDeltaSigla.value = resultadoGlobal.value[0]?.sigla ?? ''; // default = ganador de la base
    }
    renderComparacionFill(); // aplica relleno según el sub-modo (ganador | delta)
  } catch {
    // Degradación silenciosa: si no hay datos de comparación, el mapa sigue normal.
  }
}

/** % (0..1) de una sigla en una zona de la elección BASE (sobre válidos). null si no hay datos. */
function basePctSiglaEnZona(key: string, sigla: string): number | null {
  const validos = zonasValidos.get(key) ?? 0;
  if (validos <= 0) return null;
  const vm = zonasVotos.get(key);
  if (!vm) return null;
  let s = 0;
  for (const [oid, v] of vm) if (resolveParty(opcNombreMap.get(oid) ?? oid, activeEleccion).sigla === sigla) s += v;
  return s / validos;
}

/**
 * Aplica el relleno del mapa según el sub-modo de comparación (Fase 2).
 * - 'ganador': relleno base (colores de partido + banderas), con el borde naranja del flip.
 * - 'delta':   relleno divergente por Δ% (base − vs) del partido `cmpDeltaSigla`; zonas sin dato
 *              comparable van GRISES (nunca delta-contra-cero → evita falsos extremos).
 */
function renderComparacionFill(): void {
  const m = map.value;
  const fc = fcRef.value;
  if (!m || !fc) return;
  if (cmpModo.value !== 'delta' || !cmpDeltaSigla.value) {
    // 'ganador' (flip) por REALCE-POR-CONTRASTE, MANTENIENDO LAS BANDERAS: las zonas que cambiaron
    // de ganador quedan a full; las que se mantuvieron, atenuadas. Las banderas (canvas) se atenúan
    // por alpha en drawFlagOverlay; los rellenos sólidos (sin bandera) por fill-opacity acá.
    for (const f of fc.features) {
      const name = String((f.properties as { name: string }).name);
      m.setFeatureState({ source: 'zonas', id: name }, { delta: 0, deltaNA: false });
    }
    setPatternVisible(true); // banderas SIEMPRE visibles
    if (m.getLayer('zonas-vs-changed')) m.setLayoutProperty('zonas-vs-changed', 'visibility', 'none'); // contorno abandonado
    m.setPaintProperty('zonas-fill', 'fill-color', ['get', 'color']);
    m.setPaintProperty('zonas-fill', 'fill-opacity', [
      'case',
      ['!=', ['get', 'flagPattern'], null], 0,                              // con bandera → la dibuja el canvas
      ['boolean', ['feature-state', 'vsChanged'], false], 0.85,             // sin bandera, cambió → full
      0.22,                                                                 // sin bandera, se mantuvo → atenuado
    ]);
    drawFlagOverlay(m); // redibuja banderas con la atenuación de las que no cambiaron
    return;
  }
  const sigla = cmpDeltaSigla.value;
  for (const f of fc.features) {
    const name = String((f.properties as { name: string }).name);
    const key = norm(name);
    const basePct = basePctSiglaEnZona(key, sigla);
    const vsPct = vsZonaPct.get(key)?.get(sigla);
    if (basePct === null || vsPct === undefined) {
      m.setFeatureState({ source: 'zonas', id: name }, { deltaNA: true, delta: 0 }); // sin dato comparable → gris
      continue;
    }
    const d = Math.max(-DELTA_CLAMP, Math.min(DELTA_CLAMP, basePct - vsPct));
    m.setFeatureState({ source: 'zonas', id: name }, { delta: d, deltaNA: false });
  }
  // Relleno sólido (sin banderas) + escala divergente rojo(cae) ↔ blanco ↔ verde(sube).
  // En delta ocultamos el borde naranja del flip → el mapa habla solo de magnitud.
  setPatternVisible(false);
  if (m.getLayer('zonas-vs-changed')) m.setLayoutProperty('zonas-vs-changed', 'visibility', 'none');
  m.setPaintProperty('zonas-fill', 'fill-opacity', 0.85);
  m.setPaintProperty('zonas-fill', 'fill-color', [
    'case',
    ['boolean', ['feature-state', 'deltaNA'], false], '#d4d4d8',
    ['interpolate', ['linear'], ['to-number', ['feature-state', 'delta'], 0],
      -0.15, '#b91c1c', -0.05, '#fca5a5', 0, '#f4f4f5', 0.05, '#86efac', 0.15, '#15803d'],
  ]);
}

/** Cambia el sub-modo de comparación (ganador | delta) y re-renderiza el relleno. */
function setCmpModo(modo: 'ganador' | 'delta'): void { cmpModo.value = modo; renderComparacionFill(); }
/** Cambia el partido seguido por el delta y re-renderiza. */
function setCmpDeltaSigla(sigla: string): void { cmpDeltaSigla.value = sigla; renderComparacionFill(); }

/** Limpia el overlay de comparación: restaura feature-states y leyenda original (Story 4.3). */
function clearComparisonOverlay(): void {
  const m = map.value;
  const fc = fcRef.value;
  if (!m || !fc) return;
  for (const f of fc.features) {
    const name = String((f.properties as { name: string }).name);
    m.setFeatureState({ source: 'zonas', id: name }, { vsChanged: false, deltaNA: false, delta: 0 });
  }
  // Si el delta había cambiado el relleno/opacidad, restaurar la vista base.
  m.setPaintProperty('zonas-fill', 'fill-color', ['get', 'color']);
  m.setPaintProperty('zonas-fill', 'fill-opacity', BASE_FILL_OPACITY);
  setPatternVisible(true);
  if (m.getLayer('zonas-vs-changed')) m.setLayoutProperty('zonas-vs-changed', 'visibility', 'visible');
  vsWinnersMap = new Map();
  vsZonaPct = new Map();
  legend.value = origLegend;
  comparacionActiva.value = false;
  cmpModo.value = 'ganador';
  drawFlagOverlay(m); // redibuja banderas a full (sin atenuación de flip)
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
    (m.getSource('zonas') as GeoJSONSource).setData(fc); zonasDisplayFC = fc;
    intensidadActive = false;
  }
  markers.forEach((mk) => mk.remove());
  markers.length = 0;
  selMarkerState = null;
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
  catalogoNodeLabel = new Map();
  catalogoNivelesPorCont = new Map();
  catalogoPromise = null;
  nivelesDisponibles.value = ['lema'];
  // Re-cargar el catálogo (eager) para repoblar los niveles del selector gnivel tras navegar.
  void ensureCatalogo(eleccion, departamento).then(syncNivelesDisponibles);
  hojaVotos = new Map();
  circuitoZonaPorGeo = new Map();   // ficha por circuito/local: limpiar dato del overlay al cambiar depto/elección
  circuitHojaVotos = new Map();     // desglose por hoja del local: idem

  lemasCargados = new Set();
  hojaGeoPromise = null; // Story 7.8: re-cargar el consolidado hoja-{nivel} al cambiar nivel/depto
  seleccionFCActive = false;
  try {
    const { fc, bounds } = await loadData(eleccion, departamento, nivel);
    // Esperar a que la fuente esté lista (puede que el mapa aún esté cargando).
    if (m.getSource('zonas')) {
      (m.getSource('zonas') as GeoJSONSource).setData(fc); zonasDisplayFC = fc;
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
    // Epic 17: el overlay de puntos prefiere LOCAL (1 punto por local de votación, votos
    // agregados, estable entre elecciones). Fallback a circuito donde aún no hay votes-local.json.
    let [topoRes, votesRes] = await Promise.all([
      fetch(`${base}/data/geo/${departamento}/local.topo.json`),
      fetch(`${base}/data/${eleccion}/${departamento}/votes-local.json`),
    ]);
    if (!topoRes.ok || !votesRes.ok) {
      [topoRes, votesRes] = await Promise.all([
        fetch(`${base}/data/geo/${departamento}/circuito.topo.json`),
        fetch(`${base}/data/${eleccion}/${departamento}/votes-circuito.json`),
      ]);
    }
    if (!topoRes.ok || !votesRes.ok) return;
    const topo = (await topoRes.json()) as Topology;
    const votes = (await votesRes.json()) as VotosShard;
    const objName = Object.keys(topo.objects)[0];
    const geo = topoFeature(topo, topo.objects[objName] as GeometryCollection) as FeatureCollection;

    const zonaPorGeo = new Map(votes.zonas.map((z) => [norm(z.geoId), z]));
    circuitoZonaPorGeo = new Map(votes.zonas.map((z) => [norm(z.geoId), z as ZonaLocal]));
    // Desglose por HOJA del local (si existe el shard): detalle por lista en la ficha + coloreo exacto.
    circuitHojaVotos = new Map();
    if (votes.nivel === 'local') {
      try {
        const hlRes = await fetch(`${base}/data/${eleccion}/${departamento}/hoja-local.json`);
        if (hlRes.ok) {
          const hl = (await hlRes.json()) as VotosShard;
          for (const z of hl.zonas) {
            circuitHojaVotos.set(norm(z.geoId), new Map(z.porOpcion.map((o) => [o.opcionId, o.votos])));
          }
        }
      } catch { /* sin hoja-local → la ficha degrada a nivel partido */ }
    }
    for (const f of geo.features) {
      const name = String((f.properties as { name: string }).name);
      const zona = zonaPorGeo.get(norm(name));
      const p = f.properties as Record<string, unknown>;
      if (zona && zona.porOpcion.length > 0) {
        const nombre = opcNombreMap.get(zona.ganadorOpcionId) ?? zona.ganadorOpcionId;
        const meta = resolveParty(nombre, activeEleccion);
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
    // Si la URL ya traía ?zona=<localId> (deep-link), abrir su ficha ahora que el overlay cargó.
    const zsel = $selection.get().zona;
    if (zsel && circuitoZonaPorGeo.has(norm(zsel))) selectCircuitoLocal(zsel);
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
    // Epic 12: desglose de la selección en esta zona. Prioridad: acordeón HOJA
    // (seleccion[]) > opción simple. (Comparación dual A/B decomisada — Epic 13.)
    const selFicha = seleccionActiva.value.length > 0
      ? seleccionActiva.value
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
      habilitados: noP.habilitados || undefined,
      emitidos: noP.emitidos || undefined,
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

/** Ficha de un circuito/local del overlay (Epic "ficha por circuito"): total del local + metadata
 *  + desglose de los circuitos que votan ahí. El dato viene del overlay (circuitoZonaPorGeo). */
function selectCircuitoLocal(name: string): void {
  const z = circuitoZonaPorGeo.get(norm(name));
  if (!z) return;
  const ganNombre = opcNombreMap.get(z.ganadorOpcionId) ?? z.ganadorOpcionId;
  const ganMeta = resolveParty(ganNombre, activeEleccion);
  const votoGanador = z.porOpcion.find((o) => o.opcionId === z.ganadorOpcionId)?.votos ?? 0;
  const noP = z.noPartidarios ?? { enBlanco: 0, anulados: 0, observados: 0 };
  const circuitos = (z.circuitos ?? []).map((c) => {
    const nm = opcNombreMap.get(c.ganadorOpcionId) ?? c.ganadorOpcionId;
    const m = resolveParty(nm, activeEleccion);
    return { circuito: c.circuito, sigla: m.sigla, nombre: nm, color: m.color, flagUrl: m.flagUrl, validos: c.validos };
  });
  // Desglose de lo seleccionado en este circuito (paridad con selectByName). Si existe hoja-local
  // → detalle COMPLETO por lista/sublema (igual que zona); si no → agregado por partido.
  const opcionId = $selection.get().opcion;
  const selFicha = seleccionActiva.value.length > 0 ? seleccionActiva.value : opcionId ? [opcionId] : [];
  const hojaMap = circuitHojaVotos.get(norm(name));
  const desgRaw = selFicha.length > 0
    ? (hojaMap ? buildDesglose(norm(name), selFicha, (id) => hojaMap.get(id) ?? 0) : buildDesgloseCircuito(z, selFicha))
    : null;
  const desg = desgRaw && desgRaw.grupos.length > 0 ? desgRaw : null;
  const pctOpcionActiva = !desg && opcionId && z.validos > 0
    ? ((hojaMap?.get(opcionId) ?? z.porOpcion.find((o) => o.opcionId === opcionId)?.votos ?? 0) / z.validos) * 100
    : null;
  selected.value = {
    geoId: name,
    label: z.local?.nombre ?? name,
    sigla: ganMeta.sigla, nombre: ganNombre, color: ganMeta.color, flagUrl: ganMeta.flagUrl,
    votoGanador, validos: z.validos,
    pct: z.validos > 0 ? (votoGanador / z.validos) * 100 : 0,
    enBlanco: noP.enBlanco, anulados: noP.anulados, observados: noP.observados,
    habilitados: z.habilitados || undefined, emitidos: z.emitidos || undefined,
    pctOpcionActiva,
    seleccionTotal: desg?.total,
    seleccionPct: desg && z.validos > 0 ? (desg.total / z.validos) * 100 : undefined,
    desglose: desg?.grupos,
    local: z.local, circuitos,
  };
}

let prevSelId: string | null = null;
function applySelection(zona: string | null): void {
  const m = map.value;
  if (!m || !m.getSource('zonas')) return;
  if (prevSelId !== null) m.setFeatureState({ source: 'zonas', id: prevSelId }, { sel: false });
  if (zona) {
    // Circuito/local activo: la ficha sale del dato del overlay (localIds no colisionan con zonas base).
    if (circuitoZonaPorGeo.has(norm(zona))) {
      selectCircuitoLocal(zona);
    } else {
      m.setFeatureState({ source: 'zonas', id: zona }, { sel: true });
      if (fcRef.value) selectByName(zona, fcRef.value);
    }
  } else {
    selected.value = null;
  }
  prevSelId = zona;
  // El highlight de circuito/local se pinta en el canvas overlay (no usa feature-state), así que
  // forzamos un render para que aparezca/desaparezca al seleccionar o limpiar.
  m.triggerRepaint();
}
const unsubSelection = $selection.subscribe((s) => {
  opcionActiva.value = s.opcion;
  seleccionActiva.value = [...s.seleccion];
  if (s.modo === 'ganador' || s.modo === 'share' || s.modo === 'heatmap') coloreoMode.value = s.modo;
  gnivel.value = esNivel(s.gnivel) ? s.gnivel : 'lema';
  syncNivelesDisponibles();
  applySelection(s.zona);
  if (s.seleccion.length > 0) {
    void applySeleccion(); // Epic 10: coloreo por selección múltiple de hojas (usa gnivel)
  } else if (gnivel.value !== 'lema') {
    void aplicarGanadorAbsolutoPorNivel(); // sin selección, sub-nivel → ganador absoluto del nivel (base = ganador)
  } else {
    if (seleccionFCActive) restoreGanadorDesdeSeleccion(); // restaurar desde el FC de selección
    applyOpcionFilter(s.opcion);
  }
});

/** Resuelve el nivel base efectivo: excluye 'circuito' (ahora es overlay, no nivel base). */
function resolveNivel(urlLevel: NivelGeografico, dept?: string): NivelGeografico {
  const avail = (dept ? DEPT_LEVELS[dept] : null) ?? props.availableLevels ?? (['zona'] as NivelGeografico[]);
  const base = avail.filter(l => l !== 'circuito' && l !== 'local');
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
    // Re-evaluar los labels de total por barrio: se ocultan con circuitos ON, reaparecen con OFF.
    if (selMarkerState) rebuildSelMarkers(selMarkerState.fc, selMarkerState.modo);
  });

  try {
    mlLib = await import('maplibre-gl');
    // Resolver nivel desde URL ($level) respetando disponibilidad del depto.
    // Si la URL no trae ?level explícito y hay defaultNivel (vista nacional → 'departamento'),
    // usar ese default en vez del genérico 'zona' (Epic 15.4).
    const urlTieneLevel = new URLSearchParams(window.location.search).has('level');
    const urlLevel = (!urlTieneLevel && props.defaultNivel) ? props.defaultNivel : $level.get();
    const geoNivel = resolveNivel(urlLevel);
    activeNivel = geoNivel;
    // Si el nivel efectivo difiere del estado actual, fijarlo en URL+store (AC4: Rivera;
    // y vista nacional: el default 'departamento' se materializa aunque el atom arranque en 'zona').
    if (geoNivel !== $level.get()) commit({ level: geoNivel });
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
    if (import.meta.env.DEV) (window as unknown as { __mlMap?: MlMap }).__mlMap = m; // debug/QA only
    // Controles de zoom visibles (el zoom revela el detalle por circuito/local).
    m.addControl(new mlLib.NavigationControl({ showCompass: false, showZoom: true, visualizePitch: false }), 'top-right');

    m.on('load', () => { void (async () => {
      await loadFlagImages();
      setupFlagCanvas(m);
      m.addSource('zonas', { type: 'geojson', data: fc, promoteId: 'name' }); zonasDisplayFC = fc;
      m.addLayer({ id: 'zonas-fill', type: 'fill', source: 'zonas', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': ['case', ['!=', ['get', 'flagPattern'], null], 0, 0.85] } });
      m.addLayer({ id: 'zonas-line', type: 'line', source: 'zonas', paint: { 'line-color': 'rgba(20,20,35,0.85)', 'line-width': 1.8 } });
      m.on('render', () => drawFlagOverlay(m));
      m.on('movestart', () => { isMapMoving = true; });
      m.on('moveend',   () => { isMapMoving = false; drawFlagOverlay(m);
        // Re-declusterizar los labels de valor para el nuevo zoom/encuadre (modo selección).
        if (selMarkerState) rebuildSelMarkers(selMarkerState.fc, selMarkerState.modo);
      });
      m.on('zoomstart', () => { isMapMoving = true; });
      m.on('zoomend',   () => { isMapMoving = false; drawFlagOverlay(m); });
      // Overlay de comparación (Story 4.3): borde naranja en zonas que cambiaron ganador.
      m.addLayer({
        id: 'zonas-vs-changed',
        type: 'line',
        source: 'zonas',
        paint: {
          'line-color': '#f97316',
          // Grueso + punteado para que se distinga de los bordes negros de base y resalte sobre
          // los rellenos de bandera. Ancho responsivo al zoom (zoom debe ser input top-level del
          // interpolate; el case por feature-state va en los STOPS, no envolviendo al zoom).
          'line-width': ['interpolate', ['linear'], ['zoom'],
            4, ['case', ['boolean', ['feature-state', 'vsChanged'], false], 4, 0],
            9, ['case', ['boolean', ['feature-state', 'vsChanged'], false], 7, 0]],
          'line-dasharray': [2, 1.1],
          'line-opacity': ['case', ['boolean', ['feature-state', 'vsChanged'], false], 1, 0],
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
        if (initSel.modo === 'ganador' || initSel.modo === 'share' || initSel.modo === 'heatmap') coloreoMode.value = initSel.modo;
        gnivel.value = esNivel(initSel.gnivel) ? initSel.gnivel : 'lema';
        // Carga eager del catálogo para conocer los niveles agrupables → el selector gnivel
        // aparece ya en la vista base (sin esperar a una selección).
        void ensureCatalogo(activeEleccion, activeDepartamento).then(syncNivelesDisponibles);
        if (initSel.seleccion.length > 0) void applySeleccion();
        else if (gnivel.value !== 'lema') void aplicarGanadorAbsolutoPorNivel();
      }
      status.value = 'listo';
      readResultadoCtx(); // contexto inicial (elección · depto) del masthead
      // Aplicar modo comparación si la URL ya traía ?vs= o ?a=&b= (Stories 4.3/4.4).
      const initCmp = $comparison.get();
      if (initCmp.a && initCmp.b) {
        applyDualOpcionView(initCmp.a, initCmp.b);
      } else if (initCmp.vs && initCmp.vs !== props.eleccion) {
        void applyComparisonOverlay(initCmp.vs, props.eleccion, props.departamento, activeNivel);
      }
      // Activar overlay de circuitos si la URL ya traía ?circ=1.
      if ($circuito.get()) void loadCircuitoOverlay(props.eleccion, props.departamento);
      // Fix (Epic 15): en algunas rutas (p. ej. la vista nacional, con menos contenido sobre el
      // mapa) el contenedor puede tener ancho 0 al construir el mapa → el fitBounds inicial queda
      // mal (la geometría aparece como un sliver). Tras el layout, re-medir y re-ajustar a bounds.
      // Idempotente en las páginas que ya encajaban (resize no-op + mismo bounds).
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (!map.value) return;
        m.resize();
        m.fitBounds(bounds, { padding: 24, animate: false });
      }));
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
      readResultadoCtx(); // el masthead nuevo ya está en el DOM tras el swap
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

    <!-- Leyenda: explica los colores del mapa → va PEGADA al mapa, arriba del toggle de
         coloreo y del RESULTADO. Solo aporta en modos selección/filtro/intensidad (escala)
         o si hay nota de votos sin ubicación; en el modo ganador base duplica a RESULTADO. -->
    <MapLegend
      v-if="opcionActiva || seleccionActiva.length > 0 || votosSinUbicacion > 0 || gnivel !== 'lema' || comparacionActiva"
      :entradas="legend" :sin-datos="sinDatos" :votos-sin-ubicacion="votosSinUbicacion" :zonas-sin-ubicacion="zonasSinUbicacion"
      :comparacion-nota="comparacionActiva && cmpModo === 'ganador' ? 'Zonas a todo color: cambió el partido ganador entre las dos elecciones. Las atenuadas mantuvieron el mismo ganador.' : null" />

    <!-- Comparación entre elecciones (Fase 2): cómo ver el contraste. Va DEBAJO del mapa (junto a la
         leyenda) para no re-saturar arriba. 'Cambió ganador' = flip (borde naranja); 'Δ %' = magnitud
         del cambio de un partido (escala divergente). El selector de partido vive acá, no arriba. -->
    <div v-if="comparacionActiva" class="cmp-view">
      <div class="cmp-view__modos" role="group" aria-label="Modo de comparación">
        <button type="button" class="cmp-view__btn" :class="{ 'cmp-view__btn--activo': cmpModo === 'ganador' }"
          :aria-pressed="cmpModo === 'ganador'" @click="setCmpModo('ganador')">Cambió ganador</button>
        <button type="button" class="cmp-view__btn" :class="{ 'cmp-view__btn--activo': cmpModo === 'delta' }"
          :aria-pressed="cmpModo === 'delta'" @click="setCmpModo('delta')">Δ % de un partido</button>
      </div>
      <div v-if="cmpModo === 'delta'" class="cmp-view__delta">
        <label class="cmp-view__lbl">Partido:
          <select class="cmp-view__sel" :value="cmpDeltaSigla"
            @change="setCmpDeltaSigla(($event.target as HTMLSelectElement).value)" aria-label="Partido para el delta">
            <option v-for="s in siglasComparables" :key="s.sigla" :value="s.sigla">{{ s.sigla }} — {{ s.nombre }}</option>
          </select>
        </label>
        <div class="cmp-view__grad" aria-hidden="true">
          <span>−15pp</span><span class="cmp-view__gradbar"></span><span>+15pp</span>
        </div>
        <p class="cmp-view__cap">Δ <strong>{{ cmpDeltaSigla }}</strong> = esta elección − la otra · <span class="cmp-view__rojo">rojo cayó</span> / <span class="cmp-view__verde">verde subió</span> · gris = sin dato comparable. Escala recortada a ±15 puntos.</p>
      </div>
    </div>

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

    <!-- Cluster de controles de coloreo (Epic 19.1): el conmutador de modo y el selector de nivel
         se leen como UN solo bloque (un borde superior), con el nivel como sub-fila tenue del modo
         Ganador — no como dos bandas pares. v-if propio para no dejar una banda vacía (balotaje/plano). -->
    <div v-if="seleccionActiva.length > 0 || nivelesDisponibles.length > 1" class="coloreo-cluster">
      <!-- Conmutador de modo para selección múltiple de hojas (Epic 10, Story 10.4) -->
      <div v-if="seleccionActiva.length > 0" class="vista-toggle" role="group" aria-label="Modo de coloreo del mapa">
        <button
          v-for="mo in (['ganador', 'heatmap', 'share'] as const)"
          :key="mo"
          class="vista-toggle__btn"
          :class="{ 'vista-toggle__btn--activo': coloreoMode === mo }"
          :aria-pressed="coloreoMode === mo"
          type="button"
          @click="setColoreo(mo)"
        >{{ mo === 'ganador' ? 'Ganador' : mo === 'share' ? 'Share %' : 'Heatmap' }}</button>
      </div>

      <!-- Selector de nivel del ganador (coloreo-por-nivel): solo en modo Ganador y si la contienda
           tiene >1 nivel agrupable. No depende de la selección (sin selección = ganador absoluto). -->
      <div
        v-if="(seleccionActiva.length === 0 || coloreoMode === 'ganador') && nivelesDisponibles.length > 1"
        class="gnivel" role="group" aria-label="Nivel del ganador"
      >
        <span class="gnivel__lbl">Ganador por:</span>
        <button
          v-for="nv in nivelesDisponibles" :key="nv"
          type="button"
          class="gnivel__btn"
          :class="{ 'gnivel__btn--activo': gnivel === nv }"
          :aria-pressed="gnivel === nv"
          @click="setGnivel(nv)"
        >{{ NIVEL_LABEL[nv] }}</button>
      </div>
    </div>

    <ResultadoGlobal
      :entradas="resultadoGlobal"
      :validos="resultadoValidos"
      :titulo="departamento === '_nacional' ? 'Resultado nacional' : 'Resultado'"
      :contexto="resultadoCtx"
    />

    <!-- Ficha de zona (detalle on-demand): va AL FINAL para no separar el mapa de sus
         controles (leyenda + toggle de coloreo + RESULTADO). El highlight en el mapa ya da
         feedback inmediato al clickear; la ficha se lee al hacer scroll. -->
    <ZoneSheet
      :sel="selected"
      :opcion-sigla="opcionActiva ? (opcNombreMap.get(opcionActiva) ? resolveParty(opcNombreMap.get(opcionActiva)!).sigla : opcionActiva) : null"
      @close="commit({ zona: null })"
    />
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
/* Cluster de coloreo (Epic 19.1): UN solo borde superior para todo el bloque de controles.
   Dentro del cluster el toggle pierde su borde propio (lo aporta el cluster) y el selector de
   nivel se pega como sub-fila, evitando dos bandas pares apiladas. */
.coloreo-cluster { border-top: 1px solid var(--color-border); }
.coloreo-cluster .vista-toggle { border-top: none; padding-bottom: 0.375rem; }
/* Selector de nivel del ganador (coloreo-por-nivel). Por defecto (vista base, va solo) = fila normal. */
.gnivel { display: flex; flex-wrap: wrap; align-items: center; gap: 0.375rem; padding: 0.375rem 0.75rem 0.5rem; font-size: 0.75rem; }
/* Cuando sigue al toggle (selección + modo Ganador) se muestra como sub-fila tenue e indentada de él. */
.coloreo-cluster .vista-toggle + .gnivel { padding: 0.125rem 0.75rem 0.5rem 0.875rem; margin: 0 0.75rem; border-left: 2px solid var(--color-border); }
.gnivel__lbl { color: var(--color-ink-muted); font-weight: 600; }
.gnivel__btn { padding: 0.2rem 0.55rem; border: 1px solid var(--color-border-strong); border-radius: 9999px; background: var(--color-surface-1); color: var(--color-ink-soft); cursor: pointer; min-height: 30px; }
.gnivel__btn--activo { background: var(--color-ink); color: var(--color-paper); border-color: var(--color-ink); }
.gnivel__btn:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
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

/* Comparación Fase 2: controles de "cómo ver el contraste", debajo del mapa (no re-satura arriba). */
.cmp-view {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-top: 1px solid var(--color-border);
}
.cmp-view__modos { display: flex; gap: 0; }
.cmp-view__btn {
  flex: 1;
  padding: 0.35rem 0.5rem;
  font-size: 0.75rem;
  background: var(--color-surface-1);
  border: 1px solid var(--color-border-strong);
  color: var(--color-ink-soft);
  cursor: pointer;
  min-height: 36px;
}
.cmp-view__btn:first-child { border-radius: 0.25rem 0 0 0.25rem; }
.cmp-view__btn:last-child { border-radius: 0 0.25rem 0.25rem 0; border-left: none; }
.cmp-view__btn--activo { background: #1d4ed8; color: #fff; font-weight: 700; border-color: #1d4ed8; }
.cmp-view__delta { display: flex; flex-direction: column; gap: 0.375rem; }
.cmp-view__lbl { font-size: 0.75rem; color: var(--color-ink-soft); display: flex; align-items: center; gap: 0.375rem; }
.cmp-view__sel {
  font-size: 0.75rem; padding: 0.2rem 0.4rem;
  border: 1px solid var(--color-border-strong); border-radius: 0.25rem;
  background: var(--color-paper); color: var(--color-ink); cursor: pointer;
}
.cmp-view__grad { display: flex; align-items: center; gap: 0.5rem; font-size: 0.6875rem; color: var(--color-ink-muted); }
.cmp-view__gradbar {
  flex: 1; height: 0.625rem; border-radius: 0.3125rem;
  background: linear-gradient(90deg, #b91c1c, #fca5a5, #f4f4f5, #86efac, #15803d);
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.1);
}
.cmp-view__cap { margin: 0; font-size: 0.6875rem; line-height: 1.4; color: var(--color-ink-faint); }
.cmp-view__rojo { color: #b91c1c; font-weight: 600; }
.cmp-view__verde { color: #15803d; font-weight: 600; }

</style>
