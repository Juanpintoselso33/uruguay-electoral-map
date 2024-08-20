import { defineStore } from "pinia";
import L from "leaflet";
import chroma from "chroma-js";
import { styleFeature, getNormalizedNeighborhood } from "../utils/mapUtils";
import { useVoteOperations } from "../composables/useVoteOperations";
import { useRegionStore } from "../stores/regionStore";
import { createTooltipContent } from "../utils/tooltipUtils";

export const useMapStore = defineStore("map", {
  state: () => ({
    map: null as L.Map | null,
    currentTooltip: null as L.Tooltip | null,
    selectedNeighborhood: null as string | null,
    showLegend: true,
    isMobileHidden: false,
    isLoading: false,
    selectedCandidates: [] as string[],
    selectedLists: [] as string[],
    votosPorListas: {} as Record<string, Record<string, number>>,
    precandidatosByList: {} as Record<string, string>,
    partiesByList: {} as Record<string, string>,
    geojsonData: null as any,
    sortBy: "votes" as "votes" | "alphabetical",
    voteOperations: null as ReturnType<typeof useVoteOperations> | null,
  }),

  getters: {
    computedVoteOperations: (state) => {
      const currentRegion = useRegionStore().currentRegion;
      return useVoteOperations({
        votosPorListas: currentRegion.votosPorListas || {},
        precandidatosByList: currentRegion.precandidatosByList || {},
        selectedLists: state.selectedLists,
        selectedCandidates: state.selectedCandidates,
        partiesByList: state.partiesByList,
      });
    },

    groupedSelectedItems: (state) => {
      return state.voteOperations?.groupedSelectedItems || {};
    },

    getMaxVotes: (state) => {
      const regionStore = useRegionStore();
      return regionStore.getMaxVotes(
        state.geojsonData,
        state.selectedCandidates,
        state.voteOperations?.getVotesForNeighborhood || (() => 0),
        state.voteOperations?.getCandidateTotalVotes || (() => 0)
      );
    },
  },

  actions: {
    async initializeMap(container: HTMLElement, geojsonData: any) {
      this.isLoading = true;
      if (this.map) {
        this.map.remove();
      }
      this.map = L.map(container).setView([0, 0], 2);
      this.geojsonData = geojsonData;
      await this.updateMap();
      this.isLoading = false;
      return this.map;
    },

    async updateMap() {
      this.isLoading = true;
      if (!this.map || !this.geojsonData) {
        console.log("No map or geojsonData");
        this.isLoading = false;
        return;
      }

      this.map.eachLayer((layer) => {
        if (layer instanceof L.GeoJSON) {
          this.map.removeLayer(layer);
        }
      });

      const maxVotes = this.getMaxVotes;
      return new Promise<void>((resolve) => {
        L.geoJSON(this.geojsonData, {
          style: (feature) => {
            if (!feature) return {};
            const neighborhood = getNormalizedNeighborhood(feature);
            const votes =
              this.computedVoteOperations.getVotesForNeighborhood(neighborhood);
            const color = this.getColor(votes, maxVotes, false);
            return {
              fillColor: color,
              weight: 2,
              opacity: 1,
              color: "black",
              fillOpacity: 0.7,
            };
          },
          onEachFeature: (feature, layer) => {
            layer.on({
              mouseover: (e) => {
                const neighborhood = getNormalizedNeighborhood(feature);
                const votes =
                  this.computedVoteOperations.getVotesForNeighborhood(
                    neighborhood
                  );
                this.handleFeatureMouseover(e, votes);
              },
              mouseout: this.handleFeatureMouseout,
              click: (e) => this.handleFeatureClick(e),
            });
          },
        }).addTo(this.map);

        this.fitMapToBounds();
        this.isLoading = false;
        resolve();
      });
    },

    fitMapToBounds() {
      if (this.map && this.geojsonData) {
        const geojsonLayer = L.geoJSON(this.geojsonData);
        const bounds = geojsonLayer.getBounds();
        this.map.fitBounds(bounds);
      }
    },

    handleFeatureMouseover(e: L.LeafletMouseEvent, votes: number) {
      const layer = e.target;
      const neighborhood = getNormalizedNeighborhood(layer.feature);
      const regionStore = useRegionStore();

      const tooltipContent = createTooltipContent(
        neighborhood,
        votes,
        regionStore.selectedCandidates,
        regionStore.selectedLists,
        regionStore.currentRegion.partiesAbbrev || {},
        regionStore.groupedSelectedItems,
        this.computedVoteOperations,
        this.sortBy
      );

      if (this.map) {
        this.currentTooltip = L.tooltip({
          permanent: false,
          direction: "top",
          className: "custom-tooltip",
        })
          .setLatLng(e.latlng)
          .setContent(tooltipContent)
          .openOn(this.map);
      }
    },

    handleFeatureMouseout() {
      if (this.map && this.currentTooltip) {
        this.map.closeTooltip(this.currentTooltip);
        this.currentTooltip = null;
      }
    },

    handleFeatureClick(e: L.LeafletMouseEvent) {
      const layer = e.target;
      const neighborhood = getNormalizedNeighborhood(layer.feature);
      this.setSelectedNeighborhood(neighborhood);
    },

    getColor(votes: number, maxVotes: number, isCandidate: boolean): string {
      if (votes === 0 || maxVotes === 0) {
        return "#FFFFFF";
      }
      const ratio = votes / maxVotes;
      const colorScale = chroma
        .scale(
          isCandidate
            ? ["#e6f2ff", "#0066cc"]
            : [
                "#ffffcc",
                "#ffeda0",
                "#fed976",
                "#feb24c",
                "#fd8d3c",
                "#fc4e2a",
                "#e31a1c",
                "#b10026",
              ]
        )
        .mode("lab");
      return colorScale(ratio).hex();
    },

    setSelectedNeighborhood(neighborhood: string | null) {
      this.selectedNeighborhood = neighborhood;
    },

    toggleMobileVisibility() {
      this.isMobileHidden = !this.isMobileHidden;
    },

    updateMapData() {
      const regionStore = useRegionStore();
      this.selectedCandidates = regionStore.selectedCandidates;
      this.selectedLists = regionStore.selectedLists;
      this.votosPorListas = regionStore.currentRegion.votosPorListas || {};
      this.precandidatosByList =
        regionStore.currentRegion.precandidatosByList || {};
      this.partiesAbbrev = regionStore.currentRegion.partiesAbbrev || {};
      this.partiesByList = regionStore.currentRegion.partiesByList || {};

      // Force a recomputation of computedVoteOperations
      this.voteOperations = useVoteOperations({
        votosPorListas: this.votosPorListas,
        precandidatosByList: this.precandidatosByList,
        selectedLists: this.selectedLists,
        selectedCandidates: this.selectedCandidates,
        partiesByList: this.partiesByList,
      });

      // Update the map
      this.updateMap();
    },
  },
});
