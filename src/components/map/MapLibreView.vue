<template>
  <div class="maplibre-container">
    <!-- Loading skeleton -->
    <MapSkeleton v-if="isMapLoading" />

    <!-- Map container -->
    <div v-show="!isMapLoading" ref="mapContainer" class="map"></div>

    <!-- Map Controls -->
    <div class="map-controls" role="group" aria-label="Controles del mapa">
      <button
        @click="zoomIn"
        @keydown.enter="zoomIn"
        @keydown.space.prevent="zoomIn"
        class="map-control-btn"
        title="Zoom in (tecla +)"
        aria-label="Acercar mapa"
      >
        <Plus :size="18" />
      </button>
      <button
        @click="zoomOut"
        @keydown.enter="zoomOut"
        @keydown.space.prevent="zoomOut"
        class="map-control-btn"
        title="Zoom out (tecla -)"
        aria-label="Alejar mapa"
      >
        <Minus :size="18" />
      </button>
      <button
        @click="resetView"
        @keydown.enter="resetView"
        @keydown.space.prevent="resetView"
        class="map-control-btn"
        title="Reset view (tecla R)"
        aria-label="Restablecer vista"
      >
        <Maximize2 :size="18" />
      </button>
    </div>

    <!-- Legend -->
    <div class="map-legend">
      <div class="legend-title">Intensidad de votos</div>
      <div class="legend-scale">
        <div
          v-for="(item, index) in legendItems"
          :key="index"
          class="legend-scale-item"
        >
          <div class="legend-color-box" :style="{ backgroundColor: item.color }"></div>
          <div class="legend-label">{{ item.label }}</div>
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
        v-if="hoveredFeature || isTooltipPinned"
        ref="tooltipRef"
        :class="['map-tooltip', { 'tooltip-pinned': isTooltipPinned }]"
        :style="tooltipStyle"
        @click.stop
        @touchend.stop
      >
        <!-- Close button (only when pinned) -->
        <button
          v-if="isTooltipPinned"
          @click="unpinTooltip"
          class="tooltip-close-btn"
          aria-label="Cerrar tooltip"
        >
          <X :size="14" />
        </button>

        <div class="tooltip-header">
          <strong>{{ hoveredFeature?.properties?.BARRIO || hoveredFeature?.properties?.zona || pinnedZoneName }}</strong>
        </div>

        <div class="tooltip-body" :class="{ 'tooltip-scrollable': shouldShowDetailedBreakdown }">
          <!-- Simple view (no selection or pinned with no data) -->
          <div v-if="!shouldShowDetailedBreakdown" class="tooltip-simple">
            <div class="tooltip-stat">
              <span>Votos:</span>
              <strong>{{ hoveredVotes.toLocaleString() }}</strong>
            </div>
            <div v-if="selectedParty" class="tooltip-stat">
              <span>Partido:</span>
              <strong>{{ selectedParty }}</strong>
            </div>
          </div>

          <!-- Detailed breakdown view (with selections) -->
          <div v-else class="tooltip-detailed">
            <div v-for="(lists, party) in detailedBreakdown" :key="party" class="tooltip-party-group">
              <div class="tooltip-party-name">
                {{ getPartyAbbrev(party) }}: {{ getPartyVotes(lists).toLocaleString() }} votos
              </div>
              <div class="tooltip-lists">
                <div
                  v-for="(list, index) in getDisplayedLists(lists)"
                  :key="list.number || list.candidate"
                  class="tooltip-list-item"
                >
                  {{ formatListItem(list) }}
                </div>
                <div v-if="shouldTruncateLists(lists)" class="tooltip-more">
                  y {{ lists.length - MAX_LISTS_PER_PARTY }} más...
                </div>
              </div>
            </div>

            <div class="tooltip-total">
              Total: {{ hoveredVotes.toLocaleString() }} votos
            </div>
          </div>

          <!-- Sticky hint (only when not pinned and hovering) -->
          <div v-if="!isTooltipPinned && hoveredFeature && shouldShowStickyHint" class="tooltip-hint">
            Mantén el cursor para fijar
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
import { Plus, Minus, Maximize2, X } from 'lucide-vue-next'
import chroma from 'chroma-js'
import { useMapInteraction } from '@/composables/useMapInteraction'
import { useTooltipContent } from '@/composables/useTooltipContent'
import { useKeyboardNavigation } from '@/composables/useKeyboardNavigation'
import { useScreenReaderAnnouncements } from '@/composables/useScreenReaderAnnouncements'
import { useMapColors } from '@/composables/useMapColors'
import MapSkeleton from '@/components/ui/MapSkeleton.vue'

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
  seriesLocalityMapping?: Record<string, string>
  seriesBarrioMapping?: Record<string, string[]>
}>()

const emit = defineEmits(['updateSelectedNeighborhood', 'mapInitialized'])

const mapContainer = ref<HTMLDivElement>()
const map = ref<maplibregl.Map>()
const tooltipRef = ref<HTMLDivElement>()
const hoveredFeature = ref<any>(null)
const hoveredVotes = ref(0)
const tooltipStyle = ref({})
const tooltipHtml = ref('')
const isMapLoading = ref(true)

// Use composables
const mapInteraction = useMapInteraction({
  geojsonData: computed(() => props.geojsonData),
  selectedLists: computed(() => props.selectedLists),
  selectedCandidates: computed(() => props.selectedCandidates),
  votosPorListas: computed(() => props.votosPorListas),
  partiesByList: computed(() => props.partiesByList),
  precandidatosByList: computed(() => props.precandidatosByList),
  partiesAbbrev: computed(() => props.partiesAbbrev),
  getVotosForNeighborhood: computed(() => props.getVotosForNeighborhood),
})

const tooltipContent = useTooltipContent({
  partiesAbbrev: props.partiesAbbrev,
})

const { normalizeString, groupListsByParty } = mapInteraction
const { generateListTooltip } = tooltipContent

// Screen reader announcements
const { announceZoneSelection } = useScreenReaderAnnouncements()

// Color system with ColorBrewer palette (from feature branch)
const { calculateBreaks, getColorForValue, getColorScale } = useMapColors('blues', 6, 'jenks')

// Sticky tooltip state
const isTooltipPinned = ref(false)
const pinnedZoneName = ref<string | null>(null)
const pinnedPosition = ref({ left: '0px', top: '0px' })
const hoverTimer = ref<number | null>(null)
const shouldShowStickyHint = ref(false)
const HOVER_STICKY_DELAY = 1000 // 1 second
const STICKY_HINT_DELAY = 2000 // 2 seconds
const MAX_LISTS_PER_PARTY = 10

const selectedParty = computed(() => {
  if (props.selectedLists.length > 0) {
    return props.partiesByList[props.selectedLists[0]]
  }
  return null
})

// Compute detailed breakdown for tooltip
const detailedBreakdown = computed(() => {
  if (!hoveredFeature.value && !isTooltipPinned.value) return {}

  const zoneName = hoveredFeature.value?.properties?.BARRIO ||
                   hoveredFeature.value?.properties?.zona ||
                   pinnedZoneName.value
  if (!zoneName) return {}

  const breakdown: Record<string, Array<{ number?: string; candidate?: string; votes: number }>> = {}

  // For ODN mode with candidates
  if (props.isODN && props.selectedCandidates.length > 0) {
    props.selectedCandidates.forEach(candidate => {
      const party = Object.entries(props.precandidatosByList)
        .find(([_, c]) => c === candidate)?.[0]
      if (!party) return

      const partyName = props.partiesByList[party]
      if (!partyName) return

      const votes = props.votosPorListas[party]?.[zoneName] || 0
      if (votes === 0) return

      if (!breakdown[partyName]) {
        breakdown[partyName] = []
      }
      breakdown[partyName].push({ candidate, votes })
    })
  }
  // For list mode
  else if (props.selectedLists.length > 0) {
    props.selectedLists.forEach(list => {
      const party = props.partiesByList[list]
      if (!party) return

      const votes = props.votosPorListas[list]?.[zoneName] || 0
      if (votes === 0) return

      if (!breakdown[party]) {
        breakdown[party] = []
      }
      breakdown[party].push({ number: list, votes })
    })
  }

  // Sort lists within each party by votes (descending)
  Object.keys(breakdown).forEach(party => {
    breakdown[party].sort((a, b) => b.votes - a.votes)
  })

  return breakdown
})

const shouldShowDetailedBreakdown = computed(() => {
  return (props.selectedLists.length > 0 || props.selectedCandidates.length > 0) &&
         Object.keys(detailedBreakdown.value).length > 0
})

// Helper functions
const getPartyAbbrev = (partyName: string): string => {
  return props.partiesAbbrev[partyName] || partyName
}

const getPartyVotes = (lists: Array<{ votes: number }>): number => {
  return lists.reduce((sum, list) => sum + list.votes, 0)
}

const getDisplayedLists = (lists: Array<any>): Array<any> => {
  return lists.slice(0, MAX_LISTS_PER_PARTY)
}

const shouldTruncateLists = (lists: Array<any>): boolean => {
  return lists.length > MAX_LISTS_PER_PARTY
}

const formatListItem = (item: { number?: string; candidate?: string; votes: number }): string => {
  if (item.candidate) {
    return `• ${item.candidate}: ${item.votes.toLocaleString()} votos`
  }
  return `• Lista ${item.number}: ${item.votes.toLocaleString()} votos`
}

const unpinTooltip = () => {
  isTooltipPinned.value = false
  pinnedZoneName.value = null
  if (hoverTimer.value) {
    clearTimeout(hoverTimer.value)
    hoverTimer.value = null
  }
  shouldShowStickyHint.value = false
}

const pinTooltip = () => {
  if (!hoveredFeature.value) return

  isTooltipPinned.value = true
  pinnedZoneName.value = hoveredFeature.value.properties.BARRIO || hoveredFeature.value.properties.zona
  pinnedPosition.value = { ...tooltipStyle.value }
  shouldShowStickyHint.value = false

  if (hoverTimer.value) {
    clearTimeout(hoverTimer.value)
    hoverTimer.value = null
  }
}

// Legend items
const legendItems = computed(() => {
  const scale = getColorScale()
  return scale.map((item, index) => {
    if (index === 0) {
      return { ...item, label: 'Sin datos / Muy bajo' }
    } else if (index === scale.length - 1) {
      return { ...item, label: `> ${item.label}` }
    } else {
      const nextValue = scale[index + 1]?.value || item.value
      return { ...item, label: `${item.label} - ${nextValue.toLocaleString()}` }
    }
  })
})

// Keyboard shortcuts for map controls
useKeyboardNavigation({
  customKeys: {
    '+': () => zoomIn(),
    '=': () => zoomIn(), // For keyboards without numpad
    '-': () => zoomOut(),
    '_': () => zoomOut(),
    'r': () => resetView(),
    'R': () => resetView()
  }
})

const getColor = (votes: number, maxVotes: number): string => {
  // Use ColorBrewer-based color system from feature branch
  return getColorForValue(votes)
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

  // Expose map for debugging
  ;(window as any).debugMap = map.value

  map.value.on('load', () => {
    updateMapData()
    isMapLoading.value = false
    emit('mapInitialized')
  })

  // Hover interaction
  map.value.on('mousemove', 'electoral-fill', (e) => {
    if (e.features && e.features.length > 0) {
      const feature = e.features[0]

      // Don't update if tooltip is pinned
      if (isTooltipPinned.value) {
        map.value!.getCanvas().style.cursor = 'pointer'
        return
      }

      hoveredFeature.value = feature

      const zoneName = feature.properties.serie || feature.properties.BARRIO || feature.properties.zona
      const normalizedZone = normalizeString(zoneName)
      hoveredVotes.value = props.getVotosForNeighborhood(normalizedZone)

      // Get display name using series mapping if available
      const seriesCode = feature.properties.serie?.toUpperCase()
      let displayName = zoneName

      if (seriesCode && props.seriesLocalityMapping?.[seriesCode]) {
        displayName = props.seriesLocalityMapping[seriesCode]
      } else if (seriesCode && seriesCode.length === 3) {
        displayName = `Serie ${seriesCode}`
      } else {
        displayName = zoneName?.toUpperCase() || normalizedZone.toUpperCase()
      }

      // Get barrios for this series if available
      const barrios = seriesCode && props.seriesBarrioMapping?.[seriesCode]

      // Generate tooltip HTML with lists
      const groupedLists = groupListsByParty(normalizedZone)
      tooltipHtml.value = generateListTooltip(
        displayName,
        groupedLists,
        hoveredVotes.value,
        seriesCode,
        barrios
      )

      // Position tooltip
      const point = map.value!.project(e.lngLat)
      tooltipStyle.value = {
        left: `${point.x + 10}px`,
        top: `${point.y - 10}px`
      }

      map.value!.getCanvas().style.cursor = 'pointer'

      // Start timer for sticky mode
      if (hoverTimer.value) {
        clearTimeout(hoverTimer.value)
      }

      // Show hint after STICKY_HINT_DELAY
      const hintTimer = setTimeout(() => {
        shouldShowStickyHint.value = true
      }, STICKY_HINT_DELAY)

      // Auto-pin after HOVER_STICKY_DELAY
      hoverTimer.value = window.setTimeout(() => {
        pinTooltip()
        clearTimeout(hintTimer)
      }, HOVER_STICKY_DELAY)
    }
  })

  map.value.on('mouseleave', 'electoral-fill', () => {
    // Don't hide if tooltip is pinned
    if (!isTooltipPinned.value) {
      hoveredFeature.value = null
      shouldShowStickyHint.value = false
    }

    map.value!.getCanvas().style.cursor = ''

    // Clear hover timer
    if (hoverTimer.value) {
      clearTimeout(hoverTimer.value)
      hoverTimer.value = null
    }
  })

  map.value.on('click', 'electoral-fill', (e) => {
    if (e.features && e.features.length > 0) {
      const feature = e.features[0]
      const zoneName = feature.properties.serie || feature.properties.BARRIO || feature.properties.zona
      const votes = props.getVotosForNeighborhood(zoneName)

      // Toggle pin on click
      if (isTooltipPinned.value && pinnedZoneName.value === zoneName) {
        unpinTooltip()
      } else {
        // Pin this tooltip
        hoveredFeature.value = feature
        hoveredVotes.value = votes
        pinTooltip()
      }

      // Announce to screen readers
      announceZoneSelection(zoneName, votes)

      emit('updateSelectedNeighborhood', zoneName)
    }
  })

  // Mobile tap support
  map.value.on('touchstart', 'electoral-fill', (e) => {
    if (e.features && e.features.length > 0) {
      const feature = e.features[0]
      const zoneName = feature.properties.serie || feature.properties.BARRIO || feature.properties.zona
      const votes = props.getVotosForNeighborhood(zoneName)

      hoveredFeature.value = feature
      hoveredVotes.value = votes

      // Position tooltip at tap location
      const point = map.value!.project(e.lngLat)
      tooltipStyle.value = {
        left: `${point.x + 10}px`,
        top: `${point.y - 10}px`
      }

      // Toggle pin on tap
      if (isTooltipPinned.value && pinnedZoneName.value === zoneName) {
        unpinTooltip()
      } else {
        pinTooltip()
      }

      // Announce to screen readers
      announceZoneSelection(zoneName, votes)

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

  // Calculate breaks for Jenks classification
  const allVotes = props.geojsonData.features.map((feature: any) => {
    const zoneName = feature.properties.serie || feature.properties.BARRIO || feature.properties.zona
    return props.getVotosForNeighborhood(zoneName)
  })
  calculateBreaks(allVotes)

  // Calculate max votes for fallback
  const maxVotes = props.votosPorListas
    ? Math.max(...Object.values(props.votosPorListas).flatMap(v => Object.values(v as Record<string, number>)))
    : 1

  // Add updated source with colors
  const geoJsonWithColors = {
    ...props.geojsonData,
    features: props.geojsonData.features.map((feature: any) => {
      // Try different zone identifiers in order of priority:
      // 1. serie (electoral series - most specific)
      // 2. BARRIO (neighborhood name)
      // 3. zona (zone code)
      const zoneName = feature.properties.serie || feature.properties.BARRIO || feature.properties.zona
      const votes = props.getVotosForNeighborhood(zoneName)
      const color = getColor(votes, maxVotes)

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

  // Add new source and layers
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
      'fill-opacity': 0.8
    }
  })

  // Add outline layer
  map.value.addLayer({
    id: outlineLayerId,
    type: 'line',
    source: sourceId,
    paint: {
      'line-color': '#666666',
      'line-width': 0.5,
      'line-opacity': 0.6
    }
  })

  // Fit map to data bounds
  try {
    // Calculate bounds from all features
    const bounds = new maplibregl.LngLatBounds();
    let pointCount = 0;

    geoJsonWithColors.features.forEach((feature: any) => {
      const geom = feature.geometry;
      if (!geom) return;

      if (geom.type === 'Polygon') {
        geom.coordinates[0].forEach((coord: number[]) => {
          if (coord && coord.length >= 2) {
            bounds.extend([coord[0], coord[1]]);
            pointCount++;
          }
        });
      } else if (geom.type === 'MultiPolygon') {
        geom.coordinates.forEach((polygon: any) => {
          if (polygon && polygon[0]) {
            polygon[0].forEach((coord: number[]) => {
              if (coord && coord.length >= 2) {
                bounds.extend([coord[0], coord[1]]);
                pointCount++;
              }
            });
          }
        });
      } else if (geom.type === 'LineString') {
        geom.coordinates.forEach((coord: number[]) => {
          if (coord && coord.length >= 2) {
            bounds.extend([coord[0], coord[1]]);
            pointCount++;
          }
        });
      } else if (geom.type === 'MultiLineString') {
        geom.coordinates.forEach((line: any) => {
          line.forEach((coord: number[]) => {
            if (coord && coord.length >= 2) {
              bounds.extend([coord[0], coord[1]]);
              pointCount++;
            }
          });
        });
      }
    });

    if (pointCount > 0) {
      map.value.fitBounds(bounds, { padding: 20, maxZoom: 12 });
    }
  } catch (e) {
    console.error('[MapLibreView] Error fitting bounds:', e);
  }
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
  // If map not initialized yet and geojsonData is now available, initialize it
  if (!map.value && props.geojsonData && mapContainer.value) {
    isMapLoading.value = true
    initMap()
  } else if (map.value) {
    if (map.value.loaded()) {
      updateMapData()
    } else {
      // Wait for map to be idle (all tiles loaded), then update
      isMapLoading.value = true
      map.value.once('idle', () => {
        updateMapData()
        isMapLoading.value = false
      })
    }
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

// Watch for selection changes - unpin tooltip when selections change
watch(() => [props.selectedLists, props.selectedCandidates], () => {
  if (isTooltipPinned.value) {
    unpinTooltip()
  }
}, { deep: true })

onMounted(() => {
  initMap()

  // Add global click listener to unpin on outside clicks
  const handleOutsideClick = (event: MouseEvent) => {
    if (isTooltipPinned.value && tooltipRef.value && !tooltipRef.value.contains(event.target as Node)) {
      unpinTooltip()
    }
  }
  document.addEventListener('click', handleOutsideClick)

  // Cleanup
  onUnmounted(() => {
    document.removeEventListener('click', handleOutsideClick)
  })
})

onUnmounted(() => {
  // Cleanup timers
  if (hoverTimer.value) {
    clearTimeout(hoverTimer.value)
  }

  // Remove map
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
  z-index: var(--z-map-controls);
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
  z-index: var(--z-map-controls);
}

.legend-title {
  font-weight: 600;
  font-size: 0.875rem;
  margin-bottom: 0.75rem;
}

.legend-scale {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.legend-scale-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
}

.legend-color-box {
  width: 20px;
  height: 14px;
  border-radius: 3px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  flex-shrink: 0;
}

.legend-label {
  color: var(--color-text-secondary);
  font-size: 0.7rem;
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
  max-width: 350px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  pointer-events: none;
  z-index: var(--z-tooltip);
  transition: all 0.2s ease;
}

.map-tooltip.tooltip-pinned {
  pointer-events: auto;
  border-color: var(--color-accent);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  cursor: default;
}

.tooltip-close-btn {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: none;
  background: var(--color-border);
  color: var(--color-text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  z-index: 1;
}

.tooltip-close-btn:hover {
  background: var(--color-accent);
  color: white;
  transform: scale(1.1);
}

.tooltip-header {
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
  padding-bottom: 0.5rem;
  padding-right: 1.5rem; /* Space for close button */
  border-bottom: 1px solid var(--color-border);
}

.tooltip-body {
  max-height: 300px;
  overflow-y: visible;
}

.tooltip-body.tooltip-scrollable {
  overflow-y: auto;
  padding-right: 0.25rem;
}

/* Custom scrollbar */
.tooltip-scrollable::-webkit-scrollbar {
  width: 6px;
}

.tooltip-scrollable::-webkit-scrollbar-track {
  background: var(--color-bg);
  border-radius: 3px;
}

.tooltip-scrollable::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 3px;
}

.tooltip-scrollable::-webkit-scrollbar-thumb:hover {
  background: var(--color-text-secondary);
}

.tooltip-simple .tooltip-stat {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  padding: 0.25rem 0;
}

.tooltip-stat span {
  color: var(--color-text-secondary);
}

.tooltip-detailed {
  font-size: 0.8125rem;
}

.tooltip-party-group {
  margin-bottom: 0.75rem;
}

.tooltip-party-group:last-child {
  margin-bottom: 0;
}

.tooltip-party-name {
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 0.375rem;
}

.tooltip-lists {
  margin-left: 0.75rem;
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}

.tooltip-list-item {
  padding: 0.125rem 0;
  line-height: 1.4;
}

.tooltip-more {
  font-style: italic;
  color: var(--color-text-secondary);
  margin-top: 0.25rem;
  opacity: 0.8;
}

.tooltip-total {
  border-top: 1px solid var(--color-border);
  margin-top: 0.75rem;
  padding-top: 0.5rem;
  font-weight: 600;
  font-size: 0.875rem;
}

.tooltip-hint {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px dashed var(--color-border);
  font-size: 0.7rem;
  color: var(--color-text-secondary);
  font-style: italic;
  text-align: center;
  opacity: 0.7;
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
