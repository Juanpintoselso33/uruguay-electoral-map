<template>
  <div
    role="status"
    :aria-live="ariaLive"
    aria-atomic="true"
    class="sr-only"
  >
    {{ announcement }}
  </div>
</template>

<script setup lang="ts">
import { useScreenReaderAnnouncements } from '@/composables/useScreenReaderAnnouncements'

// Create screen reader announcer instance
const { announcement, ariaLive } = useScreenReaderAnnouncements()

// Expose for parent components if needed
defineExpose({
  announcement,
  ariaLive
})
</script>

<style scoped>
/* Screen reader only - visually hidden but accessible */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
</style>
