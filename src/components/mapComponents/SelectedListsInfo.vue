<template>
  <div class="selected-lists-info" :class="{ 'mobile-hidden': isMobileHidden }">
    <h3 class="selected-lists-title">Listas seleccionadas</h3>
    <div class="selected-lists-content">
      <ul class="party-list">
        <li
          v-for="(partyData, party) in sortedGroupedItems"
          :key="party"
          class="party-item"
        >
          <span class="party-name">{{
            parseFullPartyName(String(party))
          }}</span>
          <ul v-if="partyData.candidates" class="candidate-items">
            <li
              v-for="candidate in partyData.candidates"
              :key="candidate.name"
              class="candidate-item"
            >
              {{ candidate.name }}: {{ candidate.votes }} votos
            </li>
          </ul>
          <ul v-else-if="partyData.lists" class="list-items">
            <li
              v-for="list in partyData.lists"
              :key="list.number"
              class="list-item"
            >
              Lista {{ list.number }}: {{ list.votes }} votos
            </li>
          </ul>
          <div class="party-total">
            <span class="total-label"
              >Total:
              {{
                partyData.candidates
                  ? partyData.candidates.reduce(
                      (sum, candidate) => sum + candidate.votes,
                      0
                    )
                  : partyData.lists.reduce((sum, list) => sum + list.votes, 0)
              }}
              votos
            </span>
          </div>
        </li>
      </ul>
    </div>
    <div class="total-votes">Total votos: {{ getTotalVotes() }}</div>
  </div>
</template>

<script setup lang="ts">
import { parseFullPartyName } from "../../utils/stringUtils";
import { computed } from "vue";

interface Props {
  isMobileHidden: boolean;
  selectedCandidates: string[];
  groupedSelectedItems: Record<
    string,
    {
      candidates: { name: string; votes: number }[];
      lists: { number: string; votes: number }[];
    }
  >;
  getTotalVotes: () => number;
  sortBy: "votes" | "alphabetical";
}

const props = defineProps<Props>();

// Sorting function
const sortByVotes = <T extends { votes: number }>(a: T, b: T) =>
  b.votes - a.votes;
const sortAlphabetically = <T extends { name?: string; number?: string }>(
  a: T,
  b: T
) => {
  const aValue = a.name || a.number || "";
  const bValue = b.name || b.number || "";
  return aValue.localeCompare(bValue);
};

// Sorted grouped items
const sortedGroupedItems = computed(() => {
  const sorted = Object.entries(props.groupedSelectedItems).sort(
    ([, a], [, b]) => {
      const aVotes = a.candidates
        ? a.candidates.reduce((sum, c) => sum + c.votes, 0)
        : a.lists.reduce((sum, l) => sum + l.votes, 0);
      const bVotes = b.candidates
        ? b.candidates.reduce((sum, c) => sum + c.votes, 0)
        : b.lists.reduce((sum, l) => sum + l.votes, 0);
      return bVotes - aVotes;
    }
  );

  return Object.fromEntries(
    sorted.map(([party, data]) => {
      if (data.candidates) {
        data.candidates.sort(
          props.sortBy === "votes" ? sortByVotes : sortAlphabetically
        );
      } else if (data.lists) {
        data.lists.sort(
          props.sortBy === "votes" ? sortByVotes : sortAlphabetically
        );
      }
      return [party, data];
    })
  );
});
</script>

<style scoped>
.selected-lists-info {
  position: absolute;
  top: 40px;
  right: 20px;
  background-color: rgba(255, 255, 255, 0.9);
  padding: 15px;
  border-radius: 8px;
  max-width: 300px;
  max-height: 1200px;
  overflow-y: auto;
  z-index: 1000;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.selected-lists-content {
  max-height: calc(70vh - 30px);
  overflow-y: auto;
}

.selected-lists-title {
  margin-top: 0;
  margin-bottom: 15px;
  font-size: 1.5em;
  color: #333;
}

.party-list {
  list-style-type: none;
  padding: 0;
  margin: 0;
}

.party-item {
  margin-bottom: 10px;
  background-color: #f9f9f9;
  border-radius: 5px;
  padding: 10px;
  transition: background-color 0.3s;
}

.party-item:hover {
  background-color: #e0e0e0;
}

.party-name {
  display: block;
  margin-bottom: 5px;
  color: #444;
  font-weight: bold;
}

.list-items,
.candidate-items {
  padding-left: 15px;
  margin: 0;
}

.list-item,
.candidate-item {
  margin-bottom: 3px;
  font-size: 0.9em;
  color: #666;
}

.party-total {
  margin-top: 5px;
  font-size: 0.9em;
  color: #666;
  display: flex;
  justify-content: space-between; /* Aligns total label and value */
}

.total-label {
  font-weight: bold; /* Makes the label bold */
}

.total-votes {
  color: #333;
}

.total-votes {
  margin-top: 20px;
  padding-top: 10px;
  border-top: 1px solid #ddd;
  font-size: 1.2em;
  color: #333;
}

@media (max-width: 767px) {
  .selected-lists-info {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    max-width: 100%;
    border-radius: 8px 8px 0 0;
    transform: translateY(50%);
    transition: transform 0.3s ease-in-out;
    max-height: 70vh;
  }

  .selected-lists-info.mobile-hidden {
    transform: translateY(300%);
  }

  .selected-lists-content {
    max-height: calc(70vh - 40px);
    overflow-y: auto;
    padding-bottom: 20px;
    -webkit-overflow-scrolling: touch;
  }
}
</style>
