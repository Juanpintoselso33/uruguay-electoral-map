# RegionMap.vue Refactoring Documentation

## Overview
This document describes the refactoring of the original 1027-line `RegionMap.vue` component into smaller, maintainable, and reusable components following Vue 3 Composition API and TypeScript best practices.

## Refactoring Summary

### Before
- **Single file**: `src/components/RegionMap.vue` (1027 lines)
- Mixed concerns: map rendering, tooltips, legend, selection panel
- Difficult to test and maintain
- Limited reusability

### After
The component has been split into:

#### Components (src/components/map/)
1. **ElectoralMap.vue** (~380 lines)
   - Main container component
   - Leaflet map initialization and lifecycle management
   - GeoJSON layer rendering
   - Event handling (click, hover, mousedown/up)
   - Coordinates all sub-components

2. **MapLegend.vue** (~88 lines)
   - Color scale legend display
   - Responsive positioning (desktop/mobile)
   - Receives color function and max votes as props

3. **SelectedInfo.vue** (~230 lines)
   - Displays selected lists/candidates panel
   - Mobile-responsive toggle functionality
   - Groups items by party with vote totals
   - Accepts pre-computed grouped data

#### Composables (src/composables/)
1. **useMapInteraction.ts** (~220 lines)
   - Core map interaction logic
   - Vote calculations (candidates and lists)
   - Color computation with chroma.js
   - Data grouping functions
   - Type-safe with full TypeScript support

2. **useTooltipContent.ts** (~70 lines)
   - Tooltip HTML generation
   - Separate functions for candidate and list tooltips
   - Consistent formatting logic

#### Index Files
- **src/components/map/index.ts**: Exports all map components and types
- **src/composables/index.ts**: Exports all composables and types

## Architecture Decisions

### 1. Composition API with TypeScript
All new components use `<script setup lang="ts">` for:
- Better type inference
- Reduced boilerplate
- Improved IDE support
- Cleaner code organization

### 2. Composables for Business Logic
Extracted shared logic into composables to:
- Separate concerns (UI vs. logic)
- Enable unit testing
- Promote reusability
- Improve maintainability

### 3. Props vs. Computed Refs in Composables
Composables receive `ComputedRef<T>` instead of raw values to:
- Maintain reactivity
- Allow composables to respond to prop changes
- Follow Vue 3 best practices

### 4. Component Hierarchy
```
ElectoralMap.vue (Main Container)
├── MapLegend.vue (Legend Display)
└── SelectedInfo.vue (Selection Panel)
    └── Mobile Toggle (Integrated)

Composables:
├── useMapInteraction.ts (Core Logic)
└── useTooltipContent.ts (Tooltip Generation)
```

## Key Features Maintained

1. **Leaflet Map Integration**
   - Map initialization with custom center/zoom
   - GeoJSON layer rendering
   - Dynamic styling based on votes
   - Auto-fitting to bounds

2. **Heat Map Visualization**
   - Color scale using chroma.js
   - Dynamic max vote calculation
   - Support for both lists and candidates
   - Smooth color gradients

3. **Interactive Features**
   - Hover tooltips with detailed vote breakdown
   - Click selection of neighborhoods
   - Darker color on hover (shade effect)
   - Click effect (opacity change)

4. **Responsive Design**
   - Desktop: Fixed position panels
   - Mobile: Slide-up toggle panel
   - Adaptive legend positioning
   - Touch-friendly scrolling

5. **Data Grouping**
   - Groups lists by party
   - Groups candidates by party
   - Sorts by total votes (descending)
   - Proper party name formatting

## Component APIs

### ElectoralMap.vue
```typescript
interface Props {
  regionName: string;
  selectedLists: string[];
  votosPorListas: Record<string, Record<string, number>>;
  maxVotosPorListas: Record<string, number>;
  getVotosForNeighborhood: (neighborhood: string) => number;
  geojsonData: any;
  selectedNeighborhood: string | null;
  isODN: boolean;
  partiesAbbrev: Record<string, string>;
  partiesByList: Record<string, string>;
  precandidatosByList: Record<string, string>;
  selectedCandidates: string[];
  mapCenter: [number, number];
  mapZoom: number;
}

interface Emits {
  updateSelectedNeighborhood: [neighborhood: string | null];
  mapInitialized: [];
}
```

### MapLegend.vue
```typescript
interface Props {
  show: boolean;
  maxVotes: number;
  getColor: (votes: number) => string;
}
```

### SelectedInfo.vue
```typescript
interface PartyData {
  totalVotes: number;
  lists?: { number: string; votes: number }[];
  candidates?: { name: string; votes: number }[];
}

interface Props {
  groupedItems: Record<string, PartyData>;
  totalVotes: number;
  showCandidates: boolean;
}
```

## Migration Guide

### For App.vue (Already Updated)
```typescript
// Before
import RegionMap from "./components/RegionMap.vue";

// After
import ElectoralMap from "./components/map/ElectoralMap.vue";

// Usage remains the same, just rename the component
<ElectoralMap :regionName="..." ... />
```

### For Future Components
```typescript
// Import individual components
import { ElectoralMap, MapLegend, SelectedInfo } from '@/components/map';

// Import composables
import { useMapInteraction, useTooltipContent } from '@/composables';

// Import types
import type { PartyData, CandidateVote } from '@/composables';
```

## File Structure
```
src/
├── components/
│   ├── map/
│   │   ├── ElectoralMap.vue       (Main container - 380 lines)
│   │   ├── MapLegend.vue          (Legend - 88 lines)
│   │   ├── SelectedInfo.vue       (Selection panel - 230 lines)
│   │   └── index.ts               (Exports)
│   ├── ListSelector.vue
│   ├── RegionSelector.vue
│   └── RegionMap.vue.backup       (Original file - backup)
├── composables/
│   ├── useMapInteraction.ts       (Core logic - 220 lines)
│   ├── useTooltipContent.ts       (Tooltips - 70 lines)
│   └── index.ts                   (Exports)
└── App.vue                         (Updated to use ElectoralMap)
```

## Testing Considerations

### Unit Testing
Each composable can now be tested independently:
```typescript
import { useMapInteraction } from '@/composables';

describe('useMapInteraction', () => {
  it('calculates candidate votes correctly', () => {
    // Test getCandidateVotesForNeighborhood
  });

  it('groups lists by party', () => {
    // Test groupListsByParty
  });
});
```

### Component Testing
Components can be tested with mocked composables:
```typescript
import { mount } from '@vue/test-utils';
import MapLegend from '@/components/map/MapLegend.vue';

describe('MapLegend', () => {
  it('renders legend items correctly', () => {
    const wrapper = mount(MapLegend, {
      props: {
        show: true,
        maxVotes: 1000,
        getColor: (votes) => '#ff0000'
      }
    });
    // Assertions
  });
});
```

## Performance Improvements

1. **Smaller Bundle Size**: Each component can be tree-shaken if imported individually
2. **Better Code Splitting**: Components can be lazy-loaded if needed
3. **Optimized Re-renders**: Smaller components = more targeted updates
4. **Computed Props**: Heavy calculations cached in composables

## Future Enhancements

### Potential Improvements
1. **Lazy Loading**: Load SelectedInfo only when needed
2. **Web Workers**: Move heavy vote calculations to workers
3. **Virtual Scrolling**: For long lists in SelectedInfo
4. **Map Markers**: Add custom markers for selected neighborhoods
5. **Export Functionality**: Export map as image or data

### Additional Composables
1. **useMapControls**: Extract zoom/pan controls
2. **useMapExport**: Map screenshot/export functionality
3. **useMapFilters**: Advanced filtering logic
4. **useMapAnalytics**: Analytics and statistics

## Configuration Changes

### vite.config.js
Added path alias support:
```javascript
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

## Breaking Changes
None. The API remains identical to the original RegionMap.vue component.

## Rollback Plan
If issues arise, the original file is preserved as:
```
src/components/RegionMap.vue.backup
```

To rollback:
1. Rename `RegionMap.vue.backup` to `RegionMap.vue`
2. Update App.vue import back to `./components/RegionMap.vue`
3. Remove the `map/` directory and `composables/` directory

## Build Verification
The refactored code has been verified to build successfully:
```bash
npm run build
# ✓ built in 1.71s
# No errors or warnings
```

## Benefits Summary

1. **Maintainability**: Smaller, focused components are easier to understand and modify
2. **Testability**: Business logic separated into testable composables
3. **Reusability**: Components and composables can be used elsewhere
4. **Type Safety**: Full TypeScript support with proper type exports
5. **Developer Experience**: Better IDE autocomplete and error checking
6. **Code Organization**: Clear separation of concerns
7. **Performance**: Optimized re-rendering and bundle size
8. **Scalability**: Easy to add new features without bloating files

## Contributors
- Refactored by: vue-frontend-agent
- Date: 2026-01-30
- Original: RegionMap.vue (1027 lines)
- Result: 4 components + 2 composables (~988 total lines with better organization)
