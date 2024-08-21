import { GroupedCandidates, GroupedLists } from "../types/VoteTypes";
import { parseFullPartyName } from "../utils/stringUtils";
import { useVoteOperations } from "../composables/useVoteOperations";

const sortByVotes = <T extends { votes: number }>(a: T, b: T) =>
  b.votes - a.votes;

const sortByNameOrNumber = <T extends { name?: string; number?: string }>(
  a: T,
  b: T
) => {
  if (a.name && b.name) return a.name.localeCompare(b.name);
  if (a.number && b.number) return a.number.localeCompare(b.number);
  return 0;
};

export function createTooltipContent(
  neighborhood: string,
  votes: number,
  selectedCandidates: string[],
  selectedLists: string[],
  partiesAbbrev: Record<string, string>,
  groupedSelectedItems: Record<
    string,
    {
      candidates?: { name: string; votes: number }[];
      lists?: { number: string; votes: number }[];
    }
  >,
  voteOperations: ReturnType<typeof useVoteOperations>,
  sortBy: "votes" | "alphabetical" = "votes"
): string {
  let content = `
    <div class="tooltip-content" style="font-family: 'Arial', sans-serif; min-width: 220px; max-width: 300px; background-color: rgba(255, 255, 255, 0.95); border-radius: 8px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1); padding: 12px;">
      <h3 style="font-size: 16px; font-weight: 600; margin: 0 0 8px; color: #333; border-bottom: 1px solid #e0e0e0; padding-bottom: 6px;">${neighborhood}</h3>
  `;

  let totalSelectedVotes = 0;

  if (selectedCandidates.length > 0 || selectedLists.length > 0) {
    const sortedParties = Object.entries(groupedSelectedItems)
      .map(([party, data]) => {
        let partyVotes = 0;
        const sortedCandidates = data.candidates
          ? data.candidates
              .filter((c) => selectedCandidates.includes(c.name))
              .map((c) => ({
                ...c,
                votes: voteOperations.getVotesForCandidateInNeighborhood(
                  c.name,
                  neighborhood
                ),
              }))
              .filter((c) => c.votes > 0)
              .sort(sortBy === "votes" ? sortByVotes : sortByNameOrNumber)
          : [];

        const sortedLists = data.lists
          ? data.lists
              .filter((l) => selectedLists.includes(l.number))
              .map((l) => ({
                ...l,
                votes: voteOperations.getVotesForNeighborhood(
                  neighborhood,
                  l.number
                ),
              }))
              .filter((l) => l.votes > 0)
              .sort(sortBy === "votes" ? sortByVotes : sortByNameOrNumber)
          : [];

        partyVotes =
          sortedCandidates.reduce((sum, c) => sum + c.votes, 0) +
          sortedLists.reduce((sum, l) => sum + l.votes, 0);

        return { party, sortedCandidates, sortedLists, partyVotes };
      })
      .filter(({ partyVotes }) => partyVotes > 0)
      .sort((a, b) => b.partyVotes - a.partyVotes);

    for (const {
      party,
      sortedCandidates,
      sortedLists,
      partyVotes,
    } of sortedParties) {
      content += `
        <div style="margin-bottom: 10px;">
          <span style="display: block; margin-bottom: 4px; color: #555; font-weight: 600; font-size: 14px;">${parseFullPartyName(
            party
          )}</span>
          <ul style="list-style-type: none; padding: 0; margin: 0;">
      `;

      for (const candidate of sortedCandidates) {
        content += `<li style="margin-bottom: 2px; font-size: 13px; color: #333;"><strong>${
          candidate.name
        }</strong>: <span style="font-weight: 600;">${candidate.votes.toLocaleString()}</span> votos</li>`;
      }

      for (const list of sortedLists) {
        content += `<li style="margin-bottom: 2px; font-size: 13px; color: #333;">Lista ${
          list.number
        }: <span style="font-weight: 600;">${list.votes.toLocaleString()}</span> votos</li>`;
      }

      content += `
          </ul>
          <span style="display: block; margin-top: 4px; color: #555; font-weight: 600; font-size: 13px;">Total ${parseFullPartyName(
            party
          )}: ${partyVotes.toLocaleString()} votos</span>
        </div>
      `;
      totalSelectedVotes += partyVotes;
    }
  } else {
    content += `<p style="color: #666; font-style: italic;">No hay listas o candidatos seleccionados.</p>`;
  }

  content += `
    <div style="margin-top: 8px; font-size: 14px; color: #333; text-align: right; border-top: 1px solid #e0e0e0; padding-top: 6px;">
      Total seleccionado: <span style="font-weight: 700; color: #0066cc;">${totalSelectedVotes.toLocaleString()}</span> votos
    </div>
  </div>
  `;
  return content;
}

export function createNeighborhoodInfoContent(
  neighborhood: string,
  voteOperations: ReturnType<typeof useVoteOperations>,
  selectedCandidates: string[],
  selectedLists: string[],
  partiesAbbrev: Record<string, string>,
  groupedSelectedItems: Record<
    string,
    {
      candidates?: { name: string; votes: number }[];
      lists?: { number: string; votes: number }[];
    }
  >,
  sortBy: "votes" | "alphabetical" = "votes"
): string {
  let content = `
    <div style="font-family: Arial, sans-serif; font-size: 14px;">
      <h3 style="margin: 0 0 10px; font-size: 16px; color: #333;">${neighborhood}</h3>
  `;

  const totalVotes = voteOperations.getVotesForNeighborhood(neighborhood);

  const sortedParties = Object.entries(groupedSelectedItems)
    .map(([party, data]) => ({
      party,
      data,
      partyVotes: voteOperations.getPartyVotesInNeighborhood(
        party,
        neighborhood
      ),
    }))
    .filter((item) => item.partyVotes > 0)
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
        .filter((c) => selectedCandidates.includes(c.name))
        .map((c) => ({
          ...c,
          votes: voteOperations.getVotesForCandidateInNeighborhood(
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
        .filter((l) => selectedLists.includes(l.number))
        .map((l) => ({
          ...l,
          votes: voteOperations.getVotesForNeighborhood(neighborhood, l.number),
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
        Total: <span style="font-weight: 700; color: #0066cc;">${totalVotes.toLocaleString()}</span> votos
      </div>
    </div>
  `;
  return content;
}
