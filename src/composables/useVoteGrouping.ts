import { computed } from "vue";
import {
  CandidateVote,
  GroupedCandidates,
  GroupedLists,
  PartyData,
} from "../types/VoteTypes";
import { getTotalVotesForList } from "../utils/mapUtils";

export function useVoteGrouping(props, voteCalculations) {
  console.log("useVoteGrouping called with props:", props);
  console.log(
    "Precandidatos por lista en useVoteGrouping:",
    props.precandidatosByList
  );
  const groupCandidatesByParty = (
    candidateVotes: Record<string, number> | null | undefined,
    partiesAbbrev: Record<string, string> | undefined,
    precandidatosByList: Record<string, string> | undefined,
    partiesByList: Record<string, string> | undefined
  ): Record<
    string,
    { totalVotes: number; candidates: { name: string; votes: number }[] }
  > => {
    const grouped: Record<
      string,
      { totalVotes: number; candidates: { name: string; votes: number }[] }
    > = {};

    if (candidateVotes && typeof candidateVotes === "object") {
      Object.entries(candidateVotes).forEach(([candidate, votes]) => {
        const list = Object.entries(precandidatosByList).find(
          ([_, c]) => c === candidate
        )?.[0];
        const party = list ? partiesByList[list] || "Unknown" : "Unknown";

        if (!grouped[party]) {
          grouped[party] = { totalVotes: 0, candidates: [] };
        }
        grouped[party].totalVotes += votes;
        grouped[party].candidates.push({ name: candidate, votes });
      });
    }
    console.log("Grouped Candidates by Party:", grouped);
    return grouped;
  };

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

  const groupedSelectedItems = computed<Record<string, PartyData>>(() => {
    if (props.selectedCandidates.length > 0) {
      const grouped: Record<string, PartyData> = {};

      props.selectedCandidates.forEach((candidate) => {
        const party = Object.entries(props.precandidatosByList).find(
          ([, c]) => c === candidate
        )?.[0];

        if (!party) {
          console.warn(
            `No se encontró partido para el candidato: ${candidate}`
          );
          return;
        }

        const partyName = props.partiesByList[party] || "Unknown";
        if (!grouped[partyName]) {
          grouped[partyName] = { totalVotes: 0, candidates: [] };
        }

        const candidateVotes =
          voteCalculations.getCandidateTotalVotesForAllNeighborhoods
            ? voteCalculations.getCandidateTotalVotesForAllNeighborhoods(
                candidate
              )
            : 0;

        grouped[partyName].totalVotes += candidateVotes;
        grouped[partyName].candidates!.push({
          name: candidate,
          votes: candidateVotes,
        });
      });

      Object.values(grouped).forEach((partyData) => {
        if (partyData.candidates) {
          partyData.candidates.sort((a, b) => b.votes - a.votes);
        }
      });

      return grouped;
    } else {
      const grouped: Record<string, PartyData> = {};
      props.selectedLists.forEach((list) => {
        const party = props.partiesByList[list];
        if (!grouped[party]) {
          grouped[party] = { totalVotes: 0, lists: [] };
        }
        const votes = getTotalVotesForList(props.votosPorListas, list);
        grouped[party].totalVotes += votes;
        grouped[party].lists!.push({ number: list, votes });
      });
      Object.values(grouped).forEach((partyData) => {
        if (partyData.lists) {
          partyData.lists.sort((a, b) => b.votes - a.votes);
        }
      });
      const sortedGrouped = Object.fromEntries(
        Object.entries(grouped)
          .sort(([, a], [, b]) => b.totalVotes - a.totalVotes)
          .map(([party, data]) => [
            party !== "Independiente" && party !== "Frente Amplio"
              ? `Partido ${party}`
              : party,
            data,
          ])
      );
      console.log("Grouped Selected Items (Lists):", sortedGrouped);
      return sortedGrouped;
    }
  });

  return {
    groupCandidatesByParty,
    groupListsByParty,
    groupedSelectedItems,
  };
}
