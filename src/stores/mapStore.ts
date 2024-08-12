import { defineStore } from "pinia";
import L from "leaflet";
import chroma from "chroma-js"; // Ensure this import is correct

import { getNormalizedNeighborhood } from "../utils/mapUtils";

export const useMapStore = defineStore("map", {
  state: () => ({
    map: null as L.Map | null,
    currentTooltip: null as L.Tooltip | null,
    selectedNeighborhood: null as string | null,
    showLegend: true,
    isMobileHidden: false,
  }),
  actions: {
    initializeMap(
      container: HTMLElement,
      center: [number, number],
      zoom: number
    ) {
      if (this.map) {
        this.map.remove();
      }
      this.map = L.map(container, {
        center,
        zoom,
        layers: [],
        zoomControl: false,
        attributionControl: false,
      });
    },
    updateMap(
      geojsonData: any,
      styleFunction: L.StyleFunction,
      onEachFeature: (feature: GeoJSON.Feature, layer: L.Layer) => void
    ) {
      if (this.map && geojsonData) {
        this.map.eachLayer((layer) => {
          if (layer instanceof L.GeoJSON && this.map) {
            this.map.removeLayer(layer);
          }
        });

        L.geoJSON(geojsonData, {
          style: styleFunction,
          onEachFeature,
        }).addTo(this.map);
      }
    },
    fitMapToBounds(geojsonData: any) {
      if (this.map && geojsonData) {
        const geojsonLayer = L.geoJSON(geojsonData);
        const bounds = geojsonLayer.getBounds();
        this.map.fitBounds(bounds);
      }
    },
    closeTooltip() {
      if (this.map && this.currentTooltip) {
        console.log("Closing tooltip");
        this.map.closeTooltip(this.currentTooltip);
        this.currentTooltip = null;
      }
    },
    setSelectedNeighborhood(neighborhood: string | null) {
      this.selectedNeighborhood = neighborhood;
    },
    toggleMobileVisibility() {
      this.isMobileHidden = !this.isMobileHidden;
    },
    getColor(votes: number, maxVotes: number): string {
      if (votes === 0 || maxVotes === 0) {
        return "#FFFFFF";
      }
      const ratio = votes / maxVotes;
      const colorScale = chroma
        .scale(["#ffffb2", "#fecc5c", "#fd8d3c", "#f03b20", "#bd0026"])
        .mode("lab")
        .domain([0, 1]);
      return colorScale(ratio).hex();
    },
  },

  getters: {
    getMaxVotes:
      (state) =>
      (
        geojsonData: any,
        selectedCandidates: string[],
        getVotosForNeighborhood: Function,
        getCandidateTotalVotes: Function
      ) => {
        if (!geojsonData || !geojsonData.features) {
          return 0;
        }
        return selectedCandidates.length > 0
          ? Math.max(
              ...geojsonData.features.map((feature: any) =>
                getCandidateTotalVotes(getNormalizedNeighborhood(feature))
              )
            )
          : Math.max(
              ...geojsonData.features.map((feature: any) =>
                getVotosForNeighborhood(getNormalizedNeighborhood(feature))
              )
            );
      },
  },
});
