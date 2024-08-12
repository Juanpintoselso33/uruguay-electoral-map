import { GroupedCandidates, GroupedLists } from "../types/VoteTypes";

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
  groupListsByParty: (neighborhood: string) => GroupedLists
): string {
  let content = `
    <div class="tooltip-content" style="font-family: 'Arial', sans-serif; min-width: 200px; max-width: 300px; width: auto; background-color: rgba(255, 255, 255, 0.95); border-radius: 8px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1); padding: 16px;">
      <h3 style="font-size: 18px; font-weight: 600; margin: 0 0 12px; color: #333; border-bottom: 2px solid #f0f0f0; padding-bottom: 8px;">${neighborhood}</h3>
  `;

  if (selectedCandidates.length > 0) {
    const candidateVotes = getCandidateVotesForNeighborhood(neighborhood);
    const groupedCandidates = groupCandidatesByParty(candidateVotes);

    for (const [party, candidates] of Object.entries(groupedCandidates)) {
      content += `
        <div style="margin-bottom: 16px;">
          <span style="display: block; margin-bottom: 6px; color: #333; font-weight: 600; font-size: 16px;">${party}</span>
          <ul style="list-style-type: none; padding: 0; margin: 0;">
      `;
      candidates.forEach(({ candidate, votes }) => {
        content += `<li style="margin-bottom: 6px; font-size: 14px; color: #333; display: flex; justify-content: space-between;"><span>${candidate}</span> <span style="font-weight: 600;">${votes.toLocaleString()}</span></li>`;
      });
      content += "</ul></div>";
    }
  } else {
    const groupedLists = groupListsByParty(neighborhood);

    for (const [party, lists] of Object.entries(groupedLists)) {
      content += `
        <div style="margin-bottom: 16px;">
          <span style="display: block; margin-bottom: 6px; color: #333; font-weight: 600; font-size: 16px;">${party}</span>
          <ul style="list-style-type: none; padding: 0; margin: 0;">
      `;
      lists.forEach(({ number, votes }) => {
        content += `<li style="margin-bottom: 6px; font-size: 15px; color: #333; display: flex; justify-content: space-between;"><span>Lista ${number}</span> <span style="font-weight: 600;">${votes.toLocaleString()}</span></li>`;
      });
      content += "</ul></div>";
    }
  }

  content += `
      <div style="margin-top: 12px; font-size: 17px; color: #333; text-align: right;">
        Total: <span style="font-weight: 700; color: #0066cc;">${votes.toLocaleString()}</span>
      </div>
    </div>
  `;
  return content;
}
