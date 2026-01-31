import { ref, type Ref } from 'vue'

export type AriaLiveLevel = 'polite' | 'assertive' | 'off'

interface AnnouncementOptions {
  /**
   * Aria-live level: 'polite' (default) or 'assertive'
   * Use 'assertive' only for critical/urgent updates
   */
  level?: AriaLiveLevel

  /**
   * Delay before announcing (ms). Useful to avoid rapid-fire announcements
   */
  delay?: number

  /**
   * Clear previous announcement before adding new one
   */
  clearPrevious?: boolean
}

/**
 * Composable for managing screen reader announcements
 * Creates accessible live regions for dynamic content updates
 */
export function useScreenReaderAnnouncements() {
  const announcement = ref('')
  const ariaLive = ref<AriaLiveLevel>('polite')
  const announcementQueue: string[] = []
  let isAnnouncing = false

  /**
   * Announce a message to screen readers
   */
  const announce = (message: string, options: AnnouncementOptions = {}) => {
    const {
      level = 'polite',
      delay = 100,
      clearPrevious = true
    } = options

    // Update aria-live level
    ariaLive.value = level

    // Clear if requested
    if (clearPrevious) {
      announcement.value = ''
      announcementQueue.length = 0
    }

    // Add to queue
    announcementQueue.push(message)

    // Process queue
    if (!isAnnouncing) {
      processQueue(delay)
    }
  }

  const processQueue = (delay: number) => {
    if (announcementQueue.length === 0) {
      isAnnouncing = false
      return
    }

    isAnnouncing = true
    const nextMessage = announcementQueue.shift()

    setTimeout(() => {
      announcement.value = nextMessage || ''

      // Clear after 1 second to avoid stale announcements
      setTimeout(() => {
        if (announcement.value === nextMessage) {
          announcement.value = ''
        }
        processQueue(delay)
      }, 1000)
    }, delay)
  }

  /**
   * Announce zone/neighborhood selection
   */
  const announceZoneSelection = (zoneName: string, votes: number) => {
    const message = `Zona ${zoneName} seleccionada. ${votes.toLocaleString()} votos.`
    announce(message)
  }

  /**
   * Announce list selection
   */
  const announceListSelection = (listNumber: string, isSelected: boolean, party?: string) => {
    const action = isSelected ? 'seleccionada' : 'deseleccionada'
    const partyInfo = party ? ` del partido ${party}` : ''
    const message = `Lista ${listNumber}${partyInfo} ${action}.`
    announce(message)
  }

  /**
   * Announce multiple lists selection
   */
  const announceMultipleListsSelection = (count: number, action: 'selected' | 'deselected') => {
    const actionText = action === 'selected' ? 'seleccionadas' : 'deseleccionadas'
    const message = `${count} listas ${actionText}.`
    announce(message)
  }

  /**
   * Announce department/region change
   */
  const announceDepartmentChange = (departmentName: string) => {
    const message = `Departamento cambiado a ${departmentName}.`
    announce(message)
  }

  /**
   * Announce data source change (ODN/ODD)
   */
  const announceDataSourceChange = (source: string) => {
    const sourceText = source === 'ODN' ? 'Orden Departamental Nacional' : 'Orden Departamental Departamental'
    const message = `Datos cambiados a ${sourceText}.`
    announce(message)
  }

  /**
   * Announce statistics update
   */
  const announceStatisticsUpdate = (stats: { totalVotes: number; lists: number; zones?: number }) => {
    const { totalVotes, lists, zones } = stats
    let message = `${totalVotes.toLocaleString()} votos totales en ${lists} listas.`
    if (zones) {
      message += ` ${zones} zonas con datos.`
    }
    announce(message)
  }

  /**
   * Announce filter applied
   */
  const announceFilterApplied = (filterType: string, filterValue: string) => {
    const message = filterValue
      ? `Filtro de ${filterType} aplicado: ${filterValue}`
      : `Filtro de ${filterType} eliminado`
    announce(message)
  }

  /**
   * Announce error
   */
  const announceError = (error: string) => {
    announce(`Error: ${error}`, { level: 'assertive' })
  }

  /**
   * Announce loading state
   */
  const announceLoading = (isLoading: boolean, context?: string) => {
    const contextText = context ? ` ${context}` : ''
    const message = isLoading
      ? `Cargando${contextText}...`
      : `Carga completada${contextText}.`
    announce(message)
  }

  return {
    announcement,
    ariaLive,
    announce,
    announceZoneSelection,
    announceListSelection,
    announceMultipleListsSelection,
    announceDepartmentChange,
    announceDataSourceChange,
    announceStatisticsUpdate,
    announceFilterApplied,
    announceError,
    announceLoading
  }
}

/**
 * Create a globally accessible screen reader announcer
 * Use this for cross-component announcements
 */
export function createGlobalAnnouncer() {
  let instance: ReturnType<typeof useScreenReaderAnnouncements> | null = null

  return {
    getInstance: () => {
      if (!instance) {
        instance = useScreenReaderAnnouncements()
      }
      return instance
    },
    announce: (message: string, options?: AnnouncementOptions) => {
      const announcer = instance || useScreenReaderAnnouncements()
      announcer.announce(message, options)
    }
  }
}
