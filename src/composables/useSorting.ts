import { computed } from "vue";

export function useSorting(props: any) {
  // Sort lists by vote count (descending order)
  const sortListsByVotes = computed(() => {
    return (lists: string[]) => {
      return [...lists].sort((a, b) => {
        const votesA = getTotalVotesForList(props.votosPorListas, a);
        const votesB = getTotalVotesForList(props.votosPorListas, b);
        return votesB - votesA;
      });
    };
  });

  // Sort lists alphabetically
  const sortListsAlphabetically = computed(() => {
    return (lists: string[]) => {
      return [...lists].sort((a, b) => a.localeCompare(b));
    };
  });

  // Sort candidates by vote count (descending order)
  const sortCandidatesByVotes = computed(() => {
    return (candidates: string[]) => {
      return [...candidates].sort((a, b) => {
        const votesA = getCandidateTotalVotesForAllNeighborhoods(a);
        const votesB = getCandidateTotalVotesForAllNeighborhoods(b);
        return votesB - votesA;
      });
    };
  });

  // Sort candidates alphabetically
  const sortCandidatesAlphabetically = computed(() => {
    return (candidates: string[]) => {
      return [...candidates].sort((a, b) => a.localeCompare(b));
    };
  });

  // Helper function to get total votes for a list
  const getTotalVotesForList = (
    votosPorListas: Record<string, Record<string, number>>,
    list: string
  ): number => {
    if (!votosPorListas[list]) {
      return 0;
    }
    return Object.values(votosPorListas[list]).reduce((a, b) => a + b, 0);
  };

  // Helper function to get total votes for a candidate
  const getCandidateTotalVotesForAllNeighborhoods = (
    candidate: string
  ): number => {
    const candidateLists = Object.entries(props.precandidatosByList)
      .filter(([, precandidato]) => precandidato === candidate)
      .map(([list]) => list);

    return candidateLists.reduce((total, list) => {
      const listVotes =
        props.votosPorListas[list] || ({} as Record<string, number>);
      return (
        total +
        Object.values(listVotes as Record<string, number>).reduce(
          (sum, votes) => sum + votes,
          0
        )
      );
    }, 0);
  };

  return {
    sortListsByVotes,
    sortListsAlphabetically,
    sortCandidatesByVotes,
    sortCandidatesAlphabetically,
  };
}
