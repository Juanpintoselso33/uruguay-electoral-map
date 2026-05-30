import { onMounted, onUnmounted, type Ref } from 'vue'

export interface KeyboardNavigationOptions {
  /**
   * Enable arrow key navigation in a grid layout
   */
  gridNavigation?: {
    container: Ref<HTMLElement | undefined>
    columns: number
    onNavigate?: (index: number) => void
  }

  /**
   * Enable tab trapping within a container
   */
  trapFocus?: {
    container: Ref<HTMLElement | undefined>
    active: Ref<boolean>
  }

  /**
   * Custom key handlers
   */
  customKeys?: Record<string, (event: KeyboardEvent) => void>

  /**
   * Escape key handler
   */
  onEscape?: () => void
}

/**
 * Composable for keyboard navigation and accessibility
 * Handles common keyboard patterns: arrow keys, tab, escape, enter, space
 */
export function useKeyboardNavigation(options: KeyboardNavigationOptions = {}) {
  const handleKeyDown = (event: KeyboardEvent) => {
    // Custom key handlers
    if (options.customKeys && options.customKeys[event.key]) {
      options.customKeys[event.key](event)
      return
    }

    // Escape key
    if (event.key === 'Escape' && options.onEscape) {
      event.preventDefault()
      options.onEscape()
      return
    }

    // Grid navigation
    if (options.gridNavigation) {
      handleGridNavigation(event, options.gridNavigation)
    }

    // Focus trapping
    if (options.trapFocus?.active.value) {
      handleFocusTrap(event, options.trapFocus.container)
    }
  }

  const handleGridNavigation = (
    event: KeyboardEvent,
    grid: NonNullable<KeyboardNavigationOptions['gridNavigation']>
  ) => {
    if (!grid.container.value) return

    const focusableElements = Array.from(
      grid.container.value.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ) as HTMLElement[]

    const currentIndex = focusableElements.findIndex(el => el === document.activeElement)
    if (currentIndex === -1) return

    let nextIndex = currentIndex

    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault()
        nextIndex = Math.min(currentIndex + 1, focusableElements.length - 1)
        break
      case 'ArrowLeft':
        event.preventDefault()
        nextIndex = Math.max(currentIndex - 1, 0)
        break
      case 'ArrowDown':
        event.preventDefault()
        nextIndex = Math.min(currentIndex + grid.columns, focusableElements.length - 1)
        break
      case 'ArrowUp':
        event.preventDefault()
        nextIndex = Math.max(currentIndex - grid.columns, 0)
        break
      case 'Home':
        event.preventDefault()
        nextIndex = 0
        break
      case 'End':
        event.preventDefault()
        nextIndex = focusableElements.length - 1
        break
      default:
        return
    }

    if (nextIndex !== currentIndex) {
      focusableElements[nextIndex]?.focus()
      if (grid.onNavigate) {
        grid.onNavigate(nextIndex)
      }
    }
  }

  const handleFocusTrap = (
    event: KeyboardEvent,
    container: Ref<HTMLElement | undefined>
  ) => {
    if (event.key !== 'Tab' || !container.value) return

    const focusableElements = Array.from(
      container.value.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
      )
    ) as HTMLElement[]

    if (focusableElements.length === 0) return

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    if (event.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      }
    } else {
      // Tab
      if (document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }
  }

  onMounted(() => {
    document.addEventListener('keydown', handleKeyDown)
  })

  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeyDown)
  })

  return {
    handleKeyDown
  }
}

/**
 * Helper to make any element keyboard-activatable (Enter/Space like a button)
 */
export function useKeyboardActivation(onActivate: () => void) {
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onActivate()
    }
  }

  return {
    onKeyDown: handleKeyDown,
    tabindex: 0
  }
}
