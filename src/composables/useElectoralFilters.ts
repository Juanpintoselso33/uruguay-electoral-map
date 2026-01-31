import { ref, computed, watch } from 'vue';
import { useDebounce } from '@vueuse/core';

interface UseElectoralFiltersOptions {
  lists: string[];
  candidates: string[];
  partiesAbbrev: Record<string, string>;
  partiesByList: Record<string, string>;
  candidatesByParty: Record<string, string>;
}

export function useElectoralFilters(options: UseElectoralFiltersOptions) {
  const searchQuery = ref('');
  const selectedParty = ref('');
  const filteredLists = ref<string[]>([]);

  // Computed properties
  const uniqueParties = computed(() => {
    return Object.keys(options.partiesAbbrev)
      .map((party) => (party.startsWith('Partido ') ? party : `Partido ${party}`))
      .sort();
  });

  const filteredListsByParty = computed(() => {
    if (!selectedParty.value) return options.lists;

    const selectedPartyName = selectedParty.value.replace('Partido ', '');

    return options.lists.filter(
      (list) => options.partiesByList[list] === selectedPartyName
    );
  });

  const filteredCandidates = computed(() => {
    if (!selectedParty.value) return options.candidates;

    const selectedPartyName = selectedParty.value.replace('Partido ', '');

    return options.candidates.filter(
      (candidate) => options.candidatesByParty[candidate] === selectedPartyName
    );
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

  watch(debouncedSearchQuery, filterLists);

  watch(filteredListsByParty, (newFilteredLists) => {
    filteredLists.value = newFilteredLists;
  });

  watch([() => searchQuery.value, () => selectedParty.value], filterLists);

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
