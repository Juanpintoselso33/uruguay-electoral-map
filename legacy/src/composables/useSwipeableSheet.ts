import { ref, computed, onMounted, onUnmounted } from 'vue'

export type SnapState = 'collapsed' | 'partial' | 'expanded'

export interface SnapPoints {
  collapsed: number // percentage from top (e.g., 88 = sheet shows 12%)
  partial: number   // percentage from top (e.g., 45 = half screen)
  expanded: number  // percentage from top (e.g., 8 = almost full)
}

export interface SwipeableSheetOptions {
  snapPoints: SnapPoints
  initialSnap: SnapState
  threshold?: number // Velocity threshold for momentum (default: 0.3)
  rubberBandFactor?: number // Overscroll resistance (default: 0.35)
}

/**
 * Composable for creating swipeable bottom sheet behavior
 *
 * This composable provides the core gesture handling and snap point logic
 * for bottom sheet components with three snap states: collapsed, partial, and expanded.
 *
 * Features:
 * - Smooth touch/mouse gesture handling
 * - Velocity-based snap detection
 * - Rubber-band effect at boundaries
 * - Responsive to viewport changes
 *
 * @example
 * ```ts
 * const {
 *   currentSnap,
 *   translateY,
 *   isDragging,
 *   handleTouchStart,
 *   handleTouchMove,
 *   handleTouchEnd,
 *   snapTo
 * } = useSwipeableSheet({
 *   snapPoints: { collapsed: 88, partial: 45, expanded: 8 },
 *   initialSnap: 'collapsed'
 * })
 * ```
 */
export function useSwipeableSheet(options: SwipeableSheetOptions) {
  const {
    snapPoints,
    initialSnap,
    threshold = 0.3,
    rubberBandFactor = 0.35
  } = options

  const currentSnap = ref<SnapState>(initialSnap)
  const translateY = ref(0)
  const isDragging = ref(false)
  const viewportHeight = ref(typeof window !== 'undefined' ? window.innerHeight : 800)

  // Track touch positions and timing for velocity calculation
  let startY = 0
  let startTranslateY = 0
  let lastY = 0
  let lastTime = 0
  let velocityY = 0

  // Convert snap points from percentages to pixels
  const snapPointsPx = computed(() => ({
    collapsed: viewportHeight.value * (snapPoints.collapsed / 100),
    partial: viewportHeight.value * (snapPoints.partial / 100),
    expanded: viewportHeight.value * (snapPoints.expanded / 100)
  }))

  // Calculate sheet height for each snap state (useful for animations)
  const sheetHeights = computed(() => ({
    collapsed: viewportHeight.value - snapPointsPx.value.collapsed,
    partial: viewportHeight.value - snapPointsPx.value.partial,
    expanded: viewportHeight.value - snapPointsPx.value.expanded
  }))

  const handleTouchStart = (e: TouchEvent) => {
    isDragging.value = true
    startY = e.touches[0].clientY
    startTranslateY = translateY.value
    lastY = startY
    lastTime = Date.now()
    velocityY = 0
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (!isDragging.value) return

    // Prevent page scroll while dragging
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

    // Constrain to valid range with rubber-band effect at boundaries
    const maxY = snapPointsPx.value.collapsed
    const minY = snapPointsPx.value.expanded

    if (newTranslateY < minY) {
      // Rubber-band at top (expanded beyond limit)
      const overscroll = minY - newTranslateY
      newTranslateY = minY - (overscroll * rubberBandFactor)
    } else if (newTranslateY > maxY) {
      // Rubber-band at bottom (collapsed beyond limit)
      const overscroll = newTranslateY - maxY
      newTranslateY = maxY + (overscroll * rubberBandFactor)
    }

    translateY.value = newTranslateY
  }

  const handleTouchEnd = () => {
    if (!isDragging.value) return
    isDragging.value = false

    // Use velocity to determine snap direction if above threshold
    if (Math.abs(velocityY) > threshold) {
      const direction = velocityY > 0 ? 'down' : 'up'
      const snapOrder: SnapState[] = ['expanded', 'partial', 'collapsed']
      const currentIndex = snapOrder.indexOf(currentSnap.value)

      if (direction === 'up' && currentIndex > 0) {
        snapTo(snapOrder[currentIndex - 1])
        return
      } else if (direction === 'down' && currentIndex < snapOrder.length - 1) {
        snapTo(snapOrder[currentIndex + 1])
        return
      }
    }

    // Otherwise, find nearest snap point
    const distances = {
      collapsed: Math.abs(translateY.value - snapPointsPx.value.collapsed),
      partial: Math.abs(translateY.value - snapPointsPx.value.partial),
      expanded: Math.abs(translateY.value - snapPointsPx.value.expanded)
    }

    const closest = (Object.entries(distances) as [SnapState, number][])
      .reduce((a, b) => a[1] < b[1] ? a : b)[0]

    snapTo(closest)
  }

  const snapTo = (snap: SnapState) => {
    currentSnap.value = snap
    translateY.value = snapPointsPx.value[snap]
  }

  // Handle viewport resize
  const handleResize = () => {
    viewportHeight.value = window.innerHeight
    // Re-snap to current position with new dimensions
    translateY.value = snapPointsPx.value[currentSnap.value]
  }

  onMounted(() => {
    window.addEventListener('resize', handleResize, { passive: true })
    // Initialize position
    snapTo(initialSnap)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', handleResize)
  })

  return {
    currentSnap,
    translateY,
    isDragging,
    sheetHeights,
    viewportHeight,
    snapPointsPx,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    snapTo
  }
}
