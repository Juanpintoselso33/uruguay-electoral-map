<template>
  <div class="montevideo-map-wrapper">
    <div class="montevideo-map" ref="mapContainer"></div>

    <div v-if="selectedNeighborhood !== null" class="neighborhood-info">
      Barrio seleccionado: {{ selectedNeighborhood }} - Votos:
      {{ getVotosForNeighborhood(selectedNeighborhood) }}
    </div>
  </div>
  <div
    class="mobile-toggle"
    @click="toggleMobileVisibility"
    tabindex="0"
    role="button"
    aria-label="Toggle selected lists visibility"
  >
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
      <h3 class="selected-lists-title">
        {{
          props.selectedCandidates.length > 0
            ? "Candidatos seleccionados"
            : "Listas seleccionadas"
        }}
      </h3>
      <ul class="party-list">
        <li
          v-for="(partyData, party) in groupedSelectedItems"
          :key="party"
          class="party-item"
        >
          <strong class="party-name"
            >{{ party }}: {{ partyData.totalVotes }} votos</strong
          >
          <ul class="list-items" v-if="props.selectedCandidates.length === 0">
            <li
              v-for="list in partyData.lists"
              :key="list.number"
              class="list-item"
            >
              Lista {{ list.number }}: {{ list.votes }} votos
            </li>
          </ul>
          <ul class="candidate-items" v-else>
            <li
              v-for="candidate in partyData.candidates"
              :key="candidate.name"
              class="candidate-item"
            >
              {{ candidate.name }}: {{ candidate.votes }} votos
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
import { ref, onMounted, watch, computed, onUnmounted, watchEffect } from "vue";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import chroma from "chroma-js";

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
}>();

const emit = defineEmits(["updateSelectedNeighborhood"]);

const mapContainer = ref(null);
const selectedNeighborhood = ref(null);
const map = ref(null);

const sheetNumbers = computed(() => props.selectedLists);

const updateMap = () => {
  if (map.value && props.geojsonData) {
    map.value.eachLayer((layer) => {
      if (layer instanceof L.GeoJSON && map.value) {
        map.value.removeLayer(layer);
      }
    });

    L.geoJSON(props.geojsonData, {
      style: styleFeature,
      onEachFeature: onEachFeature,
    }).addTo(map.value);
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
        map.value.invalidateSize();
      }, 100);
    }
  } catch (error) {
    console.error("Error initializing map:", error);
  }
};

const fitMapToBounds = () => {
  if (map.value && props.geojsonData) {
    const geojsonLayer = L.geoJSON(props.geojsonData);
    const bounds = geojsonLayer.getBounds();
    map.value.fitBounds(bounds);
  }
};

watch(
  () => props.regionName,
  () => {
    initializeMap();
  }
);

watch(
  () => props.geojsonData,
  () => {
    fitMapToBounds();
  }
);

const styleFeature = (feature) => {
  if (!feature) return {};
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
      selectedNeighborhood.value = normalizeString(
        feature.properties.BARRIO ||
          feature.properties.texto ||
          feature.properties.zona
      );
    },
    mouseover: () => {
      const neighborhood = normalizeString(
        feature.properties.BARRIO ||
          feature.properties.texto ||
          feature.properties.zona
      );
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

      let tooltipContent = `<div class="tooltip-content"><strong>${neighborhood}</strong><br>`;

      if (props.selectedCandidates.length > 0) {
        const candidateVotes = getCandidateVotesForNeighborhood(neighborhood);
        const groupedCandidates = groupCandidatesByParty(candidateVotes);

        tooltipContent += '<div class="party-list">';
        for (const [party, candidates] of Object.entries(groupedCandidates)) {
          const partyVotes = candidates.reduce((sum, c) => sum + c.votes, 0);
          const partyAbbrev = props.partiesAbbrev[party] || party;
          tooltipContent += `<div class="party-item">
            <div class="party-name" style="margin-left: 20px;"><strong>${partyAbbrev}</strong>: ${partyVotes} votos</div>
            <div class="candidate-items" style="margin-left: 40px;">`;
          candidates
            .sort((a, b) => b.votes - a.votes)
            .forEach(({ candidate, votes }) => {
              tooltipContent += `<div class="candidate-item">${candidate}: ${votes} votos</div>`;
            });
          tooltipContent += "</div></div>";
        }
        tooltipContent += "</div>";
      } else {
        const groupedLists = groupListsByParty(neighborhood);

        tooltipContent += '<div class="party-list">';
        for (const [party, lists] of Object.entries(groupedLists)) {
          const partyVotes = lists.reduce((sum, l) => sum + l.votes, 0);
          const partyAbbrev = props.partiesAbbrev[party] || party;
          tooltipContent += `<div class="party-item">
            <div class="party-name" style="margin-left: 20px;"><strong>${partyAbbrev}</strong>: ${partyVotes} votos</div>
            <div class="list-items" style="margin-left: 40px;">`;
          lists
            .sort((a, b) => b.votes - a.votes)
            .forEach(({ number, votes }) => {
              tooltipContent += `<div class="list-item">Lista ${number}: ${votes} votos</div>`;
            });
          tooltipContent += "</div></div>";
        }
        tooltipContent += "</div>";
      }

      const totalVotes =
        props.selectedCandidates.length > 0
          ? getCandidateTotalVotes(neighborhood)
          : votes;
      tooltipContent += `<div class="tooltip-total"><strong>Total: ${
        totalVotes || 0
      } votos</strong></div></div>`;

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

const groupCandidatesByParty = (candidateVotes) => {
  const grouped = {};
  candidateVotes.forEach(({ candidate, votes, party }) => {
    if (!grouped[party]) {
      grouped[party] = [];
    }
    grouped[party].push({ candidate, votes });
  });
  return Object.fromEntries(
    Object.entries(grouped).sort(
      ([, a], [, b]) =>
        b.reduce((sum, c) => sum + c.votes, 0) -
        a.reduce((sum, c) => sum + c.votes, 0)
    )
  );
};

const groupListsByParty = (neighborhood) => {
  const grouped = {};
  props.selectedLists.forEach((list) => {
    const party = props.partiesByList[list];
    const votes = props.votosPorListas[list]?.[neighborhood] || 0;
    if (votes > 0) {
      if (!grouped[party]) {
        grouped[party] = [];
      }
      grouped[party].push({ number: list, votes });
    }
  });
  return Object.fromEntries(
    Object.entries(grouped).sort(
      ([, a], [, b]) =>
        b.reduce((sum, l) => sum + l.votes, 0) -
        a.reduce((sum, l) => sum + l.votes, 0)
    )
  );
};

const getCandidateVotesForNeighborhood = (neighborhood: string) => {
  return props.selectedCandidates.map((candidate) => {
    let votes = 0;
    const candidateLists = Object.entries(props.precandidatosByList)
      .filter(([, precandidato]) => precandidato === candidate)
      .map(([list]) => list);

    candidateLists.forEach((list) => {
      const listVotes = props.votosPorListas[list]?.[neighborhood] || 0;
      votes += listVotes;
    });

    const party = Object.entries(props.precandidatosByList).find(
      ([, c]) => c === candidate
    )?.[0];
    const partyName = party ? props.partiesByList[party] : "Unknown";
    const partyAbbrev = props.partiesAbbrev[partyName] || partyName;
    return { candidate, votes, party: partyAbbrev };
  });
};

const getCandidateTotalVotes = (neighborhood: string) => {
  return getCandidateVotesForNeighborhood(neighborhood).reduce(
    (total, { votes }) => total + votes,
    0
  );
};

const getCandidateTotalVotesAllNeighborhoods = (candidate: string) => {
  return Object.values(props.geojsonData.features).reduce((total, feature) => {
    const neighborhood = normalizeString(
      feature.properties.BARRIO ||
        feature.properties.texto ||
        feature.properties.zona
    );
    return (
      total +
        getCandidateVotesForNeighborhood(neighborhood).find(
          (c) => c.candidate === candidate
        )?.votes || 0
    );
  }, 0);
};

onMounted(() => {
  initializeMap();
  window.addEventListener("resize", () => {
    if (map.value) {
      map.value.invalidateSize();
    }
  });
  emit("mapInitialized");
});

watch(
  () => props.geojsonData,
  (newGeojsonData) => {
    if (newGeojsonData && map.value) {
      updateMap();
      createLegend();
    }
  },
  { immediate: true }
);

watch(() => props.geojsonData, updateMap, { deep: true });
watch(() => props.selectedLists, updateMap);
watch(() => props.selectedCandidates, updateMap);

const getMaxVotes = computed(() => {
  return Math.max(
    ...Object.values(props.geojsonData.features).map((feature) =>
      props.getVotosForNeighborhood(
        normalizeString(
          feature.properties.BARRIO ||
            feature.properties.texto ||
            feature.properties.zona
        )
      )
    )
  );
});

function getColor(votes) {
  const maxVotes =
    props.selectedCandidates.length > 0
      ? Math.max(
          ...Object.values(props.geojsonData.features).map((feature) =>
            getCandidateTotalVotes(
              normalizeString(
                feature.properties.BARRIO ||
                  feature.properties.texto ||
                  feature.properties.zona
              )
            )
          )
        )
      : getMaxVotes.value;

  if (votes === 0) {
    return "#FFFFFF";
  }

  const ratio = votes / maxVotes;

  // Create a heat map color scale using chroma.js
  const colorScale = chroma
    .scale(["#ffffb2", "#fecc5c", "#fd8d3c", "#f03b20", "#bd0026"])
    .mode("lab")
    .domain([0, 1]);

  return colorScale(ratio).hex();
}
function shadeColor(color, percent) {
  return chroma(color)
    .darken(percent / 100)
    .hex();
}

function createLegend() {
  if (!map.value || !getMaxVotes.value) return;

  // Remove existing legend if it exists
  const existingLegend = document.querySelector(".info.legend");
  if (existingLegend) {
    existingLegend.remove();
  }

  const legend = L.control({ position: "bottomright" });

  legend.onAdd = function () {
    const div = L.DomUtil.create("div", "info legend");
    const grades = [0, 0.2, 0.4, 0.6, 0.8, 1];
    const labels = [];

    for (let i = 0; i < grades.length; i++) {
      const color = getColor(grades[i] * getMaxVotes.value);
      labels.push(
        '<i style="background:' +
          color +
          '"></i> ' +
          Math.round(grades[i] * getMaxVotes.value)
      );
    }

    div.innerHTML = labels.join("<br>");
    return div;
  };

  legend.addTo(map.value);
}

const getTotalVotesForList = (list: string) => {
  return Object.values(props.votosPorListas[list] || {}).reduce(
    (a, b) => a + b,
    0
  );
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

const groupedSelectedItems = computed(() => {
  if (props.selectedCandidates.length > 0) {
    const grouped = {};
    props.selectedCandidates.forEach((candidate) => {
      const party = Object.entries(props.precandidatosByList).find(
        ([, c]) => c === candidate
      )?.[0];
      const partyName = party ? props.partiesByList[party] : "Unknown";
      if (!grouped[partyName]) {
        grouped[partyName] = { totalVotes: 0, candidates: [] };
      }
      const votes = getCandidateTotalVotesAllNeighborhoods(candidate);
      grouped[partyName].totalVotes += votes;
      grouped[partyName].candidates.push({ name: candidate, votes });
    });
    // Sort candidates within each party
    Object.values(grouped).forEach((partyData: any) => {
      partyData.candidates.sort((a, b) => b.votes - a.votes);
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
  } else {
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
    // Sort lists within each party
    Object.values(grouped).forEach((partyData: any) => {
      partyData.lists.sort((a, b) => b.votes - a.votes);
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
  }
});

const isMobileHidden = ref(true);

const toggleMobileVisibility = () => {
  isMobileHidden.value = !isMobileHidden.value;
};

onUnmounted(() => {
  if (map.value) {
    map.value.remove();
  }
});

function normalizeString(str: string): string {
  return str;
}
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
  margin-bottom: 10px;
}

.party-name {
  display: block;
  margin-bottom: 5px;
  color: #444;
  font-weight: bold;
}

.list-items,
.candidate-items {
  padding-left: 15px;
  margin: 0;
}

.list-item,
.candidate-item {
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

.tooltip-content {
  max-width: 400px;
  max-height: 300px;
  overflow-y: auto;
  font-size: 12px;
}

.tooltip-columns {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
}

.tooltip-column {
  flex: 1;
  min-width: 120px;
  padding: 0 5px;
}

.tooltip-item {
  margin-bottom: 4px;
  white-space: nowrap;
}

.tooltip-total {
  margin-top: 8px;
  font-weight: bold;
}

.scrollable-tooltip .leaflet-tooltip-content {
  max-height: 300px;
  overflow-y: auto;
}

@media (max-width: 767px) {
  .tooltip-content {
    max-width: 250px;
  }

  .tooltip-column {
    min-width: 100%;
  }
}

.candidate-list {
  list-style-type: none;
  padding: 0;
  margin: 0;
}

.candidate-item {
  margin-bottom: 15px;
}

.tooltip-content .party-list,
.tooltip-content .list-items,
.tooltip-content .candidate-items {
  margin: 0;
  padding: 0;
}

.tooltip-content .party-item {
  margin-bottom: 10px;
}

.tooltip-content .party-name {
  font-weight: bold;
  color: #444;
  margin-bottom: 5px;
}

.tooltip-content .list-items,
.tooltip-content .candidate-items {
  padding-left: 15px;
  margin: 0;
}

.tooltip-content .list-item,
.tooltip-content .candidate-item {
  margin-bottom: 3px;
  font-size: 0.9em;
  color: #666;
}

.tooltip-total {
  margin-top: 10px;
  font-weight: bold;
}

.tooltip-content .party-list,
.tooltip-content .list-items,
.tooltip-content .candidate-items {
  list-style-type: none;
  padding-left: 0;
  margin: 0;
}

.tooltip-content .party-item {
  margin-bottom: 10px;
}

.tooltip-content .party-name {
  display: block;
  margin-bottom: 5px;
  color: #444;
  font-weight: bold;
}

.tooltip-content .list-items,
.tooltip-content .candidate-items {
  padding-left: 15px;
}

.tooltip-content .list-item,
.tooltip-content .candidate-item {
  margin-bottom: 3px;
  font-size: 0.9em;
  color: #666;
}

.candidate-votes {
  font-size: 0.9em;
  color: #666;
}

.tooltip-content .party-list {
  list-style-type: none;
  padding: 0;
  margin: 0;
}

.tooltip-content .party-item {
  margin-bottom: 10px;
}

.tooltip-content .party-name {
  display: block;
  margin-bottom: 5px;
  color: #444;
  font-weight: bold;
}

.tooltip-content .list-items,
.tooltip-content .candidate-items {
  list-style-type: none;
  padding-left: 15px;
  margin: 0;
}

.tooltip-content .list-item,
.tooltip-content .candidate-item {
  margin-bottom: 3px;
  font-size: 0.9em;
  color: #666;
}

.legend {
  line-height: 18px;
  color: #555;
  background: white;
  padding: 6px 8px;
  border-radius: 5px;
}
.legend i {
  width: 18px;
  height: 18px;
  float: left;
  margin-right: 8px;
  opacity: 0.7;
}
</style>
