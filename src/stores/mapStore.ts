import { defineStore } from "pinia";
import L from "leaflet";
import chroma from "chroma-js";
import { styleFeature, getNormalizedNeighborhood } from "../utils/mapUtils";
import { useVoteCalculations } from "../composables/useVoteCalculations";
import { useVoteGrouping } from "../composables/useVoteGrouping";

export const useMapStore = defineStore("map", {
  state: () => ({
    map: null as L.Map | null,
    currentTooltip: null as L.Tooltip | null,
    selectedNeighborhood: null as string | null,
    showLegend: true,
    isMobileHidden: false,
    isLoading: false,
    selectedCandidates: [] as string[],
    partiesAbbrev: {} as Record<string, string>,
    votosPorListas: {} as Record<string, Record<string, number>>,
    precandidatosByList: {} as Record<string, string>,
    sortBy: "votes" as "votes" | "alphabetical",
  }),
  getters: {
    voteCalculations: (state) =>
      useVoteCalculations(
        {
          votosPorListas: state.votosPorListas,
          precandidatosByList: state.precandidatosByList,
        },
        null
      ),
    groupedSelectedItems: (state) => {
      const { groupSelectedItems } = useVoteGrouping(
        {
          selectedCandidates: state.selectedCandidates,
          votosPorListas: state.votosPorListas,
          precandidatosByList: state.precandidatosByList,
        },
        state.voteCalculations
      );
      return groupSelectedItems();
    },
  },
  actions: {
    async initializeMap(container: HTMLElement, geojsonData: any, props: any) {
      this.isLoading = true;
      if (this.map) {
        this.map.remove();
      }
      this.map = L.map(container).setView([0, 0], 2);
      await this.updateMap(geojsonData, props);
      this.isLoading = false;
      return this.map;
    },

    setMap(newMap: L.Map | null) {
      this.map = newMap;
    },

    async updateMap(geojsonData: any, props: any) {
      this.isLoading = true;
      if (!this.map) {
        this.isLoading = false;
        return;
      }

      this.map.eachLayer((layer) => {
        if (layer instanceof L.GeoJSON) {
          this.map.removeLayer(layer);
        }
      });

      const { getVotesForNeighborhood } = this.voteCalculations;
      const maxVotes = this.getMaxVotes(
        geojsonData,
        this.selectedCandidates,
        getVotesForNeighborhood,
        this.voteCalculations.getCandidateTotalVotes
      );

      return new Promise<void>((resolve) => {
        L.geoJSON(geojsonData, {
          style: (feature) =>
            styleFeature(feature, getVotesForNeighborhood, (votes) =>
              this.getColor(votes, maxVotes, false)
            ),
          onEachFeature: (feature, layer) => {
            layer.on({
              mouseover: (e) =>
                this.handleFeatureMouseover(e, getVotesForNeighborhood),
              mouseout: this.handleFeatureMouseout,
            });
          },
        }).addTo(this.map);

        this.fitMapToBounds(geojsonData);
        this.isLoading = false;
        resolve();
      });
    },

    fitMapToBounds(geojsonData: any) {
      if (this.map && geojsonData) {
        const geojsonLayer = L.geoJSON(geojsonData);
        const bounds = geojsonLayer.getBounds();
        this.map.fitBounds(bounds);
      }
    },

    handleFeatureMouseover(
      e: L.LeafletMouseEvent,
      getVotesForNeighborhood: Function
    ) {
      const layer = e.target;
      const votes = getVotesForNeighborhood(
        getNormalizedNeighborhood(layer.feature)
      );
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

    getMaxVotes(
      geojsonData: any,
      selectedCandidates: string[],
      getVotesForNeighborhood: Function,
      getCandidateTotalVotes: Function
    ): number {
      if (!geojsonData || !geojsonData.features) {
        return 1;
      }
      return selectedCandidates.length > 0
        ? Math.max(
            ...geojsonData.features.map((feature: any) =>
              getCandidateTotalVotes(getNormalizedNeighborhood(feature))
            )
          )
        : Math.max(
            ...geojsonData.features.map((feature: any) =>
              getVotesForNeighborhood(getNormalizedNeighborhood(feature))
            )
          );
    },

    closeTooltip() {
      if (this.map && this.currentTooltip) {
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
  },
});
