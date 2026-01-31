import type { CandidateVote, GroupedCandidates, GroupedLists } from './useMapInteraction';

export interface UseTooltipContentProps {
  partiesAbbrev: Record<string, string>;
}

export function useTooltipContent(props: UseTooltipContentProps) {
  const generateCandidateTooltip = (
    neighborhood: string,
    candidateVotes: CandidateVote[],
    groupedCandidates: GroupedCandidates,
    totalVotes: number
  ): string => {
    let tooltipContent = `<div class="tooltip-content"><strong>${neighborhood}</strong><br>`;

    tooltipContent += '<div class="party-list">';
    for (const [party, candidates] of Object.entries(groupedCandidates)) {
      const partyVotes = candidates.reduce((sum, c) => sum + c.votes, 0);
      const partyAbbrev = props.partiesAbbrev[party] || party;
      tooltipContent += `<div class="party-item">
        <div class="party-name" style="margin-left: 20px;"><strong>${partyAbbrev}</strong>: ${partyVotes} votos</div>
        <div class="candidate-items" style="margin-left: 40px;">`;
      candidates
        .sort((a, b) => b.votes - a.votes)
        .forEach(({ candidate, votes }) => {
          tooltipContent += `<div class="candidate-item">${candidate}: ${votes} votos</div>`;
        });
      tooltipContent += "</div></div>";
    }
    tooltipContent += "</div>";

    tooltipContent += `<div class="tooltip-total"><strong>Total: ${totalVotes || 0} votos</strong></div></div>`;

    return tooltipContent;
  };

  const generateListTooltip = (
    neighborhood: string,
    groupedLists: GroupedLists,
    totalVotes: number
  ): string => {
    let tooltipContent = `<div class="tooltip-content"><strong>${neighborhood}</strong><br>`;

    tooltipContent += '<div class="party-list">';
    for (const [party, lists] of Object.entries(groupedLists)) {
      const partyVotes = lists.reduce((sum, l) => sum + l.votes, 0);
      const partyAbbrev = props.partiesAbbrev[party] || party;
      tooltipContent += `<div class="party-item">
        <div class="party-name" style="margin-left: 20px;"><strong>${partyAbbrev}</strong>: ${partyVotes} votos</div>
        <div class="list-items" style="margin-left: 40px;">`;
      lists
        .sort((a, b) => b.votes - a.votes)
        .forEach(({ number, votes }) => {
          tooltipContent += `<div class="list-item">Lista ${number}: ${votes} votos</div>`;
        });
      tooltipContent += "</div></div>";
    }
    tooltipContent += "</div>";

    tooltipContent += `<div class="tooltip-total"><strong>Total: ${totalVotes || 0} votos</strong></div></div>`;

    return tooltipContent;
  };

  return {
    generateCandidateTooltip,
    generateListTooltip,
  };
}
