<template>
  <div class="selected-lists-info" :class="{ 'mobile-hidden': isMobileHidden }">
    <h3 class="selected-lists-title">
      {{
        selectedCandidates.length > 0
          ? "Candidatos seleccionados"
          : "Listas seleccionadas"
      }}
    </h3>
    <div class="selected-lists-content">
      <ul class="party-list">
        <li
          v-for="(partyData, party) in groupedSelectedItems"
          :key="party"
          class="party-item"
        >
          <span class="party-name">{{
            parseFullPartyName(String(party))
          }}</span>
          <ul v-if="partyData?.candidates?.length" class="candidate-items">
            <li
              v-for="candidate in partyData.candidates"
              :key="candidate.candidate"
              class="candidate-item"
            >
              {{ candidate.candidate }}: {{ candidate.votes }} votos
            </li>
          </ul>
          <ul v-else-if="partyData?.lists?.length" class="list-items">
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
              >Total: {{ partyData.totalVotes }} votos</span
            >
          </div>
        </li>
      </ul>
    </div>
    <div class="total-votes">
      Total votos: {{ getTotalVotes(selectedLists, selectedCandidates) }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { parseFullPartyName } from "../../utils/stringUtils";
import { computed } from "vue";
import { useRegionStore } from "../../stores/regionStore";

const props = defineProps<{
  isMobileHidden: boolean;
  selectedCandidates: string[];
  selectedLists: string[];
  getTotalVotes: (
    selectedLists: string[],
    selectedCandidates: string[]
  ) => number;
}>();

const regionStore = useRegionStore();

interface PartyData {
  candidates?: { candidate: string; votes: number }[];
  lists?: { number: string; votes: number }[];
  totalVotes: number;
}

// Local sorting functions
const sortCandidatesByVotes = (
  candidates: { candidate: string; votes: number }[]
) => {
  return [...candidates].sort((a, b) => b.votes - a.votes);
};

const sortListsByVotes = (lists: { number: string; votes: number }[]) => {
  return [...lists].sort((a, b) => b.votes - a.votes);
};

// Update the computed property to use the interface
const groupedSelectedItems = computed<Record<string, PartyData>>(() => {
  const items = regionStore.groupedSelectedItems as Record<string, PartyData>;

  // Ordenar candidatos dentro de cada partido
  Object.values(items).forEach((partyData) => {
    if (partyData.candidates) {
      partyData.candidates = sortCandidatesByVotes(partyData.candidates);
    }
    // Ordenar listas dentro de cada partido
    if (partyData.lists) {
      partyData.lists = sortListsByVotes(partyData.lists);
    }
  });

  // Ordenar partidos por total de votos
  return Object.fromEntries(
    Object.entries(items).sort(([, a], [, b]) => b.totalVotes - a.totalVotes)
  );
});

const selectedCandidates = computed(() => props.selectedCandidates);
const selectedLists = computed(() => props.selectedLists);
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

.candidate-items {
  padding-left: 15px;
  margin: 0;
}

.candidate-item {
  margin-bottom: 3px;
  font-size: 0.9em;
  color: #666;
}

.list-items {
  padding-left: 15px;
  margin: 0;
}

.list-item {
  margin-bottom: 3px;
  font-size: 0.9em;
  color: #666;
}

.party-total {
  margin-top: 5px;
  font-size: 0.9em;
  color: #666;
  display: flex;
  justify-content: space-between;
}

.total-label {
  font-weight: bold;
}

.total-votes {
  color: #333;
  margin-top: 20px;
  padding-top: 10px;
  border-top: 1px solid #ddd;
  font-size: 1.2em;
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
