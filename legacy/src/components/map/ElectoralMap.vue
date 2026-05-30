<template>
  <div class="electoral-map-wrapper" data-testid="map-container">
    <div class="electoral-map" ref="mapContainer"></div>

    <MapLegend
      :show="showLegend"
      :max-votes="maxVotesComputed"
      :get-color="getColor"
    />

    <div v-if="selectedNeighborhood !== null" class="neighborhood-info">
      Barrio seleccionado: {{ selectedNeighborhood }} - Votos:
      {{ getVotosForNeighborhood(selectedNeighborhood) }}
    </div>

    <SelectedInfo
      :grouped-items="groupedSelectedItems"
      :total-votes="getTotalVotes()"
      :show-candidates="selectedCandidates.length > 0"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed, onUnmounted } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { GeoJSON, GeoJsonProperties } from 'geojson';
import MapLegend from './MapLegend.vue';
import SelectedInfo from './SelectedInfo.vue';
import { useMapInteraction } from '@/composables/useMapInteraction';
import { useTooltipContent } from '@/composables/useTooltipContent';
import type { PartyData } from './SelectedInfo.vue';

const props = defineProps<{
  regionName: string;
  selectedLists: string[];
  votosPorListas: Record<string, Record<string, number>>;
  maxVotosPorListas: Record<string, number>;
  getVotosForNeighborhood: (neighborhood: string) => number;
  geojsonData: any;
  selectedNeighborhood: string | null;
  isODN: boolean;
  partiesAbbrev: Record<string, string>;
  partiesByList: Record<string, string>;
  precandidatosByList: Record<string, string>;
  selectedCandidates: string[];
  mapCenter: [number, number];
  mapZoom: number;
  seriesLocalityMapping: Record<string, string>;
  seriesBarrioMapping?: Record<string, string[]>;
}>();

const emit = defineEmits<{
  updateSelectedNeighborhood: [neighborhood: string | null];
  mapInitialized: [];
}>();

const mapContainer = ref<HTMLElement | null>(null);
const selectedNeighborhood = ref<string | null>(null);
const map = ref<L.Map | null>(null);
const showLegend = ref(true);

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
});

const tooltipContent = useTooltipContent({
  partiesAbbrev: props.partiesAbbrev,
});

const {
  normalizeString,
  getCandidateVotesForNeighborhood,
  getCandidateTotalVotes,
  getCandidateTotalVotesAllNeighborhoods,
  groupCandidatesByParty,
  groupListsByParty,
  getMaxVotes,
  getColor,
  shadeColor,
  getTotalVotesForList,
} = mapInteraction;

const { generateCandidateTooltip, generateListTooltip } = tooltipContent;

const maxVotesComputed = computed(() => {
  if (!props.geojsonData || !props.geojsonData.features) {
    return 0;
  }

  if (props.selectedCandidates.length > 0) {
    return Math.max(
      ...props.geojsonData.features.map((feature: any) =>
        getCandidateTotalVotes(
          normalizeString(
            feature.properties.BARRIO ||
              feature.properties.texto ||
              feature.properties.zona
          )
        )
      )
    );
  }

  return getMaxVotes.value;
});

const updateMap = () => {
  if (map.value && props.geojsonData) {
    map.value.eachLayer((layer) => {
      if (layer instanceof L.GeoJSON && map.value) {
        map.value.removeLayer(layer);
      }
    });

    L.geoJSON(props.geojsonData, {
      style: styleFeature as L.StyleFunction<GeoJsonProperties>,
      onEachFeature: onEachFeature,
    }).addTo(map.value as L.Map);
  }
};

const initializeMap = () => {
  try {
    if (mapContainer.value) {
      if (map.value) {
        map.value.remove();
      }
      map.value = L.map(mapContainer.value, {
        center: props.mapCenter,
        zoom: props.mapZoom,
        layers: [],
        zoomControl: false,
        attributionControl: false,
      });
      updateMap();
      fitMapToBounds();

      setTimeout(() => {
        map.value?.invalidateSize();
      }, 100);
    }
  } catch (error) {
    console.error('Error initializing map:', error);
  }
};

const fitMapToBounds = () => {
  if (map.value && props.geojsonData) {
    const geojsonLayer = L.geoJSON(props.geojsonData);
    const bounds = geojsonLayer.getBounds();
    map.value.fitBounds(bounds);
  }
};

const styleFeature = (
  feature: GeoJSON.Feature<GeoJSON.Geometry, GeoJsonProperties> | undefined
): L.PathOptions => {
  if (!feature || !feature.properties) return {};
  const neighborhood = normalizeString(
    feature.properties.BARRIO ||
      feature.properties.texto ||
      feature.properties.zona
  );
  const votes =
    props.selectedCandidates.length > 0
      ? getCandidateTotalVotes(neighborhood)
      : props.getVotosForNeighborhood(neighborhood);
  const fillColor = getColor(votes);
  return {
    color: '#000000',
    weight: 1,
    fillColor: fillColor,
    fillOpacity: 0.7,
    opacity: 1,
  };
};

const onEachFeature = (feature: GeoJSON.Feature, layer: L.Layer) => {
  layer.on({
    click: () => {
      selectedNeighborhood.value = feature.properties
        ? normalizeString(
            feature.properties.BARRIO ||
              feature.properties.texto ||
              feature.properties.zona
          )
        : null;
    },
    mouseover: () => {
      const neighborhood = feature.properties
        ? normalizeString(
            feature.properties.BARRIO ||
              feature.properties.texto ||
              feature.properties.zona
          )
        : '';

      // Get series code from originalName property (uppercase 3-letter code)
      const seriesCode = feature.properties?.originalName?.toUpperCase();

      // Try to use series-to-locality mapping if available
      let displayName: string;
      if (seriesCode && props.seriesLocalityMapping[seriesCode]) {
        // Use the mapped locality name
        displayName = props.seriesLocalityMapping[seriesCode];
      } else if (seriesCode && seriesCode.length === 3) {
        // Fallback to "Serie XXX" format for 3-letter codes without mapping
        displayName = `Serie ${seriesCode}`;
      } else {
        // Fallback to other properties for non-series data
        displayName =
          feature.properties?.name ||
          feature.properties?.normalizedName?.toUpperCase() ||
          feature.properties?.BARRIO?.toUpperCase() ||
          feature.properties?.texto ||
          feature.properties?.zona ||
          neighborhood.toUpperCase();
      }

      const votes =
        props.selectedCandidates.length > 0
          ? getCandidateTotalVotes(neighborhood)
          : props.getVotosForNeighborhood(neighborhood);
      const currentColor = getColor(votes);
      const darkerColor = shadeColor(currentColor, -20);
      (layer as L.Path).setStyle({
        fillColor: darkerColor,
        fillOpacity: 0.7,
      });

      // Get barrios for this series if available (Rivera only)
      const barrios = seriesCode && props.seriesBarrioMapping?.[seriesCode]
        ? props.seriesBarrioMapping[seriesCode]
        : undefined;

      let tooltipHtml = '';

      if (props.selectedCandidates.length > 0) {
        const candidateVotes = getCandidateVotesForNeighborhood(neighborhood);
        const groupedCandidates = groupCandidatesByParty(candidateVotes);
        const totalVotes = getCandidateTotalVotes(neighborhood);
        tooltipHtml = generateCandidateTooltip(
          displayName,
          candidateVotes,
          groupedCandidates,
          totalVotes,
          seriesCode,
          barrios
        );
      } else {
        const groupedLists = groupListsByParty(neighborhood);
        tooltipHtml = generateListTooltip(
          displayName,
          groupedLists,
          votes,
          seriesCode,
          barrios
        );
      }

      layer
        .bindTooltip(tooltipHtml, {
          permanent: false,
          direction: 'auto',
          className: 'neighborhood-label scrollable-tooltip',
        })
        .openTooltip();
    },
    mouseout: () => {
      (layer as L.Path).setStyle(styleFeature(feature));
      selectedNeighborhood.value = null;
      layer.unbindTooltip();
    },
    mousedown: (e) => {
      e.target.setStyle({
        fillOpacity: 0.3,
      });
    },
    mouseup: (e) => {
      e.target.setStyle(styleFeature(feature));
    },
  });
};

const getTotalVotes = (): number => {
  if (props.selectedCandidates.length > 0) {
    return props.selectedCandidates.reduce((total, candidate) => {
      return total + getCandidateTotalVotesAllNeighborhoods(candidate);
    }, 0);
  } else {
    return props.selectedLists.reduce(
      (total, list) => total + getTotalVotesForList(list),
      0
    );
  }
};

const groupedSelectedItems = computed<Record<string, PartyData>>(() => {
  if (props.selectedCandidates.length > 0) {
    const grouped: Record<string, PartyData> = {};
    props.selectedCandidates.forEach((candidate) => {
      const party = Object.entries(props.precandidatosByList).find(
        ([, c]) => c === candidate
      )?.[0];
      const partyName = party ? props.partiesByList[party] : 'Unknown';
      grouped[partyName] ??= { totalVotes: 0, candidates: [] };
      const votes = getCandidateTotalVotesAllNeighborhoods(candidate);
      grouped[partyName].totalVotes += votes;
      grouped[partyName].candidates?.push({ name: candidate, votes });
    });
    // Sort candidates within each party
    Object.values(grouped).forEach((partyData: PartyData) => {
      partyData.candidates?.sort((a, b) => b.votes - a.votes);
    });
    return Object.fromEntries(
      Object.entries(grouped)
        .sort(([, a], [, b]) => b.totalVotes - a.totalVotes)
        .map(([party, data]) => [
          party !== 'Independiente' && party !== 'Frente Amplio'
            ? `Partido ${party}`
            : party,
          data,
        ])
    );
  } else {
    const grouped: Record<string, PartyData> = {};
    props.selectedLists.forEach((list) => {
      const party = props.partiesByList[list];
      if (!grouped[party]) {
        grouped[party] = { totalVotes: 0, lists: [] };
      }
      const votes = getTotalVotesForList(list);
      grouped[party].totalVotes += votes;
      grouped[party].lists?.push({ number: list, votes });
    });
    // Sort lists within each party
    Object.values(grouped).forEach((partyData: PartyData) => {
      partyData.lists?.sort((a, b) => b.votes - a.votes);
    });
    return Object.fromEntries(
      Object.entries(grouped)
        .sort(([, a], [, b]) => b.totalVotes - a.totalVotes)
        .map(([party, data]) => [
          party !== 'Independiente' && party !== 'Frente Amplio'
            ? `Partido ${party}`
            : party,
          data,
        ])
    );
  }
});

onMounted(() => {
  initializeMap();
  window.addEventListener('resize', () => {
    if (map.value) {
      map.value.invalidateSize();
    }
  });
  emit('mapInitialized');
});

watch(
  () => props.regionName,
  () => {
    initializeMap();
  }
);

watch(
  () => props.geojsonData,
  (newGeojsonData) => {
    if (newGeojsonData && map.value) {
      updateMap();
      showLegend.value = true;
      fitMapToBounds();
    }
  },
  { immediate: true }
);

watch(() => props.geojsonData, updateMap, { deep: true });
watch(() => props.selectedLists, updateMap);
watch(() => props.selectedCandidates, updateMap);

onUnmounted(() => {
  if (map.value) {
    map.value.remove();
  }
});
</script>

<style scoped>
.electoral-map-wrapper {
  width: 100%;
  height: 100%;
  position: relative;
}

.electoral-map {
  width: 100%;
  height: 100%;
}

.neighborhood-info {
  position: absolute;
  bottom: 10px;
  left: 10px;
  background-color: rgba(255, 255, 255, 0.8);
  padding: 5px 10px;
  border-radius: 5px;
}

.neighborhood-label {
  background: none;
  border: none;
  box-shadow: none;
  font-size: 12px;
  font-weight: bold;
  color: black;
}

:deep(.leaflet-interactive) {
  outline: none !important;
  cursor: pointer;
}

:deep(.leaflet-pane path) {
  outline: none !important;
  outline-offset: 0 !important;
}

:deep(.leaflet-container) {
  outline: none !important;
}

:deep(.leaflet-interactive:focus) {
  outline: none !important;
}

:deep(.leaflet-interactive:active) {
  outline: none !important;
}

:deep(.scrollable-tooltip) {
  max-height: 300px;
  overflow-y: auto;
}

:deep(.tooltip-content) {
  max-width: 400px;
  max-height: 300px;
  overflow-y: auto;
  font-size: 12px;
}

:deep(.tooltip-content .party-list),
:deep(.tooltip-content .list-items),
:deep(.tooltip-content .candidate-items) {
  list-style-type: none;
  padding-left: 0;
  margin: 0;
}

:deep(.tooltip-content .party-item) {
  margin-bottom: 10px;
}

:deep(.tooltip-content .party-name) {
  display: block;
  margin-bottom: 5px;
  color: #444;
  font-weight: bold;
}

:deep(.tooltip-content .list-items),
:deep(.tooltip-content .candidate-items) {
  padding-left: 15px;
}

:deep(.tooltip-content .list-item),
:deep(.tooltip-content .candidate-item) {
  margin-bottom: 3px;
  font-size: 0.9em;
  color: #666;
}

:deep(.tooltip-total) {
  margin-top: 10px;
  font-weight: bold;
}

:deep(.scrollable-tooltip .leaflet-tooltip-content) {
  max-height: 300px;
  overflow-y: auto;
}

@media (max-width: 767px) {
  :deep(.scrollable-tooltip) {
    max-height: none;
    overflow-y: visible;
  }

  :deep(.tooltip-content) {
    max-width: 250px;
  }
}
</style>
