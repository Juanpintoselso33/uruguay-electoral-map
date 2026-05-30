<script setup lang="ts">
/**
 * Isla mapa choropleth (Story 1.8). `client:load`. Pinta los barrios por partido
 * ganador, con la SIGLA como texto (markers HTML en centroides — el text-field de
 * MapLibre exige glyphs/fuentes que no tenemos). Leyenda nombra color+sigla+partido.
 * Tap resalta y muestra el ganador. Estado de selección → URL vía nanostores.
 *
 * SSR-safe: maplibre-gl se importa dinámicamente en onMounted (referencia window al evaluar).
 */
import { onMounted, onUnmounted, ref, shallowRef } from 'vue';
import type { Map as MlMap, Marker as MlMarker, LngLatBoundsLike } from 'maplibre-gl';
import type { Feature, FeatureCollection, Polygon, MultiPolygon, Position } from 'geojson';
import type { Topology, GeometryCollection } from 'topojson-specification';
import { feature as topoFeature } from 'topojson-client';
import { resolveParty } from '../../lib/party-meta';
import type { VotosShard } from '../../lib/contracts';
import { $selection, bindToLocation, commit } from '../../stores/map-state';
import MapLegend from './MapLegend.vue';

const props = defineProps<{ eleccion: string; departamento: string; nivel?: string }>();

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

function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Centroide aproximado del anillo exterior más grande (para ubicar la sigla). */
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

async function loadData(): Promise<{ fc: FeatureCollection; bounds: LngLatBoundsLike }> {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const geoNivel = props.nivel ?? 'zona';
  const [topoRes, votesRes, opcRes] = await Promise.all([
    fetch(`${base}/data/geo/${props.departamento}/${geoNivel}.topo.json`),
    fetch(`${base}/data/${props.eleccion}/${props.departamento}/votes.json`),
    fetch(`${base}/data/${props.eleccion}/${props.departamento}/opciones.json`),
  ]);
  if (!topoRes.ok || !votesRes.ok || !opcRes.ok) throw new Error('No se pudieron cargar los datos del mapa');
  const topo = (await topoRes.json()) as Topology;
  const votes = (await votesRes.json()) as VotosShard;
  const opcDoc = (await opcRes.json()) as OpcionesDoc;

  const objName = Object.keys(topo.objects)[0];
  const geo = topoFeature(topo, topo.objects[objName] as GeometryCollection) as FeatureCollection;

  const nombrePorOpcion = new Map(opcDoc.opciones.map((o) => [o.opcionId, o.nombre]));
  const zonaPorGeo = new Map(votes.zonas.map((z) => [norm(z.geoId), z]));
  const barriosGanados = new Map<string, number>(); // ganadorOpcionId → nº de barrios ganados

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
      barriosGanados.set(zona.ganadorOpcionId, (barriosGanados.get(zona.ganadorOpcionId) ?? 0) + 1);
    } else {
      p.color = COLOR_SIN_DATOS;
      p.sigla = '';
      p.hasData = false;
      sin++;
    }
  }
  sinDatos.value = sin;

  // Leyenda: SOLO los partidos ganadores (los colores que realmente aparecen en el
  // mapa), ordenados por barrios ganados desc. No listar las ~18 opciones que nunca
  // ganan ningún barrio (el mapa colorea por ganador, no por todas las opciones).
  legend.value = [...barriosGanados.entries()]
    .map(([opcionId, barrios]) => {
      const nombre = nombrePorOpcion.get(opcionId) ?? opcionId;
      const meta = resolveParty(nombre);
      return { sigla: meta.sigla, nombre, color: meta.color, votos: barrios };
    })
    .sort((a, b) => b.votos - a.votos);

  return { fc: geo, bounds: boundsOf(geo) };
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

onMounted(async () => {
  bindToLocation();
  try {
    const maplibre = await import('maplibre-gl');
    const { fc, bounds } = await loadData();
    if (!mapEl.value) return;

    const m: MlMap = new maplibre.Map({
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
        // Realce por feature-state (solo repinta, sin re-teselar) → INP bajo.
        paint: {
          'line-color': '#111827',
          'line-width': ['case', ['boolean', ['feature-state', 'sel'], false], 2.5, 0],
        },
      });

      // Siglas como markers HTML en centroides (texto real, sin glyphs).
      for (const f of fc.features) {
        const p = f.properties as Record<string, unknown>;
        if (!p.hasData) continue;
        const [lng, lat] = centroid(f.geometry as Polygon | MultiPolygon);
        const el = document.createElement('span');
        el.className = 'zona-sigla';
        el.textContent = String(p.sigla);
        el.setAttribute('aria-hidden', 'true');
        markers.push(new maplibre.Marker({ element: el }).setLngLat([lng, lat]).addTo(m));
      }

      fcRef.value = fc;
      // El tap SOLO escribe la URL; la suscripción a $selection aplica realce + readout
      // (un único setFilter por interacción → INP bajo). No duplicar el repaint acá.
      m.on('click', 'zonas-fill', (e) => {
        const f = e.features?.[0];
        if (!f) return;
        commit({ zona: String((f.properties as { name: string }).name) });
      });
      m.on('mouseenter', 'zonas-fill', () => { m.getCanvas().style.cursor = 'pointer'; });
      m.on('mouseleave', 'zonas-fill', () => { m.getCanvas().style.cursor = ''; });

      // Reconstruir selección desde la URL (deep-link / recarga).
      applySelection($selection.get().zona);
      status.value = 'listo';
    });
  } catch (err) {
    status.value = 'error';
    errorMsg.value = err instanceof Error ? err.message : String(err);
  }
});

onUnmounted(() => {
  markers.forEach((mk) => mk.remove());
  map.value?.remove();
});

// Única vía de aplicar selección al mapa (realce + readout). La disparan tanto el tap
// (vía commit→$selection) como popstate/deep-link. Realce vía feature-state (repaint barato).
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
$selection.subscribe((s) => applySelection(s.zona));
</script>

<template>
  <section class="map-wrap" aria-label="Mapa electoral por barrio">
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
