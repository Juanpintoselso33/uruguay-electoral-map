export function useVoteCalculations(props, currentRegion) {
  // Calculate total votes for a neighborhood based on selected candidates or lists
  const getVotesForNeighborhood = (
    neighborhood: string,
    list?: string
  ): number => {
    if (props.selectedCandidates.length > 0) {
      return getCandidateTotalVotes(neighborhood);
    } else if (list) {
      return props.votosPorListas[list]?.[neighborhood] || 0;
    } else {
      const selectedLists = Array.isArray(props.selectedLists)
        ? props.selectedLists
        : [];
      return selectedLists.reduce((total, list) => {
        return total + (props.votosPorListas[list]?.[neighborhood] || 0);
      }, 0);
    }
  };

  // Get votes for each selected candidate in a specific neighborhood
  const getCandidateVotesForNeighborhood = (
    neighborhood: string
  ): Record<string, number> => {
    const votes: Record<string, number> = {};
    props.selectedCandidates.forEach((candidate) => {
      votes[candidate] = getVotesForCandidateInNeighborhood(
        candidate,
        neighborhood
      );
    });
    return votes;
  };

  // Calculate votes for a single candidate in a specific neighborhood
  const getVotesForCandidateInNeighborhood = (
    candidate: string,
    neighborhood: string
  ): number => {
    const candidateLists = Object.entries(props.precandidatosByList)
      .filter(([, precandidato]) => precandidato === candidate)
      .map(([list]) => list);

    return candidateLists.reduce((total, list) => {
      return total + (props.votosPorListas[list]?.[neighborhood] || 0);
    }, 0);
  };

  // Calculate total votes for all selected candidates in a specific neighborhood
  const getCandidateTotalVotes = (neighborhood: string): number => {
    return props.selectedCandidates.reduce((total, candidate) => {
      return (
        total + getVotesForCandidateInNeighborhood(candidate, neighborhood)
      );
    }, 0);
  };

  // Calculate total votes for a candidate across all neighborhoods
  const getCandidateTotalVotesForAllNeighborhoods = (
    candidate: string
  ): number => {
    const candidateLists = Object.entries(props.precandidatosByList)
      .filter(([, precandidato]) => precandidato === candidate)
      .map(([list]) => list);

    return candidateLists.reduce((total, list) => {
      const listVotes =
        (props.votosPorListas[list] as Record<string, number>) || {};
      return (
        total + Object.values(listVotes).reduce((sum, votes) => sum + votes, 0)
      );
    }, 0);
  };

  // Calculate total votes for a list across all neighborhoods
  const getTotalVotesForList = (
    votosPorListas: Record<string, Record<string, number>>,
    list: string
  ): number => {
    if (!votosPorListas[list]) {
      return 0;
    }
    return Object.values(votosPorListas[list]).reduce((a, b) => a + b, 0);
  };

  // Calculate total votes for all selected candidates or lists
  const getTotalVotes = (): number => {
    if (props.selectedCandidates.length > 0) {
      return props.selectedCandidates.reduce((total, candidate) => {
        return total + getCandidateTotalVotesForAllNeighborhoods(candidate);
      }, 0);
    } else {
      return props.selectedLists.reduce((total, list) => {
        return total + getTotalVotesForList(props.votosPorListas, list);
      }, 0);
    }
  };

  return {
    getVotesForNeighborhood,
    getCandidateVotesForNeighborhood,
    getCandidateTotalVotes,
    getTotalVotes,
    getCandidateTotalVotesForAllNeighborhoods,
    getTotalVotesForList,
    getVotesForCandidateInNeighborhood,
  };
}
