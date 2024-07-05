<template>
  <div class="montevideo-map-wrapper">
    <div class="montevideo-map" ref="mapContainer"></div>
    <div class="selected-lists-info">
      <h3>Selected Lists</h3>
      <ul>
        <li v-for="list in selectedLists" :key="list">
          Lista {{ list }}: {{ getTotalVotesForList(list) }} votes
        </li>
      </ul>
      <p>Total Votes: {{ getTotalVotes() }}</p>
    </div>
    <div v-if="selectedNeighborhood !== null" class="neighborhood-info">
      Selected Neighborhood: {{ selectedNeighborhood }} - Votos:
      {{ getVotosForNeighborhood(selectedNeighborhood) }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from "vue";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const props = defineProps<{
  selectedLists: string[];
  votosPorListas: Record<string, Record<string, number>>;
  maxVotosPorListas: Record<string, number>;
  geojsonData: any;
  isODN: boolean;
  getVotosForNeighborhood: (neighborhood: string) => number;
}>();

const mapContainer = ref(null);
const selectedNeighborhood = ref(null);
let map: L.Map | null = null;

const sheetNumbers = computed(() => props.selectedLists);

const updateMap = () => {
  if (map && props.geojsonData) {
    map.eachLayer((layer) => {
      if (layer instanceof L.GeoJSON && map) {
        map.removeLayer(layer);
      }
    });

    L.geoJSON(props.geojsonData, {
      style: styleFeature,
      onEachFeature: onEachFeature,
    }).addTo(map);
  }
};

const initializeMap = () => {
  if (mapContainer.value && !map) {
    map = L.map(mapContainer.value, {
      center: [-34.8211, -56.225],
      zoom: 11.5,
      layers: [],
      zoomControl: false,
      attributionControl: false,
    });

    L.control.zoom({ position: "bottomright" }).addTo(map);

    updateMap();
  }
};

const styleFeature = (feature) => {
  if (!feature) return {};
  const neighborhood = feature.properties.BARRIO;
  const votes = props.getVotosForNeighborhood(neighborhood);
  const fillColor = getColor(votes);
  return {
    color: "#000000",
    weight: 2,
    fillColor: fillColor,
    fillOpacity: 0.7,
  };
};

const onEachFeature = (feature, layer) => {
  layer.on({
    click: () => {
      selectedNeighborhood.value = feature.properties.BARRIO;
    },
    mouseover: () => {
      const neighborhood = feature.properties.BARRIO;
      const votes = props.getVotosForNeighborhood(neighborhood);
      const currentColor = getColor(votes);
      const darkerColor = shadeColor(currentColor, -20);
      (layer as L.Path).setStyle({
        fillColor: darkerColor,
        fillOpacity: 0.5,
      });

      let tooltipContent = `<strong>${neighborhood}</strong><br>`;

      const sortedSheetNumbers = [...sheetNumbers.value].sort((a, b) => {
        const votesA = props.votosPorListas[a]?.[neighborhood] || 0;
        const votesB = props.votosPorListas[b]?.[neighborhood] || 0;
        return votesB - votesA;
      });

      tooltipContent += sortedSheetNumbers
        .map((sheetNumber) => {
          const listVotes =
            props.votosPorListas[sheetNumber]?.[neighborhood] || 0;
          return `Lista ${parseInt(sheetNumber)}: ${listVotes} votos`;
        })
        .join("<br>");

      const totalVotes =
        sheetNumbers.value.length > 1
          ? `<br><strong>Total: ${votes} votos</strong>`
          : "";
      tooltipContent += totalVotes;

      layer
        .bindTooltip(tooltipContent, {
          permanent: false,
          direction: "auto",
          className: "neighborhood-label",
        })
        .openTooltip();
    },
    mouseout: () => {
      (layer as L.Path).setStyle(styleFeature(feature));
      selectedNeighborhood.value = null;
      layer.unbindTooltip();
    },
  });
};

onMounted(() => {
  initializeMap();
});

watch(
  [
    () => props.selectedLists,
    () => props.votosPorListas,
    () => props.geojsonData,
  ],
  () => {
    updateMap();
  },
  { deep: true }
);

const getMaxVotes = computed(() => {
  return Math.max(
    ...Object.values(props.geojsonData.features).map((feature) =>
      props.getVotosForNeighborhood(feature.properties.BARRIO)
    )
  );
});

function getColor(votes) {
  const maxVotes = getMaxVotes.value;
  if (votes === 0) {
    return "#FFFFFF"; // White for 0 votes
  }

  const ratio = votes / maxVotes;
  const colorSteps = [
    { threshold: 0.05, color: "#FFF3E0" },
    { threshold: 0.1, color: "#FFE0B2" },
    { threshold: 0.15, color: "#FFD54F" },
    { threshold: 0.2, color: "#FFCC80" },
    { threshold: 0.25, color: "#FFC107" },
    { threshold: 0.3, color: "#FFA72C" },
    { threshold: 0.4, color: "#FF9800" },
    { threshold: 0.45, color: "#FF8A65" },
    { threshold: 0.5, color: "#FF7043" },
    { threshold: 0.6, color: "#FF6E6E" },
    { threshold: 0.8, color: "#FF5722" },
    { threshold: 1, color: "#FF4500" },
  ];

  for (const step of colorSteps) {
    if (ratio <= step.threshold) {
      return step.color;
    }
  }

  // For values above 1 (shouldn't happen, but just in case)
  return interpolateColor("#FF4500", "#4B0082", Math.min(ratio - 1, 1));
}

function interpolateColor(startColor, endColor, ratio) {
  const hex = (x) => {
    x = x.toString(16);
    return x.length === 1 ? "0" + x : x;
  };
  const interpolate = (start, end, ratio) =>
    Math.ceil(parseInt(start, 16) * (1 - ratio) + parseInt(end, 16) * ratio);
  const r = interpolate(startColor.slice(1, 3), endColor.slice(1, 3), ratio);
  const g = interpolate(startColor.slice(3, 5), endColor.slice(3, 5), ratio);
  const b = interpolate(startColor.slice(5, 7), endColor.slice(5, 7), ratio);
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

function shadeColor(color, percent) {
  const num = parseInt(color.slice(1), 16),
    amt = Math.round(2.55 * percent),
    R = (num >> 16) + amt,
    G = ((num >> 8) & 0x00ff) + amt,
    B = (num & 0x0000ff) + amt;
  return (
    "#" +
    (
      0x1000000 +
      (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
      (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
      (B < 255 ? (B < 1 ? 0 : B) : 255)
    )
      .toString(16)
      .slice(1)
  );
}

const getTotalVotesForList = (list: string) => {
  return Object.values(props.votosPorListas[list] || {}).reduce(
    (a, b) => a + b,
    0
  );
};

const getTotalVotes = () => {
  return props.selectedLists.reduce(
    (total, list) => total + getTotalVotesForList(list),
    0
  );
};

const getTotalVotesAcrossAllNeighborhoods = () => {
  return props.selectedLists.reduce((total, list) => {
    return (
      total +
      Object.values(props.votosPorListas[list] || {}).reduce((a, b) => a + b, 0)
    );
  }, 0);
};

const areAllVotesAccounted = computed(() => {
  return getTotalVotes() === getTotalVotesAcrossAllNeighborhoods();
});
</script>

<style scoped>
.montevideo-map-wrapper {
  width: 100%;
  height: 100%;
  position: relative;
}

.montevideo-map {
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

.selected-lists-info {
  position: absolute;
  top: 10px;
  left: 10px;
  background-color: rgba(255, 255, 255, 0.8);
  padding: 10px;
  border-radius: 5px;
  max-width: 250px;
  max-height: 300px;
  overflow-y: auto;
  z-index: 1000;
}

.selected-lists-info h3 {
  margin-top: 0;
  margin-bottom: 10px;
}

.selected-lists-info ul {
  list-style-type: none;
  padding: 0;
  margin: 0;
}

.selected-lists-info li {
  margin-bottom: 5px;
}
</style>
