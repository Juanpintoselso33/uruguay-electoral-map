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
    const votes: Record<string, number> = {};
    props.selectedCandidates.forEach((candidate) => {
      votes[candidate] = getVotesForCandidateInNeighborhood(
        candidate,
        neighborhood
      );
    });
    return votes;
  };

  const getVotesForCandidateInNeighborhood = (
    candidate: string,
    neighborhood: string
  ) => {
    const candidateLists = Object.entries(props.precandidatosByList)
      .filter(([, precandidato]) => precandidato === candidate)
      .map(([list]) => list);

    const votes = candidateLists.reduce((total, list) => {
      return total + (props.votosPorListas[list]?.[neighborhood] || 0);
    }, 0);

    return votes;
  };

  const getCandidateTotalVotes = (neighborhood: string): number => {
    return props.selectedCandidates.reduce((total, candidate) => {
      const candidateVotes = props.votosPorListas[candidate] || {};
      return total + (candidateVotes[neighborhood] || 0);
    }, 0);
  };

  const getCandidateTotalVotesForAllNeighborhoods = (
    candidate: string
  ): number => {
    const candidateLists = Object.entries(props.precandidatosByList)
      .filter(([, precandidato]) => precandidato === candidate)
      .map(([list]) => list);

    return candidateLists.reduce((total, list) => {
      const listVotes = props.votosPorListas[list] || {};
      return (
        total + Object.values(listVotes).reduce((sum, votes) => sum + votes, 0)
      );
    }, 0);
  };

  const getTotalVotes = (): number => {
    if (props.selectedCandidates.length > 0) {
      return props.selectedCandidates.reduce((total, candidate) => {
        return total + getCandidateTotalVotesForAllNeighborhoods(candidate);
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
    getCandidateTotalVotesForAllNeighborhoods,
  };
}
