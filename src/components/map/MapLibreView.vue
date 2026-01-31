<template>
  <div class="maplibre-container">
    <div ref="mapContainer" class="map"></div>

    <!-- Map Controls -->
    <div class="map-controls">
      <button @click="zoomIn" class="map-control-btn" title="Zoom in">
        <Plus :size="18" />
      </button>
      <button @click="zoomOut" class="map-control-btn" title="Zoom out">
        <Minus :size="18" />
      </button>
      <button @click="resetView" class="map-control-btn" title="Reset view">
        <Maximize2 :size="18" />
      </button>
    </div>

    <!-- Legend -->
    <div class="map-legend">
      <div class="legend-title">Intensidad de votos</div>
      <div class="legend-gradient">
        <div class="gradient-bar"></div>
        <div class="gradient-labels">
          <span>Bajo</span>
          <span>Alto</span>
        </div>
      </div>
      <div v-if="selectedLists.length > 0" class="legend-info">
        <div class="legend-list-item" v-for="list in selectedLists.slice(0, 3)" :key="list">
          Lista {{ list }}
        </div>
      </div>
    </div>

    <!-- Tooltip -->
    <Transition name="tooltip">
      <div
        v-if="hoveredFeature"
        ref="tooltipRef"
        class="map-tooltip"
        :style="tooltipStyle"
      >
        <div class="tooltip-header">
          <strong>{{ hoveredFeature.properties.BARRIO || hoveredFeature.properties.zona }}</strong>
        </div>
        <div class="tooltip-body">
          <div class="tooltip-stat">
            <span>Votos:</span>
            <strong>{{ hoveredVotes.toLocaleString() }}</strong>
          </div>
          <div v-if="selectedParty" class="tooltip-stat">
            <span>Partido:</span>
            <strong>{{ selectedParty }}</strong>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Plus, Minus, Maximize2 } from 'lucide-vue-next'
import chroma from 'chroma-js'

const props = defineProps<{
  regionName: string
  selectedLists: string[]
  votosPorListas: Record<string, Record<string, number>>
  maxVotosPorListas: Record<string, number>
  partiesByList: Record<string, string>
  precandidatosByList: Record<string, string>
  geojsonData: any
  selectedNeighborhood: string | null
  isODN: boolean
  partiesAbbrev: Record<string, string>
  selectedCandidates: string[]
  mapCenter: [number, number]
  mapZoom: number
  getVotosForNeighborhood: (neighborhood: string) => number
}>()

const emit = defineEmits(['updateSelectedNeighborhood', 'mapInitialized'])

const mapContainer = ref<HTMLDivElement>()
const map = ref<maplibregl.Map>()
const tooltipRef = ref<HTMLDivElement>()
const hoveredFeature = ref<any>(null)
const hoveredVotes = ref(0)
const tooltipStyle = ref({})

const selectedParty = computed(() => {
  if (props.selectedLists.length > 0) {
    return props.partiesByList[props.selectedLists[0]]
  }
  return null
})

const getColor = (votes: number): string => {
  const maxVotes = Math.max(...Object.values(props.votosPorListas).flatMap(v => Object.values(v)))
  if (votes === 0 || maxVotes === 0) return '#f0f0f0'

  const ratio = votes / maxVotes
  const colorScale = chroma.scale(['#ffffb2', '#fecc5c', '#fd8d3c', '#f03b20', '#bd0026'])
    .mode('lab')
    .domain([0, 1])

  return colorScale(ratio).hex()
}

const initMap = () => {
  if (!mapContainer.value || !props.geojsonData) return

  map.value = new maplibregl.Map({
    container: mapContainer.value,
    style: {
      version: 8,
      sources: {
        'carto-light': {
          type: 'raster',
          tiles: [
            'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
            'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
            'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'
          ],
          tileSize: 256,
          attribution: '© OpenStreetMap contributors © CARTO'
        }
      },
      layers: [
        {
          id: 'carto-light-layer',
          type: 'raster',
          source: 'carto-light',
          minzoom: 0,
          maxzoom: 22
        }
      ]
    },
    center: [props.mapCenter[1], props.mapCenter[0]],
    zoom: props.mapZoom,
    attributionControl: false
  })

  map.value.on('load', () => {
    updateMapData()
    emit('mapInitialized')
  })

  // Hover interaction
  map.value.on('mousemove', 'electoral-fill', (e) => {
    if (e.features && e.features.length > 0) {
      const feature = e.features[0]
      hoveredFeature.value = feature

      const zoneName = feature.properties.BARRIO || feature.properties.zona
      hoveredVotes.value = props.getVotosForNeighborhood(zoneName)

      // Position tooltip
      const point = map.value!.project(e.lngLat)
      tooltipStyle.value = {
        left: `${point.x + 10}px`,
        top: `${point.y - 10}px`
      }

      map.value!.getCanvas().style.cursor = 'pointer'
    }
  })

  map.value.on('mouseleave', 'electoral-fill', () => {
    hoveredFeature.value = null
    map.value!.getCanvas().style.cursor = ''
  })

  map.value.on('click', 'electoral-fill', (e) => {
    if (e.features && e.features.length > 0) {
      const feature = e.features[0]
      const zoneName = feature.properties.BARRIO || feature.properties.zona
      emit('updateSelectedNeighborhood', zoneName)
    }
  })
}

const updateMapData = () => {
  if (!map.value || !props.geojsonData) return

  const sourceId = 'electoral-data'
  const layerId = 'electoral-fill'
  const outlineLayerId = 'electoral-outline'

  // Remove existing layers and source
  if (map.value.getLayer(outlineLayerId)) {
    map.value.removeLayer(outlineLayerId)
  }
  if (map.value.getLayer(layerId)) {
    map.value.removeLayer(layerId)
  }
  if (map.value.getSource(sourceId)) {
    map.value.removeSource(sourceId)
  }

  // Add updated source with colors
  const geoJsonWithColors = {
    ...props.geojsonData,
    features: props.geojsonData.features.map((feature: any) => {
      const zoneName = feature.properties.BARRIO || feature.properties.zona
      const votes = props.getVotosForNeighborhood(zoneName)
      const color = getColor(votes)

      return {
        ...feature,
        properties: {
          ...feature.properties,
          color,
          votes
        }
      }
    })
  }

  map.value.addSource(sourceId, {
    type: 'geojson',
    data: geoJsonWithColors
  })

  // Add fill layer
  map.value.addLayer({
    id: layerId,
    type: 'fill',
    source: sourceId,
    paint: {
      'fill-color': ['get', 'color'],
      'fill-opacity': 0.7
    }
  })

  // Add outline layer
  map.value.addLayer({
    id: outlineLayerId,
    type: 'line',
    source: sourceId,
    paint: {
      'line-color': '#666',
      'line-width': 1,
      'line-opacity': 0.5
    }
  })
}

const zoomIn = () => {
  map.value?.zoomIn()
}

const zoomOut = () => {
  map.value?.zoomOut()
}

const resetView = () => {
  map.value?.flyTo({
    center: [props.mapCenter[1], props.mapCenter[0]],
    zoom: props.mapZoom,
    duration: 1000
  })
}

watch(() => [props.geojsonData, props.selectedLists, props.selectedCandidates], () => {
  if (map.value?.loaded()) {
    updateMapData()
  }
}, { deep: true })

watch(() => [props.mapCenter, props.mapZoom], () => {
  if (map.value) {
    map.value.flyTo({
      center: [props.mapCenter[1], props.mapCenter[0]],
      zoom: props.mapZoom,
      duration: 800
    })
  }
})

onMounted(() => {
  initMap()
})

onUnmounted(() => {
  map.value?.remove()
})
</script>

<style scoped>
.maplibre-container {
  width: 100%;
  height: 100%;
  position: relative;
}

.map {
  width: 100%;
  height: 100%;
}

/* Map Controls */
.map-controls {
  position: absolute;
  top: 1rem;
  right: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  z-index: 10;
}

.map-control-btn {
  width: 36px;
  height: 36px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.map-control-btn:hover {
  background: var(--color-bg);
  transform: scale(1.05);
}

/* Legend */
.map-legend {
  position: absolute;
  bottom: 2rem;
  left: 2rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 1rem;
  min-width: 200px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 10;
}

.legend-title {
  font-weight: 600;
  font-size: 0.875rem;
  margin-bottom: 0.75rem;
}

.gradient-bar {
  height: 12px;
  border-radius: 6px;
  background: linear-gradient(to right, #ffffb2, #fecc5c, #fd8d3c, #f03b20, #bd0026);
  margin-bottom: 0.5rem;
}

.gradient-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}

.legend-info {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--color-border);
}

.legend-list-item {
  font-size: 0.8rem;
  padding: 0.25rem 0;
}

/* Tooltip */
.map-tooltip {
  position: absolute;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 0.75rem;
  min-width: 150px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  pointer-events: none;
  z-index: 20;
}

.tooltip-header {
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--color-border);
}

.tooltip-stat {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  padding: 0.25rem 0;
}

.tooltip-stat span {
  color: var(--color-text-secondary);
}

/* Transitions */
.tooltip-enter-active,
.tooltip-leave-active {
  transition: all 0.15s ease;
}

.tooltip-enter-from,
.tooltip-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

@media (max-width: 768px) {
  .map-controls {
    top: 0.5rem;
    right: 0.5rem;
  }

  .map-legend {
    bottom: 1rem;
    left: 1rem;
    right: 1rem;
    min-width: auto;
  }
}
</style>
