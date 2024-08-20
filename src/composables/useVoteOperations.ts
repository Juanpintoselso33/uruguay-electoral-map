import { computed } from "vue";
import { GroupedCandidates, GroupedLists, PartyData } from "../types/VoteTypes";
import { useRegionStore } from "../stores/regionStore";

interface VoteCalculationsProps {
  votosPorListas: Record<string, Record<string, number>>;
  precandidatosByList: Record<string, string>;
  selectedLists: string[];
  selectedCandidates: string[];
  partiesByList: Record<string, string>;
}

export function useVoteOperations({
  votosPorListas,
  precandidatosByList,
  selectedLists,
  selectedCandidates,
  partiesByList,
}: VoteCalculationsProps) {
  const regionStore = useRegionStore();

  const getTotalVotes = (
    selectedLists: string[] = [],
    selectedCandidates: string[] = []
  ) => {
    if (selectedCandidates.length > 0) {
      return selectedCandidates.reduce((total, candidate) => {
        return total + getCandidateTotalVotes(candidate);
      }, 0);
    } else if (selectedLists.length > 0) {
      return selectedLists.reduce((total, list) => {
        return total + getTotalVotesForList(list);
      }, 0);
    }
    return 0;
  };

  const getTotalVotesForList = (list: string) => {
    if (!votosPorListas || !votosPorListas[list]) return 0;

    return Object.values(votosPorListas[list]).reduce(
      (total, votes) => total + votes,
      0
    );
  };

  const getVotesForNeighborhood = (neighborhood: string, list?: string) => {
    if (!votosPorListas) return 0;

    if (list) {
      return votosPorListas[list]?.[neighborhood] || 0;
    }

    return Object.values(votosPorListas).reduce((total, listVotes) => {
      return total + (listVotes[neighborhood] || 0);
    }, 0);
  };

  const getCandidateTotalVotes = (candidate: string) => {
    if (!votosPorListas || !precandidatosByList) return 0;

    const candidateLists = Object.entries(precandidatosByList)
      .filter(([, precandidato]) => precandidato === candidate)
      .map(([list]) => list);

    // Usar un conjunto para evitar contar listas duplicadas
    const countedLists = new Set();

    return candidateLists.reduce((total, list) => {
      if (!countedLists.has(list)) {
        countedLists.add(list); // Marcar la lista como contada
        return total + getTotalVotesForList(list);
      }
      return total; // Si ya se contó, no sumar
    }, 0);
  };

  const getVotesForCandidateInNeighborhood = (
    candidate: string,
    neighborhood: string
  ) => {
    console.log(
      `DEBUG: getVotesForCandidateInNeighborhood called for ${candidate} in ${neighborhood}`
    );
    if (!votosPorListas || !precandidatosByList) {
      console.log("DEBUG: votosPorListas or precandidatosByList is undefined");
      return 0;
    }

    const candidateLists = Object.entries(precandidatosByList)
      .filter(([, precandidato]) => precandidato === candidate)
      .map(([list]) => list);

    console.log(`DEBUG: Candidate lists for ${candidate}:`, candidateLists);

    const votes = candidateLists.reduce((total, list) => {
      const listVotes = getVotesForNeighborhood(neighborhood, list);
      console.log(
        `DEBUG: Votes for list ${list} in ${neighborhood}:`,
        listVotes
      );
      return total + listVotes;
    }, 0);

    console.log(
      `DEBUG: Total votes for ${candidate} in ${neighborhood}:`,
      votes
    );
    return votes;
  };

  const getPartyVotesInNeighborhood = (party: string, neighborhood: string) => {
    if (!votosPorListas || !partiesByList) return 0;

    const partyLists = Object.entries(partiesByList)
      .filter(([, partyName]) => partyName === party)
      .map(([list]) => list);

    return partyLists.reduce((total, list) => {
      return total + getVotesForNeighborhood(neighborhood, list);
    }, 0);
  };

  const groupCandidatesByParty = (
    candidateVotes: Record<string, number> | null | undefined,
    precandidatosByList: Record<string, string> | undefined,
    partiesByList: Record<string, string> | undefined
  ): GroupedCandidates => {
    const grouped: GroupedCandidates = {};

    if (candidateVotes && typeof candidateVotes === "object") {
      Object.keys(candidateVotes).forEach((candidate) => {
        // Obtener el total de votos del candidato solo una vez
        const totalVotes = getCandidateTotalVotes(candidate);

        // Buscar el partido del candidato (usando la primera lista asociada)
        const candidateList = Object.entries(precandidatosByList || {}).find(
          ([, precandidato]) => precandidato === candidate
        )?.[0];
        const party = candidateList
          ? partiesByList?.[candidateList]
          : undefined;

        if (party) {
          if (!grouped[party]) {
            grouped[party] = { totalVotes: 0, candidates: [] };
          }

          grouped[party].totalVotes += totalVotes;
          grouped[party].candidates.push({
            candidate,
            votes: totalVotes,
            party,
          });
        } else {
          console.warn(`No party found for candidate: ${candidate}`);
        }
      });
    }
    return grouped;
  };

  const groupListsByParty = (neighborhood: string): GroupedLists => {
    const grouped: GroupedLists = {};
    selectedLists.forEach((list) => {
      const party = partiesByList[list];
      const votes = votosPorListas[list]?.[neighborhood];
      if (votes) {
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

  const groupSelectedLists = (): Record<string, PartyData> => {
    const grouped: Record<string, PartyData> = {};

    selectedLists.forEach((list) => {
      const party = partiesByList[list];
      const votes = getTotalVotesForList(list);

      if (!grouped[party]) {
        grouped[party] = { totalVotes: 0, lists: [], candidates: [] };
      }

      grouped[party].totalVotes += votes;
      grouped[party].lists!.push({ number: list, votes });
    });

    return Object.fromEntries(
      Object.entries(grouped).sort(
        ([, a], [, b]) => b.totalVotes - a.totalVotes
      )
    );
  };

  const groupedSelectedItems = computed(() => {
    if (selectedCandidates.length > 0) {
      const candidateVotes = selectedCandidates.reduce((acc, candidate) => {
        acc[candidate] = getCandidateTotalVotes(candidate);
        return acc;
      }, {});

      return groupCandidatesByParty(
        candidateVotes,
        precandidatosByList,
        partiesByList
      );
    } else {
      return groupSelectedLists(); // Use groupSelectedLists instead of groupListsByParty
    }
  });

  return {
    getVotesForNeighborhood,
    getTotalVotesForList,
    getCandidateTotalVotes,
    getVotesForCandidateInNeighborhood,
    getPartyVotesInNeighborhood,
    getTotalVotes,
    groupCandidatesByParty,
    groupListsByParty,
    groupedSelectedItems,
  };
}
