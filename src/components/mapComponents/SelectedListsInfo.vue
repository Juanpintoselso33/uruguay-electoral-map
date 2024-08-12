<template>
  <div class="selected-lists-info" :class="{ 'mobile-hidden': isMobileHidden }">
    <h3 class="selected-lists-title">Listas seleccionadas</h3>
    <div class="selected-lists-content">
      <ul class="party-list">
        <li
          v-for="(partyData, party) in groupedSelectedItems"
          :key="party"
          class="party-item"
        >
          <span class="party-name">{{ party }}</span>
          <ul v-if="selectedCandidates.length > 0" class="candidate-items">
            <li
              v-for="candidate in partyData.candidates"
              :key="candidate.name"
              class="candidate-item"
            >
              {{ candidate.name }}: {{ candidate.votes }} votos
            </li>
          </ul>
          <ul v-else class="list-items">
            <li
              v-for="list in partyData.lists"
              :key="list.number"
              class="list-item"
            >
              Lista {{ list.number }}: {{ list.votes }} votos
            </li>
          </ul>
        </li>
      </ul>
    </div>
    <div class="total-votes">Total votos: {{ getTotalVotes() }}</div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  isMobileHidden: boolean;
  selectedCandidates: string[];
  groupedSelectedItems: Record<string, { candidates: any[]; lists: any[] }>;
  getTotalVotes: () => number;
}

const props = defineProps<Props>();

// Debugging props
console.log("Selected Candidates:", props.selectedCandidates);
console.log("Grouped Selected Items:", props.groupedSelectedItems);
console.log("Is Mobile Hidden:", props.isMobileHidden);
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
  font-size: 1.2em;
  color: #333;
}

.party-list {
  list-style-type: none;
  padding: 0;
  margin: 0;
}

.party-item {
  margin-bottom: 10px;
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

.total-votes {
  margin-top: 20px;
  padding-top: 10px;
  border-top: 1px solid #ddd;
  font-size: 1.1em;
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
