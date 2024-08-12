import { computed } from "vue";
import {
  CandidateVote,
  GroupedCandidates,
  GroupedLists,
  PartyData,
} from "../types/VoteTypes";
import {
  getCandidateTotalVotesAllNeighborhoods,
  getTotalVotesForList,
} from "../utils/mapUtils"; // Added import

export function useVoteGrouping(props) {
  console.log("useVoteGrouping called with props:", props);
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
    console.log("Selected Candidates:", props.selectedCandidates);
    if (props.selectedCandidates.length > 0) {
      const grouped: Record<string, PartyData> = {};
      props.selectedCandidates.forEach((candidate) => {
        const party = Object.entries(props.precandidatosByList).find(
          ([, c]) => c === candidate
        )?.[0];
        const partyName = party ? props.partiesByList[party] : "Unknown";
        if (!grouped[partyName]) {
          grouped[partyName] = { totalVotes: 0, candidates: [] };
        }
        const votes = getCandidateTotalVotesAllNeighborhoods(
          props.geojsonData,
          props.getCandidateVotesForNeighborhood,
          candidate
        );
        console.log(`Votes for ${candidate} in ${partyName}:`, votes);
        grouped[partyName].totalVotes += votes;
        grouped[partyName].candidates?.push({ name: candidate, votes });
      });
      Object.values(grouped).forEach((partyData: any) => {
        partyData.candidates.sort((a, b) => b.votes - a.votes);
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
      console.log("Grouped Selected Items:", sortedGrouped);
      return sortedGrouped;
    } else {
      const grouped: Record<string, PartyData> = {};
      props.selectedLists.forEach((list) => {
        const party = props.partiesByList[list];
        if (!grouped[party]) {
          grouped[party] = { totalVotes: 0, lists: [] };
        }
        const votes = getTotalVotesForList(props.votosPorListas, list);
        grouped[party].totalVotes += votes;
        grouped[party].lists?.push({ number: list, votes });
      });
      Object.values(grouped).forEach((partyData: any) => {
        partyData.lists.sort((a, b) => b.votes - a.votes);
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
