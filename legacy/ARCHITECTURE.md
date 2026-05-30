# Electoral Map Component Architecture

## Component Hierarchy

```
App.vue
│
└── ElectoralMap.vue (Main Container)
    │
    ├── uses: useMapInteraction (composable)
    │   └── Provides:
    │       ├── Vote calculations
    │       ├── Color computations
    │       ├── Data grouping
    │       └── Utility functions
    │
    ├── uses: useTooltipContent (composable)
    │   └── Provides:
    │       ├── Candidate tooltip HTML
    │       └── List tooltip HTML
    │
    ├── MapLegend.vue (Child Component)
    │   └── Receives:
    │       ├── show: boolean
    │       ├── maxVotes: number
    │       └── getColor: function
    │
    └── SelectedInfo.vue (Child Component)
        └── Receives:
            ├── groupedItems: Record<string, PartyData>
            ├── totalVotes: number
            └── showCandidates: boolean
```

## Data Flow

```
┌─────────────┐
│   App.vue   │
└──────┬──────┘
       │ props
       ▼
┌──────────────────────────────────┐
│      ElectoralMap.vue            │
│  ┌────────────────────────────┐  │
│  │  useMapInteraction         │  │
│  │  ┌──────────────────────┐  │  │
│  │  │ • Vote calculations  │  │  │
│  │  │ • Color functions    │  │  │
│  │  │ • Data grouping      │  │  │
│  │  └──────────────────────┘  │  │
│  └────────────────────────────┘  │
│  ┌────────────────────────────┐  │
│  │  useTooltipContent         │  │
│  │  ┌──────────────────────┐  │  │
│  │  │ • Tooltip HTML       │  │  │
│  │  └──────────────────────┘  │  │
│  └────────────────────────────┘  │
│              │                    │
│  ┌───────────┴─────────┐         │
│  │                     │         │
│  ▼                     ▼         │
│ ┌──────────────┐ ┌──────────────┐│
│ │ MapLegend    │ │ SelectedInfo ││
│ └──────────────┘ └──────────────┘│
└──────────────────────────────────┘
```

## Props Flow Detail

```
App.vue Props → ElectoralMap.vue
├── regionName: string
├── selectedLists: string[]
├── votosPorListas: Record<string, Record<string, number>>
├── maxVotosPorListas: Record<string, number>
├── getVotosForNeighborhood: (neighborhood: string) => number
├── geojsonData: any
├── selectedNeighborhood: string | null
├── isODN: boolean
├── partiesAbbrev: Record<string, string>
├── partiesByList: Record<string, string>
├── precandidatosByList: Record<string, string>
├── selectedCandidates: string[]
├── mapCenter: [number, number]
└── mapZoom: number

ElectoralMap Computed → MapLegend Props
├── show: boolean
├── maxVotes: number
└── getColor: (votes: number) => string

ElectoralMap Computed → SelectedInfo Props
├── groupedItems: Record<string, PartyData>
├── totalVotes: number
└── showCandidates: boolean
```

## Event Flow

```
┌──────────────────────────────────┐
│      ElectoralMap.vue            │
│                                  │
│  User Interactions:              │
│  ┌────────────────────────────┐  │
│  │ • Map Click               │  │
│  │ • Mouse Hover             │  │
│  │ • Mouse Down/Up           │  │
│  └────────────────────────────┘  │
│              │                    │
│              ▼                    │
│    Emits to App.vue:              │
│    ├── updateSelectedNeighborhood │
│    └── mapInitialized             │
└──────────────────────────────────┘
```

## Composable Architecture

### useMapInteraction.ts

```typescript
Input: ComputedRef<Props>
  ├── geojsonData
  ├── selectedLists
  ├── selectedCandidates
  ├── votosPorListas
  ├── partiesByList
  ├── precandidatosByList
  ├── partiesAbbrev
  └── getVotosForNeighborhood

Processing Functions:
  ├── normalizeString()
  ├── getCandidateVotesForNeighborhood()
  ├── getCandidateTotalVotes()
  ├── getCandidateTotalVotesAllNeighborhoods()
  ├── groupCandidatesByParty()
  ├── groupListsByParty()
  ├── getColor()
  ├── shadeColor()
  └── getTotalVotesForList()

Output: Utility Functions
  └── All functions above returned for use
```

### useTooltipContent.ts

```typescript
Input: Props
  └── partiesAbbrev: Record<string, string>

Processing Functions:
  ├── generateCandidateTooltip()
  │   ├── Input: neighborhood, candidateVotes, groupedCandidates, totalVotes
  │   └── Output: HTML string
  │
  └── generateListTooltip()
      ├── Input: neighborhood, groupedLists, totalVotes
      └── Output: HTML string

Output: Generator Functions
  └── Both functions returned for use
```

## Component Interaction Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    ElectoralMap.vue                     │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Leaflet    │  │    State     │  │ Composables  │ │
│  │     Map      │  │  Management  │  │    Logic     │ │
│  └───────┬──────┘  └───────┬──────┘  └───────┬──────┘ │
│          │                 │                 │        │
│          │                 │                 │        │
│  ┌───────▼─────────────────▼─────────────────▼──────┐ │
│  │          Render & Event Handling                 │ │
│  └──────────────────┬────────────────────────────────┘ │
│                     │                                  │
│      ┌──────────────┼──────────────┐                  │
│      │              │              │                  │
│  ┌───▼────┐  ┌──────▼──────┐  ┌───▼────┐            │
│  │ Legend │  │   Tooltip   │  │Selected│            │
│  │ Display│  │   Display   │  │  Info  │            │
│  └────────┘  └─────────────┘  └────────┘            │
└─────────────────────────────────────────────────────────┘
```

## Lifecycle Flow

```
1. Mount Phase
   ├── ElectoralMap.onMounted()
   ├── Initialize Leaflet Map
   ├── Add GeoJSON layers
   ├── Fit map to bounds
   ├── Emit mapInitialized
   └── Add window resize listener

2. Update Phase (on props change)
   ├── Watch regionName → reinitialize map
   ├── Watch geojsonData → update layers
   ├── Watch selectedLists → update map
   └── Watch selectedCandidates → update map

3. User Interaction Phase
   ├── Mouse Hover
   │   ├── Calculate votes for neighborhood
   │   ├── Generate tooltip HTML
   │   ├── Apply darker color
   │   └── Show tooltip
   │
   ├── Mouse Click
   │   ├── Update selected neighborhood
   │   └── Emit to parent
   │
   └── Mouse Out
       ├── Reset colors
       └── Hide tooltip

4. Unmount Phase
   └── Remove Leaflet map
```

## TypeScript Type System

```
Core Types:
├── CandidateVote
│   ├── candidate: string
│   ├── votes: number
│   └── party: string
│
├── ListVote
│   ├── number: string
│   └── votes: number
│
├── GroupedCandidates
│   └── [party: string]: { candidate: string; votes: number }[]
│
├── GroupedLists
│   └── [party: string]: ListVote[]
│
└── PartyData
    ├── totalVotes: number
    ├── lists?: { number: string; votes: number }[]
    └── candidates?: { name: string; votes: number }[]

Interface Exports:
├── UseMapInteractionProps
├── UseTooltipContentProps
└── Component Props Interfaces
```

## Styling Architecture

```
Global Styles (from ElectoralMap.vue)
├── .electoral-map-wrapper
├── .electoral-map
├── .neighborhood-info
└── Deep selectors for Leaflet
    ├── :deep(.leaflet-interactive)
    ├── :deep(.leaflet-pane path)
    ├── :deep(.tooltip-content)
    └── :deep(.scrollable-tooltip)

MapLegend Styles
├── .map-legend
├── .legend-item
├── .legend-color
└── .legend-label

SelectedInfo Styles
├── .selected-lists-info
├── .selected-lists-content
├── .party-list
├── .mobile-toggle
└── Responsive @media queries
```

## Responsive Behavior

```
Desktop (≥768px)
├── MapLegend: bottom-right position
├── SelectedInfo: top-right fixed panel
└── Tooltips: auto direction

Mobile (<768px)
├── MapLegend: top-right position (smaller)
├── SelectedInfo: bottom slide-up panel
├── Mobile Toggle: visible
└── Tooltips: simplified display
```

## Import Pattern

```typescript
// From App.vue
import ElectoralMap from './components/map/ElectoralMap.vue';

// From ElectoralMap.vue
import MapLegend from './MapLegend.vue';
import SelectedInfo from './SelectedInfo.vue';
import { useMapInteraction } from '@/composables/useMapInteraction';
import { useTooltipContent } from '@/composables/useTooltipContent';

// Alternative (using index)
import { ElectoralMap, MapLegend, SelectedInfo } from '@/components/map';
import { useMapInteraction, useTooltipContent } from '@/composables';
```

## State Management

```
Local State (ElectoralMap.vue)
├── mapContainer: Ref<HTMLElement | null>
├── selectedNeighborhood: Ref<string | null>
├── map: Ref<L.Map | null>
└── showLegend: Ref<boolean>

Computed State
├── maxVotesComputed
└── groupedSelectedItems

Composable State (useMapInteraction)
├── getMaxVotes (computed)
└── All utility functions

Component State (SelectedInfo)
└── isHidden: Ref<boolean>
```

## Dependencies

```
External Libraries
├── leaflet (^1.9.4)
├── chroma-js (^2.4.2)
└── vue (^3.x)

Internal Dependencies
├── @/composables/useMapInteraction
├── @/composables/useTooltipContent
├── MapLegend.vue
└── SelectedInfo.vue

Type Dependencies
├── geojson (types)
├── leaflet (types)
└── Custom interfaces
```

## Performance Considerations

```
Optimizations
├── Computed values cached
├── Event handlers properly cleaned up
├── Map invalidation on resize
├── Efficient re-rendering (small components)
└── Lazy evaluation where possible

Memory Management
├── Map removed on unmount
├── Event listeners cleaned up
├── Proper watch cleanup
└── No memory leaks detected
```

## Testing Strategy

```
Unit Tests (Composables)
├── useMapInteraction
│   ├── Vote calculations
│   ├── Color functions
│   └── Grouping logic
│
└── useTooltipContent
    ├── HTML generation
    └── Data formatting

Component Tests
├── MapLegend
│   ├── Renders correctly
│   └── Responsive behavior
│
├── SelectedInfo
│   ├── Displays data
│   ├── Toggle functionality
│   └── Responsive layout
│
└── ElectoralMap
    ├── Map initialization
    ├── Layer rendering
    ├── Event handling
    └── Props/emits

Integration Tests
└── Full user workflow
    ├── Map interactions
    ├── Tooltip display
    └── Selection updates
```
