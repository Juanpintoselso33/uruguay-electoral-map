<template>
  <div>
    <div
      class="mobile-toggle"
      @click="toggleVisibility"
      tabindex="0"
      role="button"
      aria-label="Toggle selected lists visibility"
    >
      <a class="mobile-toggle-text">Ver listas seleccionadas</a>
      <span
        class="arrow"
        :class="{
          'arrow-up': !isHidden,
          'arrow-down': isHidden,
        }"
      ></span>
    </div>
    <div class="selected-lists-info" :class="{ 'mobile-hidden': isHidden }">
      <div class="selected-lists-content">
        <h3 class="selected-lists-title">
          {{ title }}
        </h3>
        <ul class="party-list">
          <li
            v-for="(partyData, party) in groupedItems"
            :key="party"
            class="party-item"
          >
            <strong class="party-name"
              >{{ party }}: {{ partyData.totalVotes }} votos</strong
            >
            <ul class="list-items" v-if="!showCandidates">
              <li
                v-for="list in partyData.lists"
                :key="list.number"
                class="list-item"
              >
                Lista {{ list.number }}: {{ list.votes }} votos
              </li>
            </ul>
            <ul class="candidate-items" v-else>
              <li
                v-for="candidate in partyData.candidates"
                :key="candidate.name"
                class="candidate-item"
              >
                {{ candidate.name }}: {{ candidate.votes }} votos
              </li>
            </ul>
          </li>
        </ul>
        <div class="total-votes">
          <strong>Total de votos:</strong> {{ totalVotes }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

export interface PartyData {
  totalVotes: number;
  lists?: { number: string; votes: number }[];
  candidates?: { name: string; votes: number }[];
}

interface Props {
  groupedItems: Record<string, PartyData>;
  totalVotes: number;
  showCandidates: boolean;
}

const props = defineProps<Props>();

const isHidden = ref(true);

const title = computed(() => {
  return props.showCandidates ? 'Candidatos seleccionados' : 'Listas seleccionadas';
});

const toggleVisibility = () => {
  isHidden.value = !isHidden.value;
};
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
  z-index: var(--z-dropdown);
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
  list-style-type: none;
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

.mobile-toggle {
  display: none;
  cursor: pointer;
  padding: 10px;
  text-align: center;
}

.arrow {
  display: inline-block;
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
}

.arrow-up {
  border-bottom: 5px solid black;
}

.arrow-down {
  border-top: 5px solid black;
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

  .selected-lists-content {
    max-height: calc(70vh - 40px);
    overflow-y: auto;
    padding-bottom: 20px;
    -webkit-overflow-scrolling: touch;
  }

  .selected-lists-info.mobile-hidden {
    transform: translateY(300%);
  }

  .mobile-toggle {
    display: block;
    height: 40px;
    display: flex;
    font-size: 1.2rem;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background-color: white;
    border-radius: 8px 8px 0 0;
    box-shadow: 0 -2px 5px rgba(0, 0, 0, 0.1);
    z-index: var(--z-modal);
  }

  .mobile-toggle-text {
    font-size: 1.2rem;
    color: #333;
    font-weight: bold;
    margin-right: 10px;
  }

  .mobile-hidden .selected-lists-content {
    display: none;
  }

  .selected-lists-content {
    padding-top: 10px;
  }
}
</style>
