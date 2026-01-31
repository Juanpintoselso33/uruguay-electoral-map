<script setup lang="ts">
import { computed } from 'vue';
import { useElectoralStore } from '../../stores/electoral';
import { Calendar, Users, Vote, Building2 } from 'lucide-vue-next';

const store = useElectoralStore();

// Get election details from catalog
const electionDetails = computed(() => {
  return store.electionsFromCatalog.map(election => ({
    ...election,
    isAvailable: store.availableElections.includes(election.id),
    isCurrent: store.currentElection === election.id,
  }));
});

const electionTypeIcon = (type: string) => {
  switch (type) {
    case 'internas': return Users;
    case 'nacionales': return Vote;
    case 'balotaje': return Vote;
    case 'departamentales': return Building2;
    default: return Calendar;
  }
};

const electionTypeColor = (type: string) => {
  switch (type) {
    case 'internas': return 'bg-blue-500';
    case 'nacionales': return 'bg-purple-500';
    case 'balotaje': return 'bg-orange-500';
    case 'departamentales': return 'bg-green-500';
    default: return 'bg-gray-500';
  }
};

const electionTypeLabel = (type: string) => {
  switch (type) {
    case 'internas': return 'Internas';
    case 'nacionales': return 'Nacionales';
    case 'balotaje': return 'Balotaje';
    case 'departamentales': return 'Departamentales';
    default: return type;
  }
};

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('es-UY', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date);
};

const handleSelectElection = async (electionId: string) => {
  if (store.availableElections.includes(electionId)) {
    await store.switchElection(electionId);
  }
};
</script>

<template>
  <div class="election-selector">
    <div class="election-header">
      <h3 class="election-title">Elecciones Disponibles</h3>
      <p class="election-subtitle">
        Selecciona una elección para explorar los resultados
      </p>
    </div>

    <div class="elections-timeline">
      <div
        v-for="election in electionDetails"
        :key="election.id"
        :class="[
          'election-card',
          {
            'election-current': election.isCurrent,
            'election-disabled': !election.isAvailable,
          }
        ]"
        @click="election.isAvailable && handleSelectElection(election.id)"
      >
        <!-- Year badge -->
        <div class="election-year">{{ election.year }}</div>

        <!-- Type indicator -->
        <div :class="['election-type-badge', electionTypeColor(election.type)]">
          <component :is="electionTypeIcon(election.type)" :size="16" />
          <span>{{ electionTypeLabel(election.type) }}</span>
        </div>

        <!-- Content -->
        <div class="election-content">
          <h4 class="election-name">{{ election.name }}</h4>
          <div class="election-date">
            <Calendar :size="14" />
            <span>{{ formatDate(election.date) }}</span>
          </div>
        </div>

        <!-- Status indicator -->
        <div v-if="election.isCurrent" class="election-current-badge">
          Seleccionada
        </div>
        <div v-else-if="!election.isAvailable" class="election-unavailable-badge">
          Próximamente
        </div>
      </div>
    </div>

    <!-- Compact timeline view for mobile -->
    <div class="elections-compact">
      <div class="compact-timeline">
        <div
          v-for="election in electionDetails"
          :key="election.id"
          :class="[
            'compact-item',
            {
              'compact-current': election.isCurrent,
              'compact-disabled': !election.isAvailable,
            }
          ]"
          @click="election.isAvailable && handleSelectElection(election.id)"
        >
          <div class="compact-year">{{ election.year }}</div>
          <div :class="['compact-dot', electionTypeColor(election.type)]" />
          <div class="compact-label">{{ electionTypeLabel(election.type) }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.election-selector {
  width: 100%;
}

.election-header {
  margin-bottom: 1.5rem;
}

.election-title {
  font-family: 'DM Serif Display', serif;
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 0.5rem;
}

.election-subtitle {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
}

/* Card grid view (Desktop) */
.elections-timeline {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

@media (max-width: 768px) {
  .elections-timeline {
    display: none;
  }
}

.election-card {
  position: relative;
  background: var(--color-surface);
  border: 2px solid var(--color-border);
  border-radius: 12px;
  padding: 1.25rem;
  cursor: pointer;
  transition: all 0.2s ease;
  overflow: hidden;
}

.election-card:hover:not(.election-disabled) {
  border-color: var(--color-accent);
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
}

.election-card.election-current {
  border-color: var(--color-accent);
  background: linear-gradient(135deg, var(--color-accent-light) 0%, var(--color-surface) 100%);
}

.election-card.election-disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: var(--color-bg);
}

.election-year {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  font-family: 'DM Serif Display', serif;
  font-size: 2rem;
  font-weight: 700;
  color: var(--color-text);
  opacity: 0.15;
  line-height: 1;
}

.election-type-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.75rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  color: white;
  margin-bottom: 1rem;
}

.election-content {
  margin-top: 0.5rem;
}

.election-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 0.5rem;
  line-height: 1.3;
}

.election-date {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--color-text-secondary);
}

.election-current-badge {
  margin-top: 1rem;
  padding: 0.5rem;
  background: var(--color-accent);
  color: white;
  border-radius: 6px;
  text-align: center;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.election-unavailable-badge {
  margin-top: 1rem;
  padding: 0.5rem;
  background: var(--color-border);
  color: var(--color-text-secondary);
  border-radius: 6px;
  text-align: center;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Compact timeline view (Mobile) */
.elections-compact {
  display: none;
}

@media (max-width: 768px) {
  .elections-compact {
    display: block;
  }
}

.compact-timeline {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.5rem;
}

.compact-item {
  display: grid;
  grid-template-columns: 60px 32px 1fr;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem;
  background: var(--color-surface);
  border: 2px solid var(--color-border);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.compact-item:active:not(.compact-disabled) {
  transform: scale(0.98);
}

.compact-item.compact-current {
  border-color: var(--color-accent);
  background: linear-gradient(90deg, var(--color-accent-light) 0%, var(--color-surface) 100%);
}

.compact-item.compact-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.compact-year {
  font-family: 'DM Serif Display', serif;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text);
  text-align: center;
}

.compact-dot {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  flex-shrink: 0;
}

.compact-label {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-text);
}

/* Dark mode */
[data-theme="dark"] .election-card {
  background: var(--color-surface);
  border-color: var(--color-border);
}

[data-theme="dark"] .election-card.election-current {
  background: linear-gradient(135deg, rgba(0, 102, 204, 0.2) 0%, var(--color-surface) 100%);
}

[data-theme="dark"] .compact-item.compact-current {
  background: linear-gradient(90deg, rgba(0, 102, 204, 0.2) 0%, var(--color-surface) 100%);
}
</style>
