<template>
  <Teleport to="body">
    <div v-if="isVisible" class="bottom-sheet-container">
      <!-- Backdrop -->
      <Transition name="backdrop">
        <div
          v-if="showBackdrop"
          class="bottom-sheet-backdrop"
          @click="handleBackdropClick"
          aria-hidden="true"
        />
      </Transition>

      <!-- Sheet -->
      <div
        ref="sheetRef"
        class="bottom-sheet"
        :class="[
          `snap-${currentSnap}`,
          { 'is-dragging': isDragging },
          { 'is-animating': isAnimating }
        ]"
        :style="sheetStyle"
        role="dialog"
        aria-modal="true"
        aria-label="Panel de opciones"
        :aria-expanded="currentSnap !== 'collapsed'"
      >
        <!-- Drag Handle Area -->
        <div
          class="sheet-handle-area"
          @touchstart.passive="handleTouchStart"
          @touchmove="handleTouchMove"
          @touchend="handleTouchEnd"
          @mousedown="handleMouseDown"
          role="slider"
          aria-label="Arrastra para expandir o colapsar el panel"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-valuenow="snapPercentage"
          tabindex="0"
          @keydown="handleKeyDown"
        >
          <div class="sheet-handle">
            <div class="sheet-handle-bar" />
          </div>
        </div>

        <!-- Content -->
        <div class="sheet-content" ref="contentRef">
          <slot />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

export type SnapState = 'collapsed' | 'partial' | 'expanded'

export interface SnapPoints {
  collapsed: number
  partial: number
  expanded: number
}

interface Props {
  initialSnap?: SnapState
  snapPoints?: SnapPoints
  backdropDismiss?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  initialSnap: 'collapsed',
  snapPoints: () => ({ collapsed: 88, partial: 45, expanded: 8 }),
  backdropDismiss: true
})

const emit = defineEmits<{
  'snap-change': [snap: SnapState]
}>()

const sheetRef = ref<HTMLElement>()
const contentRef = ref<HTMLElement>()
const isVisible = ref(true)
const currentSnap = ref<SnapState>(props.initialSnap)
const translateY = ref(0)
const isDragging = ref(false)
const isAnimating = ref(false)
const viewportHeight = ref(typeof window !== 'undefined' ? window.innerHeight : 800)

// Touch tracking
let startY = 0
let startTranslateY = 0
let lastY = 0
let lastTime = 0
let velocityY = 0

// Spring physics constants
const VELOCITY_THRESHOLD = 0.3
const RUBBER_BAND_FACTOR = 0.35
const SPRING_TENSION = 300
const SPRING_FRICTION = 30

// Convert snap points to pixels
const snapPointsPx = computed(() => ({
  collapsed: viewportHeight.value * (props.snapPoints.collapsed / 100),
  partial: viewportHeight.value * (props.snapPoints.partial / 100),
  expanded: viewportHeight.value * (props.snapPoints.expanded / 100)
}))

// Show backdrop when not collapsed
const showBackdrop = computed(() => currentSnap.value !== 'collapsed' && !isDragging.value)

// Percentage for accessibility
const snapPercentage = computed(() => {
  const total = snapPointsPx.value.collapsed - snapPointsPx.value.expanded
  const current = snapPointsPx.value.collapsed - translateY.value
  return Math.round((current / total) * 100)
})

// Sheet style
const sheetStyle = computed(() => ({
  transform: `translateY(${translateY.value}px)`,
  height: `${viewportHeight.value}px`
}))

// Handle touch start
const handleTouchStart = (e: TouchEvent) => {
  if (isAnimating.value) return

  isDragging.value = true
  startY = e.touches[0].clientY
  startTranslateY = translateY.value
  lastY = startY
  lastTime = Date.now()
  velocityY = 0
}

// Handle touch move
const handleTouchMove = (e: TouchEvent) => {
  if (!isDragging.value) return

  // Prevent default to stop page scroll
  e.preventDefault()

  const currentY = e.touches[0].clientY
  const now = Date.now()
  const deltaTime = now - lastTime

  // Calculate velocity (px/ms)
  if (deltaTime > 0) {
    velocityY = (currentY - lastY) / deltaTime
  }

  lastY = currentY
  lastTime = now

  const deltaY = currentY - startY
  let newTranslateY = startTranslateY + deltaY

  // Rubber-band effect at boundaries
  const maxY = snapPointsPx.value.collapsed
  const minY = snapPointsPx.value.expanded

  if (newTranslateY < minY) {
    const overscroll = minY - newTranslateY
    newTranslateY = minY - (overscroll * RUBBER_BAND_FACTOR)
  } else if (newTranslateY > maxY) {
    const overscroll = newTranslateY - maxY
    newTranslateY = maxY + (overscroll * RUBBER_BAND_FACTOR)
  }

  translateY.value = newTranslateY
}

// Handle touch end
const handleTouchEnd = () => {
  if (!isDragging.value) return
  isDragging.value = false

  // Determine snap based on velocity or position
  let targetSnap: SnapState

  if (Math.abs(velocityY) > VELOCITY_THRESHOLD) {
    // Use velocity to determine direction
    const direction = velocityY > 0 ? 'down' : 'up'
    const snapOrder: SnapState[] = ['expanded', 'partial', 'collapsed']
    const currentIndex = snapOrder.indexOf(currentSnap.value)

    if (direction === 'up' && currentIndex > 0) {
      targetSnap = snapOrder[currentIndex - 1]
    } else if (direction === 'down' && currentIndex < snapOrder.length - 1) {
      targetSnap = snapOrder[currentIndex + 1]
    } else {
      targetSnap = currentSnap.value
    }
  } else {
    // Find nearest snap point
    const distances = {
      collapsed: Math.abs(translateY.value - snapPointsPx.value.collapsed),
      partial: Math.abs(translateY.value - snapPointsPx.value.partial),
      expanded: Math.abs(translateY.value - snapPointsPx.value.expanded)
    }

    targetSnap = (Object.entries(distances) as [SnapState, number][])
      .reduce((a, b) => a[1] < b[1] ? a : b)[0]
  }

  animateToSnap(targetSnap)
}

// Mouse support for desktop testing
const handleMouseDown = (e: MouseEvent) => {
  if (isAnimating.value) return

  isDragging.value = true
  startY = e.clientY
  startTranslateY = translateY.value
  lastY = startY
  lastTime = Date.now()
  velocityY = 0

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging.value) return

    const currentY = e.clientY
    const now = Date.now()
    const deltaTime = now - lastTime

    if (deltaTime > 0) {
      velocityY = (currentY - lastY) / deltaTime
    }

    lastY = currentY
    lastTime = now

    const deltaY = currentY - startY
    let newTranslateY = startTranslateY + deltaY

    const maxY = snapPointsPx.value.collapsed
    const minY = snapPointsPx.value.expanded

    if (newTranslateY < minY) {
      const overscroll = minY - newTranslateY
      newTranslateY = minY - (overscroll * RUBBER_BAND_FACTOR)
    } else if (newTranslateY > maxY) {
      const overscroll = newTranslateY - maxY
      newTranslateY = maxY + (overscroll * RUBBER_BAND_FACTOR)
    }

    translateY.value = newTranslateY
  }

  const handleMouseUp = () => {
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
    handleTouchEnd()
  }

  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

// Keyboard navigation
const handleKeyDown = (e: KeyboardEvent) => {
  const snapOrder: SnapState[] = ['expanded', 'partial', 'collapsed']
  const currentIndex = snapOrder.indexOf(currentSnap.value)

  switch (e.key) {
    case 'ArrowUp':
    case 'ArrowLeft':
      e.preventDefault()
      if (currentIndex > 0) {
        snapTo(snapOrder[currentIndex - 1])
      }
      break
    case 'ArrowDown':
    case 'ArrowRight':
      e.preventDefault()
      if (currentIndex < snapOrder.length - 1) {
        snapTo(snapOrder[currentIndex + 1])
      }
      break
    case 'Home':
      e.preventDefault()
      snapTo('expanded')
      break
    case 'End':
      e.preventDefault()
      snapTo('collapsed')
      break
    case 'Escape':
      e.preventDefault()
      snapTo('collapsed')
      break
  }
}

// Animate to snap point with spring physics feel
const animateToSnap = (snap: SnapState) => {
  isAnimating.value = true
  currentSnap.value = snap

  const targetY = snapPointsPx.value[snap]
  translateY.value = targetY

  // Use CSS transition for smooth animation
  setTimeout(() => {
    isAnimating.value = false
    emit('snap-change', snap)
  }, 350)
}

// Public snap method
const snapTo = (snap: SnapState) => {
  animateToSnap(snap)
}

// Handle backdrop click
const handleBackdropClick = () => {
  if (props.backdropDismiss) {
    snapTo('collapsed')
  }
}

// Handle resize
const handleResize = () => {
  viewportHeight.value = window.innerHeight
  translateY.value = snapPointsPx.value[currentSnap.value]
}

// Lifecycle
onMounted(() => {
  window.addEventListener('resize', handleResize, { passive: true })
  // Initialize position
  translateY.value = snapPointsPx.value[props.initialSnap]
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})

// Watch for snap point changes (e.g., orientation change)
watch(() => props.snapPoints, () => {
  translateY.value = snapPointsPx.value[currentSnap.value]
}, { deep: true })

// Expose methods
defineExpose({ snapTo, currentSnap })
</script>

<style scoped>
.bottom-sheet-container {
  position: fixed;
  inset: 0;
  z-index: var(--z-sheet, 150);
  pointer-events: none;
  /* Prevent iOS bounce */
  overscroll-behavior: none;
}

/* Backdrop */
.bottom-sheet-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  pointer-events: all;
}

.backdrop-enter-active,
.backdrop-leave-active {
  transition: opacity 0.3s ease;
}

.backdrop-enter-from,
.backdrop-leave-to {
  opacity: 0;
}

/* Sheet */
.bottom-sheet {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  background: var(--color-surface, #ffffff);
  border-radius: 16px 16px 0 0;
  box-shadow:
    0 -2px 20px rgba(0, 0, 0, 0.08),
    0 -1px 3px rgba(0, 0, 0, 0.04);
  pointer-events: all;
  display: flex;
  flex-direction: column;
  will-change: transform;
  /* Safe area for bottom */
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.bottom-sheet.is-animating {
  transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1);
}

.bottom-sheet.is-dragging {
  transition: none;
  cursor: grabbing;
}

/* Handle Area */
.sheet-handle-area {
  flex-shrink: 0;
  padding: 12px 0 4px;
  cursor: grab;
  touch-action: none;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}

.sheet-handle-area:active {
  cursor: grabbing;
}

.sheet-handle-area:focus-visible {
  outline: none;
}

.sheet-handle-area:focus-visible .sheet-handle-bar {
  background: var(--color-accent, #0066cc);
  transform: scaleX(1.2);
}

.sheet-handle {
  display: flex;
  justify-content: center;
  padding: 4px 0;
}

.sheet-handle-bar {
  width: 36px;
  height: 5px;
  background: rgba(0, 0, 0, 0.15);
  border-radius: 2.5px;
  transition: all 0.2s ease;
}

.sheet-handle-area:hover .sheet-handle-bar {
  background: rgba(0, 0, 0, 0.25);
  transform: scaleX(1.1);
}

/* Content */
.sheet-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Snap state styles */
.bottom-sheet.snap-collapsed .sheet-content {
  overflow: hidden;
}

.bottom-sheet.snap-partial .sheet-content,
.bottom-sheet.snap-expanded .sheet-content {
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

/* Dark mode */
:root.dark .bottom-sheet,
.dark .bottom-sheet {
  background: var(--color-surface, #1a1a1a);
  box-shadow:
    0 -2px 20px rgba(0, 0, 0, 0.3),
    0 0 0 1px rgba(255, 255, 255, 0.05);
}

:root.dark .sheet-handle-bar,
.dark .sheet-handle-bar {
  background: rgba(255, 255, 255, 0.2);
}

:root.dark .sheet-handle-area:hover .sheet-handle-bar,
.dark .sheet-handle-area:hover .sheet-handle-bar {
  background: rgba(255, 255, 255, 0.35);
}

:root.dark .bottom-sheet-backdrop,
.dark .bottom-sheet-backdrop {
  background: rgba(0, 0, 0, 0.5);
}

/* Landscape adjustments */
@media (orientation: landscape) and (max-height: 500px) {
  .bottom-sheet {
    border-radius: 12px 12px 0 0;
  }

  .sheet-handle-area {
    padding: 8px 0 2px;
  }

  .sheet-handle-bar {
    width: 32px;
    height: 4px;
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .bottom-sheet.is-animating {
    transition: transform 0.15s ease-out;
  }

  .backdrop-enter-active,
  .backdrop-leave-active {
    transition: opacity 0.15s ease;
  }

  .sheet-handle-bar {
    transition: none;
  }
}

/* High contrast mode */
@media (prefers-contrast: high) {
  .bottom-sheet {
    border: 2px solid var(--color-border, #333);
  }

  .sheet-handle-bar {
    background: var(--color-text, #000);
  }
}
</style>
