import { computed } from "vue";
import {
  CandidateVote,
  GroupedCandidates,
  GroupedLists,
  PartyData,
} from "../types/VoteTypes";

export function useVoteGrouping(
  props,
  { getTotalVotesForList, getCandidateTotalVotesForAllNeighborhoods }
) {
  // Group candidates by their respective parties
  const groupCandidatesByParty = (
    candidateVotes: Record<string, number> | null | undefined,
    partiesAbbrev: Record<string, string> | undefined,
    precandidatosByList: Record<string, string> | undefined,
    partiesByList: Record<string, string> | undefined
  ): GroupedCandidates => {
    const grouped: GroupedCandidates = {};

    if (candidateVotes && typeof candidateVotes === "object") {
      Object.entries(candidateVotes).forEach(([candidate, votes]) => {
        const list = Object.entries(precandidatosByList || {}).find(
          ([_, c]) => c === candidate
        )?.[0];
        const party = list ? partiesByList?.[list] || "Unknown" : "Unknown";

        if (!grouped[party]) {
          grouped[party] = { totalVotes: 0, candidates: [] };
        }
        grouped[party].totalVotes += votes;
        grouped[party].candidates.push({ candidate, votes, party });
      });
    }
    return grouped;
  };

  // Group lists by their respective parties for a specific neighborhood
  const groupListsByParty = (neighborhood: string): GroupedLists => {
    const grouped: GroupedLists = {};
    props.selectedLists.forEach((list) => {
      const party = props.partiesByList[list];
      const votes = props.votosPorListas[list]?.[neighborhood] || 0;
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

  // Compute grouped selected items (candidates or lists)
  const groupedSelectedItems = computed<Record<string, PartyData>>(() => {
    if (props.selectedCandidates.length > 0) {
      return groupSelectedCandidates();
    } else {
      return groupSelectedLists();
    }
  });

  // Helper function to group selected candidates
  const groupSelectedCandidates = (): Record<string, PartyData> => {
    const grouped: Record<string, PartyData> = {};

    props.selectedCandidates.forEach((candidate) => {
      const party = Object.entries(props.precandidatosByList).find(
        ([, c]) => c === candidate
      )?.[0];

      if (!party) return;

      const partyName = props.partiesByList[party] || "Unknown";
      if (!grouped[partyName]) {
        grouped[partyName] = { totalVotes: 0, candidates: [] };
      }

      const candidateVotes =
        getCandidateTotalVotesForAllNeighborhoods?.(candidate) || 0;

      grouped[partyName].totalVotes += candidateVotes;
      grouped[partyName].candidates!.push({
        name: candidate,
        votes: candidateVotes,
      });
    });

    // Sort candidates within each party by votes
    Object.values(grouped).forEach((partyData) => {
      if (partyData.candidates) {
        partyData.candidates.sort((a, b) => b.votes - a.votes);
      }
    });

    return grouped;
  };

  // Helper function to group selected lists
  const groupSelectedLists = (): Record<string, PartyData> => {
    const grouped: Record<string, PartyData> = {};
    const selectedLists = Array.isArray(props.selectedLists)
      ? props.selectedLists
      : [];

    selectedLists.forEach((list) => {
      const party = props.partiesByList[list];

      if (!grouped[party]) {
        grouped[party] = { totalVotes: 0, lists: [] };
      }

      const votes = getTotalVotesForList(props.votosPorListas, list);

      grouped[party].totalVotes += votes;
      grouped[party].lists!.push({ number: list, votes });
    });

    // Sort lists within each party by votes
    Object.values(grouped).forEach((partyData) => {
      if (partyData.lists) {
        partyData.lists.sort((a, b) => b.votes - a.votes);
      }
    });

    // Sort parties by total votes and format party names
    return Object.fromEntries(
      Object.entries(grouped)
        .sort(([, a], [, b]) => b.totalVotes - a.totalVotes)
        .map(([party, data]) => [
          party !== "Independiente" && party !== "Frente Amplio"
            ? `Partido ${party}`
            : party,
          data,
        ])
    );
  };

  return {
    groupCandidatesByParty,
    groupListsByParty,
    groupedSelectedItems,
  };
}
