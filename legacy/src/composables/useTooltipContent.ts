import type { CandidateVote, GroupedCandidates, GroupedLists } from './useMapInteraction';

export interface UseTooltipContentProps {
  partiesAbbrev: Record<string, string>;
}

export function useTooltipContent(props: UseTooltipContentProps) {
  const generateCandidateTooltip = (
    neighborhood: string,
    candidateVotes: CandidateVote[],
    groupedCandidates: GroupedCandidates,
    totalVotes: number,
    seriesCode?: string,
    barrios?: string[]
  ): string => {
    let tooltipContent = '<div class="tooltip-content">';

    // Header with neighborhood/locality name
    tooltipContent += `<strong style="font-size: 14px; color: #2c3e50;">${neighborhood}</strong>`;

    // Show series code and barrios if available (for Rivera ciudad)
    if (seriesCode && barrios && barrios.length > 0) {
      tooltipContent += `<div style="font-size: 11px; color: #7f8c8d; margin-bottom: 8px;">Serie ${seriesCode} • ${barrios.join(', ')}</div>`;
    }

    tooltipContent += '<div class="party-list">';
    for (const [party, candidates] of Object.entries(groupedCandidates)) {
      const partyVotes = candidates.reduce((sum, c) => sum + c.votes, 0);
      const partyAbbrev = props.partiesAbbrev[party] || party;
      tooltipContent += `<div class="party-item" style="margin-bottom: 8px;">
        <strong style="color: #34495e;">${partyAbbrev}: ${partyVotes.toLocaleString('es-UY')} votos</strong>
        <div style="margin-left: 10px; font-size: 11px; color: #555;">`;
      candidates
        .sort((a, b) => b.votes - a.votes)
        .forEach(({ candidate, votes }) => {
          tooltipContent += `• ${candidate}: ${votes.toLocaleString('es-UY')} votos<br>`;
        });
      tooltipContent += "</div></div>";
    }
    tooltipContent += "</div>";

    tooltipContent += `<div style="border-top: 1px solid #ddd; margin-top: 8px; padding-top: 4px;">
      <strong>Total: ${(totalVotes || 0).toLocaleString('es-UY')} votos</strong>
    </div></div>`;

    return tooltipContent;
  };

  const generateListTooltip = (
    neighborhood: string,
    groupedLists: GroupedLists,
    totalVotes: number,
    seriesCode?: string,
    barrios?: string[]
  ): string => {
    let tooltipContent = '<div class="tooltip-content">';

    // Header with neighborhood/locality name
    tooltipContent += `<strong style="font-size: 14px; color: #2c3e50;">${neighborhood}</strong>`;

    // Show series code and barrios if available (for Rivera ciudad)
    if (seriesCode && barrios && barrios.length > 0) {
      tooltipContent += `<div style="font-size: 11px; color: #7f8c8d; margin-bottom: 8px;">Serie ${seriesCode} • ${barrios.join(', ')}</div>`;
    }

    tooltipContent += '<div class="party-list">';

    const entries = Object.entries(groupedLists);

    for (const [party, lists] of entries) {
      const partyVotes = lists.reduce((sum, l) => sum + l.votes, 0);
      const partyAbbrev = props.partiesAbbrev[party] || party;

      tooltipContent += `<div class="party-item" style="margin-bottom: 8px;">
        <strong style="color: #34495e;">${partyAbbrev}: ${partyVotes.toLocaleString('es-UY')} votos</strong>
        <div style="margin-left: 10px; font-size: 11px; color: #555;">`;

      lists
        .sort((a, b) => b.votes - a.votes)
        .forEach(({ number, votes }) => {
          tooltipContent += `• Lista ${number}: ${votes.toLocaleString('es-UY')} votos<br>`;
        });
      tooltipContent += "</div></div>";
    }
    tooltipContent += "</div>";

    tooltipContent += `<div style="border-top: 1px solid #ddd; margin-top: 8px; padding-top: 4px;">
      <strong>Total: ${(totalVotes || 0).toLocaleString('es-UY')} votos</strong>
    </div></div>`;

    return tooltipContent;
  };

  return {
    generateCandidateTooltip,
    generateListTooltip,
  };
}
