<template>
  <div
    ref="containerRef"
    class="selected-lists-info"
    :class="{ 'mobile-hidden': isMobileHidden }"
    @touchstart="onTouchStart"
    @touchmove="onTouchMove"
    @touchend="onTouchEnd"
  >
    <div class="drag-handle"></div>
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
import { onMounted, computed, ref, watch, nextTick } from "vue";
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

const emit = defineEmits<{
  (e: "update:isMobileHidden", value: boolean): void;
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

const startY = ref(0);
const currentY = ref(0);
const isDragging = ref(false);

const onTouchStart = (e: TouchEvent) => {
  startY.value = e.touches[0].clientY;
  isDragging.value = true;
};

const onTouchMove = (e: TouchEvent) => {
  if (!isDragging.value) return;
  currentY.value = e.touches[0].clientY;
  const diff = startY.value - currentY.value;
  const threshold = window.innerHeight * 0.2; // 20% of screen height

  if (diff > threshold) {
    // Swipe up, show full content
    emit("update:isMobileHidden", false);
  } else if (diff < -threshold) {
    // Swipe down, hide content
    emit("update:isMobileHidden", true);
  }
};

const onTouchEnd = () => {
  isDragging.value = false;
};

const containerRef = ref<HTMLElement | null>(null);

const totalSelectedItems = computed(() => {
  return props.selectedLists.length + props.selectedCandidates.length;
});

const updateContainerHeight = async () => {
  await nextTick();
  if (containerRef.value) {
    const minHeight = 80; // Increased minimum height
    const itemHeight = 50; // Approximate height of each item in pixels
    const maxHeight = window.innerHeight * 0.7; // 70% of viewport height

    let calculatedHeight = minHeight + totalSelectedItems.value * itemHeight;
    calculatedHeight = Math.min(calculatedHeight, maxHeight);
    calculatedHeight = Math.max(calculatedHeight, minHeight);

    (containerRef.value as HTMLElement).style.height = `${calculatedHeight}px`;
    (containerRef.value as HTMLElement).style.overflowY =
      totalSelectedItems.value > 0 ? "auto" : "hidden";
  }
};

watch(totalSelectedItems, updateContainerHeight);

// Call updateContainerHeight when the component mounts
onMounted(updateContainerHeight);
</script>

<style lang="scss" scoped>
@import "@/styles/variables";

.selected-lists-info {
  position: absolute;
  top: 0;
  right: 0;
  width: 300px;
  background-color: rgba($background-color, 0.95);
  padding: 15px;
  border-radius: 0 0 0 15px;
  box-shadow: -2px 2px 10px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease-in-out, height 0.3s ease-in-out;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  max-height: calc(100vh - 60px); // Adjust based on your header height
}

.selected-lists-content {
  overflow-y: auto;
}

.selected-lists-title {
  margin-top: 0;
  margin-bottom: 15px;
  font-size: 1.3em;
  color: $primary-color;
  text-align: center;
}

.drag-handle {
  display: none;
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
}

.party-name {
  display: block;
  margin-bottom: 5px;
  color: #444;
  font-weight: bold;
}

.candidate-items,
.list-items {
  padding-left: 15px;
  margin: 0;
}

.candidate-item,
.list-item {
  margin-bottom: 3px;
  font-size: 0.9em;
  color: #666;
}

.party-total {
  margin-top: 5px;
  font-size: 0.9em;
  color: #666;
}

.total-votes {
  color: $primary-color;
  margin-top: 20px;
  padding-top: 10px;
  border-top: 1px solid #ddd;
  font-size: 1.2em;
}

@media (max-width: $mobile-breakpoint) {
  .selected-lists-info {
    position: fixed;
    top: auto;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100%;
    border-radius: 15px 15px 0 0;
    max-height: calc(100vh - 40px);
    min-height: 200px;
    transform: translateY(0);
    transition: transform 0.3s ease-in-out;
  }

  .selected-lists-info.mobile-hidden {
    transform: translateY(100%);
  }

  .selected-lists-content {
    max-height: calc(100vh - 120px);
  }

  .drag-handle {
    display: block;
    width: 40px;
    height: 5px;
    background-color: #ccc;
    border-radius: 3px;
    margin: 0 auto 10px;
    cursor: grab;
  }
}
</style>
