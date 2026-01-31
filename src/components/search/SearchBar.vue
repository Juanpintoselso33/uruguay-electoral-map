<template>
  <div class="search-bar" ref="searchRef">
    <div class="search-input-wrapper">
      <Search :size="18" class="search-icon" />
      <input
        v-model="query"
        @focus="isOpen = true"
        @keydown="handleKeydown"
        type="text"
        placeholder="Buscar departamento..."
        class="search-input"
      />
      <kbd v-if="!isMobile" class="search-kbd">⌘K</kbd>
    </div>

    <!-- Results Dropdown -->
    <Transition name="dropdown">
      <div v-if="isOpen && filteredDepartments.length > 0" class="search-results">
        <div
          v-for="(dept, index) in filteredDepartments"
          :key="dept.slug"
          :class="['search-result-item', { 'active': index === selectedIndex }]"
          @click="selectDepartment(dept)"
          @mouseenter="selectedIndex = index"
        >
          <MapPin :size="16" class="result-icon" />
          <span class="result-name">{{ dept.name }}</span>
          <span class="result-meta">{{ getMetaInfo(dept) }}</span>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useWindowSize, onClickOutside } from '@vueuse/core'
import { Search, MapPin } from 'lucide-vue-next'
import { useElectoralStore } from '../../stores/electoral'

const emit = defineEmits(['select'])

const store = useElectoralStore()
const query = ref('')
const isOpen = ref(false)
const selectedIndex = ref(0)
const searchRef = ref(null)

const { width } = useWindowSize()
const isMobile = computed(() => width.value < 768)

const filteredDepartments = computed(() => {
  if (!query.value) return store.regions
  const q = query.value.toLowerCase()
  return store.regions.filter(dept =>
    dept.name.toLowerCase().includes(q)
  ).slice(0, 5)
})

const getMetaInfo = (dept: any) => {
  // Podemos agregar metadata como población, votos totales, etc
  return ''
}

const selectDepartment = (dept: any) => {
  emit('select', dept)
  store.setCurrentRegion(dept)
  query.value = ''
  isOpen.value = false
  selectedIndex.value = 0
}

const handleKeydown = (e: KeyboardEvent) => {
  if (!isOpen.value) return

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault()
      selectedIndex.value = Math.min(selectedIndex.value + 1, filteredDepartments.value.length - 1)
      break
    case 'ArrowUp':
      e.preventDefault()
      selectedIndex.value = Math.max(selectedIndex.value - 1, 0)
      break
    case 'Enter':
      e.preventDefault()
      if (filteredDepartments.value[selectedIndex.value]) {
        selectDepartment(filteredDepartments.value[selectedIndex.value])
      }
      break
    case 'Escape':
      isOpen.value = false
      break
  }
}

// Cmd+K shortcut
const handleGlobalKeydown = (e: KeyboardEvent) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault()
    const input = searchRef.value?.querySelector('input')
    input?.focus()
  }
}

onClickOutside(searchRef, () => {
  isOpen.value = false
})

onMounted(() => {
  document.addEventListener('keydown', handleGlobalKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleGlobalKeydown)
})
</script>

<style scoped>
.search-bar {
  position: relative;
  width: 100%;
  max-width: 400px;
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 12px;
  color: var(--color-text-secondary);
}

.search-input {
  width: 100%;
  height: 40px;
  padding: 0 40px 0 40px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 0.9rem;
  transition: all 0.2s ease;
}

.search-input:focus {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.1);
}

.dark .search-input:focus {
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.search-kbd {
  position: absolute;
  right: 12px;
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  background: var(--color-surface);
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--color-border);
  font-family: monospace;
}

/* Results */
.search-results {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  max-height: 300px;
  overflow-y: auto;
  z-index: var(--z-sidebar);
}

.search-result-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  cursor: pointer;
  border-bottom: 1px solid var(--color-border);
  transition: background-color 0.15s ease;
}

.search-result-item:last-child {
  border-bottom: none;
}

.search-result-item:hover,
.search-result-item.active {
  background: var(--color-bg);
}

.result-icon {
  color: var(--color-accent);
  flex-shrink: 0;
}

.result-name {
  flex: 1;
  font-weight: 500;
}

.result-meta {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}

/* Transitions */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

@media (max-width: 768px) {
  .search-bar {
    max-width: none;
  }

  .search-kbd {
    display: none;
  }
}
</style>
