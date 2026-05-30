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
import { $selection, bindToLocation, commit, hydrateStores } from '../../stores/map-state';
import { parseUrl } from '../../lib/url-state';
import MapLegend from './MapLegend.vue';

const props = defineProps<{ eleccion: string; departamento: string; nivel?: string }>();

// Catálogo de nivel nativo por dept (espeja [departamento].astro). Actualizar al añadir deptos.
const DEPT_NIVEL: Record<string, string> = { montevideo: 'zona', rivera: 'serie' };

interface OpcionesDoc {
  opciones: { opcionId: string; nombre: string }[];
}
interface SelInfo {
  geoId: string;
  sigla: string;
  nombre: string;
  validos: number;
  pct: number;
}
interface LegendEntry {
  sigla: string;
  nombre: string;
  color: string;
  votos: number;
}

const COLOR_SIN_DATOS = '#e5e7eb';
const mapEl = ref<HTMLDivElement | null>(null);
const status = ref<'cargando' | 'listo' | 'error'>('cargando');
const errorMsg = ref('');
const legend = ref<LegendEntry[]>([]);
const sinDatos = ref(0);
const selected = ref<SelInfo | null>(null);
const map = shallowRef<MlMap | null>(null);
const fcRef = shallowRef<FeatureCollection | null>(null);
const markers: MlMarker[] = [];

// MapLibre module guardado para crear Markers en reloadData sin re-importar.
let mlLib: typeof import('maplibre-gl') | null = null;
// Contexto en curso (para detectar cambio en astro:after-swap).
let activeEleccion = props.eleccion;
let activeDepartamento = props.departamento;
// Catálogo opcionId→nombre y snapshot de leyenda en modo ganador (Story 2.2).
let opcNombreMap = new Map<string, string>();
let origLegend: LegendEntry[] = [];

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

/** Aplica o limpia el filtro de opción en el mapa (Story 2.2).
 *  No modifica fcRef — usa setPaintProperty para mayor velocidad. */
function applyOpcionFilter(opcionId: string | null): void {
  const m = map.value;
  const fc = fcRef.value;
  if (!m || !fc || !m.getSource('zonas')) return;
  if (opcionId) {
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
  } else {
    m.setPaintProperty('zonas-fill', 'fill-color', ['get', 'color']);
    rebuildMarkers(fc);
    legend.value = origLegend;
  }
}

/**
 * Recarga datos en el mapa ya inicializado (sin re-init de MapLibre — NFR1).
 * Llamado desde el handler astro:after-swap cuando cambia el departamento/elección.
 */
async function reloadData(eleccion: string, departamento: string, nivel: string): Promise<void> {
  const m = map.value;
  if (!m) return;
  status.value = 'cargando';
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
  } catch (err) {
    status.value = 'error';
    errorMsg.value = err instanceof Error ? err.message : String(err);
  }
}

function selectByName(name: string, fc: FeatureCollection): void {
  const f = fc.features.find((ft) => norm(String((ft.properties as { name: string }).name)) === norm(name));
  const p = f?.properties as Record<string, unknown> | undefined;
  if (p && p.hasData) {
    selected.value = {
      geoId: String(p.name),
      sigla: String(p.sigla),
      nombre: String(p.nombre),
      validos: Number(p.validos),
      pct: 0,
    };
  } else if (p) {
    selected.value = { geoId: String(p.name), sigla: '', nombre: 'Sin datos', validos: 0, pct: 0 };
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
  applySelection(s.zona);
  applyOpcionFilter(s.opcion);
});

let afterSwapHandler: (() => void) | null = null;

onMounted(async () => {
  bindToLocation();
  try {
    mlLib = await import('maplibre-gl');
    const geoNivel = DEPT_NIVEL[props.departamento] ?? props.nivel ?? 'zona';
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
      const newNivel = DEPT_NIVEL[view.departamento] ?? 'zona';
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
});
</script>

<template>
  <section class="map-wrap" aria-label="Mapa electoral por zona">
    <div ref="mapEl" class="map" role="img" :aria-label="`Mapa de ${departamento}, ${eleccion}, coloreado por partido ganador`"></div>

    <p v-if="status === 'cargando'" class="map-status">Cargando mapa…</p>
    <p v-else-if="status === 'error'" class="map-status map-status--error">Error: {{ errorMsg }}</p>

    <div v-if="selected" class="readout" aria-live="polite">
      <strong>{{ selected.geoId }}</strong>
      <template v-if="selected.sigla">
        — ganó <span class="readout__sigla">{{ selected.sigla }}</span> ({{ selected.nombre }}) ·
        {{ selected.validos.toLocaleString('es-UY') }} votos válidos
      </template>
      <template v-else> — sin datos</template>
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
.readout {
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  border-top: 1px solid #e5e7eb;
}
.readout__sigla {
  font-weight: 700;
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
