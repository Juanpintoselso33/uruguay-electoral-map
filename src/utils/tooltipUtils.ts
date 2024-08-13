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
    <div class="tooltip-content" style="font-family: 'Arial', sans-serif; min-width: 220px; max-width: 300px; background-color: rgba(255, 255, 255, 0.95); border-radius: 8px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1); padding: 12px;">
      <h3 style="font-size: 16px; font-weight: 600; margin: 0 0 8px; color: #333; border-bottom: 1px solid #e0e0e0; padding-bottom: 6px;">${neighborhood}</h3>
  `;

  if (selectedCandidates.length > 0) {
    const candidateVotes = getCandidateVotesForNeighborhood(neighborhood);
    const groupedCandidates = groupCandidatesByParty(candidateVotes);

    for (const [party, candidates] of Object.entries(groupedCandidates)) {
      content += `
        <div style="margin-bottom: 10px;">
          <span style="display: block; margin-bottom: 4px; color: #555; font-weight: 600; font-size: 14px;">${
            partiesAbbrev[party] || party
          }</span>
          <ul style="list-style-type: none; padding: 0; margin: 0;">
      `;
      if (Array.isArray(candidates)) {
        candidates.forEach(({ candidate, votes }) => {
          content += `<li style="margin-bottom: 2px; font-size: 13px; color: #333;"><span>${candidate}</span>: <span style="font-weight: 600;">${votes.toLocaleString()}</span></li>`;
        });
      } else if (typeof candidates === "object" && candidates !== null) {
        Object.entries(candidates).forEach(([candidate, votes]) => {
          content += `<li style="margin-bottom: 2px; font-size: 13px; color: #333;"><span>${candidate}</span>: <span style="font-weight: 600;">${votes.toLocaleString()}</span></li>`;
        });
      }
      content += "</ul></div>";
    }
  } else {
    const groupedLists = groupListsByParty(neighborhood);

    for (const [party, lists] of Object.entries(groupedLists)) {
      content += `
        <div style="margin-bottom: 10px;">
          <span style="display: block; margin-bottom: 4px; color: #555; font-weight: 600; font-size: 14px;">${
            partiesAbbrev[party] || party
          }</span>
          <ul style="list-style-type: none; padding: 0; margin: 0;">
      `;
      lists.forEach(({ number, votes }) => {
        content += `<li style="margin-bottom: 2px; font-size: 13px; color: #333;">Lista ${number}: <span style="font-weight: 600;">${votes.toLocaleString()}</span></li>`;
      });
      content += "</ul></div>";
    }
  }

  content += `
      <div style="margin-top: 8px; font-size: 14px; color: #333; text-align: right; border-top: 1px solid #e0e0e0; padding-top: 6px;">
        Total: <span style="font-weight: 700; color: #0066cc;">${votes.toLocaleString()}</span>
      </div>
    </div>
  `;
  return content;
}
