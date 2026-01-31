<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useElectoralStore } from '../../stores/electoral';
import { ArrowUp, ArrowDown, Minus, X } from 'lucide-vue-next';
import MapLibreView from '../map/MapLibreView.vue';

const props = defineProps<{
  departmentSlug: string;
}>();

const emit = defineEmits(['close']);

const store = useElectoralStore();

// Comparison state
const leftElection = ref<string>('');
const rightElection = ref<string>('');
const leftData = ref<any>(null);
const rightData = ref<any>(null);
const isLoading = ref(false);

// Get available elections for comparison
const availableElections = computed(() => {
  return store.electionsFromCatalog.filter(e =>
    store.availableElections.includes(e.id)
  );
});

// Load data for a specific election
async function loadElectionData(electionId: string) {
  try {
    const response = await fetch(
      `/data/electoral/${electionId}/${props.departmentSlug}/odd.json`
    );

    if (!response.ok) {
      console.warn(`No data for ${electionId}`);
      return null;
    }

    return await response.json();
  } catch (err) {
    console.error(`Error loading ${electionId}:`, err);
    return null;
  }
}

// Calculate comparison statistics
const comparisonStats = computed(() => {
  if (!leftData.value || !rightData.value) return null;

  const leftVotes = leftData.value.metadata.stats.totalVotes;
  const rightVotes = rightData.value.metadata.stats.totalVotes;
  const difference = rightVotes - leftVotes;
  const percentChange = leftVotes > 0 ? ((difference / leftVotes) * 100) : 0;

  // Party comparison
  const leftParties = leftData.value.data.partyList || [];
  const rightParties = rightData.value.data.partyList || [];

  // Calculate votes by party for both elections
  const getPartyVotes = (data: any) => {
    const votesByParty: Record<string, number> = {};

    Object.entries(data.data.votosPorListas || {}).forEach(([list, votes]: [string, any]) => {
      const party = data.data.partiesByList[list];
      if (party) {
        votesByParty[party] = (votesByParty[party] || 0) +
          Object.values(votes as Record<string, number>).reduce((a, b) => a + b, 0);
      }
    });

    return votesByParty;
  };

  const leftPartyVotes = getPartyVotes(leftData.value);
  const rightPartyVotes = getPartyVotes(rightData.value);

  // Find biggest changes
  const partyChanges = Object.keys({ ...leftPartyVotes, ...rightPartyVotes }).map(party => {
    const left = leftPartyVotes[party] || 0;
    const right = rightPartyVotes[party] || 0;
    const change = right - left;
    const pctChange = left > 0 ? ((change / left) * 100) : 0;

    return {
      party,
      leftVotes: left,
      rightVotes: right,
      change,
      percentChange: pctChange,
    };
  }).sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

  return {
    totalVotes: {
      left: leftVotes,
      right: rightVotes,
      difference,
      percentChange,
    },
    partyChanges: partyChanges.slice(0, 5), // Top 5 changes
  };
});

// Load comparison data
async function loadComparison() {
  if (!leftElection.value || !rightElection.value) return;

  isLoading.value = true;

  try {
    const [left, right] = await Promise.all([
      loadElectionData(leftElection.value),
      loadElectionData(rightElection.value),
    ]);

    leftData.value = left;
    rightData.value = right;
  } catch (err) {
    console.error('Error loading comparison:', err);
  } finally {
    isLoading.value = false;
  }
}

// Initialize with default elections
onMounted(() => {
  if (availableElections.value.length >= 2) {
    leftElection.value = availableElections.value[0].id;
    rightElection.value = availableElections.value[1].id;
    loadComparison();
  }
});

// Format number with thousand separators
const formatNumber = (num: number) => {
  return new Intl.NumberFormat('es-UY').format(Math.round(num));
};

// Get trend indicator
const getTrendIndicator = (change: number) => {
  if (change > 0) return { icon: ArrowUp, color: 'text-green-600', label: 'Aumento' };
  if (change < 0) return { icon: ArrowDown, color: 'text-red-600', label: 'Disminución' };
  return { icon: Minus, color: 'text-gray-600', label: 'Sin cambio' };
};

// Get election name
const getElectionName = (id: string) => {
  return availableElections.value.find(e => e.id === id)?.name || id;
};
</script>

<template>
  <div class="comparison-view">
    <!-- Header -->
    <div class="comparison-header">
      <div class="header-content">
        <h2 class="comparison-title">Modo Comparación</h2>
        <p class="comparison-subtitle">
          Compara resultados entre diferentes elecciones
        </p>
      </div>
      <button @click="emit('close')" class="close-button">
        <X :size="24" />
      </button>
    </div>

    <!-- Election Selectors -->
    <div class="election-selectors">
      <div class="selector-group">
        <label class="selector-label">Elección Base</label>
        <select v-model="leftElection" @change="loadComparison" class="election-select">
          <option v-for="election in availableElections" :key="election.id" :value="election.id">
            {{ election.name }}
          </option>
        </select>
      </div>

      <div class="vs-divider">vs</div>

      <div class="selector-group">
        <label class="selector-label">Elección a Comparar</label>
        <select v-model="rightElection" @change="loadComparison" class="election-select">
          <option v-for="election in availableElections" :key="election.id" :value="election.id">
            {{ election.name }}
          </option>
        </select>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <p>Cargando datos de comparación...</p>
    </div>

    <!-- Comparison Content -->
    <div v-else-if="comparisonStats" class="comparison-content">
      <!-- Summary Stats -->
      <div class="summary-section">
        <h3 class="section-title">Resumen de Cambios</h3>

        <!-- Total Votes Change -->
        <div class="stat-card total-votes">
          <div class="stat-header">
            <span class="stat-label">Votos Totales</span>
            <component
              :is="getTrendIndicator(comparisonStats.totalVotes.difference).icon"
              :class="getTrendIndicator(comparisonStats.totalVotes.difference).color"
              :size="20"
            />
          </div>

          <div class="stat-values">
            <div class="value-item">
              <span class="value-label">{{ getElectionName(leftElection) }}</span>
              <span class="value-number">{{ formatNumber(comparisonStats.totalVotes.left) }}</span>
            </div>

            <div class="value-arrow">→</div>

            <div class="value-item">
              <span class="value-label">{{ getElectionName(rightElection) }}</span>
              <span class="value-number">{{ formatNumber(comparisonStats.totalVotes.right) }}</span>
            </div>
          </div>

          <div class="stat-change">
            <span :class="[
              'change-badge',
              comparisonStats.totalVotes.difference > 0 ? 'change-positive' : 'change-negative'
            ]">
              {{ comparisonStats.totalVotes.difference > 0 ? '+' : '' }}
              {{ formatNumber(comparisonStats.totalVotes.difference) }}
              ({{ comparisonStats.totalVotes.percentChange > 0 ? '+' : '' }}{{ comparisonStats.totalVotes.percentChange.toFixed(1) }}%)
            </span>
          </div>
        </div>

        <!-- Party Changes -->
        <div class="party-changes">
          <h4 class="subsection-title">Cambios por Partido</h4>

          <div class="party-change-list">
            <div
              v-for="partyChange in comparisonStats.partyChanges"
              :key="partyChange.party"
              class="party-change-item"
            >
              <div class="party-name">
                {{ partyChange.party }}
              </div>

              <div class="party-comparison">
                <span class="party-votes">{{ formatNumber(partyChange.leftVotes) }}</span>
                <component
                  :is="getTrendIndicator(partyChange.change).icon"
                  :class="getTrendIndicator(partyChange.change).color"
                  :size="16"
                />
                <span class="party-votes">{{ formatNumber(partyChange.rightVotes) }}</span>
              </div>

              <div class="party-change-badge">
                <span :class="[
                  'change-text',
                  partyChange.change > 0 ? 'text-green-600' : 'text-red-600'
                ]">
                  {{ partyChange.change > 0 ? '+' : '' }}{{ formatNumber(partyChange.change) }}
                </span>
                <span class="change-percent">
                  ({{ partyChange.percentChange > 0 ? '+' : '' }}{{ partyChange.percentChange.toFixed(1) }}%)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Map Comparison (Future enhancement) -->
      <!-- <div class="maps-section">
        <div class="map-container">
          <h4>{{ getElectionName(leftElection) }}</h4>
          <MapLibreView ... />
        </div>
        <div class="map-container">
          <h4>{{ getElectionName(rightElection) }}</h4>
          <MapLibreView ... />
        </div>
      </div> -->
    </div>

    <!-- No data state -->
    <div v-else class="no-data-state">
      <p>Selecciona dos elecciones para comenzar la comparación</p>
    </div>
  </div>
</template>

<style scoped>
.comparison-view {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
  overflow: hidden;
}

.comparison-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  border-bottom: 2px solid var(--color-border);
  background: var(--color-surface);
}

.header-content {
  flex: 1;
}

.comparison-title {
  font-family: 'DM Serif Display', serif;
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 0.25rem;
}

.comparison-subtitle {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
}

.close-button {
  padding: 0.5rem;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  color: var(--color-text);
  transition: all 0.2s;
}

.close-button:hover {
  background: var(--color-bg);
  border-color: var(--color-accent);
}

/* Election Selectors */
.election-selectors {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 1.5rem;
  padding: 1.5rem;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.selector-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.selector-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.election-select {
  padding: 0.75rem 1rem;
  background: var(--color-bg);
  border: 2px solid var(--color-border);
  border-radius: 8px;
  font-size: 0.9375rem;
  color: var(--color-text);
  cursor: pointer;
  transition: all 0.2s;
}

.election-select:focus {
  outline: none;
  border-color: var(--color-accent);
}

.vs-divider {
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'DM Serif Display', serif;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-accent);
  padding-top: 1.5rem;
}

/* Loading State */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  gap: 1rem;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Comparison Content */
.comparison-content {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.summary-section {
  max-width: 900px;
  margin: 0 auto;
}

.section-title {
  font-family: 'DM Serif Display', serif;
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 1.5rem;
}

.subsection-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 1rem;
}

/* Stat Cards */
.stat-card {
  background: var(--color-surface);
  border: 2px solid var(--color-border);
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.stat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.stat-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-values {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  margin-bottom: 1rem;
}

.value-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.value-label {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}

.value-number {
  font-family: 'DM Serif Display', serif;
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--color-text);
}

.value-arrow {
  font-size: 1.5rem;
  color: var(--color-text-secondary);
}

.stat-change {
  display: flex;
  justify-content: center;
}

.change-badge {
  display: inline-block;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.9375rem;
}

.change-positive {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
}

.change-negative {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

/* Party Changes */
.party-changes {
  margin-top: 2rem;
}

.party-change-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.party-change-item {
  display: grid;
  grid-template-columns: 2fr 3fr 2fr;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
}

.party-name {
  font-weight: 600;
  color: var(--color-text);
}

.party-comparison {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

.party-votes {
  font-family: 'DM Serif Display', serif;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text);
}

.party-change-badge {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.25rem;
}

.change-text {
  font-weight: 700;
  font-size: 1rem;
}

.change-percent {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}

/* No Data State */
.no-data-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  color: var(--color-text-secondary);
}

/* Responsive */
@media (max-width: 768px) {
  .election-selectors {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .vs-divider {
    padding: 0;
  }

  .party-change-item {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }

  .party-comparison {
    justify-content: space-between;
  }

  .party-change-badge {
    align-items: flex-start;
  }
}
</style>
