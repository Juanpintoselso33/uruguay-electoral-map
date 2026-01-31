import { computed, type ComputedRef } from 'vue';
import chroma from 'chroma-js';
import type { GeoJSON } from 'geojson';

export interface CandidateVote {
  candidate: string;
  votes: number;
  party: string;
}

export interface ListVote {
  number: string;
  votes: number;
}

export interface GroupedCandidates {
  [party: string]: { candidate: string; votes: number }[];
}

export interface GroupedLists {
  [party: string]: ListVote[];
}

export interface UseMapInteractionProps {
  geojsonData: ComputedRef<any>;
  selectedLists: ComputedRef<string[]>;
  selectedCandidates: ComputedRef<string[]>;
  votosPorListas: ComputedRef<Record<string, Record<string, number>>>;
  partiesByList: ComputedRef<Record<string, string>>;
  precandidatosByList: ComputedRef<Record<string, string>>;
  partiesAbbrev: ComputedRef<Record<string, string>>;
  getVotosForNeighborhood: ComputedRef<(neighborhood: string) => number>;
}

export function useMapInteraction(props: UseMapInteractionProps) {
  const normalizeString = (str: string): string => {
    return str;
  };

  const getCandidateVotesForNeighborhood = (neighborhood: string): CandidateVote[] => {
    return props.selectedCandidates.value.map((candidate) => {
      let votes = 0;
      const candidateLists = Object.entries(props.precandidatosByList.value)
        .filter(([, precandidato]) => precandidato === candidate)
        .map(([list]) => list);

      candidateLists.forEach((list) => {
        const listVotes = props.votosPorListas.value[list]?.[neighborhood] || 0;
        votes += listVotes;
      });

      const party = Object.entries(props.precandidatosByList.value).find(
        ([, c]) => c === candidate
      )?.[0];
      const partyName = party ? props.partiesByList.value[party] : 'Unknown';
      const partyAbbrev = props.partiesAbbrev.value[partyName] || partyName;
      return { candidate, votes, party: partyAbbrev };
    });
  };

  const getCandidateTotalVotes = (neighborhood: string): number => {
    return getCandidateVotesForNeighborhood(neighborhood).reduce(
      (total, { votes }) => total + votes,
      0
    );
  };

  const getCandidateTotalVotesAllNeighborhoods = (candidate: string): number => {
    return Object.values(props.geojsonData.value.features).reduce(
      (total: number, feature: any) => {
        const neighborhood = normalizeString(
          feature.properties.BARRIO ||
            feature.properties.texto ||
            feature.properties.zona
        );
        const candidateVotes = getCandidateVotesForNeighborhood(neighborhood);
        const candidateVote = candidateVotes.find(
          (c) => c.candidate === candidate
        );
        return total + (candidateVote?.votes || 0);
      },
      0
    );
  };

  const groupCandidatesByParty = (
    candidateVotes: CandidateVote[]
  ): GroupedCandidates => {
    const grouped: GroupedCandidates = {};
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

  const groupListsByParty = (neighborhood: string): GroupedLists => {
    const grouped: GroupedLists = {};
    props.selectedLists.value.forEach((list) => {
      const party = props.partiesByList.value[list];
      const votes = props.votosPorListas.value[list]?.[neighborhood] || 0;
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

  const getMaxVotes = computed(() => {
    if (!props.geojsonData.value || !props.geojsonData.value.features) {
      return 0;
    }
    return Math.max(
      ...props.geojsonData.value.features.map((feature: any) =>
        props.getVotosForNeighborhood.value(
          normalizeString(
            feature.properties.BARRIO ||
              feature.properties.texto ||
              feature.properties.zona
          )
        )
      )
    );
  });

  const getColor = (votes: number): string => {
    if (!props.geojsonData.value || !props.geojsonData.value.features) {
      return '#FFFFFF';
    }

    const maxVotes =
      props.selectedCandidates.value.length > 0
        ? Math.max(
            ...props.geojsonData.value.features.map((feature: any) =>
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

    if (votes === 0 || maxVotes === 0) {
      return '#FFFFFF';
    }

    const ratio = votes / maxVotes;

    // Create a heat map color scale using chroma.js
    const colorScale = chroma
      .scale(['#ffffb2', '#fecc5c', '#fd8d3c', '#f03b20', '#bd0026'])
      .mode('lab')
      .domain([0, 1]);

    return colorScale(ratio).hex();
  };

  const shadeColor = (color: string, percent: number): string => {
    return chroma(color)
      .darken(percent / 100)
      .hex();
  };

  const getTotalVotesForList = (list: string): number => {
    return Object.values(props.votosPorListas.value[list] || {}).reduce(
      (a, b) => a + b,
      0
    );
  };

  return {
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
  };
}
