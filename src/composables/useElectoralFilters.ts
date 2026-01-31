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

    const selectedPartyName = selectedParty.value.replace('Partido ', '');
    const byList = toValue(options.partiesByList) || {};
    const lists = toValue(options.lists) || [];

    return lists.filter(
      (list) => byList[list] === selectedPartyName
    );
  });

  const filteredCandidates = computed(() => {
    if (!selectedParty.value) return toValue(options.candidates) || [];

    const selectedPartyName = selectedParty.value.replace('Partido ', '');
    const byParty = toValue(options.candidatesByParty) || {};
    const candidates = toValue(options.candidates) || [];

    return candidates.filter(
      (candidate) => byParty[candidate] === selectedPartyName
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
