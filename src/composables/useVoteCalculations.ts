import { computed } from "vue";
import { Region } from "../types/Region";

export function useVoteCalculations(region: Region) {
  const getVotesForNeighborhood = (neighborhood: string, list?: string) => {
    if (!region.votosPorListas) return 0;

    if (list) {
      return region.votosPorListas[list]?.[neighborhood] || 0;
    }

    return Object.values(region.votosPorListas).reduce((total, listVotes) => {
      return total + (listVotes[neighborhood] || 0);
    }, 0);
  };

  const getTotalVotesForList = (list: string) => {
    if (!region.votosPorListas || !region.votosPorListas[list]) return 0;

    return Object.values(region.votosPorListas[list]).reduce(
      (total, votes) => total + votes,
      0
    );
  };

  const getCandidateTotalVotes = (candidate: string) => {
    if (!region.votosPorListas || !region.precandidatosByList) return 0;

    const candidateLists = Object.entries(region.precandidatosByList)
      .filter(([, precandidato]) => precandidato === candidate)
      .map(([list]) => list);

    return candidateLists.reduce((total, list) => {
      return total + getTotalVotesForList(list);
    }, 0);
  };

  const getVotesForCandidateInNeighborhood = (
    candidate: string,
    neighborhood: string
  ) => {
    if (!region.votosPorListas || !region.precandidatosByList) return 0;

    const candidateLists = Object.entries(region.precandidatosByList)
      .filter(([, precandidato]) => precandidato === candidate)
      .map(([list]) => list);

    return candidateLists.reduce((total, list) => {
      return total + getVotesForNeighborhood(neighborhood, list);
    }, 0);
  };

  const getTotalVotes = (
    selectedLists: string[],
    selectedCandidates: string[]
  ) => {
    if (selectedCandidates.length > 0) {
      return selectedCandidates.reduce((total, candidate) => {
        return total + getCandidateTotalVotes(candidate);
      }, 0);
    } else {
      return selectedLists.reduce((total, list) => {
        return total + getTotalVotesForList(list);
      }, 0);
    }
  };

  return {
    getVotesForNeighborhood,
    getTotalVotesForList,
    getCandidateTotalVotes,
    getVotesForCandidateInNeighborhood,
    getTotalVotes,
  };
}
