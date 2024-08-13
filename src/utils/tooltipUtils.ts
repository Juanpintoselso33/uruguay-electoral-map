import { GroupedCandidates, GroupedLists } from "../types/VoteTypes";
import { parseFullPartyName } from "../utils/stringUtils"; // Import the function
import { useVoteCalculations } from "../composables/useVoteCalculations"; // Import the useVoteCalculations

export function createTooltipContent(
  neighborhood: string,
  votes: number,
  selectedCandidates: string[],
  partiesAbbrev: Record<string, string>,
  getCandidateVotesForNeighborhood: (
    neighborhood: string
  ) => { candidate: string; votes: number; party: string }[],
  groupCandidatesByParty: (
    candidateVotes: { candidate: string; votes: number; party: string }[]
  ) => GroupedCandidates,
  groupListsByParty: (neighborhood: string) => GroupedLists,
  props: any // Add props to access vote calculations
): string {
  let content = `
    <div class="tooltip-content" style="font-family: 'Arial', sans-serif; min-width: 220px; max-width: 300px; background-color: rgba(255, 255, 255, 0.95); border-radius: 8px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1); padding: 12px;">
      <h3 style="font-size: 16px; font-weight: 600; margin: 0 0 8px; color: #333; border-bottom: 1px solid #e0e0e0; padding-bottom: 6px;">${neighborhood}</h3>
  `;

  const { getTotalVotesForList } = useVoteCalculations(props, null); // Initialize useVoteCalculations

  if (selectedCandidates.length > 0) {
    const candidateVotes = getCandidateVotesForNeighborhood(neighborhood);
    const groupedCandidates = groupCandidatesByParty(candidateVotes);
    for (const [party, { totalVotes, candidates }] of Object.entries(
      groupedCandidates
    )) {
      const fullPartyName = parseFullPartyName(party);
      const partyTotalVotes = candidates.reduce(
        (sum, candidate) => sum + candidate.votes,
        0
      ); // Calculate total votes for the party
      content += `
        <div style="margin-bottom: 10px;">
          <span style="display: block; margin-bottom: 4px; color: #555; font-weight: 600; font-size: 14px;">${fullPartyName} (Total: ${partyTotalVotes.toLocaleString()} votos)</span>
          <ul style="list-style-type: none; padding: 0; margin: 0;">
      `;
      candidates.forEach(({ name, votes }) => {
        content += `<li style="margin-bottom: 2px; font-size: 13px; color: #333;"><strong>${name}</strong>: <span style="font-weight: 600;">${votes.toLocaleString()}</span> votos</li>`;
      });
      content += "</ul></div>";
    }
  } else {
    const groupedLists = groupListsByParty(neighborhood);

    for (const [party, lists] of Object.entries(groupedLists)) {
      const fullPartyName = parseFullPartyName(party);
      const partyTotalVotes = lists.reduce((sum, list) => sum + list.votes, 0); // Calculate total votes for the party
      content += `
        <div style="margin-bottom: 10px;">
          <span style="display: block; margin-bottom: 4px; color: #555; font-weight: 600; font-size: 14px;">${fullPartyName} (Total: ${partyTotalVotes.toLocaleString()} votos)</span>
          <ul style="list-style-type: none; padding: 0; margin: 0;">
      `;
      lists.forEach(({ number, votes }) => {
        content += `<li style="margin-bottom: 2px; font-size: 13px; color: #333;">Lista ${number}: <span style="font-weight: 600;">${votes.toLocaleString()}</span> votos</li>`;
      });
      content += "</ul></div>";
    }
  }

  content += `
      <div style="margin-top: 8px; font-size: 14px; color: #333; text-align: right; border-top: 1px solid #e0e0e0; padding-top: 6px;">
        Total: <span style="font-weight: 700; color: #0066cc;">${votes.toLocaleString()}</span> votos
      </div>
    </div>
  `;
  return content;
}
