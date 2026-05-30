<template>
  <div class="stats-panel">
    <div class="stats-header">
      <h2 class="stats-title">Estadísticas</h2>
      <div class="export-group">
        <button
          @click="toggleExportMenu"
          class="export-btn"
          title="Exportar datos"
          :aria-expanded="showExportMenu"
        >
          <Download :size="16" />
          <span>Exportar</span>
        </button>

        <!-- Export Format Menu -->
        <div v-if="showExportMenu" class="export-menu">
          <button @click="handleExport('csv')" class="export-menu-item">
            <FileText :size="16" />
            <div class="export-item-info">
              <span class="export-item-title">CSV Completo</span>
              <span class="export-item-desc">Todos los votos por zona</span>
            </div>
          </button>
          <button @click="handleExport('geojson')" class="export-menu-item">
            <Map :size="16" />
            <div class="export-item-info">
              <span class="export-item-title">GeoJSON</span>
              <span class="export-item-desc">Para análisis GIS</span>
            </div>
          </button>
          <button @click="handleExport('png')" class="export-menu-item">
            <Image :size="16" />
            <div class="export-item-info">
              <span class="export-item-title">Imagen PNG</span>
              <span class="export-item-desc">Captura del mapa</span>
            </div>
          </button>
          <button @click="handleExport('pdf')" class="export-menu-item">
            <FileDown :size="16" />
            <div class="export-item-info">
              <span class="export-item-title">Reporte PDF</span>
              <span class="export-item-desc">Estadísticas completas</span>
            </div>
          </button>
        </div>
      </div>
    </div>

    <!-- Current Department Info -->
    <div
      v-if="currentRegion"
      class="department-card"
      role="region"
      aria-label="Estadísticas del departamento"
    >
      <h3 class="department-name">{{ currentRegion.name }}</h3>
      <div class="department-stats" role="group" aria-live="polite">
        <div class="stat-item">
          <span class="stat-label">Listas disponibles</span>
          <span class="stat-value" aria-label="Listas disponibles">{{ availableLists.length }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Partidos</span>
          <span class="stat-value" aria-label="Partidos políticos">{{ uniqueParties.length }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Total votos</span>
          <span class="stat-value" aria-label="Total de votos">{{ totalVotes.toLocaleString() }}</span>
        </div>
      </div>
    </div>

    <!-- Data Source Toggle -->
    <div class="data-source-section">
      <label class="section-label">Fuente de datos</label>
      <div class="toggle-group" role="group" aria-label="Cambiar fuente de datos">
        <button
          :class="['toggle-btn', { active: !isODN }]"
          @click="handleToggleSource(false)"
          :aria-pressed="!isODN"
          aria-label="Orden Departamental Departamental"
        >
          ODD
        </button>
        <button
          :class="['toggle-btn', { active: isODN }]"
          @click="handleToggleSource(true)"
          :aria-pressed="isODN"
          aria-label="Orden Departamental Nacional"
        >
          ODN
        </button>
      </div>
    </div>

    <!-- Party Distribution Chart -->
    <div v-if="showCharts" class="chart-section">
      <h4 class="chart-title">Distribución por partido</h4>
      <div class="chart-container">
        <Pie :data="partyChartData" :options="chartOptions" />
      </div>
    </div>

    <!-- Top Lists -->
    <div class="chart-section">
      <h4 class="chart-title">Listas más votadas</h4>
      <div class="top-lists">
        <div
          v-for="(list, index) in topLists"
          :key="list.number"
          class="top-list-item"
        >
          <div class="list-rank">{{ index + 1 }}</div>
          <div class="list-info">
            <div class="list-number">Lista {{ list.number }}</div>
            <div class="list-party">{{ list.party }}</div>
          </div>
          <div class="list-votes">{{ list.votes.toLocaleString() }}</div>
        </div>
      </div>
    </div>

    <!-- Selected Lists Info -->
    <div v-if="selectedLists.length > 0" class="selected-section">
      <h4 class="chart-title">Selección actual</h4>
      <div class="selected-lists">
        <div
          v-for="list in selectedLists"
          :key="list"
          class="selected-list-item"
        >
          <div class="selected-list-info">
            <span class="selected-list-number">Lista {{ list }}</span>
            <span class="selected-list-party">{{ partiesByList[list] }}</span>
          </div>
          <button
            @click="emit('remove-list', list)"
            class="remove-btn"
            title="Remover"
          >
            <X :size="14" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Pie } from 'vue-chartjs'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { Download, X, FileText, Map, Image, FileDown } from 'lucide-vue-next'
import { useScreenReaderAnnouncements } from '@/composables/useScreenReaderAnnouncements'
import { useDataExport, type ExportFormat } from '@/composables/useDataExport'
import { PARTY_COLORS, getPartyColor } from '@/utils/partyColors'

ChartJS.register(ArcElement, Tooltip, Legend)

const props = defineProps<{
  currentRegion: any
  availableLists: string[]
  selectedLists: string[]
  isODN: boolean
  partiesByList: Record<string, string>
  votosPorListas: Record<string, Record<string, number>>
}>()

const emit = defineEmits(['toggle-source', 'remove-list', 'export'])

// Export menu state
const showExportMenu = ref(false)

// Screen reader announcements
const { announceDataSourceChange, announceStatisticsUpdate } = useScreenReaderAnnouncements()

// Data export
const { exportData } = useDataExport()

// Calculate unique parties
const uniqueParties = computed(() => {
  return Array.from(new Set(Object.values(props.partiesByList)))
})

// Calculate total votes
const totalVotes = computed(() => {
  let total = 0
  Object.values(props.votosPorListas).forEach(zones => {
    Object.values(zones).forEach(votes => {
      total += votes
    })
  })
  return total
})

// Calculate votes by party
const votesByParty = computed(() => {
  const partyVotes: Record<string, number> = {}

  Object.entries(props.votosPorListas).forEach(([list, zones]) => {
    const party = props.partiesByList[list]
    if (!party) return

    const listTotal = Object.values(zones).reduce((sum, votes) => sum + votes, 0)

    if (!partyVotes[party]) {
      partyVotes[party] = 0
    }
    partyVotes[party] += listTotal
  })

  return partyVotes
})

// Chart data using official party colors
const partyChartData = computed(() => {
  const parties = Object.keys(votesByParty.value)
  return {
    labels: parties,
    datasets: [{
      data: parties.map(p => votesByParty.value[p]),
      backgroundColor: parties.map(p => getPartyColor(p)),
      borderWidth: 2,
      borderColor: '#fff'
    }]
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: true,
  plugins: {
    legend: {
      position: 'bottom' as const,
      labels: {
        boxWidth: 12,
        padding: 8,
        font: {
          size: 11
        }
      }
    },
    tooltip: {
      callbacks: {
        label: (context: any) => {
          const label = context.label || ''
          const value = context.parsed
          const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0)
          const percentage = ((value / total) * 100).toFixed(1)
          return `${label}: ${value.toLocaleString()} (${percentage}%)`
        }
      }
    }
  }
}

const showCharts = computed(() => {
  return Object.keys(votesByParty.value).length > 0
})

// Top lists
const topLists = computed(() => {
  const lists = Object.entries(props.votosPorListas).map(([list, zones]) => ({
    number: list,
    party: props.partiesByList[list] || 'Desconocido',
    votes: Object.values(zones).reduce((sum, votes) => sum + votes, 0)
  }))

  return lists.sort((a, b) => b.votes - a.votes).slice(0, 5)
})

const handleToggleSource = (isODN: boolean) => {
  const source = isODN ? 'ODN' : 'ODD'
  announceDataSourceChange(source)
  emit('toggle-source', isODN)
}

const toggleExportMenu = () => {
  showExportMenu.value = !showExportMenu.value
}

const handleExport = async (format: ExportFormat) => {
  showExportMenu.value = false
  emit('export')

  if (!props.currentRegion) return

  await exportData(format, {
    departmentName: props.currentRegion.name,
    departmentSlug: props.currentRegion.slug || 'data',
    votosPorListas: props.votosPorListas,
    partiesByList: props.partiesByList,
    geojsonData: props.currentRegion.geojsonData,
    mapElement: document.querySelector('.maplibre-container') as HTMLElement
  })
}

// Announce statistics updates
watch([totalVotes, uniqueParties], () => {
  const zonesCount = Object.keys(props.votosPorListas).length
  announceStatisticsUpdate({
    totalVotes: totalVotes.value,
    lists: props.availableLists.length,
    zones: zonesCount
  })
}, { immediate: false })
</script>

<style scoped>
.stats-panel {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.stats-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.stats-title {
  font-family: 'DM Serif Display', Georgia, serif;
  font-size: 1.5rem;
  font-weight: 400;
  margin: 0;
}

.export-group {
  position: relative;
}

.export-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--color-accent);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.export-btn:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

/* Export Menu */
.export-menu {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  min-width: 250px;
  z-index: var(--z-dropdown);
  overflow: hidden;
}

.export-menu-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.75rem 1rem;
  background: transparent;
  border: none;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;
  border-bottom: 1px solid var(--color-border);
}

.export-menu-item:last-child {
  border-bottom: none;
}

.export-menu-item:hover {
  background: var(--color-bg);
}

.export-item-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.export-item-title {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text);
}

.export-item-desc {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}

/* Department Card */
.department-card {
  background: var(--color-bg);
  border-radius: 8px;
  padding: 1rem;
  border: 1px solid var(--color-border);
}

.department-name {
  font-family: 'DM Serif Display', Georgia, serif;
  font-size: 1.25rem;
  margin: 0 0 1rem 0;
}

.department-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.stat-label {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--color-accent);
}

/* Data Source Toggle */
.data-source-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.section-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.toggle-group {
  display: flex;
  gap: 0.5rem;
}

.toggle-btn {
  flex: 1;
  padding: 0.75rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.toggle-btn.active {
  background: var(--color-accent);
  color: white;
  border-color: var(--color-accent);
}

.toggle-btn:not(.active):hover {
  background: var(--color-bg);
}

/* Charts */
.chart-section {
  background: var(--color-bg);
  border-radius: 8px;
  padding: 1rem;
  border: 1px solid var(--color-border);
}

.chart-title {
  font-size: 0.875rem;
  font-weight: 600;
  margin: 0 0 1rem 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.chart-container {
  max-width: 300px;
  margin: 0 auto;
}

/* Top Lists */
.top-lists {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.top-list-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--color-surface);
  border-radius: 6px;
  transition: all 0.2s ease;
}

.top-list-item:hover {
  transform: translateX(4px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.list-rank {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-accent);
  color: white;
  border-radius: 50%;
  font-weight: 600;
  font-size: 0.875rem;
}

.list-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.list-number {
  font-weight: 600;
  font-size: 0.9rem;
}

.list-party {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}

.list-votes {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--color-accent);
}

/* Selected Lists */
.selected-section {
  background: var(--color-bg);
  border-radius: 8px;
  padding: 1rem;
  border: 1px solid var(--color-border);
}

.selected-lists {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.selected-list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem;
  background: var(--color-surface);
  border-radius: 6px;
}

.selected-list-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.selected-list-number {
  font-weight: 600;
  font-size: 0.875rem;
}

.selected-list-party {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}

.remove-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.remove-btn:hover {
  background: var(--color-border);
}

@media (max-width: 768px) {
  .department-stats {
    grid-template-columns: 1fr;
  }
}
</style>
