<template>
  <Teleport to="body">
    <Transition name="hint">
      <div
        v-if="showHint"
        class="gesture-hint"
        role="status"
        aria-live="polite"
        aria-label="Sugerencia de gestos del mapa"
      >
        <div class="hint-content">
          <div class="hint-icon" aria-hidden="true">
            <svg viewBox="0 0 40 40" width="40" height="40">
              <!-- Two fingers -->
              <g class="fingers">
                <rect x="8" y="12" width="8" height="20" rx="4" fill="currentColor" />
                <rect x="24" y="12" width="8" height="20" rx="4" fill="currentColor" opacity="0.6" />
              </g>
              <!-- Pinch arrows -->
              <g class="arrows" stroke="currentColor" stroke-width="2" fill="none">
                <path d="M4 20 L12 20" />
                <path d="M28 20 L36 20" />
                <polyline points="7,17 4,20 7,23" />
                <polyline points="33,17 36,20 33,23" />
              </g>
            </svg>
          </div>
          <div class="hint-text">
            <span class="hint-title">Usa dos dedos</span>
            <span class="hint-description">para hacer zoom en el mapa</span>
          </div>
        </div>
        <button
          class="hint-dismiss"
          @click="dismissHint"
          aria-label="Cerrar sugerencia"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const showHint = ref(false)
const HINT_DURATION = 4000 // milliseconds
const STORAGE_KEY = 'electoral-map-gesture-hint-shown'
let hideTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Check if this is the user's first visit (gesture hint not shown before)
 */
const isFirstVisit = (): boolean => {
  if (typeof window === 'undefined') return false
  return !localStorage.getItem(STORAGE_KEY)
}

/**
 * Mark that the gesture hint has been shown
 */
const markHintAsShown = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, 'true')
  }
}

/**
 * Show the hint for a duration
 */
const displayHint = (): void => {
  showHint.value = true
  markHintAsShown()

  // Auto-hide after duration
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(() => {
    showHint.value = false
  }, HINT_DURATION)
}

/**
 * Dismiss hint immediately
 */
const dismissHint = (): void => {
  showHint.value = false
  if (hideTimer) clearTimeout(hideTimer)
}

/**
 * Handle first touch to show the hint
 */
const handleFirstTouch = (): void => {
  if (isFirstVisit()) {
    // Small delay to not interfere with initial interaction
    setTimeout(displayHint, 500)
    removeListeners()
  }
}

/**
 * Handle two-finger gesture to hide the hint
 */
const handleTwoFingerGesture = (event: TouchEvent): void => {
  if (event.touches && event.touches.length >= 2) {
    dismissHint()
    removeListeners()
  }
}

/**
 * Remove event listeners
 */
const removeListeners = (): void => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('touchstart', handleFirstTouch)
    window.removeEventListener('touchmove', handleTwoFingerGesture)
  }
}

/**
 * Check if device is mobile
 */
const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (window.matchMedia && window.matchMedia('(max-width: 767px)').matches)
}

onMounted(() => {
  if (isMobileDevice() && isFirstVisit()) {
    window.addEventListener('touchstart', handleFirstTouch, { once: true, passive: true })
    window.addEventListener('touchmove', handleTwoFingerGesture, { passive: true })
  }
})

onUnmounted(() => {
  removeListeners()
  if (hideTimer) clearTimeout(hideTimer)
})
</script>

<style scoped>
.gesture-hint {
  position: fixed;
  bottom: calc(14% + 80px); /* Above the bottom sheet peek */
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.88);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-radius: 14px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
  z-index: var(--z-overlay, 250);
  max-width: calc(100vw - 32px);
}

.hint-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.hint-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  color: white;
  flex-shrink: 0;
}

.hint-icon svg {
  display: block;
}

/* Pinch animation */
.hint-icon .fingers {
  animation: pinch 1.5s ease-in-out infinite;
}

.hint-icon .arrows {
  opacity: 0.6;
}

@keyframes pinch {
  0%, 100% {
    transform: translateX(0);
  }
  50% {
    transform: scaleX(0.85);
  }
}

.hint-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  color: white;
}

.hint-title {
  font-size: 0.9375rem;
  font-weight: 600;
  line-height: 1.2;
}

.hint-description {
  font-size: 0.8125rem;
  color: rgba(255, 255, 255, 0.75);
  line-height: 1.2;
}

.hint-dismiss {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  margin-left: 4px;
  padding: 0;
  background: rgba(255, 255, 255, 0.15);
  border: none;
  border-radius: 50%;
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
  -webkit-tap-highlight-color: transparent;
}

.hint-dismiss:hover {
  background: rgba(255, 255, 255, 0.25);
  color: white;
}

.hint-dismiss:active {
  transform: scale(0.95);
}

/* Entrance/Exit animation */
.hint-enter-active {
  animation: hintIn 0.35s cubic-bezier(0.32, 0.72, 0, 1);
}

.hint-leave-active {
  animation: hintOut 0.25s ease-in forwards;
}

@keyframes hintIn {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1);
  }
}

@keyframes hintOut {
  from {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateX(-50%) translateY(-10px) scale(0.95);
  }
}

/* Landscape orientation */
@media (orientation: landscape) and (max-height: 500px) {
  .gesture-hint {
    bottom: auto;
    top: 50%;
    transform: translate(-50%, -50%);
    padding: 10px 14px;
  }

  .hint-icon {
    width: 32px;
    height: 32px;
  }

  .hint-icon svg {
    width: 32px;
    height: 32px;
  }

  .hint-title {
    font-size: 0.875rem;
  }

  .hint-description {
    font-size: 0.75rem;
  }

  @keyframes hintIn {
    from {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }
  }

  @keyframes hintOut {
    from {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }
    to {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.95);
    }
  }
}

/* Small screens */
@media (max-width: 360px) {
  .gesture-hint {
    padding: 10px 12px;
    gap: 6px;
  }

  .hint-content {
    gap: 10px;
  }

  .hint-icon {
    width: 32px;
    height: 32px;
  }

  .hint-icon svg {
    width: 32px;
    height: 32px;
  }

  .hint-title {
    font-size: 0.875rem;
  }

  .hint-description {
    font-size: 0.75rem;
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .hint-icon .fingers {
    animation: none;
  }

  .hint-enter-active,
  .hint-leave-active {
    animation: none;
    transition: opacity 0.15s ease;
  }

  .hint-enter-from,
  .hint-leave-to {
    opacity: 0;
  }
}

/* Dark mode adjustments (if needed - already dark by default) */
:root.dark .gesture-hint,
.dark .gesture-hint {
  background: rgba(0, 0, 0, 0.92);
}
</style>
