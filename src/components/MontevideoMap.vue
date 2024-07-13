<template>
  <div class="montevideo-map-wrapper">
    <div class="montevideo-map" ref="mapContainer"></div>

    <div v-if="selectedNeighborhood !== null" class="neighborhood-info">
      Barrio seleccionado: {{ selectedNeighborhood }} - Votos:
      {{ getVotosForNeighborhood(selectedNeighborhood) }}
    </div>
  </div>
  <div class="mobile-toggle" @click="toggleMobileVisibility">
    <a class="mobile-toggle-text">Ver listas seleccionadas</a>
    <span
      class="arrow"
      :class="{
        'arrow-up': !isMobileHidden,
        'arrow-down': isMobileHidden,
      }"
    ></span>
  </div>
  <div class="selected-lists-info" :class="{ 'mobile-hidden': isMobileHidden }">
    <div class="selected-lists-content">
      <h3 class="selected-lists-title">Listas seleccionadas</h3>
      <ul class="party-list">
        <li
          v-for="(partyData, party) in groupedSelectedLists"
          :key="party"
          class="party-item"
        >
          <strong class="party-name"
            >{{ party }}: {{ partyData.totalVotes }} votos</strong
          >
          <ul class="list-items">
            <li
              v-for="list in partyData.lists"
              :key="list.number"
              class="list-item"
            >
              Lista {{ list.number }}: {{ list.votes }} votos
            </li>
          </ul>
        </li>
      </ul>
      <div class="total-votes">
        <strong>Total de votos:</strong> {{ getTotalVotes() }}
      </div>
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
  partiesAbbrev: Record<string, string>;
  partiesByList: Record<string, string>;
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
    weight: 1,
    fillColor: fillColor,
    fillOpacity: 0.7,
    opacity: 1,
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

      let tooltipContent = `<div class="tooltip-content"><strong>${neighborhood}</strong><br>`;

      const sortedSheetNumbers = [...sheetNumbers.value].sort((a, b) => {
        const votesA = props.votosPorListas[a]?.[neighborhood] || 0;
        const votesB = props.votosPorListas[b]?.[neighborhood] || 0;
        return votesB - votesA;
      });

      if (sortedSheetNumbers.length > 10) {
        tooltipContent += '<div class="tooltip-columns">';
        const halfLength = Math.ceil(sortedSheetNumbers.length / 2);
        for (let i = 0; i < 2; i++) {
          tooltipContent += '<div class="tooltip-column">';
          tooltipContent += sortedSheetNumbers
            .slice(i * halfLength, (i + 1) * halfLength)
            .map((sheetNumber) => {
              const listVotes =
                props.votosPorListas[sheetNumber]?.[neighborhood] || 0;
              const party = props.partiesByList[sheetNumber];
              const partyAbbrev = props.partiesAbbrev[party] || party;
              return `Lista ${parseInt(
                sheetNumber
              )} (${partyAbbrev}): ${listVotes} votos`;
            })
            .join("<br>");
          tooltipContent += "</div>";
        }
        tooltipContent += "</div>";
      } else {
        tooltipContent += sortedSheetNumbers
          .map((sheetNumber) => {
            const listVotes =
              props.votosPorListas[sheetNumber]?.[neighborhood] || 0;
            const party = props.partiesByList[sheetNumber];
            const partyAbbrev = props.partiesAbbrev[party] || party;
            return `Lista ${parseInt(
              sheetNumber
            )} (${partyAbbrev}): ${listVotes} votos`;
          })
          .join("<br>");
      }

      const totalVotes =
        sheetNumbers.value.length > 1
          ? `<br><strong>Total: ${votes} votos</strong>`
          : "";
      tooltipContent += totalVotes + "</div>";

      layer
        .bindTooltip(tooltipContent, {
          permanent: false,
          direction: "auto",
          className: "neighborhood-label scrollable-tooltip",
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
    return "#FFFFFF";
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

interface PartyData {
  totalVotes: number;
  lists: { number: string; votes: number }[];
}

const groupedSelectedLists = computed<Record<string, PartyData>>(() => {
  const grouped = {};
  props.selectedLists.forEach((list) => {
    const party = props.partiesByList[list];
    if (!grouped[party]) {
      grouped[party] = { totalVotes: 0, lists: [] };
    }
    const votes = getTotalVotesForList(list);
    grouped[party].totalVotes += votes;
    grouped[party].lists.push({ number: list, votes });
  });

  return Object.fromEntries(
    Object.entries(grouped)
      .sort(([, a], [, b]) => b.totalVotes - a.totalVotes)
      .map(([party, data]) => [
        party !== "Independiente" && party !== "Frente Amplio"
          ? `Partido ${party}`
          : party,
        data,
      ])
  );
});

const isMobileHidden = ref(true);

const toggleMobileVisibility = () => {
  isMobileHidden.value = !isMobileHidden.value;
};
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
  top: 40px;
  right: 20px;
  background-color: rgba(255, 255, 255, 0.9);
  padding: 15px;
  border-radius: 8px;
  max-width: 300px;
  max-height: 1200px;
  overflow-y: auto;
  z-index: 1000;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.selected-lists-content {
  max-height: calc(70vh - 30px);
  overflow-y: auto;
}

.selected-lists-title {
  margin-top: 0;
  margin-bottom: 15px;
  font-size: 1.2em;
  color: #333;
}

.party-list {
  list-style-type: none;
  padding: 0;
  margin: 0;
}

.party-item {
  margin-bottom: 15px;
}

.party-name {
  display: block;
  margin-bottom: 5px;
  color: #444;
}

.list-items {
  list-style-type: none;
  padding-left: 15px;
}

.list-item {
  margin-bottom: 3px;
  font-size: 0.9em;
  color: #666;
}

.total-votes {
  margin-top: 20px;
  padding-top: 10px;
  border-top: 1px solid #ddd;
  font-size: 1.1em;
  color: #333;
}

.mobile-toggle {
  display: none;
  cursor: pointer;
  padding: 10px;
  text-align: center;
}

.arrow {
  display: inline-block;
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
}

.arrow-up {
  border-bottom: 5px solid black;
}

.arrow-down {
  border-top: 5px solid black;
}
@media (max-width: 767px) {
  .selected-lists-info {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    max-width: 100%;
    border-radius: 8px 8px 0 0;
    transform: translateY(50%);
    transition: transform 0.3s ease-in-out;
    max-height: 70vh; /* Limit the height to 70% of the viewport height */
  }

  .selected-lists-content {
    max-height: calc(
      70vh - 40px
    ); /* Subtract the height of the toggle button */
    overflow-y: auto;
    padding-bottom: 20px; /* Add some padding at the bottom for better scrolling */
    -webkit-overflow-scrolling: touch; /* Smooth scrolling on iOS */
  }

  .selected-lists-info.mobile-hidden {
    transform: translateY(300%);
  }

  .mobile-toggle {
    display: block;
    height: 40px;
    display: flex;
    font-size: 1.2rem;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background-color: white;
    border-radius: 8px 8px 0 0;
    box-shadow: 0 -2px 5px rgba(0, 0, 0, 0.1);
    z-index: 1001;
  }

  .mobile-toggle-text {
    font-size: 1.2rem;
    color: #333;
    font-weight: bold;
    margin-right: 10px;
  }

  .mobile-hidden .selected-lists-content {
    display: none;
  }

  .selected-lists-content {
    padding-top: 10px;
  }
}
.leaflet-interactive {
  outline: none !important;
  cursor: pointer;
}

.leaflet-pane path {
  outline: none !important;
  outline-offset: 0 !important;
}

.leaflet-container {
  outline: none !important;
}

.leaflet-interactive:focus {
  outline: none !important;
}

.leaflet-interactive:active {
  outline: none !important;
}

.scrollable-tooltip {
  max-height: 300px;
  overflow-y: auto;
}

.tooltip-content {
  max-width: 250px;
}

@media (max-width: 767px) {
  .scrollable-tooltip {
    max-height: none;
    overflow-y: visible;
  }
}

.tooltip-columns {
  display: flex;
  justify-content: space-between;
  width: 100%;
}

.tooltip-column {
  width: 48%;
}

.tooltip-content {
  max-width: 400px;
}

.scrollable-tooltip .leaflet-tooltip-content {
  max-height: 300px;
  overflow-y: auto;
}

@media (max-width: 767px) {
  .tooltip-columns {
    flex-direction: column;
  }

  .tooltip-column {
    width: 100%;
  }

  .tooltip-content {
    max-width: 250px;
  }

  .scrollable-tooltip .leaflet-tooltip-content {
    max-height: none;
    overflow-y: visible;
  }
}
</style>
