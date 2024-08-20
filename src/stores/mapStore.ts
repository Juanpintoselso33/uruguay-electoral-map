import { defineStore } from "pinia";
import L from "leaflet";
import chroma from "chroma-js";
import { styleFeature, getNormalizedNeighborhood } from "../utils/mapUtils";
import { useVoteCalculations } from "../composables/useVoteCalculations";
import { useVoteGrouping } from "../composables/useVoteGrouping";
import { useRegionStore } from "../stores/regionStore";

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
    partiesAbbrev: {} as Record<string, string>,
    partiesByList: {} as Record<string, string>,
    geojsonData: null as any,
    sortBy: "votes" as "votes" | "alphabetical",
    voteCalculations: {
      getVotesForNeighborhood: () => 0,
      getCandidateVotesForNeighborhood: () => ({}),
      getCandidateTotalVotes: () => 0,
      getTotalVotes: () => 0,
      getCandidateTotalVotesForAllNeighborhoods: () => 0,
      getTotalVotesForList: () => 0,
      getVotesForCandidateInNeighborhood: () => 0,
    } as ReturnType<typeof useVoteCalculations>,
  }),

  getters: {
    computedVoteCalculations: (state) => {
      const currentRegion = useRegionStore().currentRegion;
      return useVoteCalculations(
        {
          selectedCandidates: state.selectedCandidates,
          selectedLists: state.selectedLists,
          votosPorListas: state.votosPorListas,
          precandidatosByList: state.precandidatosByList,
        },
        currentRegion
      );
    },

    groupedSelectedItems: (state) => {
      const { groupedSelectedItems } = useVoteGrouping(
        {
          selectedCandidates: state.selectedCandidates,
          selectedLists: state.selectedLists,
          votosPorListas: state.votosPorListas,
          partiesByList: state.partiesByList,
          precandidatosByList: state.precandidatosByList,
        },
        state.voteCalculations || {
          getTotalVotesForList: () => 0,
          getCandidateTotalVotesForAllNeighborhoods: () => ({}),
        }
      );
      return groupedSelectedItems.value;
    },

    getMaxVotes: (state) => {
      const regionStore = useRegionStore();
      return regionStore.getMaxVotes(
        state.geojsonData,
        state.selectedCandidates,
        state.voteCalculations.getVotesForNeighborhood,
        state.voteCalculations.getCandidateTotalVotes
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
      console.log("updateMap called");
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
              this.selectedCandidates.length > 0
                ? this.voteCalculations.getCandidateTotalVotes(neighborhood)
                : this.voteCalculations.getVotesForNeighborhood(neighborhood);
            return styleFeature(
              feature,
              this.voteCalculations.getVotesForNeighborhood,
              (votes) => this.getColor(votes, maxVotes, false)
            );
          },
          onEachFeature: (feature, layer) => {
            layer.on({
              mouseover: (e) => {
                const neighborhood = getNormalizedNeighborhood(feature);
                const votes =
                  this.selectedCandidates.length > 0
                    ? this.voteCalculations.getCandidateTotalVotes(neighborhood)
                    : this.voteCalculations.getVotesForNeighborhood(
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
      const tooltipContent = `Votes: ${votes}`;
      if (this.map) {
        this.currentTooltip = L.tooltip()
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
        .mode("lab")
        .domain([0, 1]);
      return colorScale(ratio).hex();
    },

    setSelectedNeighborhood(neighborhood: string | null) {
      this.selectedNeighborhood = neighborhood;
    },

    toggleMobileVisibility() {
      this.isMobileHidden = !this.isMobileHidden;
    },

    updateMapData(data: {
      selectedCandidates: string[];
      selectedLists: string[];
      votosPorListas: Record<string, Record<string, number>>;
      precandidatosByList: Record<string, string>;
      partiesAbbrev: Record<string, string>;
      partiesByList: Record<string, string>;
    }) {
      this.selectedCandidates = data.selectedCandidates;
      this.selectedLists = data.selectedLists;
      this.votosPorListas = data.votosPorListas;
      this.precandidatosByList = data.precandidatosByList;
      this.partiesAbbrev = data.partiesAbbrev;
      this.partiesByList = data.partiesByList;
      this.voteCalculations = useVoteCalculations(
        {
          selectedCandidates: this.selectedCandidates,
          selectedLists: this.selectedLists,
          votosPorListas: this.votosPorListas,
          precandidatosByList: this.precandidatosByList,
        },
        null
      );

      this.updateMap();
    },
  },
});
