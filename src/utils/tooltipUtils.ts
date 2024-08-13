import { GroupedCandidates, GroupedLists } from "../types/VoteTypes";
import { parseFullPartyName } from "../utils/stringUtils"; // Import the function
import { useVoteCalculations } from "../composables/useVoteCalculations"; // Import the useVoteCalculations

function renderPartyData(
  party: string,
  partyData: {
    candidates?: { name: string; votes: number }[];
    lists?: { number: string; votes: number }[];
  },
  neighborhood: string,
  voteCalculations: ReturnType<typeof useVoteCalculations>
): string {
  const fullPartyName = parseFullPartyName(party);
  let partyTotalVotes = 0;
  let content = `
    <div style="margin-bottom: 10px;">
      <span style="display: block; margin-bottom: 4px; color: #555; font-weight: 600; font-size: 14px;">${fullPartyName}</span>
      <ul style="list-style-type: none; padding: 0; margin: 0;">
  `;

  if (partyData.candidates) {
    partyData.candidates.forEach(({ name }) => {
      const candidateVotes =
        voteCalculations.getCandidateVotesForNeighborhood(neighborhood)[name] ||
        0;
      partyTotalVotes += candidateVotes;
      content += `<li style="margin-bottom: 2px; font-size: 13px; color: #333;"><strong>${name}</strong>: <span style="font-weight: 600;">${candidateVotes.toLocaleString()}</span> votos</li>`;
    });
  } else if (partyData.lists) {
    partyData.lists.forEach(({ number }) => {
      const listVotes = voteCalculations.getVotesForNeighborhood(
        neighborhood,
        number
      );
      partyTotalVotes += listVotes;
      content += `<li style="margin-bottom: 2px; font-size: 13px; color: #333;">Lista ${number}: <span style="font-weight: 600;">${listVotes.toLocaleString()}</span> votos</li>`;
    });
  }

  content += `
      </ul>
      <span style="display: block; margin-top: 4px; color: #555; font-weight: 600; font-size: 13px;">Total ${fullPartyName}: ${partyTotalVotes.toLocaleString()} votos</span>
    </div>`;

  return content;
}

export function createTooltipContent(
  neighborhood: string,
  votes: number,
  selectedCandidates: string[],
  partiesAbbrev: Record<string, string>,
  groupedSelectedItems: Record<
    string,
    {
      candidates?: { name: string; votes: number }[];
      lists?: { number: string; votes: number }[];
    }
  >,
  voteCalculations: ReturnType<typeof useVoteCalculations>,
  sortBy: "votes" | "alphabetical" = "votes"
): string {
  let content = `
    <div class="tooltip-content" style="font-family: 'Arial', sans-serif; min-width: 220px; max-width: 300px; background-color: rgba(255, 255, 255, 0.95); border-radius: 8px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1); padding: 12px;">
      <h3 style="font-size: 16px; font-weight: 600; margin: 0 0 8px; color: #333; border-bottom: 1px solid #e0e0e0; padding-bottom: 6px;">${neighborhood}</h3>
  `;

  // Sort parties by total votes in the neighborhood
  const sortedParties = Object.entries(groupedSelectedItems)
    .map(([party, data]) => {
      const partyVotes = data.candidates
        ? data.candidates.reduce(
            (sum, c) =>
              sum +
              voteCalculations.getVotesForCandidateInNeighborhood(
                c.name,
                neighborhood
              ),
            0
          )
        : data.lists!.reduce(
            (sum, l) =>
              sum +
              voteCalculations.getVotesForNeighborhood(neighborhood, l.number),
            0
          );
      return { party, data, partyVotes };
    })
    .filter(({ partyVotes }) => partyVotes > 0)
    .sort((a, b) => b.partyVotes - a.partyVotes);

  for (const { party, data, partyVotes } of sortedParties) {
    content += `
      <div style="margin-bottom: 10px;">
        <span style="display: block; margin-bottom: 4px; color: #555; font-weight: 600; font-size: 14px;">${parseFullPartyName(
          party
        )}</span>
        <ul style="list-style-type: none; padding: 0; margin: 0;">
    `;

    if (data.candidates) {
      const sortedCandidates = data.candidates
        .map((c) => ({
          ...c,
          votes: voteCalculations.getVotesForCandidateInNeighborhood(
            c.name,
            neighborhood
          ),
        }))
        .filter((c) => c.votes > 0)
        .sort(
          sortBy === "votes"
            ? (a, b) => b.votes - a.votes
            : (a, b) => a.name.localeCompare(b.name)
        );

      for (const candidate of sortedCandidates) {
        content += `<li style="margin-bottom: 2px; font-size: 13px; color: #333;"><strong>${
          candidate.name
        }</strong>: <span style="font-weight: 600;">${candidate.votes.toLocaleString()}</span> votos</li>`;
      }
    } else if (data.lists) {
      const sortedLists = data.lists
        .map((l) => ({
          ...l,
          votes: voteCalculations.getVotesForNeighborhood(
            neighborhood,
            l.number
          ),
        }))
        .filter((l) => l.votes > 0)
        .sort(
          sortBy === "votes"
            ? (a, b) => b.votes - a.votes
            : (a, b) => a.number.localeCompare(b.number)
        );

      for (const list of sortedLists) {
        content += `<li style="margin-bottom: 2px; font-size: 13px; color: #333;">Lista ${
          list.number
        }: <span style="font-weight: 600;">${list.votes.toLocaleString()}</span> votos</li>`;
      }
    }

    content += `
        </ul>
        <span style="display: block; margin-top: 4px; color: #555; font-weight: 600; font-size: 13px;">Total ${parseFullPartyName(
          party
        )}: ${partyVotes.toLocaleString()} votos</span>
      </div>
    `;
  }

  content += `
      <div style="margin-top: 8px; font-size: 14px; color: #333; text-align: right; border-top: 1px solid #e0e0e0; padding-top: 6px;">
        Total: <span style="font-weight: 700; color: #0066cc;">${votes.toLocaleString()}</span> votos
      </div>
    </div>
  `;
  return content;
}
