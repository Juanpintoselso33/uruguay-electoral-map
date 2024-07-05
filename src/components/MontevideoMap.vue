<template>
  <div class="montevideo-map-wrapper">
    <div class="montevideo-map" ref="mapContainer"></div>
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
}>();

const mapContainer = ref(null);
const selectedNeighborhood = ref(null);
let map: L.Map | null = null;

const sheetNumbers = computed(() => props.selectedLists);

const getVotosForNeighborhood = (neighborhood: string) => {
  return sheetNumbers.value.reduce((acc, sheetNumber) => {
    return acc + (props.votosPorListas[sheetNumber]?.[neighborhood] || 0);
  }, 0);
};

const initializeMap = () => {
  if (mapContainer.value && !map) {
    const isMobile = window.innerWidth < 768;
    map = L.map(mapContainer.value, {
      center: [-34.8211, -56.225],
      zoom: 11.5,
      layers: [],
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: isMobile,
      doubleClickZoom: isMobile,
      boxZoom: isMobile,
      keyboard: isMobile,
      dragging: isMobile,
      touchZoom: isMobile,
    });

    if (isMobile) {
      // Add zoom control to the bottom right corner for mobile devices
      L.control
        .zoom({
          position: "bottomright",
        })
        .addTo(map);
    }

    fetch("/v_sig_barrios.json")
      .then((response) => response.json())
      .then((geojsonData) => {
        L.geoJSON(geojsonData, {
          style: (feature) => styleFeature(feature),
          onEachFeature: onEachFeature,
        }).addTo(map!);
      })
      .catch((error) =>
        console.error("Error al cargar el archivo GeoJSON:", error)
      );
  }
};

const styleFeature = (feature) => {
  if (!feature) return {};
  const neighborhood = feature.properties.BARRIO;
  const votes = getVotosForNeighborhood(neighborhood);
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
      const votes = getVotosForNeighborhood(neighborhood);
      const currentColor = getColor(votes);
      const darkerColor = shadeColor(currentColor, -20);
      (layer as L.Path).setStyle({
        fillColor: darkerColor,
        fillOpacity: 0.5,
      });

      const tooltipContent = sheetNumbers.value
        .map((sheetNumber) => {
          const listVotes =
            props.votosPorListas[sheetNumber]?.[neighborhood] || 0;
          return `Lista ${sheetNumber}: ${listVotes} votos`;
        })
        .join("<br>");

      const totalVotes =
        sheetNumbers.value.length > 1
          ? `<br><strong>Total: ${votes} votos</strong>`
          : "";

      layer
        .bindTooltip(
          `<strong>${neighborhood}</strong><br>${tooltipContent}${totalVotes}`,
          {
            permanent: false,
            direction: "auto",
            className: "neighborhood-label",
          }
        )
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
  () => props.selectedLists,
  () => {
    if (map) {
      map.eachLayer((layer) => {
        if (layer instanceof L.GeoJSON) {
          layer.setStyle(styleFeature);
        }
      });
    }
  },
  { deep: true }
);

function getColor(votes) {
  const totalVotes = votes;
  if (totalVotes === 0) {
    return "#FFFFFF"; // Blanco para 0 votos
  }

  let color;

  switch (true) {
    case totalVotes <= 100:
      color = "#FFF3E0"; // Naranja muy claro
      break;

    case totalVotes <= 200:
      color = "#FFE0B2"; // Naranja claro
      break;
    case totalVotes <= 300:
      color = "#FFD54F"; // Naranja medio
      break;
    case totalVotes <= 400:
      color = "#FFCC80"; // Naranja medio
      break;
    case totalVotes <= 500:
      color = "#FFC107"; // Naranja medio
      break;
    case totalVotes <= 600:
      color = "#FFA72C"; // Naranja medio
      break;
    case totalVotes <= 800:
      color = "#FF9800"; // Naranja medio
      break;
    case totalVotes <= 900:
      color = "#FF8A65"; // Naranja medio
      break;

    case totalVotes <= 1000:
      color = "#FF7043"; // Naranja medio
      break;
    case totalVotes <= 1200:
      color = "#FF6E6E"; // Naranja un poco más oscuro
      break;
    case totalVotes <= 1600:
      color = "#FF5722"; // Naranja oscuro
      break;
    case totalVotes <= 2000:
      color = "#FF4500"; // Naranja muy oscuro
      break;
    default:
      // Interpolación de naranja muy oscuro a violeta oscuro
      const ratio = (totalVotes - 2000) / 2000;
      const interpolateColor = (startColor, endColor, ratio) => {
        const hex = (x) => {
          x = x.toString(16);
          return x.length === 1 ? "0" + x : x;
        };
        const interpolate = (start, end, ratio) =>
          Math.ceil(
            parseInt(start, 16) * (1 - ratio) + parseInt(end, 16) * ratio
          );
        const r = interpolate("E6", "4B", ratio);
        const g = interpolate("51", "00", ratio);
        const b = interpolate("00", "82", ratio);
        return `#${hex(r)}${hex(g)}${hex(b)}`;
      };
      color = interpolateColor("#E65100", "#4B0082", Math.min(ratio, 1));
      break;
  }

  return color;
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
</script>

<style scoped>
.montevideo-map-wrapper {
  width: 100%;
  height: 100%;
}

.montevideo-map {
  width: 100%;
  height: 100%;
  background-color: white;
}

.neighborhood-info {
  position: absolute;
  top: 10px;
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
</style>
