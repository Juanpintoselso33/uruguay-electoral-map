<template>
  <nav class="bottom-nav" role="tablist" aria-label="Panel de navegacion">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      :class="['nav-tab', { 'nav-tab-active': activeTab === tab.id }]"
      role="tab"
      :id="`tab-${tab.id}`"
      :aria-selected="activeTab === tab.id"
      :aria-controls="`tab-panel-${tab.id}`"
      :tabindex="activeTab === tab.id ? 0 : -1"
      @click="handleTabClick(tab.id)"
      @keydown="handleKeyDown($event, tab.id)"
    >
      <span class="nav-tab-icon" aria-hidden="true">
        <component :is="tab.icon" :size="22" :stroke-width="activeTab === tab.id ? 2.5 : 2" />
      </span>
      <span class="nav-tab-label">{{ tab.label }}</span>

      <!-- Badge -->
      <Transition name="badge">
        <span
          v-if="tab.badge && tab.badge > 0"
          class="nav-tab-badge"
          :aria-label="`${tab.badge} ${tab.badge === 1 ? 'filtro activo' : 'filtros activos'}`"
        >
          {{ tab.badge > 99 ? '99+' : tab.badge }}
        </span>
      </Transition>

      <!-- Active indicator -->
      <span v-if="activeTab === tab.id" class="nav-tab-indicator" aria-hidden="true" />
    </button>
  </nav>
</template>

<script setup lang="ts">
import { computed, type Component } from 'vue'
import { SlidersHorizontal, BarChart3 } from 'lucide-vue-next'

export type TabId = 'filters' | 'stats'

interface Tab {
  id: TabId
  label: string
  icon: Component
  badge?: number
}

interface Props {
  activeTab: TabId
  filterCount?: number
}

const props = withDefaults(defineProps<Props>(), {
  filterCount: 0
})

const emit = defineEmits<{
  'tab-change': [tabId: TabId]
}>()

const tabs = computed<Tab[]>(() => [
  {
    id: 'filters',
    label: 'Filtros',
    icon: SlidersHorizontal,
    badge: props.filterCount
  },
  {
    id: 'stats',
    label: 'Estadisticas',
    icon: BarChart3
  }
])

const handleTabClick = (tabId: TabId) => {
  emit('tab-change', tabId)
}

// Keyboard navigation between tabs
const handleKeyDown = (event: KeyboardEvent, currentTabId: TabId) => {
  const tabIds: TabId[] = ['filters', 'stats']
  const currentIndex = tabIds.indexOf(currentTabId)

  let newIndex = currentIndex
  let handled = false

  switch (event.key) {
    case 'ArrowLeft':
    case 'ArrowUp':
      newIndex = currentIndex > 0 ? currentIndex - 1 : tabIds.length - 1
      handled = true
      break
    case 'ArrowRight':
    case 'ArrowDown':
      newIndex = currentIndex < tabIds.length - 1 ? currentIndex + 1 : 0
      handled = true
      break
    case 'Home':
      newIndex = 0
      handled = true
      break
    case 'End':
      newIndex = tabIds.length - 1
      handled = true
      break
  }

  if (handled) {
    event.preventDefault()
    emit('tab-change', tabIds[newIndex])
    // Focus the new tab
    const newTab = document.getElementById(`tab-${tabIds[newIndex]}`)
    newTab?.focus()
  }
}
</script>

<style scoped>
.bottom-nav {
  display: flex;
  gap: 8px;
  padding: 8px 16px 12px;
  background: transparent;
}

.nav-tab {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 8px 8px;
  min-height: 56px;
  background: var(--color-bg, #f5f5f5);
  border: none;
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  color: var(--color-text-secondary, #666);
  font-family: inherit;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
  overflow: hidden;
}

.nav-tab:hover {
  background: var(--color-border, #e5e5e5);
}

.nav-tab:active {
  transform: scale(0.97);
}

/* Focus indicator */
.nav-tab:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--color-accent, #0066cc), 0 0 0 5px rgba(0, 102, 204, 0.2);
}

/* Active tab */
.nav-tab-active {
  background: var(--color-accent, #0066cc);
  color: white;
}

.nav-tab-active:hover {
  background: var(--color-accent, #0066cc);
  filter: brightness(1.1);
}

/* Icon */
.nav-tab-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  transition: transform 0.2s ease;
}

.nav-tab-active .nav-tab-icon {
  transform: scale(1.05);
}

/* Label */
.nav-tab-label {
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1;
  letter-spacing: 0.01em;
}

/* Badge */
.nav-tab-badge {
  position: absolute;
  top: 4px;
  right: calc(50% - 24px);
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  background: #ef4444;
  color: white;
  font-size: 0.6875rem;
  font-weight: 700;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.nav-tab-active .nav-tab-badge {
  background: white;
  color: var(--color-accent, #0066cc);
}

/* Badge animation */
.badge-enter-active,
.badge-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.badge-enter-from {
  opacity: 0;
  transform: scale(0.5);
}

.badge-leave-to {
  opacity: 0;
  transform: scale(0.5);
}

/* Active indicator line */
.nav-tab-indicator {
  position: absolute;
  bottom: 4px;
  left: 50%;
  transform: translateX(-50%);
  width: 20px;
  height: 3px;
  background: rgba(255, 255, 255, 0.4);
  border-radius: 1.5px;
}

/* Dark mode */
:root.dark .nav-tab,
.dark .nav-tab {
  background: var(--color-border, #2a2a2a);
  color: var(--color-text-secondary, #a3a3a3);
}

:root.dark .nav-tab:hover,
.dark .nav-tab:hover {
  background: rgba(255, 255, 255, 0.1);
}

:root.dark .nav-tab-active,
.dark .nav-tab-active {
  background: var(--color-accent, #3b82f6);
  color: white;
}

:root.dark .nav-tab-active:hover,
.dark .nav-tab-active:hover {
  background: var(--color-accent, #3b82f6);
}

:root.dark .nav-tab:focus-visible,
.dark .nav-tab:focus-visible {
  box-shadow: 0 0 0 3px var(--color-accent, #3b82f6), 0 0 0 5px rgba(59, 130, 246, 0.2);
}

:root.dark .nav-tab-active .nav-tab-badge,
.dark .nav-tab-active .nav-tab-badge {
  background: white;
  color: var(--color-accent, #3b82f6);
}

/* Landscape adjustments */
@media (orientation: landscape) and (max-height: 500px) {
  .bottom-nav {
    padding: 6px 12px 8px;
  }

  .nav-tab {
    min-height: 48px;
    padding: 8px 6px 6px;
    border-radius: 12px;
  }

  .nav-tab-icon {
    width: 20px;
    height: 20px;
  }

  .nav-tab-label {
    font-size: 0.6875rem;
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .nav-tab,
  .nav-tab-icon {
    transition: none;
  }

  .nav-tab:active {
    transform: none;
  }

  .badge-enter-active,
  .badge-leave-active {
    transition: opacity 0.1s ease;
  }
}
</style>
