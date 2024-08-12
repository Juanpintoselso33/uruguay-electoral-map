import {
  getTotalVotesForList,
  getCandidateTotalVotesAllNeighborhoods,
} from "../utils/mapUtils";

export function useVoteCalculations(props, currentRegion) {
  const getVotesForNeighborhood = (neighborhood: string): number => {
    if (props.selectedCandidates.length > 0) {
      return getCandidateTotalVotes(neighborhood);
    } else {
      return props.selectedLists.reduce((total, list) => {
        return total + (props.votosPorListas[list]?.[neighborhood] || 0);
      }, 0);
    }
  };

  const getCandidateVotesForNeighborhood = (neighborhood: string) => {
    return props.selectedCandidates.map((candidate) => {
      const candidateLists = Object.entries(props.precandidatosByList)
        .filter(([, precandidato]) => precandidato === candidate)
        .map(([list]) => list);

      const votes = candidateLists.reduce((total, list) => {
        return total + (props.votosPorListas[list]?.[neighborhood] || 0);
      }, 0);

      const party = Object.entries(props.precandidatosByList).find(
        ([, c]) => c === candidate
      )?.[0];
      const partyName = party ? props.partiesByList[party] : "Unknown";
      const partyAbbrev = props.partiesAbbrev[partyName] || partyName;
      return { candidate, votes, party: partyAbbrev };
    });
  };

  const getCandidateTotalVotes = (neighborhood: string): number => {
    return props.selectedCandidates.reduce((total, candidate) => {
      const candidateVotes = props.votosPorListas[candidate] || {};
      return total + (candidateVotes[neighborhood] || 0);
    }, 0);
  };

  const getTotalVotes = (): number => {
    if (props.selectedCandidates.length > 0) {
      return props.selectedCandidates.reduce((total, candidate) => {
        return (
          total +
          getCandidateTotalVotesAllNeighborhoods(
            currentRegion.value.geojsonData,
            getCandidateVotesForNeighborhood,
            candidate
          )
        );
      }, 0);
    } else {
      return props.selectedLists.reduce(
        (total, list) =>
          total + getTotalVotesForList(props.votosPorListas, list),
        0
      );
    }
  };

  return {
    getVotesForNeighborhood,
    getCandidateVotesForNeighborhood,
    getCandidateTotalVotes,
    getTotalVotes,
  };
}
