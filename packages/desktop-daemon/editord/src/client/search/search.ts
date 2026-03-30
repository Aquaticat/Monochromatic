/**
 * Search execution logic for the search overlay.
 *
 * Handles debounced search scheduling, content-only filtering,
 * and generation-based stale result discarding.
 */

import type { SearchResult, } from '../../../protocol.ts';
import {
  createDebounced,
  type DebouncedHandle,
} from '../debounce.ts';
import {
  l as rootLogger,
  tagged,
} from '../log.ts';

/** Tagged logger for the search subsystem. */
const l = tagged({
  tag: 'search-overlay-search',
  l: rootLogger,
},);

/** Debounce delay for search input in milliseconds. */
const DEBOUNCE_MS = 150;

/** Mutable search state shared between the overlay and this module. */
export type SearchState = {
  /** Debounced search handle. */
  debouncedSearch: DebouncedHandle | null;
  /** Monotonic counter for stale result detection. */
  searchGeneration: number;
};

/**
 * Creates a debounced search handle for use in a `SearchState`.
 *
 * @param execute - callback to execute the search
 *
 * @returns debounced handle
 */
export function createSearchDebounce(
  { execute, }: { execute: () => void; },
): DebouncedHandle {
  return createDebounced({
    fn: execute,
    delayMs: DEBOUNCE_MS,
  },);
}

/**
 * Schedules a debounced search after the user types.
 *
 * @param state - mutable search state
 *
 * @param execute - callback to execute the search
 */
export function scheduleSearch({
  state,
  execute,
}: {
  state: SearchState;
  execute: () => void;
},): void {
  state.debouncedSearch ??= createSearchDebounce({ execute, },);
  state.debouncedSearch.debounced();
}

/**
 * Performs a search with content-only filtering and generation tracking.
 *
 * @param raw - raw input value
 *
 * @param state - mutable search state for generation tracking
 *
 * @param onSearch - callback that performs the actual search
 *
 * @param onResults - callback to render results
 */
export async function performSearch({
  raw,
  state,
  onSearch,
  onResults,
}: {
  raw: string;
  state: SearchState;
  onSearch: (query: string,) => Promise<SearchResult[]>;
  onResults: (opts: {
    results: SearchResult[];
    query: string;
  },) => void;
},): Promise<void> {
  if (raw.trim() === '') {
    onResults({
      results: [],
      query: '',
    },);
    return;
  }
  const isContentOnly = raw.startsWith('%',);
  const query = isContentOnly ? raw.slice(1,).trim() : raw.trim();
  if (query === '') {
    onResults({
      results: [],
      query: '',
    },);
    return;
  }
  const generation = ++state.searchGeneration;
  try {
    const results = await onSearch(query,);
    if (generation !== state.searchGeneration)
      return;
    const filtered = isContentOnly
      ? results.filter(function isContent(r,) {
        return r.kind === 'content';
      },)
      : results;
    onResults({
      results: filtered,
      query,
    },);
  }
  catch (error) {
    if (generation !== state.searchGeneration)
      return;
    l.error(`search failed: ${String(error,)}`,);
    onResults({
      results: [],
      query,
    },);
  }
}
