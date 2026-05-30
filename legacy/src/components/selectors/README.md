# List Selector Components

This directory contains the refactored ListSelector component, split into smaller, maintainable components.

## Component Structure

### ListSelectorContainer.vue (265 lines)
**Main container component** that orchestrates all child components and manages the overall state.

**Props:**
- `lists`: Array of available lists
- `isODN`: Boolean flag for ODD/ODN data source
- `partiesAbbrev`: Dictionary of party abbreviations
- `selectedParty`: Currently selected party
- `partiesByList`: Mapping of lists to parties
- `precandidatosByList`: Mapping of lists to candidates
- `candidates`: Array of all candidates
- `candidatesByParty`: Mapping of candidates to parties
- `selectedLists`: Array of selected lists
- `selectedCandidates`: Array of selected candidates

**Emits:**
- `update:selectedLists`: Emits when selected lists change
- `update:selectedCandidates`: Emits when selected candidates change
- `updateIsODN`: Emits when data source changes
- `updateSelectedParty`: Emits when party selection changes
- `listsSelected`: Emits when lists are selected/filtered

**Features:**
- Mobile-responsive with toggle button
- Integrates all child components
- Uses `useElectoralFilters` composable for filtering logic

### DataSourceToggle.vue (67 lines)
**ODD/ODN data source toggle component**

**Props:**
- `modelValue`: Boolean (false = ODD, true = ODN)

**Emits:**
- `update:modelValue`: Emits when data source changes

**Features:**
- Radio button toggle between ODD and ODN
- Tailwind CSS styled
- Accessible with proper ARIA attributes

### PartyFilter.vue (34 lines)
**Party filter dropdown component**

**Props:**
- `modelValue`: Currently selected party string
- `parties`: Array of available parties

**Emits:**
- `update:modelValue`: Emits when party selection changes

**Features:**
- Simple dropdown select
- "All parties" option
- Fully typed with TypeScript

### ListGrid.vue (106 lines)
**Lists grid with search and select-all functionality**

**Props:**
- `lists`: Array of all available lists
- `selectedLists`: Array of currently selected lists
- `filteredLists`: Array of filtered lists (after search/party filter)
- `disableSelection`: Boolean to disable selection (when candidates are selected)

**Emits:**
- `update:selectedLists`: Emits when list selection changes
- `update:searchQuery`: Emits when search query changes

**Features:**
- Search functionality for list numbers
- Select all/deselect all checkbox
- Grid layout (2 columns)
- v-memo optimization for performance
- No results message

### CandidateGrid.vue (55 lines)
**Candidates grid component**

**Props:**
- `filteredCandidates`: Array of filtered candidates (after party filter)
- `selectedCandidates`: Array of currently selected candidates
- `disableSelection`: Boolean to disable selection (when lists are selected)

**Emits:**
- `update:selectedCandidates`: Emits when candidate selection changes

**Features:**
- Grid layout (2 columns)
- v-memo optimization for performance
- No results message
- Mutually exclusive with list selection

## Composable

### useElectoralFilters.ts (86 lines)
**Composable for electoral data filtering logic**

**Parameters:**
```typescript
interface UseElectoralFiltersOptions {
  lists: string[];
  candidates: string[];
  partiesAbbrev: Record<string, string>;
  partiesByList: Record<string, string>;
  candidatesByParty: Record<string, string>;
}
```

**Returns:**
- `searchQuery`: Ref for search input
- `selectedParty`: Ref for selected party
- `filteredLists`: Ref for filtered lists array
- `uniqueParties`: Computed array of unique parties
- `filteredListsByParty`: Computed lists filtered by party
- `filteredCandidates`: Computed candidates filtered by party
- `filterLists()`: Method to trigger list filtering
- `resetFilters()`: Method to reset all filters

**Features:**
- Debounced search (300ms)
- Party-based filtering
- Search query filtering
- Reactive watchers for auto-filtering

## Migration from Original ListSelector.vue

### Before (597 lines)
Single monolithic component with all functionality mixed together.

### After (613 lines total, split into 6 files)
- **DataSourceToggle.vue**: 67 lines
- **PartyFilter.vue**: 34 lines
- **ListGrid.vue**: 106 lines
- **CandidateGrid.vue**: 55 lines
- **ListSelectorContainer.vue**: 265 lines
- **useElectoralFilters.ts**: 86 lines

### Benefits
1. **Maintainability**: Each component has a single responsibility
2. **Reusability**: Components can be reused independently
3. **Testability**: Smaller components are easier to test
4. **Readability**: Clearer structure and organization
5. **Type Safety**: Full TypeScript support with proper typing
6. **Performance**: v-memo optimization in list/candidate grids
7. **Separation of Concerns**: UI components separated from business logic

## Usage Example

```vue
<template>
  <ListSelectorContainer
    :lists="availableLists"
    :isODN="isODN"
    :partiesAbbrev="partiesAbbrev"
    :selectedParty="selectedParty"
    :partiesByList="currentPartiesByList"
    :candidates="uniqueSortedCandidates"
    :precandidatosByList="precandidatosByList"
    :candidatesByParty="candidatesByParty"
    v-model:selectedLists="selectedLists"
    v-model:selectedCandidates="selectedCandidates"
    @updateIsODN="updateIsODN"
    @updateSelectedParty="updateSelectedParty"
  />
</template>

<script setup lang="ts">
import { ListSelectorContainer } from '@/components/selectors';
// ... rest of your code
</script>
```

## File Structure

```
src/
├── components/
│   ├── selectors/
│   │   ├── DataSourceToggle.vue
│   │   ├── PartyFilter.vue
│   │   ├── ListGrid.vue
│   │   ├── CandidateGrid.vue
│   │   ├── ListSelectorContainer.vue
│   │   ├── index.ts
│   │   └── README.md
│   ├── ListSelector.vue.backup (original backup)
│   └── ... other components
└── composables/
    ├── useElectoralFilters.ts
    └── index.ts
```

## Styling

All components use **Tailwind CSS** utility classes for styling, ensuring consistency and reducing the need for custom CSS. The mobile-responsive behavior is preserved with custom CSS for specific breakpoints.

## Mobile Behavior

- On mobile devices (< 768px), the selector panel is hidden by default
- Toggle button appears at the bottom to show/hide the panel
- Panel slides in from the top when activated
- Optimized for touch interactions

## Future Enhancements

1. Consider migrating more state to Pinia store
2. Add unit tests for each component
3. Add Storybook stories for component documentation
4. Implement virtual scrolling for large lists
5. Add keyboard navigation support
6. Add accessibility improvements (ARIA labels, focus management)
