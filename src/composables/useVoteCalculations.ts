import { getTotalVotesForList } from "../utils/mapUtils";

export function useVoteCalculations(props, currentRegion) {
  const getVotesForNeighborhood = (neighborhood: string): number => {
    console.log("Calculating votes for neighborhood:", neighborhood);

    if (props.selectedCandidates.length > 0) {
      const candidateVotes = getCandidateTotalVotes(neighborhood);
      console.log("Votes for candidates in neighborhood:", candidateVotes);
      return candidateVotes;
    } else {
      const totalVotes = props.selectedLists.reduce((total, list) => {
        const listVotes = props.votosPorListas[list]?.[neighborhood] || 0;
        console.log(
          `Votes for list ${list} in neighborhood ${neighborhood}:`,
          listVotes
        );
        return total + listVotes;
      }, 0);
      console.log("Total votes for lists in neighborhood:", totalVotes);
      return totalVotes;
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
    console.log(
      "Calculating votes for candidate:",
      candidate,
      "in neighborhood:",
      neighborhood
    );

    const candidateLists = Object.entries(props.precandidatosByList)
      .filter(([, precandidato]) => precandidato === candidate)
      .map(([list]) => list);

    console.log("Candidate lists:", candidateLists);

    const votes = candidateLists.reduce((total, list) => {
      const neighborhoodVotes = props.votosPorListas[list]?.[neighborhood] || 0;
      console.log(
        `Votes for ${candidate} in ${neighborhood} from list ${list}:`,
        neighborhoodVotes
      );
      return total + neighborhoodVotes;
    }, 0);

    console.log(
      "Total votes for candidate:",
      candidate,
      "in neighborhood:",
      neighborhood,
      "is:",
      votes
    );
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
