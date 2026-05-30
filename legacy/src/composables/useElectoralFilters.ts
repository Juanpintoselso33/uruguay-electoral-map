import { ref, computed, watch, Ref } from 'vue';
import { useDebounce } from '@vueuse/core';
import { MaybeRefOrGetter, toValue } from '@vueuse/core';

interface UseElectoralFiltersOptions {
  lists: MaybeRefOrGetter<string[]>;
  candidates: MaybeRefOrGetter<string[]>;
  partiesAbbrev: MaybeRefOrGetter<Record<string, string>>;
  partiesByList: MaybeRefOrGetter<Record<string, string>>;
  candidatesByParty: MaybeRefOrGetter<Record<string, string>>;
}

/**
 * Normalize party name for comparison
 * Removes "Partido " prefix (case-insensitive) and converts to lowercase
 */
function normalizePartyName(partyName: string): string {
  if (!partyName) return '';

  return partyName
    .trim()
    .toLowerCase()
    .replace(/^partido\s+/i, '');  // Remove "Partido " or "partido " prefix
}

export function useElectoralFilters(options: UseElectoralFiltersOptions) {
  const searchQuery = ref('');
  const selectedParty = ref('');
  const filteredLists = ref<string[]>([]);

  // Computed properties that properly unwrap the refs
  const uniqueParties = computed(() => {
    const abbrev = toValue(options.partiesAbbrev) || {};
    return Object.keys(abbrev)
      .map((party) => (party.startsWith('Partido ') ? party : `Partido ${party}`))
      .sort();
  });

  const filteredListsByParty = computed(() => {
    if (!selectedParty.value) return toValue(options.lists) || [];

    const selectedPartyName = normalizePartyName(selectedParty.value);
    const byList = toValue(options.partiesByList) || {};
    const lists = toValue(options.lists) || [];

    console.log('[useElectoralFilters] =========================================');
    console.log('[useElectoralFilters] Filtering lists by party');
    console.log('[useElectoralFilters] Selected (display):', selectedParty.value);
    console.log('[useElectoralFilters] Selected (normalized):', selectedPartyName);
    console.log('[useElectoralFilters] Total lists available:', lists.length);

    // Debug: Show sample of how parties appear in data
    const sampleLists = lists.slice(0, 5);
    console.log('[useElectoralFilters] Sample data:',
      sampleLists.map(list => ({
        list,
        partyRaw: byList[list],
        partyNormalized: normalizePartyName(byList[list])
      }))
    );

    const filtered = lists.filter((list) => {
      const listParty = normalizePartyName(byList[list]);
      const matches = listParty === selectedPartyName;
      if (matches) {
        console.log(`[useElectoralFilters] ✅ List ${list} matches: "${listParty}" === "${selectedPartyName}"`);
      }
      return matches;
    });

    console.log('[useElectoralFilters] Filtered lists count:', filtered.length);

    // If no matches, show what normalized parties exist in data
    if (filtered.length === 0) {
      const allPartiesNormalized = [...new Set(
        Object.values(byList).map(p => normalizePartyName(p))
      )].sort();
      console.warn('[useElectoralFilters] ❌ No matches found!');
      console.warn('[useElectoralFilters] All normalized parties in data:', allPartiesNormalized);
      console.warn('[useElectoralFilters] Looking for:', selectedPartyName);
    }

    console.log('[useElectoralFilters] =========================================');
    return filtered;
  });

  const filteredCandidates = computed(() => {
    if (!selectedParty.value) return toValue(options.candidates) || [];

    const selectedPartyName = normalizePartyName(selectedParty.value);
    const byParty = toValue(options.candidatesByParty) || {};
    const candidates = toValue(options.candidates) || [];

    console.log('[useElectoralFilters] Filtering candidates by party:', selectedPartyName);
    console.log('[useElectoralFilters] Total candidates available:', candidates.length);

    const filtered = candidates.filter((candidate) => {
      const candidateParty = normalizePartyName(byParty[candidate]);
      const matches = candidateParty === selectedPartyName;
      if (matches) {
        console.log(`[useElectoralFilters] ✅ Candidate "${candidate}" matches: "${candidateParty}" === "${selectedPartyName}"`);
      }
      return matches;
    });

    console.log('[useElectoralFilters] Filtered candidates count:', filtered.length);

    if (filtered.length === 0) {
      const allCandidateParties = [...new Set(
        Object.values(byParty).map(p => normalizePartyName(p))
      )].sort();
      console.warn('[useElectoralFilters] No candidates found for party:', selectedPartyName);
      console.warn('[useElectoralFilters] Available parties for candidates:', allCandidateParties);
    }

    return filtered;
  });

  // Methods
  const filterLists = () => {
    const validLists = filteredListsByParty.value.filter(
      (list) => list !== undefined && list !== null
    );

    filteredLists.value = searchQuery.value
      ? validLists.filter((list) => list.includes(searchQuery.value.trim()))
      : validLists;
  };

  const resetFilters = () => {
    searchQuery.value = '';
    selectedParty.value = '';
  };

  // Watchers
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Watch debounced search query
  watch(debouncedSearchQuery, filterLists);

  // Watch party and search changes together
  // Removed duplicate watcher that was causing race condition
  watch([() => searchQuery.value, () => selectedParty.value], filterLists);

  // Initialize filtered lists
  filterLists();

  return {
    // State
    searchQuery,
    selectedParty,
    filteredLists,

    // Computed
    uniqueParties,
    filteredListsByParty,
    filteredCandidates,

    // Methods
    filterLists,
    resetFilters,
  };
}
