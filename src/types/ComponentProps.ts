export interface RegionMapProps {
  regionName: string;
  selectedLists: string[];
  votosPorListas: Record<string, Record<string, number>>;
  maxVotosPorListas: Record<string, number>;
  partiesByList: Record<string, string>;
  precandidatosByList: Record<string, string>;
  geojsonData: any;
  selectedNeighborhood: string | null;
  isODN: boolean;
  partiesAbbrev: Record<string, string>;
  selectedCandidates: string[];
  mapCenter: [number, number];
  mapZoom: number;
  currentRegion: string;
  showLegend: boolean;
  isMobileHidden: boolean;
  isLoading: boolean;
}

export interface ListSelectorProps {
  lists: string[];
  isODN: boolean;
  partiesAbbrev: Record<string, string>;
  selectedParty: string;
  partiesByList: Record<string, string>;
  precandidatosByList: Record<string, string>;
  candidates: string[];
  candidatesByParty: Record<string, string>;
  selectedLists: string[];
  selectedCandidates: string[];
}
